import { supabase } from '../../lib/supabase'

export type LocationFreshness =
  | 'none'
  | 'live'
  | 'stale'
  | 'expired'

export type GuardLiveLocation = {
  guard_id: string
  name: string
  availability: string
  latitude: number | null
  longitude: number | null
  last_location_at: string | null
  freshness: LocationFreshness
  job_id: string | null
  mission_state: string | null
}

export type ClientLiveLocation = {
  job_id: string
  title: string
  property_name: string
  property_address: string
  property_latitude: number | null
  property_longitude: number | null
  guard_id: string
  guard_name: string
  availability: string
  latitude: number | null
  longitude: number | null
  last_location_at: string | null
  freshness: LocationFreshness
  mission_state: string | null
} | null

function db() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export async function publishGuardLocation(
  position: GeolocationPosition,
  jobId: string | null = null
) {
  const coords = position.coords

  const capturedAt = new Date(
    position.timestamp || Date.now()
  ).toISOString()

  const { data, error } = await db().rpc(
    'publish_guard_location',
    {
      p_latitude: coords.latitude,
      p_longitude: coords.longitude,
      p_accuracy_meters:
        Number.isFinite(coords.accuracy)
          ? coords.accuracy
          : null,
      p_heading_degrees:
        coords.heading != null &&
        Number.isFinite(coords.heading)
          ? coords.heading
          : null,
      p_speed_mps:
        coords.speed != null &&
        Number.isFinite(coords.speed)
          ? coords.speed
          : null,
      p_captured_at: capturedAt,
      p_job_id: jobId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getAgencyLiveLocations() {
  const { data, error } = await db().rpc(
    'get_agency_live_locations'
  )

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as GuardLiveLocation[]
}

export async function getClientLiveLocation() {
  const { data, error } = await db().rpc(
    'get_client_live_location'
  )

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? null) as ClientLiveLocation
}

export function subscribeToLocationChanges(
  onChange: () => void
) {
  if (!supabase) {
    return () => undefined
  }

  const channel = supabase
    .channel(`live-location-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'guards',
      },
      onChange
    )
    .subscribe()

  return () => {
    void supabase?.removeChannel(channel)
  }
}

export function startGuardLocationPublisher(input: {
  enabled: boolean
  jobId?: string | null
  onPublished?: () => void
  onError?: (message: string) => void
}) {
  if (
    !input.enabled ||
    !navigator.geolocation
  ) {
    return () => undefined
  }

  let lastPublishedAt = 0
  let lastLatitude: number | null = null
  let lastLongitude: number | null = null
  let publishing = false

  const watchId =
    navigator.geolocation.watchPosition(
      async position => {
        if (publishing) return

        const now = Date.now()
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        const firstSample =
          lastLatitude == null ||
          lastLongitude == null

        const moved =
          firstSample ||
          Math.abs(latitude - lastLatitude!) > 0.00003 ||
          Math.abs(longitude - lastLongitude!) > 0.00003

        const heartbeatDue =
          now - lastPublishedAt >= 5000

        if (!moved && !heartbeatDue) {
          return
        }

        publishing = true

        try {
          await publishGuardLocation(
            position,
            input.jobId ?? null
          )

          lastPublishedAt = now
          lastLatitude = latitude
          lastLongitude = longitude

          input.onPublished?.()
        } catch (error) {
          input.onError?.(
            error instanceof Error
              ? error.message
              : 'Unable to publish location'
          )
        } finally {
          publishing = false
        }
      },
      error => {
        input.onError?.(error.message)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 12000,
      }
    )

  return () => {
    navigator.geolocation.clearWatch(watchId)
  }
}
