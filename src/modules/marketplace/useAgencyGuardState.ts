import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { GuardRosterRow } from './guardOnboardingRepository'

export type AgencyGuardSummary={total:number;online:number;offline:number;available:number;reserved:number;on_mission:number}
export type AgencyGuardState={guards:GuardRosterRow[];summary:AgencyGuardSummary;loading:boolean;error:string|null;refresh:()=>Promise<void>}
const empty:AgencyGuardSummary={total:0,online:0,offline:0,available:0,reserved:0,on_mission:0}

export function useAgencyGuardState(enabled:boolean):AgencyGuardState{
  const [guards,setGuards]=useState<GuardRosterRow[]>([])
  const [summary,setSummary]=useState<AgencyGuardSummary>(empty)
  const [loading,setLoading]=useState(enabled)
  const [error,setError]=useState<string|null>(null)
  const refresh=useCallback(async()=>{
    if(!enabled||!supabase){setGuards([]);setSummary(empty);setLoading(false);return}
    setLoading(true)
    const {data,error}=await supabase.rpc('get_agency_guard_state')
    if(error){setError(error.message);setLoading(false);return}
    const payload=(data??{}) as {guards?:GuardRosterRow[];summary?:Partial<AgencyGuardSummary>}
    setGuards(Array.isArray(payload.guards)?payload.guards:[])
    setSummary({...empty,...(payload.summary??{})})
    setError(null);setLoading(false)
  },[enabled])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!enabled||!supabase)return
    const channel=supabase.channel('agency-guard-state')
      .on('postgres_changes',{event:'*',schema:'public',table:'guards'},()=>{void refresh()})
      .subscribe()
    return()=>{void supabase?.removeChannel(channel)}
  },[enabled,refresh])
  return{guards,summary,loading,error,refresh}
}
