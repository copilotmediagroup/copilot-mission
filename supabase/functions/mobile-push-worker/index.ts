import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-mobile-push-worker-secret'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
const key=(...names:string[])=>{for(const name of names){const value=Deno.env.get(name);if(value)return value}return''}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
  const url=Deno.env.get('SUPABASE_URL')||'',secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),workerSecret=Deno.env.get('MOBILE_PUSH_WORKER_SECRET')||''
  if(!url||!secret||!workerSecret)return json({error:'WORKER_NOT_CONFIGURED'},503)
  if(req.headers.get('x-mobile-push-worker-secret')!==workerSecret)return json({error:'UNAUTHORIZED'},401)
  const admin=createClient(url,secret)
  const {data:claims,error:claimError}=await admin.rpc('claim_mobile_push_outbox',{p_limit:25,p_stale_after_seconds:300})
  if(claimError)return json({error:'CLAIM_FAILED'},500)
  let delivered=0,failed=0
  for(const claim of claims||[]){
    const notificationId=String(claim.notification_id||''),claimToken=String(claim.claim_token||'');let ok=false,errorCode='DELIVERY_FAILED'
    try{
      const response=await fetch(`${url}/functions/v1/mobile-push-dispatch`,{method:'POST',headers:{authorization:`Bearer ${secret}`,apikey:secret,'content-type':'application/json','x-mobile-push-worker-secret':workerSecret},body:JSON.stringify({notification_id:notificationId})})
      const result=await response.json().catch(()=>({}))
      ok=response.ok&&Number(result?.delivered||0)>0
      errorCode=ok?'':response.status===409?'ROLE_BROADCAST_NOT_ALLOWED':response.ok?'NO_REGISTERED_DEVICE':'DISPATCH_FAILED'
    }catch{errorCode='DISPATCH_UNAVAILABLE'}
    const terminal=!ok&&(errorCode==='ROLE_BROADCAST_NOT_ALLOWED'||errorCode==='NO_REGISTERED_DEVICE')
    await admin.rpc('finish_mobile_push_outbox',{p_notification_id:notificationId,p_claim_token:claimToken,p_delivered:ok,p_error:ok?null:errorCode,p_terminal:terminal})
    if(ok)delivered++;else failed++
  }
  return json({claimed:(claims||[]).length,delivered,failed})
})
