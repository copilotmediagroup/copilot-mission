import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const respond=(status:number,payload:Record<string,unknown>)=>new Response(JSON.stringify(payload),{status,headers:{...cors,'content-type':'application/json'}})
const dollars=(cents:number)=>(Math.round(cents)/100).toFixed(2)
async function parseGatewayResponse(response:Response){const text=await response.text();try{return JSON.parse(text)}catch{return Object.fromEntries(new URLSearchParams(text))}}
function last4From(value:unknown){const digits=String(value||'').replace(/\D/g,'');return digits.length>=4?digits.slice(-4):null}
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return respond(405,{error:'method'});try{
const supabaseUrl=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const gatewayKey=Deno.env.get('MAVERICK_PRIVATE_KEY')||Deno.env.get('NMI_SECURITY_KEY')||Deno.env.get('NMI_PRIVATE_KEY')
const gatewayUrl=Deno.env.get('MAVERICK_NMI_ENDPOINT')||Deno.env.get('NMI_GATEWAY_URL')||'https://secure.nmi.com/api/transact.php'
if(!gatewayKey)return respond(500,{error:'processor key not configured'})
const body=await req.json();const jobId=String(body.jobId||''),token=String(body.paymentToken||body.token||''),action=body.action==='sale'?'sale':'auth';if(!jobId)return respond(400,{error:'jobId required'})
const auth=req.headers.get('Authorization')||'';const userDb=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});const db=createClient(supabaseUrl,serviceKey)
const {data:userResult,error:userError}=await userDb.auth.getUser();if(userError||!userResult.user)return respond(401,{error:'session required'})
const {data:job,error:jobError}=await db.from('marketplace_jobs').select('id,client_id,title,estimated_total_cents,status,payment_status').eq('id',jobId).single();if(jobError||!job)return respond(404,{error:'job not found'})
const {data:client}=await db.from('clients').select('id,user_id,maverick_customer_vault_id').eq('id',job.client_id).single();if(!client||client.user_id!==userResult.user.id)return respond(403,{error:'not your job'});if(!token&&!client.maverick_customer_vault_id)return respond(400,{error:'card token required'})
if(job.status!=='open')return respond(409,{error:'job is not awaiting payment'});if(job.payment_status==='authorized'||job.payment_status==='captured')return respond(409,{error:'payment already authorized'})
const {data:financials}=await db.from('job_financials').select('total_cents').eq('job_id',jobId).maybeSingle();const amountCents=Number(financials?.total_cents||job.estimated_total_cents||0);if(!amountCents)return respond(422,{error:'no estimate'})
const form=new URLSearchParams({security_key:gatewayKey,type:action,amount:dollars(amountCents),orderid:jobId,orderdescription:job.title||'Co Pilot security request',response:'json'})
if(token){form.set('payment_token',token);form.set('customer_vault','add_customer')}else{form.set('customer_vault_id',client.maverick_customer_vault_id)}
const gatewayResponse=await fetch(gatewayUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});const processor=await parseGatewayResponse(gatewayResponse)
const approved=String(processor.response||processor.response_code||'')==='1';const transactionId=String(processor.transactionid||processor.transaction_id||'');const authCode=String(processor.authcode||processor.auth_code||'');const message=String(processor.responsetext||processor.message||(approved?'Approved':'Declined'))
const status=approved?(action==='sale'?'captured':'authorized'):'declined';const payoutStatus=approved?'held_until_report':'not_ready';const holdReason=approved?'report_required_before_payout':'payment_declined';const vaultId=String(processor.customer_vault_id||processor.customerVaultId||client.maverick_customer_vault_id||'')
const last4=last4From(processor.cc_number||processor.card_number||processor.card||processor.account_number);const brand=String(processor.card_type||processor.card_brand||processor.cc_type||'')||null
const jobPatch:any={payment_processor:'maverick_easy_pay_direct',payment_status:status,payout_status:payoutStatus,payout_hold_reason:holdReason,processor_transaction_id:transactionId||null,processor_auth_code:authCode||null,processor_response:processor,updated_at:new Date().toISOString()};if(!approved)jobPatch.status='cancelled'
await db.from('marketplace_jobs').update(jobPatch).eq('id',jobId)
await db.from('job_financials').update({payment_processor:'maverick_easy_pay_direct',payment_status:status,payout_status:payoutStatus,hold_reason:holdReason,processor_transaction_id:transactionId||null,processor_auth_code:authCode||null,processor_response:processor,updated_at:new Date().toISOString()}).eq('job_id',jobId)
if(approved&&token&&vaultId){await db.from('clients').update({payment_processor:'maverick_easy_pay_direct',maverick_customer_vault_id:vaultId,maverick_payment_last4:last4,maverick_payment_brand:brand,maverick_payment_saved_at:new Date().toISOString()}).eq('id',job.client_id)}
await db.from('mission_events').insert({job_id:jobId,actor_user_id:userResult.user.id,event_type:approved?'payment_authorized':'payment_declined',payload:{processor:'maverick_easy_pay_direct',status,job_status:approved?'open':'cancelled',transaction_id:transactionId,customer_vault_id:vaultId||null,message}})
return respond(approved?200:402,{approved,status,jobStatus:approved?'open':'cancelled',message,transactionId,authCode,amountCents,customerVaultId:vaultId||null,savedCard:Boolean(vaultId),processor:'maverick_easy_pay_direct'})
}catch(error){return respond(500,{error:error instanceof Error?error.message:'payment failed'})}})
