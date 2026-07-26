import { supabase } from '../../lib/supabase'

export type LocationFreshness = 'none' | 'live' | 'stale' | 'expired'
export type GuardAvailability = 'offline' | 'available' | 'reserved' | 'on_mission'

export type GuardLocationState = {
  guard_id: string
  agency_id: string
  availability: GuardAvailability
  latitude: number | null
  longitude: number | null
  last_location_at: string | null
  freshness: LocationFreshness
}

export type LiveGuardLocation = GuardLocationState & {
  user_id?: string
  name: string
  agency_name?: string
}

export type PublishedGuardLocation = {
  guard_id: string
  agency_id: string
  job_id: string | null
  latitude: number
  longitude: number
  accuracy_meters: number | null
  captured_at: string
  freshness: 'live'
}

export type RoutePoint = {
  latitude: number
  longitude: number
  accuracy_meters: number | null
  heading_degrees: number | null
  speed_mps: number | null
  captured_at: string
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function publishGuardLocation(input: {
  latitude: number
  longitude: number
  accuracyMeters?: number | null
  headingDegrees?: number | null
  speedMps?: number | null
  capturedAt?: string
  jobId?: string | null
}): Promise<PublishedGuardLocation> {
  const { data, error } = await db().rpc('publish_guard_location', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_meters: input.accuracyMeters ?? null,
    p_heading_degrees: input.headingDegrees ?? null,
    p_speed_mps: input.speedMps ?? null,
    p_captured_at: input.capturedAt ?? new Date().toISOString(),
    p_job_id: input.jobId ?? null,
  })
  if (error) throw new Error(error.message)
  return data as PublishedGuardLocation
}

export async function getGuardLocationState(): Promise<GuardLocationState> {
  const { data, error } = await db().rpc('get_guard_location_state')
  if (error) throw new Error(error.message)
  return data as GuardLocationState
}

export async function getAgencyLiveLocations(): Promise<LiveGuardLocation[]> {
  const { data, error } = await db().rpc('get_agency_live_locations')
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as LiveGuardLocation[] : []
}

export async function getPlatformLiveLocations(): Promise<LiveGuardLocation[]> {
  const { data, error } = await db().rpc('get_platform_live_locations')
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as LiveGuardLocation[] : []
}

export async function getMissionRouteHistory(jobId: string): Promise<RoutePoint[]> {
  const { data, error } = await db().rpc('get_mission_route_history', { p_job_id: jobId })
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as RoutePoint[] : []
}

export function subscribeToLocationChanges(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase.channel(`live-location-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guards' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guard_location_points' }, onChange)
    .subscribe()
  return () => { void supabase?.removeChannel(channel) }
}
