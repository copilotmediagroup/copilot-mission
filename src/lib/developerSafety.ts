// Production live-account previews are read-only. Run complete test journeys
// against an isolated Supabase project; changing payment mode alone is unsafe.
let developerPreviewActive = false
// Reviewed read RPCs only. A get_ prefix does not guarantee absence of writes.
const productionPreviewReads = new Set([
  "get_client_account_for_platform_rc1",
  "get_developer_agency_dispatch_workspace_rc1",
  "get_developer_agency_documents_rc1",
  "get_developer_agency_guard_credentials_rc1",
  "get_developer_agency_messages_rc1",
  "get_developer_agency_reports_rc1",
  "get_developer_agency_settings_rc1",
  "get_developer_agency_workspace_rc2",
  "get_developer_client_live_tracking_rc15",
  "get_developer_client_reports_rc1",
  "get_developer_client_workspace_rc1",
  "get_developer_guard_evidence_upload_rc1",
  "get_developer_guard_messages_rc1",
  "get_developer_guard_operational_metrics_rc1",
  "get_developer_guard_reports_rc1",
  "get_developer_guard_settings_rc1",
  "get_developer_guard_slot_offer_rc1",
  "get_developer_guard_slot_runtime_rc1",
  "get_developer_guard_workspace_rc1",
  "get_developer_job_estimate_rc1",
  "get_developer_live_accounts_rc1",
  "get_guard_rating_summary",
  "get_mission_runtime_v2",
  "get_mission_evidence_for_report_rc2"
])
const productionHost = 'eznhyemkuxectndxtymc.supabase.co'
export function setDeveloperPreviewActive(active: boolean) { developerPreviewActive = active }
export function developerRequestAllowed(input: RequestInfo | URL, init?: RequestInit) {
  if (!developerPreviewActive) return true
  const request = input instanceof Request ? input : null
  const url = new URL(request ? request.url : String(input))
  if (url.hostname !== productionHost) return true
  const method = (init?.method || request?.method || 'GET').toUpperCase()
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)
  if (rpc) return ['GET','POST'].includes(method) && productionPreviewReads.has(rpc[1])
  if (url.pathname.startsWith('/functions/v1/')) return method==='GET' && url.pathname==='/functions/v1/maverick-payment-config'
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
  // Token refresh/sign-out and secured media URL issuance do not change customer records.
  if (method === 'POST' && /^\/auth\/v1\/(token|logout)$/.test(url.pathname)) return true
  if (method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) return true
  return false
}
export async function developerSafeFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!developerRequestAllowed(input, init)) return new Response(JSON.stringify({
    message: 'Live-account preview is read-only on production. Use an isolated test backend for changes.',
    code: 'DEVELOPER_PRODUCTION_WRITE_BLOCKED',
  }), {status: 403, headers: {'content-type': 'application/json'}})
  return fetch(input, init)
}
