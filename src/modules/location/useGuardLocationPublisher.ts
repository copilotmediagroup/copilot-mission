import { useEffect, useRef } from 'react'
import { publishGuardLocation } from './liveLocationRepository'

const PUBLISH_INTERVAL_MS=8000

export function useGuardLocationPublisher(enabled:boolean,onError:(message:string)=>void){
  const lastPublishedAt=useRef(0)
  useEffect(()=>{
    if(!enabled)return
    if(!('geolocation' in navigator)){onError('Location services are not available in this browser.');return}
    let active=true
    const watchId=navigator.geolocation.watchPosition(
      (position)=>{
        if(!active)return
        const now=Date.now()
        if(now-lastPublishedAt.current<PUBLISH_INTERVAL_MS)return
        lastPublishedAt.current=now
        void publishGuardLocation(position).catch(error=>{if(active)onError(error instanceof Error?error.message:'Unable to publish Guard location')})
      },
      (error)=>{if(active)onError(error.message||'Location permission is required while online.')},
      {enableHighAccuracy:true,maximumAge:5000,timeout:15000},
    )
    return()=>{active=false;navigator.geolocation.clearWatch(watchId);lastPublishedAt.current=0}
  },[enabled,onError])
}
