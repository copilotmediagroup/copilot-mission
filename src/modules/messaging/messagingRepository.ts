import { supabase } from '../../lib/supabase'

export type AgencyMessageRecord={
  id:string
  channel:'all_guards'|'active_mission'|'post_job'
  sender:'agency'|'guard'|'system'
  senderName:string
  body:string
  context:string
  createdAt:string
  senderGuardId?:string|null
  recipientGuardId?:string|null
  recipientName?:string|null
  jobId?:string|null
}
function db(){ if(!supabase) throw new Error('Supabase is not configured.'); return supabase }
function rows(data:any):any[]{
  if(Array.isArray(data))return data
  if(typeof data==='string'){try{const parsed=JSON.parse(data);return Array.isArray(parsed)?parsed:[]}catch{return []}}
  if(data&&Array.isArray(data.messages))return data.messages
  return []
}
function normalize(row:any):AgencyMessageRecord{return{id:String(row.id),channel:(row.channel??'all_guards') as AgencyMessageRecord['channel'],sender:(row.sender_role??row.sender??'system') as AgencyMessageRecord['sender'],senderName:String(row.sender_name??row.senderName??'Co Pilot'),body:String(row.body??''),context:String(row.context??row.channel??'Message'),createdAt:String(row.created_at??row.createdAt??new Date().toISOString()),senderGuardId:row.sender_guard_id??row.senderGuardId??null,recipientGuardId:row.recipient_guard_id??row.recipientGuardId??null,recipientName:row.recipient_name??row.recipientName??null,jobId:row.job_id??row.jobId??null}}
export async function getAgencyMessages():Promise<AgencyMessageRecord[]>{const{data,error}=await db().rpc('get_agency_messages');if(error)throw new Error(error.message);return rows(data).map(normalize)}
export async function sendAgencyMessage(input:{channel:AgencyMessageRecord['channel'];body:string;jobId?:string|null;recipientGuardId?:string|null}):Promise<AgencyMessageRecord>{const{data,error}=await db().rpc('send_agency_message',{p_channel:input.channel,p_body:input.body,p_job_id:input.jobId??null,p_recipient_guard_id:input.recipientGuardId??null});if(error){if(String(error.message).includes('p_recipient_guard_id'))throw new Error('Messaging database is missing direct-guard messaging. Run 202608160008_agency_message_direct_guard_threads.sql.');if(String(error.message).includes('p_sender_role'))throw new Error('Messaging database is missing the sender-role migration. Run 202608160007_agency_guard_message_sender_role.sql.');throw new Error(error.message)}const payload=Array.isArray(data)?data[0]:data;if(!payload)throw new Error('MESSAGE_DELIVERY_NOT_CONFIRMED');return normalize(payload)}
export function subscribeToAgencyMessages(onChange:()=>void){if(!supabase)return()=>undefined;const client=supabase;const channel=client.channel(`agency-messages-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'agency_messages'},onChange).subscribe();return()=>{void client.removeChannel(channel)}}

export async function getDeveloperAgencyMessages(agencyId:string):Promise<AgencyMessageRecord[]>{const{data,error}=await db().rpc('get_developer_agency_messages_rc1',{p_agency_id:agencyId});if(error)throw new Error(error.message);return rows(data).map(normalize)}
export async function sendDeveloperAgencyMessage(agencyId:string,input:{channel:AgencyMessageRecord['channel'];body:string;jobId?:string|null;recipientGuardId?:string|null}):Promise<AgencyMessageRecord>{const{data,error}=await db().rpc('send_developer_agency_message_rc1',{p_agency_id:agencyId,p_channel:input.channel,p_body:input.body,p_job_id:input.jobId??null,p_recipient_guard_id:input.recipientGuardId??null});if(error)throw new Error(error.message);return normalize(data)}
export async function getDeveloperGuardMessages(guardId:string):Promise<AgencyMessageRecord[]>{const{data,error}=await db().rpc('get_developer_guard_messages_rc1',{p_guard_id:guardId});if(error)throw new Error(error.message);return (Array.isArray(data)?data:[]).map(normalize)}
export async function sendDeveloperGuardMessage(guardId:string,input:{channel:AgencyMessageRecord['channel'];body:string;jobId?:string|null}):Promise<AgencyMessageRecord>{const{data,error}=await db().rpc('send_developer_guard_message_rc1',{p_guard_id:guardId,p_channel:input.channel,p_body:input.body,p_job_id:input.jobId??null});if(error)throw new Error(error.message);return normalize(data)}
