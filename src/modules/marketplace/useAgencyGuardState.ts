import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { LocationFreshness } from '../location/liveLocationRepository'

export type GuardOperationalState='offline'|'online_unavailable'|'available'|'reserved'|'on_mission'|'gps_stale'
export type GuardRouteIneligibilityReason='GUARD_OFFLINE'|'GUARD_RESERVED'|'GUARD_ON_MISSION'|'GPS_COORDINATES_MISSING'|'GPS_WAITING'|'GPS_EXPIRED'|null
export type AgencyGuardRow={
  id:string;user_id:string;name:string;phone:string|null;email:string;badge_number:string|null;
  availability:'offline'|'available'|'reserved'|'on_mission';operational_state:GuardOperationalState;
  route_eligible:boolean;route_ineligibility_reason:GuardRouteIneligibilityReason;
  latitude:number|null;longitude:number|null;last_location_at:string|null;freshness:LocationFreshness;created_at:string
}
export type AgencyGuardSummary={total:number;online:number;offline:number;available:number;reserved:number;on_mission:number;route_eligible:number;gps_stale:number;online_unavailable:number}
export type AgencyGuardState={guards:AgencyGuardRow[];summary:AgencyGuardSummary;loading:boolean;error:string|null;refresh:()=>Promise<void>}
const empty:AgencyGuardSummary={total:0,online:0,offline:0,available:0,reserved:0,on_mission:0,route_eligible:0,gps_stale:0,online_unavailable:0}

export function useAgencyGuardState(enabled:boolean):AgencyGuardState{
  const [guards,setGuards]=useState<AgencyGuardRow[]>([])
  const [summary,setSummary]=useState<AgencyGuardSummary>(empty)
  const [loading,setLoading]=useState(enabled)
  const [error,setError]=useState<string|null>(null)
  const refresh=useCallback(async()=>{
    if(!enabled||!supabase){setGuards([]);setSummary(empty);setLoading(false);return}
    setLoading(true)
    const {data,error}=await supabase.rpc('get_agency_guard_state')
    if(error){setError(error.message);setLoading(false);return}
    const payload=(data??{}) as {guards?:AgencyGuardRow[];summary?:Partial<AgencyGuardSummary>}
    setGuards(Array.isArray(payload.guards)?payload.guards:[])
    setSummary({...empty,...(payload.summary??{})})
    setError(null);setLoading(false)
  },[enabled])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!enabled||!supabase)return
    const channel=supabase.channel('guard-operational-state-rc36')
      .on('postgres_changes',{event:'*',schema:'public',table:'guards'},()=>{void refresh()})
      .on('postgres_changes',{event:'*',schema:'public',table:'job_assignments'},()=>{void refresh()})
      .subscribe()
    const timer=window.setInterval(()=>{void refresh()},30000)
    return()=>{window.clearInterval(timer);void supabase?.removeChannel(channel)}
  },[enabled,refresh])
  return{guards,summary,loading,error,refresh}
}

export function guardStateLabel(guard:AgencyGuardRow){
  switch(guard.operational_state){
    case 'available':return guard.freshness==='stale'?'Available · GPS stale':'Available for dispatch'
    case 'reserved':return 'Reserved for a mission'
    case 'on_mission':return 'On mission'
    case 'gps_stale':return 'Online · GPS expired'
    case 'online_unavailable':return guard.route_ineligibility_reason==='GPS_COORDINATES_MISSING'?'Online · location missing':'Online · waiting for GPS'
    default:return 'Offline'
  }
}
