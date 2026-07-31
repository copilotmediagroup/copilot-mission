import { supabase } from '../../lib/supabase'

export type LocationFreshness =
  | 'live'
  | 'stale'
  | 'expired'
  | 'waiting'
  | 'offline'

export type GuardLiveLocation = {
  guard_id: string
  name: string
  availability: 'offline' | 'available' | 'reserved' | 'on_mission'
  latitude: number | null
  longitude: number | null
  last_location_at: string | null
  freshness: LocationFreshness
  agency_id?: string
  agency_name?: string
}

export type LocationPoint = {
  latitude: number
  longitude: number
  accuracy_meters: number | null
  heading_degrees: number | null
  speed_mps: number | null
  recorded_at: string
}

export type PublishedLocation = {
  success: boolean
  guard_id: string
  agency_id: string
  job_id: string | null
  latitude: number
  longitude: number
  recorded_at: string
}

function db() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export async function publishGuardLocation(
  position: GeolocationPosition,
): Promise<PublishedLocation> {
  const {
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
  } = position.coords

  const { data, error } = await db().rpc('publish_guard_location_rc12', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_meters: Number.isFinite(accuracy) ? accuracy : null,
    p_heading_degrees:
      heading !== null && Number.isFinite(heading) ? heading : null,
    p_speed_mps:
      speed !== null && Number.isFinite(speed) ? speed : null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as PublishedLocation
}

/**
 * Compatibility export used by older app components.
 */
export const writeGuardLocation = publishGuardLocation

export async function getAgencyLiveLocations(): Promise<
  GuardLiveLocation[]
> {
  const { data, error } = await db().rpc(
    'get_agency_live_locations_rc12',
  )

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data)
    ? (data as GuardLiveLocation[])
    : []
}

export async function getPlatformLiveLocations(): Promise<
  GuardLiveLocation[]
> {
  const { data, error } = await db().rpc(
    'get_platform_live_locations_rc12',
  )

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data)
    ? (data as GuardLiveLocation[])
    : []
}

export async function getMissionRouteHistory(
  jobId: string,
): Promise<LocationPoint[]> {
  const { data, error } = await db().rpc(
    'get_mission_route_history_rc12',
    {
      p_job_id: jobId,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data)
    ? (data as LocationPoint[])
    : []
}

export function subscribeToGuardLocations(
  onChange: () => void,
) {
  if (!supabase) {
    return () => undefined
  }

  const channel = supabase
    .channel(`live-location-rc12-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'guards',
      },
      onChange,
    )
    .subscribe()

  return () => {
    void supabase?.removeChannel(channel)
  }
}

/**
 * Compatibility export used by AgencyMarketplace.
 */
export const subscribeToLiveLocations =
  subscribeToGuardLocations