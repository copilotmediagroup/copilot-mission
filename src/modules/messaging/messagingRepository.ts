import { supabase } from '../../lib/supabase'

export type AgencyMessageRecord={id:string;channel:'all_guards'|'active_mission'|'post_job';sender:'agency'|'guard'|'system';senderName:string;body:string;context:string;createdAt:string}
function db(){ if(!supabase) throw new Error('Supabase is not configured.'); return supabase }
function rows(data:any):any[]{
  if(Array.isArray(data))return data
  if(typeof data==='string'){try{const parsed=JSON.parse(data);return Array.isArray(parsed)?parsed:[]}catch{return []}}
  if(data&&Array.isArray(data.messages))return data.messages
  return []
}
function normalize(row:any):AgencyMessageRecord{return{id:String(row.id),channel:(row.channel??'all_guards') as AgencyMessageRecord['channel'],sender:(row.sender_role??row.sender??'system') as AgencyMessageRecord['sender'],senderName:String(row.sender_name??row.senderName??'Co Pilot'),body:String(row.body??''),context:String(row.context??row.channel??'Message'),createdAt:String(row.created_at??row.createdAt??new Date().toISOString())}}
export async function getAgencyMessages():Promise<AgencyMessageRecord[]>{const{data,error}=await db().rpc('get_agency_messages');if(error)throw new Error(error.message);return rows(data).map(normalize)}
export async function sendAgencyMessage(input:{channel:AgencyMessageRecord['channel'];body:string;jobId?:string|null;senderRole?:'agency'|'guard'}):Promise<AgencyMessageRecord>{const{data,error}=await db().rpc('send_agency_message',{p_channel:input.channel,p_body:input.body,p_job_id:input.jobId??null,p_sender_role:input.senderRole??null});if(error){if(String(error.message).includes('p_sender_role'))throw new Error('Messaging database is missing the sender-role migration. Run 202608160007_agency_guard_message_sender_role.sql.');throw new Error(error.message)}const payload=Array.isArray(data)?data[0]:data;if(!payload)throw new Error('MESSAGE_DELIVERY_NOT_CONFIRMED');return normalize(payload)}
export function subscribeToAgencyMessages(onChange:()=>void){if(!supabase)return()=>undefined;const client=supabase;const channel=client.channel(`agency-messages-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'agency_messages'},onChange).subscribe();return()=>{void client.removeChannel(channel)}}
