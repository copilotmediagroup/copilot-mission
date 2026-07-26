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

export type AgencyWorkspace = { agencyId: string; name: string; status: string; open: MarketplaceJobRow[]; claimed: MarketplaceJobRow[] }

export async function getAgencyWorkspace(): Promise<AgencyWorkspace> {
  const db = requireSupabase()
  const { data, error } = await db.rpc('get_agency_workspace_rc1a')
  if (error) throw new Error(error.message)
  const payload = (data ?? {}) as { agency?: { id?: string; name?: string; status?: string }; jobs?: MarketplaceJobRow[] }
  const agencyId = payload.agency?.id
  if (!agencyId) throw new Error('AGENCY_NOT_FOUND: No Agency workspace was returned.')
  const rows = Array.isArray(payload.jobs) ? payload.jobs : []
  return {
    agencyId,
    name: payload.agency?.name ?? 'Your Agency',
    status: payload.agency?.status ?? 'pending',
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

export async function acceptMarketplaceJob(jobId: string) {
  const db = requireSupabase()
  const { data, error } = await db.rpc('claim_marketplace_job_rc1a', { p_job_id: jobId })
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { accepted?: boolean; reason?: string | null }
  return { accepted: Boolean(result.accepted), reason: result.reason ?? null }
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
