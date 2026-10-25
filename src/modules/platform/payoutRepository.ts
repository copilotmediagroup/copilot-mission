import { supabase } from '../../lib/supabase'

export type PaymentAuthorizationReconciliation={job_id:string;title:string;client_id:string;amount_cents:number;payment_status:string;hold_reason:string|null;processor_transaction_id:string|null;processor_response:Record<string,unknown>|null;updated_at:string}
export type PaymentLifecycleReconciliation=PaymentAuthorizationReconciliation&{payout_status:string;job_status:string}
export type PlatformPayoutRow={
 job_id:string;title:string;agency_id:string;agency_name:string;amount_cents:number;
 payout_status:'ready_for_payout'|'paid';hold_reason:string|null;payout_method:string;
 external_reference:string|null;recorded_at:string|null;updated_at:string
}
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getPlatformPayoutQueue():Promise<PlatformPayoutRow[]>{
 const {data,error}=await db().rpc('get_platform_payout_queue');if(error)throw new Error(error.message);return (data??[]) as PlatformPayoutRow[]
}
export async function recordAgencyPayout(jobId:string,externalReference:string,note?:string){
 const reference=externalReference.trim();if(!reference)throw new Error('Enter the bank, ACH, check, or transfer reference first.')
 const {data,error}=await db().rpc('record_agency_payout_reconciliation',{p_job_id:jobId,p_external_reference:reference,p_note:note?.trim()||null});if(error)throw new Error(error.message);return data
}

export async function getPaymentAuthorizationReconciliationQueue():Promise<PaymentAuthorizationReconciliation[]>{const {data,error}=await db().rpc('get_payment_authorization_reconciliation_queue');if(error)throw new Error(error.message);return (data??[]) as PaymentAuthorizationReconciliation[]}
export async function resolvePaymentAuthorizationUnknown(jobId:string,outcome:'authorized'|'declined',transactionId?:string,note?:string){if(outcome==='authorized'&&!transactionId?.trim())throw new Error('Processor transaction reference is required for an authorized reconciliation.');const {data,error}=await db().rpc('resolve_payment_authorization_unknown_rc1',{p_job_id:jobId,p_outcome:outcome,p_processor_transaction_id:transactionId?.trim()||null,p_note:note?.trim()||null});if(error)throw new Error(error.message);return data}

export async function getPaymentLifecycleReconciliationQueue():Promise<PaymentLifecycleReconciliation[]>{const {data,error}=await db().rpc('get_payment_lifecycle_reconciliation_queue_rc1');if(error)throw new Error(error.message);return (data??[]) as PaymentLifecycleReconciliation[]}
export async function resolvePaymentLifecycleUnknown(jobId:string,outcome:'captured'|'authorized'|'voided'|'refunded',note:string){if(!note.trim())throw new Error('Record what you verified in Maverick / NMI.');const {data,error}=await db().rpc('resolve_payment_lifecycle_unknown_rc1',{p_job_id:jobId,p_outcome:outcome,p_note:note.trim()});if(error)throw new Error(error.message);return data}
