const command=process.argv[2]||'health'
const url=(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'').replace(/\/$/,'')
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||''
const workerSecret=process.env.MOBILE_PUSH_WORKER_SECRET||''
const die=m=>{console.error(m);process.exit(2)}
if(!url)die('SUPABASE_URL (or VITE_SUPABASE_URL) is required.')
if(command==='worker'){
  if(!service||!workerSecret)die('SUPABASE_SERVICE_ROLE_KEY and MOBILE_PUSH_WORKER_SECRET are required for worker execution.')
  const r=await fetch(`${url}/functions/v1/mobile-push-worker`,{method:'POST',headers:{authorization:`Bearer ${service}`,apikey:service,'x-mobile-push-worker-secret':workerSecret}})
  const body=await r.text();console.log(body);if(!r.ok)process.exit(1)
}else if(command==='health'){
  if(!service)die('SUPABASE_SERVICE_ROLE_KEY is required for private queue health.')
  const r=await fetch(`${url}/rest/v1/rpc/mobile_push_outbox_health`,{method:'POST',headers:{authorization:`Bearer ${service}`,apikey:service,'content-type':'application/json'},body:'{}'})
  const body=await r.text();console.log(body);if(!r.ok)process.exit(1)
}else die('Usage: node scripts/mobile-push-ops.mjs <health|worker>')
