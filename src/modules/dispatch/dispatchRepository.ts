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

export async function advanceGuardMission(jobId:string,action:'start_route'|'mark_arrived'){
  const {data,error}=await db().rpc('advance_guard_mission_rc22',{p_job_id:jobId,p_action:action});
  if(error) throw new Error(error.message)
  return data as {success:boolean;status:DispatchStatus;job_id:string}
}
export function subscribeToDispatch(onChange:()=>void){
  if(!supabase)return()=>undefined
  const channel=supabase.channel(`dispatch-rc2-${crypto.randomUUID()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs'},onChange)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mission_events'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'guards'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'mission_execution_state'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'mission_engine_state'},onChange)
    .subscribe()
  return()=>{void supabase?.removeChannel(channel)}
}

export type GuardExecutionState = {
  job_id:string
  assignment_id:string
  agency_id:string
  guard_id:string
  phase:'patrol'|'proof'|'completed'
  checkpoint_index:number
  evidence:import('../../types').PatrolEvidence[]
  incidents:import('../../types').IncidentRecord[]
  started_at:string
  completed_at:string|null
  updated_at:string
}

export async function getGuardExecutionState(jobId:string):Promise<GuardExecutionState>{
  const {data,error}=await db().rpc('get_guard_execution_state_rc23',{p_job_id:jobId})
  if(error) throw new Error(error.message)
  return data as GuardExecutionState
}

export async function saveGuardExecutionPayload(jobId:string,evidence:import('../../types').PatrolEvidence[],incidents:import('../../types').IncidentRecord[]):Promise<GuardExecutionState>{
  const {data,error}=await db().rpc('save_guard_execution_payload_rc23',{p_job_id:jobId,p_evidence:evidence,p_incidents:incidents})
  if(error) throw new Error(error.message)
  return data as GuardExecutionState
}

export async function completeGuardCheckpoint(jobId:string,expectedCheckpoint:number):Promise<GuardExecutionState>{
  const {data,error}=await db().rpc('complete_guard_checkpoint_rc23',{p_job_id:jobId,p_expected_checkpoint:expectedCheckpoint})
  if(error) throw new Error(error.message)
  return data as GuardExecutionState
}

export async function submitGuardMission(jobId:string):Promise<GuardExecutionState>{
  const {data,error}=await db().rpc('submit_guard_mission_rc23',{p_job_id:jobId})
  if(error) throw new Error(error.message)
  return data as GuardExecutionState
}

export type MissionEngineState = 'awaiting_guard'|'offered'|'accepted'|'en_route'|'active'|'checkpoint'|'review'|'completed'|'cancelled'
export type MissionEngineRecord = {
  job_id:string
  assignment_id:string
  agency_id:string
  guard_id:string|null
  state:MissionEngineState
  checkpoint_index:number
  evidence:import('../../types').PatrolEvidence[]
  incidents:import('../../types').IncidentRecord[]
  mission_started_at:string|null
  route_started_at:string|null
  arrived_at:string|null
  completed_at:string|null
  version:number
  updated_at:string
  assignment:Record<string,unknown>
  job:Record<string,unknown>
}
export type GuardMissionSnapshot = { guard:DispatchGuard; mission:MissionEngineRecord|null }

export async function getGuardMissionSnapshot(jobId?:string):Promise<GuardMissionSnapshot>{
  const {data,error}=await db().rpc('get_guard_mission_snapshot',{p_job_id:jobId ?? null})
  if(error) throw new Error(error.message)
  return data as GuardMissionSnapshot
}

export async function transitionGuardMission(args:{
  jobId:string
  action:'accept'|'decline'|'start_route'|'mark_arrived'|'save_payload'|'complete_checkpoint'|'submit'
  expectedVersion?:number|null
  checkpoint?:number|null
  evidence?:import('../../types').PatrolEvidence[]|null
  incidents?:import('../../types').IncidentRecord[]|null
}):Promise<MissionEngineRecord>{
  const {data,error}=await db().rpc('transition_guard_mission',{
    p_job_id:args.jobId,
    p_action:args.action,
    p_expected_version:args.expectedVersion ?? null,
    p_checkpoint:args.checkpoint ?? null,
    p_evidence:args.evidence ?? null,
    p_incidents:args.incidents ?? null,
  })
  if(error) throw new Error(error.message)
  return data as MissionEngineRecord
}
