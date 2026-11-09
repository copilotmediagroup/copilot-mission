// Candidate worker: disabled by default, service-authenticated, not deployed or scheduled.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {runServerCaptureBatch} from '../_shared/atomicPayment.ts'
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
Deno.serve(async req=>{
 if(req.method!=='POST')return json(405,{error:'POST required'})
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!serviceKey||req.headers.get('authorization')!==`Bearer ${serviceKey}`)return json(401,{error:'service authentication required'})
 if(Deno.env.get('MAVERICK_CAPTURE_WORKER_ENABLED')!=='true')return json(200,{paused:true,processed:0})
 const key=Deno.env.get('MAVERICK_PRIVATE_KEY')||Deno.env.get('NMI_SECURITY_KEY')||Deno.env.get('NMI_PRIVATE_KEY')
 if(!key)return json(503,{error:'processor key not configured'})
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey)
  const results=await runServerCaptureBatch(db,{key,url:Deno.env.get('MAVERICK_NMI_ENDPOINT')||Deno.env.get('NMI_GATEWAY_URL')||'https://secure.nmi.com/api/transact.php'})
  return json(200,{processed:results.length,results})
 }catch(error){return json(503,{error:error instanceof Error?error.message:'capture worker failed'})}
})
