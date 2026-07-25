import { supabase } from '../../lib/supabase'

export type DispatchStatus = 'awaiting_guard'|'offered'|'accepted'|'en_route'|'arrived'|'active'|'completed'|'cancelled'
export type DispatchGuard = { id:string; user_id:string; name:string; badge_number:string|null; availability:'offline'|'available'|'reserved'|'on_mission' }
export type DispatchMission = {
  assignment_id:string; job_id:string; agency_id:string; guard_id:string|null; status:DispatchStatus;
  assigned_at:string; offered_at:string|null; accepted_at:string|null; declined_at:string|null; locked_at:string|null;
  title:string; instructions:string|null; priority:'standard'|'priority'|'emergency'; scheduled_for:string|null; duration_minutes:number;
  property:{name:string;address:string;latitude:number|null;longitude:number|null;photo_url:string|null};
  client:{display_name:string}; guard:DispatchGuard|null
}
export type DispatchEvent = { id:number; job_id:string; event_type:string; payload:Record<string,unknown>; created_at:string }
export type AgencyDispatchWorkspace = { agency:{id:string;name:string}; guards:DispatchGuard[]; missions:DispatchMission[]; events:DispatchEvent[] }
export type GuardDispatchWorkspace = { guard:DispatchGuard; assignment:DispatchMission|null; events:DispatchEvent[] }

function db(){ if(!supabase) throw new Error('Supabase is not configured.'); return supabase }
export async function getAgencyDispatchWorkspace():Promise<AgencyDispatchWorkspace>{
  const {data,error}=await db().rpc('get_agency_dispatch_workspace_rc2'); if(error) throw new Error(error.message); return data as AgencyDispatchWorkspace
}
export async function assignGuard(jobId:string,guardId:string){
  const {data,error}=await db().rpc('assign_guard_rc2',{p_job_id:jobId,p_guard_id:guardId}); if(error) throw new Error(error.message); return data as {success:boolean;job_id:string;guard_id:string;status:DispatchStatus}
}
export async function getGuardDispatchWorkspace():Promise<GuardDispatchWorkspace>{
  const {data,error}=await db().rpc('get_guard_dispatch_workspace_rc2'); if(error) throw new Error(error.message); return data as GuardDispatchWorkspace
}

export type GuardPresence = { guard_id:string; agency_id:string; availability:'offline'|'available'|'reserved'|'on_mission'; online:boolean; changed?:boolean }
export async function setGuardPresence(online:boolean):Promise<GuardPresence>{
  const {data,error}=await db().rpc('set_guard_presence_rc13',{p_online:online}); if(error) throw new Error(error.message); return data as GuardPresence
}
export async function getGuardPresence():Promise<GuardPresence>{
  const {data,error}=await db().rpc('get_guard_presence_rc13'); if(error) throw new Error(error.message); return data as GuardPresence
}

export async function respondToAssignment(jobId:string,response:'accept'|'decline'){
  const {data,error}=await db().rpc('respond_to_assignment_rc2',{p_job_id:jobId,p_response:response}); if(error) throw new Error(error.message); return data as {success:boolean;status:DispatchStatus;job_id:string}
}
export function subscribeToDispatch(onChange:()=>void){
  if(!supabase)return()=>undefined
  const channel=supabase.channel(`dispatch-rc2-${crypto.randomUUID()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs'},onChange)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mission_events'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'guards'},onChange)
    .subscribe()
  return()=>{void supabase?.removeChannel(channel)}
}
