// Candidate atomic lifecycle. Requires the pending payment-operations migration.
// Do not deploy separately from that migration and its verified service-only RPCs.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {processAtomicPayment,type PaymentAction} from '../_shared/atomicPayment.ts'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return respond(405,{error:'POST required'})
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!anon||!service)return respond(503,{error:'backend configuration unavailable'})
  const userDb=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('authorization')||''}}})
  const {data,error}=await userDb.auth.getUser()
  if(error||!data.user)return respond(401,{error:'session required'})
  let body:any;try{body=await req.json()}catch{return respond(400,{error:'valid JSON required'})}
  const result=await processAtomicPayment(createClient(url,service),{
   jobId:String(body.jobId||''),action:String(body.action||'') as PaymentAction,
   actorId:data.user.id,...(body.amountCents!==undefined?{amountCents:body.amountCents}:{}),
  },{key:Deno.env.get('MAVERICK_PRIVATE_KEY')||Deno.env.get('NMI_SECURITY_KEY')||Deno.env.get('NMI_PRIVATE_KEY')||'',
   url:Deno.env.get('MAVERICK_NMI_ENDPOINT')||Deno.env.get('NMI_GATEWAY_URL')||'https://secure.nmi.com/api/transact.php'})
  return respond(result.http,result.body)
 }catch{return respond(503,{error:'payment lifecycle unavailable; reconcile any pending operation before retrying'})}
})
