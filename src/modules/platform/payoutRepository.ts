import { supabase } from '../../lib/supabase'

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
