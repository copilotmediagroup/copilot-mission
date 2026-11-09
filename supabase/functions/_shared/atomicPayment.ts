export type PaymentAction = 'capture' | 'void' | 'refund'
export type PaymentResult = {http:number;body:Record<string,unknown>}
type Input={jobId:string;action:PaymentAction;actorId:string|null;amountCents?:number}
type Processor={key:string;url:string;fetcher?:typeof fetch}
const result=(http:number,body:Record<string,unknown>):PaymentResult=>({http,body})
export async function processAtomicPayment(db:any,input:Input,processor:Processor):Promise<PaymentResult>{
 if(!processor.key)return result(500,{error:'processor key not configured'})
 if(!input.jobId||!['capture','void','refund'].includes(input.action))return result(400,{error:'jobId and valid action required'})
 if(input.amountCents!==undefined&&(!Number.isInteger(input.amountCents)||input.amountCents<=0))return result(400,{error:'invalid amount'})
 const {data:op,error:reserveError}=await db.rpc('reserve_payment_operation_rc1',{p_job_id:input.jobId,p_action:input.action,p_actor_user_id:input.actorId,p_amount_cents:input.amountCents??null})
 if(reserveError||!op){const message=reserveError?.message||'payment reservation unavailable';return result(/FORBIDDEN|ACCOUNT_REQUIRED|CLAIM_REQUIRED/.test(message)?403:409,{error:message})}
 // A successful repeated request returns the stored result without a gateway call.
 if(op.state==='approved')return result(200,{approved:true,status:input.action==='capture'?'captured':input.action==='void'?'voided':'refunded',operationId:op.id,amountCents:op.amount_cents,transactionId:op.transaction_id,idempotent:true})
 if(op.state!=='processing')return result(409,{error:'payment reconciliation required'})
 const form=new URLSearchParams({security_key:processor.key,type:input.action,transactionid:String(op.transaction_id),response:'json'})
 if(input.action!=='void')form.set('amount',(op.amount_cents/100).toFixed(2))
 let outcome:'approved'|'declined'|'unknown'='unknown',response:Record<string,unknown>={}
 try{
  const gateway=await (processor.fetcher||fetch)(processor.url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(20000)})
  if(!gateway.ok)throw new Error(`Gateway HTTP ${gateway.status}`)
  const raw=await gateway.text();try{response=JSON.parse(raw)}catch{response=Object.fromEntries(new URLSearchParams(raw))}
  if(!response||!['1','2'].includes(String(response.response??'')))throw new Error('Unrecognized processor outcome')
  outcome=String(response.response)==='1'?'approved':'declined'
 }catch(error){response={reason:error instanceof Error?error.message:'Processor transport failed'};outcome='unknown'}
 const {data:final,error:finalError}=await db.rpc('finalize_payment_operation_rc1',{p_operation_id:op.id,p_outcome:outcome,p_response:response})
 if(finalError||!final)return result(503,{approved:false,operationId:op.id,status:'reconciliation_required',message:'Processor may have acted. Finalization failed; do not retry until reconciled.'})
 if(outcome==='unknown')return result(503,{approved:false,operationId:op.id,status:input.action+'_unknown',message:'Processor result is uncertain. Do not retry until reconciliation is complete.'})
 const status=outcome==='declined'?op.prior_payment_status:input.action==='capture'?'captured':input.action==='void'?'voided':'refunded'
 return result(outcome==='approved'?200:402,{approved:outcome==='approved',operationId:op.id,status,amountCents:op.amount_cents,transactionId:op.transaction_id,message:String(response.responsetext||response.message||(outcome==='approved'?'Approved':'Declined')),processor:'maverick_easy_pay_direct'})
}

export async function runServerCaptureBatch(db:any,processor:Processor){
 const {error:recoveryError}=await db.rpc('recover_server_capture_leases_rc1',{})
 if(recoveryError)throw new Error(recoveryError.message)
 const {data:jobs,error}=await db.rpc('claim_server_capture_jobs_rc1',{p_limit:5})
 if(error)throw new Error(error.message)
 const results=[]
 for(const jobId of jobs||[]){
  const payment=await processAtomicPayment(db,{jobId,action:'capture',actorId:null},processor)
  if(payment.http>=400){const {error:recordError}=await db.rpc('record_server_capture_failure_rc1',{p_job_id:jobId,p_reason:String(payment.body.error||payment.body.message||'Capture failed')});if(recordError)throw new Error(recordError.message)}
  results.push({jobId,...payment})
 }
 return results
}
