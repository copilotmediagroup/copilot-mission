import { supabase } from '../../lib/supabase'

export type GuardCredentialReview={id:string;guard_id:string;credential_type:'security_officer'|'armed_qualification';license_number:string;jurisdiction:string;expires_on:string|null;verification_status:'pending'|'verified'|'rejected'|'expired';verified_at:string|null;created_at:string}
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getPlatformGuardCredentials():Promise<GuardCredentialReview[]>{const{data,error}=await db().from('guard_credentials').select('id,guard_id,credential_type,license_number,jurisdiction,expires_on,verification_status,verified_at,created_at').order('created_at',{ascending:false});if(error)throw new Error(error.message);return (data??[]) as GuardCredentialReview[]}
export async function reviewGuardCredential(id:string,status:'verified'|'rejected'){const patch=status==='verified'?{verification_status:status,verified_at:new Date().toISOString()}:{verification_status:status,verified_at:null};const{error}=await db().from('guard_credentials').update(patch).eq('id',id);if(error)throw new Error(error.message)}
