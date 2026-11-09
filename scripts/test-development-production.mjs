import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
const compile=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const safety={exports:{}}
vm.runInNewContext(compile('src/lib/developerSafety.ts'),{exports:safety.exports,Request,Response,URL,fetch:()=>{throw Error('Unexpected network')}})
const {setDeveloperPreviewActive,developerRequestAllowed,developerSafeFetch}=safety.exports
const prod='https://eznhyemkuxectndxtymc.supabase.co'
setDeveloperPreviewActive(true)
for(const path of ['/rest/v1/rpc/set_developer_guard_presence_rc1','/rest/v1/rpc/update_client_account_for_platform_rc1','/functions/v1/maverick-payments','/storage/v1/object/guard-avatars/photo.jpg','/rest/v1/marketplace_jobs']) assert.equal(developerRequestAllowed(prod+path,{method:'POST'}),false,path)
assert.equal(developerRequestAllowed(prod+'/auth/v1/user',{method:'PUT'}),false)
for(const path of ['/rest/v1/rpc/get_developer_guard_workspace_rc1','/auth/v1/token','/auth/v1/logout','/storage/v1/object/sign/mission-evidence/file.jpg']) assert.equal(developerRequestAllowed(prod+path,{method:'POST'}),true,path)
assert.equal(developerRequestAllowed(new Request(prod+'/rest/v1/rpc/set_developer_guard_presence_rc1',{method:'POST'})),false)
assert.equal((await developerSafeFetch(prod+'/functions/v1/maverick-payments',{method:'POST'})).status,403)
assert.equal(developerRequestAllowed('https://isolated-test.supabase.co/rest/v1/rpc/set_developer_guard_presence_rc1',{method:'POST'}),true)
setDeveloperPreviewActive(false)
assert.equal(developerRequestAllowed(prod+'/functions/v1/maverick-payments',{method:'POST'}),true)
console.log('PASS production preview blocks customer writes, storage writes, payments and account changes; permits reads and isolated testing')

async function paymentCase(config={}){
 const writes=[];let gatewayCalls=0,handler
 const job={id:'job',client_id:'client',status:'completed',payment_status:'authorized',payout_status:'not_ready',payout_hold_reason:'job-hold',processor_transaction_id:'txn',estimated_total_cents:10000,required_guards:1,pricing_snapshot:{},...config.job}
 const financial={job_id:'job',payment_status:job.payment_status,processor_transaction_id:'txn',total_cents:10000,payout_status:'not_ready',hold_reason:'financial-hold'}
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){let op='read',patch;const chain={select(){return chain},eq(){return chain},not(){return chain},update(value){op='update';patch=value;writes.push({table,patch});return chain},insert(value){writes.push({table,event:value});return Promise.resolve({error:null})},single(){return result()},maybeSingle(){return result()},then(resolve,reject){return result().then(resolve,reject)}};async function result(){if(op==='update')return {data:(config.reserveFail&&table==='marketplace_jobs')||(config.financialReserveFail&&table==='job_financials')?null:{id:'job'},error:null};const data=table==='profiles'?{role:config.role||'platform_admin',account_status:'approved'}:table==='marketplace_jobs'?job:table==='job_financials'?financial:table==='clients'?{user_id:config.clientOwner||'owner',maverick_customer_vault_id:'test-vault'}:table==='mission_reports'?{id:'report',status:'pending_review'}:table==='job_assignments'||table==='job_guard_slots'?[{guard_id:'guard'}]:null;return {data,count:table==='mission_evidence_media'&&config.missingProof?0:config.incomplete?0:1,error:null}}return chain}}
 const source=fs.readFileSync(config.authorization?'supabase/functions/maverick-payments/index.ts':'supabase/functions/maverick-payment-lifecycle/index.ts','utf8').replace(/^import .*\n/,'')
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 vm.runInNewContext(compiled,{Deno:{env:{get:()=> 'test-only'},serve:fn=>{handler=fn}},createClient:()=>db,Request,Response,URLSearchParams,AbortSignal,Date,fetch:async()=>{gatewayCalls++;if(config.transport)throw Error('transport');return new Response(config.body??'response=1&transactionid=txn',{status:config.http||200})}})
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer fake'},body:JSON.stringify({jobId:'job',action:config.action||(config.authorization?'auth':'capture')})}))
 return {status:response.status,payload:await response.json(),writes,gatewayCalls}
}
for(const config of [{transport:true},{http:500},{body:'<html>upstream failure</html>'},{body:'response_code=1'}]){const r=await paymentCase(config);assert.equal(r.status,503);assert.equal(r.payload.status,'capture_unknown');assert.equal(r.gatewayCalls,1);assert.ok(!r.writes.some(w=>w.patch?.payment_status==='authorized'))}
for(const config of [{role:'guard'},{job:{pricing_snapshot:{developer_test:true}}},{incomplete:true},{missingProof:true},{reserveFail:true},{financialReserveFail:true}]){const r=await paymentCase(config);assert.ok(r.status>=400);assert.equal(r.gatewayCalls,0)}
const declined=await paymentCase({body:'response=2&responsetext=Declined'});assert.equal(declined.status,402)
assert.ok(declined.writes.some(w=>w.table==='marketplace_jobs'&&w.patch?.payout_hold_reason==='job-hold'))
assert.ok(declined.writes.some(w=>w.table==='job_financials'&&w.patch?.hold_reason==='financial-hold'))
const captured=await paymentCase();assert.equal(captured.status,200);assert.equal(captured.payload.status,'captured')
const clientVoid=await paymentCase({action:'void',role:'client',job:{status:'open'},incomplete:true});assert.equal(clientVoid.status,200)
const otherVoid=await paymentCase({action:'void',role:'client',clientOwner:'someone-else',job:{status:'open'},incomplete:true});assert.equal(otherVoid.status,403);assert.equal(otherVoid.gatewayCalls,0)
console.log('PASS payment lifecycle: 14 authorization, proof, duplicate reservation, capture, cancellation, decline and uncertain-response scenarios; zero real processor calls')

const uploads=[];const rpcCalls=[];const developerModule={exports:{}}
const storage={upload:async(path)=>{uploads.push(path);return {error:null}},getPublicUrl:path=>({data:{publicUrl:'https://test.invalid/'+path}}),remove:async()=>({error:null})}
const mockDb={storage:{from:()=>storage},rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:null,error:null}}}
vm.runInNewContext(compile('src/modules/developer/developerLiveRepository.ts'),{exports:developerModule.exports,Date,require:path=>path.includes('clientRepository')?{getClientAccountForPlatform:async id=>{assert.equal(id,'selected-client');return {user_id:'selected-client-owner'}}}:{supabase:mockDb}})
await developerModule.exports.uploadDeveloperClientPropertyPhoto('selected-client','property',{type:'image/jpeg',size:123,name:'photo.jpg'})
assert.match(uploads[0],/^selected-client-owner\/developer-property\/property\/photo-/)
assert.equal(rpcCalls[0].name,'set_developer_client_property_photo_rc1')
assert.equal(rpcCalls[0].args.p_client_id,'selected-client')
assert.equal(rpcCalls.some(x=>x.name==='get_developer_client_workspace_rc1'),false)
console.log('PASS selected-client property photo uses authorized account identity, not the workspace response or signed-in owner')

for(const config of [{transport:true},{http:500},{body:'<html>upstream failure</html>'},{body:'response_code=1'},{body:'response=1'}]){const r=await paymentCase({...config,authorization:true,job:{status:'open',payment_status:'estimate_only'}});assert.equal(r.status,503);assert.equal(r.payload.status,'authorization_unknown');assert.equal(r.gatewayCalls,1)}
const testAuth=await paymentCase({authorization:true,job:{status:'open',payment_status:'estimate_only',pricing_snapshot:{developer_test:true}}});assert.equal(testAuth.status,409);assert.equal(testAuth.gatewayCalls,0)
console.log('PASS authorization: uncertain responses cannot reset a chargeable authorization; developer-test jobs never reach the processor')
