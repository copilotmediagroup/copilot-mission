import { supabase } from '../../lib/supabase'
import {getVisibleClientIdentities,clientIdentityByName} from '../client/clientIdentityRepository'

export type CommandCenterSummary = {
  agencies_total: number
  agencies_pending: number
  clients_total: number
  properties_total: number
  guards_total: number
  guards_online: number
  guards_available: number
  missions_open: number
  missions_live: number
  missions_completed: number
  emergencies_live: number
}

export type CommandCenterAgency = {
  id: string; name: string; status: string; license_number: string | null; service_radius_miles: number
  created_at: string; owner_name: string | null; owner_status: string
  guard_count: number; online_guard_count: number; live_mission_count: number; completed_mission_count: number
}
export type CommandCenterProperty = {
  id: string; name: string; address: string; latitude: number | null; longitude: number | null
  photo_url: string | null; created_at: string; client_id: string; client_name: string; client_avatar_url?: string | null
}
export type CommandCenterGuard = {
  id: string; name: string; badge_number: string | null; availability: 'offline'|'available'|'reserved'|'on_mission'
  agency_id: string; agency_name: string; latitude: number | null; longitude: number | null
  last_location_at: string | null; created_at: string
}
export type CommandCenterMission = {
  id: string; title: string; status: string; priority: string; scheduled_for: string | null
  created_at: string; updated_at: string; property_name: string; property_address: string; client_name: string; client_avatar_url?: string | null
  agency_id: string | null; agency_name: string | null; guard_id: string | null; guard_name: string | null
  assignment_status: string | null; engine_state: string | null; checkpoint_index: number | null; engine_version: number | null
}
export type CommandCenterEvent = {
  id: number; job_id: string; event_type: string; payload: Record<string, unknown>; created_at: string
  mission_title: string; actor_name: string | null
}
export type OperationsRouteIntelligence = {
  job_id:string; guard_id:string; mission_state:string; guard_latitude:number|null; guard_longitude:number|null
  property_latitude:number|null; property_longitude:number|null; last_location_at:string|null; distance_miles:number|null
  eta_minutes:number|null; minutes_to_start:number|null; movement:'unknown'|'stationary'|'moving'; moved_miles_10m:number|null; location_points_10m:number
}
export type CommandCenterSnapshot = {
  generated_at: string
  summary: CommandCenterSummary
  agencies: CommandCenterAgency[]
  properties: CommandCenterProperty[]
  guards: CommandCenterGuard[]
  missions: CommandCenterMission[]
  events: CommandCenterEvent[]
}

function requireSupabase() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase }

export async function getPlatformCommandCenter(): Promise<CommandCenterSnapshot> {
  const { data, error } = await requireSupabase().rpc('get_platform_command_center')
  if (error) throw new Error(error.message)
  const snapshot=data as CommandCenterSnapshot;const identities=clientIdentityByName(await getVisibleClientIdentities());return {...snapshot,properties:(snapshot.properties??[]).map(x=>({...x,client_avatar_url:identities.get(x.client_name.trim().toLowerCase())?.avatar_url??null})),missions:(snapshot.missions??[]).map(x=>({...x,client_avatar_url:identities.get(x.client_name.trim().toLowerCase())?.avatar_url??null}))}
}

export function subscribeToCommandCenter(onChange: () => void) {
  if (!supabase) return () => undefined
  const db = supabase
  const channel = db.channel(`platform-command-center-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agencies' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guards' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_jobs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_engine_state' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mission_events' }, onChange)
    .subscribe()
  return () => { void db.removeChannel(channel) }
}

export async function getOperationsCopilotRouteIntelligence(): Promise<OperationsRouteIntelligence[]> {
 const {data,error}=await requireSupabase().rpc('get_operations_copilot_route_intelligence'); if(error) throw new Error(error.message); return (data??[]) as OperationsRouteIntelligence[]
}
export async function startMissionRescue(jobId:string,reason:string,severity:'WATCH'|'ACTION REQUIRED'|'CRITICAL',recommendedAgencyId?:string|null){const{data,error}=await requireSupabase().rpc('start_mission_rescue',{p_job_id:jobId,p_reason:reason,p_severity:severity,p_recommended_agency_id:recommendedAgencyId??null});if(error)throw new Error(error.message);return data}
export async function offerMissionRescueToBackup(jobId:string,agencyId:string){const{data,error}=await requireSupabase().rpc('offer_mission_rescue_to_backup',{p_job_id:jobId,p_agency_id:agencyId});if(error)throw new Error(error.message);return data}
export async function acceptMissionRescueOffer(jobId:string){const{data,error}=await requireSupabase().rpc('accept_mission_rescue_offer',{p_job_id:jobId});if(error)throw new Error(error.message);return data}
export async function authorizeMissionRescueHandoff(jobId:string){const{data,error}=await requireSupabase().rpc('authorize_mission_rescue_handoff',{p_job_id:jobId});if(error)throw new Error(error.message);return data}
export type AgencyRescueOffer={id:string;job_id:string;severity:string;reason:string;offered_at:string;accepted_at:string|null;title:string;scheduled_for:string|null;property_name:string;property_address:string;payout_cents:number}
export async function getMyRescueOffers(){const{data,error}=await requireSupabase().rpc('get_my_rescue_offers');if(error)throw new Error(error.message);return(data??[]) as AgencyRescueOffer[]}
export type OwnerRescueCase={id:string;job_id:string;status:string;severity:string;reason:string;recommended_agency_id:string|null;offered_agency_id:string|null;offered_agency_name:string|null;offered_at:string|null;accepted_agency_id:string|null;accepted_agency_name:string|null;accepted_at:string|null;opened_at:string}
export async function getOwnerOpenRescueCases(){const{data,error}=await requireSupabase().rpc('get_owner_open_rescue_cases');if(error)throw new Error(error.message);return(data??[]) as OwnerRescueCase[]}
