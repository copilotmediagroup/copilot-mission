import { supabase } from '../../lib/supabase'

export type AgencyAdminStatus = 'pending' | 'approved' | 'suspended' | 'rejected'

export type AgencyAdminRow = {
  id: string
  name: string
  status: AgencyAdminStatus
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
  owner_account_status: string | null
  license_number: string | null
  service_radius_miles: number
  created_at: string
  approved_at: string | null
  suspended_at: string | null
  denial_reason: string | null
  suspension_reason: string | null
  guard_count: number
  online_guard_count: number
  active_mission_count: number
  completed_mission_count: number
}

export type AgencyAuditRow = {
  id: number
  agency_id: string
  action: string
  reason: string | null
  actor_name: string | null
  actor_user_id: string | null
  created_at: string
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function getPlatformAgencies(): Promise<{ agencies: AgencyAdminRow[]; audit: AgencyAuditRow[] }> {
  const { data, error } = await db().rpc('get_platform_agencies_rc1b')
  if (error) throw new Error(error.message)
  const payload = (data ?? {}) as { agencies?: AgencyAdminRow[]; audit?: AgencyAuditRow[] }
  return {
    agencies: Array.isArray(payload.agencies) ? payload.agencies : [],
    audit: Array.isArray(payload.audit) ? payload.audit : [],
  }
}

async function runAction(functionName: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(functionName, args)
  if (error) throw new Error(error.message)
  return data as { success?: boolean; agency_id?: string; status?: AgencyAdminStatus }
}

export const approveAgency = (agencyId: string) => runAction('approve_agency_rc1b', { p_agency_id: agencyId })
export const denyAgency = (agencyId: string, reason: string) => runAction('deny_agency_rc1b', { p_agency_id: agencyId, p_reason: reason })
export const suspendAgency = (agencyId: string, reason: string) => runAction('suspend_agency_rc1b', { p_agency_id: agencyId, p_reason: reason })
export const reactivateAgency = (agencyId: string) => runAction('reactivate_agency_rc1b', { p_agency_id: agencyId })
