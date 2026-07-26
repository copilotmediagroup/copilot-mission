import { supabase } from '../../lib/supabase'

export type LiveOperationsSummary={marketplace_open:number;missions_live:number;guards_online:number;guards_available:number;guards_driving:number;completed_today:number;reports_pending:number;reports_published:number;emergencies_live:number;priority_live:number}
export type EngineHealth={database:string;realtime:string;mission_engine:string;reporting_engine:string;guard_presence:string;storage:string;gps:string;notifications:string}
export type LiveMission={id:string;title:string;status:string;priority:string;updated_at:string;property_name:string;property_address:string;property_latitude:number|null;property_longitude:number|null;client_name:string;agency_name:string|null;guard_name:string|null;engine_state:string|null;checkpoint_index:number|null;assignment_status:string|null;report_status:string|null}
export type LiveGuard={id:string;name:string;agency_name:string;availability:string;latitude:number|null;longitude:number|null;last_location_at:string|null;location_freshness:'none'|'live'|'stale'|'expired'}
export type LiveEvent={id:number;job_id:string;event_type:string;payload:Record<string,unknown>;created_at:string;mission_title:string;actor_name:string}
export type LiveOperationsSnapshot={generated_at:string;summary:LiveOperationsSummary;health:EngineHealth;missions:LiveMission[];guards:LiveGuard[];events:LiveEvent[]}
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getLiveOperationsCenter(){const {data,error}=await db().rpc('get_live_operations_center');if(error)throw new Error(error.message);return data as LiveOperationsSnapshot}
export function subscribeToLiveOperations(onChange:()=>void){if(!supabase)return()=>undefined;const channel=supabase.channel(`live-operations-${crypto.randomUUID()}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'mission_engine_state'},onChange)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'mission_events'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'guards'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'mission_reports'},onChange).subscribe()
 return()=>{void supabase?.removeChannel(channel)}}
