import { supabase } from '../../lib/supabase'

export type OperationsMissionState='awaiting_guard'|'offered'|'accepted'|'en_route'|'active'|'checkpoint'|'review'|'completed'|'cancelled'
export type OperationsGuard={id:string;user_id:string;name:string;badge_number:string|null;availability:'offline'|'available'|'reserved'|'on_mission';latitude:number|null;longitude:number|null;last_location_at:string|null;freshness:'live'|'stale'|'expired'|'waiting'|'offline';active_job_id:string|null;active_mission_state:OperationsMissionState|null}
export type OperationsMission={job_id:string;assignment_id:string;title:string;priority:'standard'|'priority'|'emergency';marketplace_status:string;state:OperationsMissionState;checkpoint_index:number;required_checkpoints:number;instructions:string|null;scheduled_for:string|null;duration_minutes:number;assigned_at:string;route_started_at:string|null;arrived_at:string|null;mission_started_at:string|null;completed_at:string|null;updated_at:string;property:{name:string;address:string;latitude:number|null;longitude:number|null;photo_url:string|null};client:{display_name:string};guard:{id:string;name:string;availability:string;latitude:number|null;longitude:number|null;last_location_at:string|null}|null;incident_count:number;evidence_count:number}
export type OperationsEvent={id:number;job_id:string;event_type:string;payload:Record<string,unknown>;created_at:string;title:string;priority:'standard'|'priority'|'emergency';property_name:string;property_address:string}
export type AgencyOperationsWorkspace={agency:{id:string;name:string};generated_at:string;kpis:{total_guards:number;online_guards:number;available_guards:number;active_missions:number;awaiting_guard:number;emergencies:number;incidents:number};guards:OperationsGuard[];missions:OperationsMission[];events:OperationsEvent[]}

function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getAgencyOperationsCenter():Promise<AgencyOperationsWorkspace>{
  const {data,error}=await db().rpc('get_agency_operations_center_rc30')
  if(error)throw new Error(error.message)
  return data as AgencyOperationsWorkspace
}
export function subscribeToAgencyOperations(onChange:()=>void){
  if(!supabase)return()=>undefined
  const channel=supabase.channel(`agency-operations-rc30-${crypto.randomUUID()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'mission_engine_state'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'guards'},onChange)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mission_events'},onChange)
    .subscribe()
  return()=>{void supabase?.removeChannel(channel)}
}
