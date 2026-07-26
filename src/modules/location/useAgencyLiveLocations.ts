import { useCallback,useEffect,useState } from 'react'
import { getAgencyLiveLocations,subscribeToGuardLocations,type GuardLiveLocation } from './liveLocationRepository'

export function useAgencyLiveLocations(enabled:boolean){
  const [locations,setLocations]=useState<GuardLiveLocation[]>([])
  const [error,setError]=useState<string|null>(null)
  const refresh=useCallback(async()=>{
    if(!enabled){setLocations([]);setError(null);return}
    try{setLocations(await getAgencyLiveLocations());setError(null)}catch(cause){setError(cause instanceof Error?cause.message:'Live locations unavailable')}
  },[enabled])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>enabled?subscribeToGuardLocations(()=>void refresh()):undefined,[enabled,refresh])
  return{locations,error,refresh}
}
