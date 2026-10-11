import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {createClient} from 'jsr:@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
const key=(name:string,legacy:string)=>{try{const m=JSON.parse(Deno.env.get(name)||'{}');return m.default||Object.values(m)[0]||Deno.env.get(legacy)||''}catch{return Deno.env.get(legacy)||''}}
const b64url=(input:Uint8Array)=>btoa(String.fromCharCode(...input)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const pemBytes=(pem:string)=>Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0))

async function apnsJwt(){
  const team=Deno.env.get('APNS_TEAM_ID')||'',keyId=Deno.env.get('APNS_KEY_ID')||'',pem=(Deno.env.get('APNS_PRIVATE_KEY')||'').replace(/\\n/g,'\n')
  if(!team||!keyId||!pem)return null
  const header=b64url(new TextEncoder().encode(JSON.stringify({alg:'ES256',kid:keyId})))
  const payload=b64url(new TextEncoder().encode(JSON.stringify({iss:team,iat:Math.floor(Date.now()/1000)})))
  const cryptoKey=await crypto.subtle.importKey('pkcs8',pemBytes(pem),{name:'ECDSA',namedCurve:'P-256'},false,['sign'])
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},cryptoKey,new TextEncoder().encode(`${header}.${payload}`)))
  return `${header}.${payload}.${b64url(signature)}`
}

async function sendApns(token:string,title:string,body:string,data:Record<string,unknown>,target:string){
  const jwt=await apnsJwt(),topic=target==='guard'?(Deno.env.get('APNS_GUARD_BUNDLE_ID')||'com.copilotsecurity.guard'):(Deno.env.get('APNS_CLIENT_BUNDLE_ID')||'com.copilotsecurity.client')
  if(!jwt)return {ok:false,error:'APNS_NOT_CONFIGURED'}
  const host=(Deno.env.get('APNS_ENV')||'production')==='sandbox'?'api.sandbox.push.apple.com':'api.push.apple.com'
  const r=await fetch(`https://${host}/3/device/${encodeURIComponent(token)}`,{method:'POST',headers:{authorization:`bearer ${jwt}`,'apns-topic':topic,'apns-push-type':'alert','apns-priority':'10','content-type':'application/json'},body:JSON.stringify({aps:{alert:{title,body},sound:'default'},...data})})
  return {ok:r.ok,status:r.status,error:r.ok?null:await r.text()}
}

async function sendFcm(token:string,title:string,body:string,data:Record<string,unknown>){
  const serverKey=Deno.env.get('FCM_SERVER_KEY')||''
  if(!serverKey)return {ok:false,error:'FCM_NOT_CONFIGURED'}
  const stringData=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v==null?'':String(v)]))
  const r=await fetch('https://fcm.googleapis.com/fcm/send',{method:'POST',headers:{authorization:`key=${serverKey}`,'content-type':'application/json'},body:JSON.stringify({to:token,priority:'high',notification:{title,body,sound:'default'},data:stringData})})
  return {ok:r.ok,status:r.status,error:r.ok?null:await r.text()}
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
  const url=Deno.env.get('SUPABASE_URL')!,publishable=key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),auth=req.headers.get('Authorization')||''
  const userDb=createClient(url,publishable,{global:{headers:{Authorization:auth}}}),admin=createClient(url,secret)
  const {data:me}=await userDb.auth.getUser();if(!me.user)return json({error:'UNAUTHORIZED'},401)
  const {data:role}=await userDb.rpc('current_role');if(role!=='platform_admin')return json({error:'PLATFORM_ADMIN_REQUIRED'},403)
  const input=await req.json().catch(()=>({})),notificationId=String(input.notification_id||''),broadcast=input.broadcast===true
  if(!notificationId)return json({error:'NOTIFICATION_ID_REQUIRED'},400)
  const {data:n,error:ne}=await admin.from('platform_notifications').select('id,recipient_user_id,recipient_role,agency_id,client_id,guard_id,job_id,type,title,body').eq('id',notificationId).single()
  if(ne||!n)return json({error:'NOTIFICATION_NOT_FOUND'},404)
  const userIds=new Set<string>();if(n.recipient_user_id)userIds.add(n.recipient_user_id)
  if(n.client_id){const {data:rows}=await admin.from('clients').select('user_id').eq('id',n.client_id);for(const r of rows||[])if(r.user_id)userIds.add(r.user_id)}
  if(n.guard_id){const {data:rows}=await admin.from('guards').select('user_id').eq('id',n.guard_id);for(const r of rows||[])if(r.user_id)userIds.add(r.user_id)}
  if(n.agency_id){const {data:rows}=await admin.from('agency_members').select('user_id').eq('agency_id',n.agency_id).eq('is_active',true);for(const r of rows||[])if(r.user_id)userIds.add(r.user_id)}
  const roleTarget=n.recipient_role==='client'||n.recipient_role==='guard'?n.recipient_role:null
  if(!userIds.size&&roleTarget&&!broadcast)return json({error:'ROLE_BROADCAST_REQUIRES_EXPLICIT_OPT_IN',recipient_role:roleTarget},409)
  if(!userIds.size&&roleTarget&&broadcast){const {data:rows}=await admin.from('profiles').select('id').eq('role',roleTarget);for(const r of rows||[])userIds.add(r.id)}
  if(!userIds.size)return json({delivered:0,attempted:0})
  const {data:tokens}=await admin.from('mobile_push_tokens').select('token,platform,app_target').in('user_id',[...userIds])
  const allowed=(tokens||[]).filter(t=>t.app_target==='client'||t.app_target==='guard'),data={job_id:n.job_id||'',type:n.type||'',notification_id:n.id}
  const results=[] as unknown[]
  for(const t of allowed)results.push({platform:t.platform,target:t.app_target,...(t.platform==='ios'?await sendApns(t.token,n.title,n.body,data,t.app_target):await sendFcm(t.token,n.title,n.body,data))})
  return json({attempted:results.length,delivered:results.filter((r:any)=>r.ok).length,results})
})
