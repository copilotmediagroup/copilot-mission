import { supabase } from '../../lib/supabase'

export type MarketplaceJobRow = {
  id: string
  title: string
  instructions: string | null
  status: 'open' | 'accepted' | 'assigned' | 'active' | 'completed' | 'cancelled'
  priority: 'standard' | 'priority' | 'emergency'
  accepted_agency_id: string | null
  accepted_at: string | null
  scheduled_for: string | null
  duration_minutes: number
  payout_cents: number | null
  required_guards: number
  created_at: string
  updated_at: string
  property?: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; photo_url?: string | null } | null
  client?: { display_name?: string } | null
}

export type MissionEventRow = {
  id: number
  job_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function getAgencyContext(_userId: string) {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_my_agency_context')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.agency_id) throw new Error('This account is not connected to an Agency Admin workspace.')
  return { agencyId: row.agency_id as string, name: row.agency_name ?? 'Your Agency', status: row.agency_status ?? 'pending' }
}

export async function getAgencyMarketplace(agencyId: string) {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_agency_marketplace')
  if (error) throw error
  const payload = (data ?? {}) as { agency_id?: string; jobs?: MarketplaceJobRow[] }
  if (payload.agency_id && payload.agency_id !== agencyId) throw new Error('Agency workspace changed. Refresh and sign in again.')
  const rows = Array.isArray(payload.jobs) ? payload.jobs : []
  return {
    open: rows.filter(job => job.status === 'open'),
    claimed: rows.filter(job => job.accepted_agency_id === agencyId && job.status !== 'open'),
  }
}

export async function getPlatformMarketplace() {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_platform_marketplace')
  if (error) throw error
  const payload = (data ?? {}) as { jobs?: MarketplaceJobRow[]; events?: MissionEventRow[]; onlineGuards?: number }
  return { jobs: Array.isArray(payload.jobs) ? payload.jobs : [], events: Array.isArray(payload.events) ? payload.events : [], onlineGuards: Number(payload.onlineGuards ?? 0) }
}

export async function acceptMarketplaceJob(jobId: string, agencyId: string) {
  const db = requireSupabase()
  const { data, error } = await db.rpc('accept_marketplace_job', { p_job_id: jobId, p_agency_id: agencyId })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  return { accepted: Boolean(result?.accepted), reason: (result?.reason as string | undefined) ?? null }
}

export function subscribeToMarketplace(onChange: () => void) {
  if (!supabase) return () => undefined
  const db = supabase
  const channel = db.channel(`marketplace-lifecycle-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_jobs' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mission_events' }, onChange)
    .subscribe()
  return () => { void db.removeChannel(channel) }
}
