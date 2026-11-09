// Production live-account previews are read-only. Run complete test journeys
// against an isolated Supabase project; changing payment mode alone is unsafe.
let developerPreviewActive = false
const productionHost = 'eznhyemkuxectndxtymc.supabase.co'
export function setDeveloperPreviewActive(active: boolean) { developerPreviewActive = active }
export function developerRequestAllowed(input: RequestInfo | URL, init?: RequestInit) {
  if (!developerPreviewActive) return true
  const request = input instanceof Request ? input : null
  const url = new URL(request ? request.url : String(input))
  if (url.hostname !== productionHost) return true
  const method = (init?.method || request?.method || 'GET').toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
  // Token refresh/sign-out and secured media URL issuance do not change customer records.
  if (method === 'POST' && /^\/auth\/v1\/(token|logout)$/.test(url.pathname)) return true
  if (method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) return true
  // Existing read RPCs use POST; writes are denied before reaching Supabase.
  return method === 'POST' && /^\/rest\/v1\/rpc\/get_[a-z0-9_]+$/.test(url.pathname)
}
export async function developerSafeFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!developerRequestAllowed(input, init)) return new Response(JSON.stringify({
    message: 'Live-account preview is read-only on production. Use an isolated test backend for changes.',
    code: 'DEVELOPER_PRODUCTION_WRITE_BLOCKED',
  }), {status: 403, headers: {'content-type': 'application/json'}})
  return fetch(input, init)
}
