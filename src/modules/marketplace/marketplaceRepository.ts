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
  property?: { name?: string; address?: string; latitude?: number | null; longitude?: number | null } | null
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

export async function getAgencyContext(userId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('agency_members')
    .select('agency_id,agencies(id,name,status)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single()
  if (error) throw error
  const agency = Array.isArray(data.agencies) ? data.agencies[0] : data.agencies
  return { agencyId: data.agency_id as string, name: agency?.name ?? 'Your Agency', status: agency?.status ?? 'pending' }
}

export async function getAgencyMarketplace(agencyId: string) {
  const db = requireSupabase()
  const { data, error } = await db
    .from('marketplace_jobs')
    .select('id,title,instructions,status,priority,accepted_agency_id,accepted_at,scheduled_for,duration_minutes,payout_cents,required_guards,created_at,updated_at,property:properties(name,address,latitude,longitude),client:clients(display_name)')
    .or(`status.eq.open,accepted_agency_id.eq.${agencyId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as MarketplaceJobRow[]
  return {
    open: rows.filter(job => job.status === 'open'),
    claimed: rows.filter(job => job.accepted_agency_id === agencyId && job.status !== 'open'),
  }
}

export async function getPlatformMarketplace() {
  const db = requireSupabase()
  const [{ data: jobs, error: jobsError }, { data: events, error: eventsError }, { count: onlineGuards, error: guardsError }] = await Promise.all([
    db.from('marketplace_jobs').select('id,title,instructions,status,priority,accepted_agency_id,accepted_at,scheduled_for,duration_minutes,payout_cents,required_guards,created_at,updated_at,property:properties(name,address,latitude,longitude),client:clients(display_name)').order('created_at', { ascending: false }).limit(100),
    db.from('mission_events').select('id,job_id,event_type,payload,created_at').order('created_at', { ascending: false }).limit(40),
    db.from('guards').select('*', { count: 'exact', head: true }).neq('availability', 'offline'),
  ])
  if (jobsError) throw jobsError
  if (eventsError) throw eventsError
  if (guardsError) throw guardsError
  return { jobs: (jobs ?? []) as unknown as MarketplaceJobRow[], events: (events ?? []) as MissionEventRow[], onlineGuards: onlineGuards ?? 0 }
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
