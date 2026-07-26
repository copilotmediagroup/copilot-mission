import { supabase } from '../../lib/supabase'

export type CommandCenterSummary = {
  agencies_total: number
  agencies_pending: number
  clients_total: number
  properties_total: number
  guards_total: number
  guards_online: number
  guards_available: number
  missions_open: number
  missions_live: number
  missions_completed: number
  emergencies_live: number
}

export type CommandCenterAgency = {
  id: string; name: string; status: string; license_number: string | null; service_radius_miles: number
  created_at: string; owner_name: string | null; owner_status: string
  guard_count: number; online_guard_count: number; live_mission_count: number; completed_mission_count: number
}
export type CommandCenterProperty = {
  id: string; name: string; address: string; latitude: number | null; longitude: number | null
  photo_url: string | null; created_at: string; client_id: string; client_name: string
}
export type CommandCenterGuard = {
  id: string; name: string; badge_number: string | null; availability: 'offline'|'available'|'reserved'|'on_mission'
  agency_id: string; agency_name: string; latitude: number | null; longitude: number | null
  last_location_at: string | null; created_at: string
}
export type CommandCenterMission = {
  id: string; title: string; status: string; priority: string; scheduled_for: string | null
  created_at: string; updated_at: string; property_name: string; property_address: string; client_name: string
  agency_id: string | null; agency_name: string | null; guard_id: string | null; guard_name: string | null
  assignment_status: string | null; engine_state: string | null; checkpoint_index: number | null; engine_version: number | null
}
export type CommandCenterEvent = {
  id: number; job_id: string; event_type: string; payload: Record<string, unknown>; created_at: string
  mission_title: string; actor_name: string | null
}
export type CommandCenterSnapshot = {
  generated_at: string
  summary: CommandCenterSummary
  agencies: CommandCenterAgency[]
  properties: CommandCenterProperty[]
  guards: CommandCenterGuard[]
  missions: CommandCenterMission[]
  events: CommandCenterEvent[]
}

function requireSupabase() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase }

export async function getPlatformCommandCenter(): Promise<CommandCenterSnapshot> {
  const { data, error } = await requireSupabase().rpc('get_platform_command_center')
  if (error) throw new Error(error.message)
  return data as CommandCenterSnapshot
}

export function subscribeToCommandCenter(onChange: () => void) {
  if (!supabase) return () => undefined
  const db = supabase
  const channel = db.channel(`platform-command-center-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agencies' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guards' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_jobs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_engine_state' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mission_events' }, onChange)
    .subscribe()
  return () => { void db.removeChannel(channel) }
}
