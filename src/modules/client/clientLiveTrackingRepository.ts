import { supabase } from '../../lib/supabase'

export type TrackingFreshness='none'|'live'|'stale'|'expired'
export type TrackingTimelineEvent={id:number;event_type:string;created_at:string;payload:Record<string,unknown>}
export type ClientTrackingExperience={
  job_id:string;title:string;priority:string;job_status:string;created_at:string;scheduled_for:string|null
  property:{id:string;name:string;address:string;photo_url:string|null;latitude:number|null;longitude:number|null}
  agency:{id:string;name:string}|null
  guard:{id:string;name:string;badge_number:string|null;latitude:number|null;longitude:number|null;last_location_at:string|null;freshness:TrackingFreshness}|null
  mission:{state:string;checkpoint_index:number;route_started_at:string|null;arrived_at:string|null;mission_started_at:string|null;completed_at:string|null;updated_at:string|null}
  distance_miles:number|null;eta_minutes:number|null
  report:{id:string;status:string;published_at:string|null}|null
  timeline:TrackingTimelineEvent[]
}|null

function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getClientTrackingExperience(){const {data,error}=await db().rpc('get_client_live_tracking_experience_rc13');if(error)throw new Error(error.message);return (data??null) as ClientTrackingExperience}
export function subscribeToClientTracking(onChange:()=>void){if(!supabase)return()=>undefined;const channel=supabase.channel(`client-tracking-${crypto.randomUUID()}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'mission_engine_state'},onChange)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'mission_events'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'guards'},onChange)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'guard_location_history'},onChange)
  .on('postgres_changes',{event:'*',schema:'public',table:'mission_reports'},onChange)
  .subscribe();return()=>{void supabase?.removeChannel(channel)}}
