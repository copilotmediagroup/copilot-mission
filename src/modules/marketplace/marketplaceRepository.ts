import { supabase } from '../../lib/supabase'

export type MarketplaceJobRow = {
  id: string
  title: string
  status: 'open' | 'accepted' | 'assigned' | 'active' | 'completed' | 'cancelled'
  priority: 'standard' | 'priority' | 'emergency'
  accepted_agency_id: string | null
}

export async function acceptMarketplaceJob(jobId: string, agencyId: string) {
  if (!supabase) return { mode: 'mock' as const, accepted: true, reason: null }
  const { data, error } = await supabase.rpc('accept_marketplace_job', {
    p_job_id: jobId,
    p_agency_id: agencyId,
  })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  return {
    mode: 'supabase' as const,
    accepted: Boolean(result?.accepted),
    reason: (result?.reason as string | undefined) ?? null,
  }
}

export function subscribeToOpenJobs(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase.channel('marketplace-open-jobs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_jobs' }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}
