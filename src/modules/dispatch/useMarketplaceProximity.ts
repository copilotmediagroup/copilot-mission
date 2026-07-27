import { useEffect, useMemo, useState } from 'react'
import { loadGoogleMaps } from '../maps/googleMapsLoader'

export type ProximityJob = { id:string; latitude?:number|null; longitude?:number|null }
export type ProximityGuard = { sourceId?:string; id:number; name:string; initials:string; status:string; latitude?:number|null; longitude?:number|null; freshness?:string|null; currentAddress?:string|null; photoUrl?:string|null }
export type JobProximity = { jobId:string; guard:ProximityGuard; distanceText:string; durationText:string; distanceMeters:number; durationSeconds:number; status:'ready'|'unavailable' }

const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)

export function useMarketplaceProximity(jobs:ProximityJob[],guards:ProximityGuard[]){
 const [byJob,setByJob]=useState<Record<string,JobProximity>>({})
 const [loading,setLoading]=useState(false)
 const eligible=useMemo(()=>guards.filter(g=>g.status==='available'&&valid(g.latitude)&&valid(g.longitude)&&g.freshness!=='expired'&&g.freshness!=='offline'),[guards])
 const jobKey=jobs.map(j=>`${j.id}:${j.latitude}:${j.longitude}`).join('|')
 const guardKey=eligible.map(g=>`${g.sourceId??g.id}:${g.latitude}:${g.longitude}:${g.freshness}`).join('|')
 useEffect(()=>{let cancelled=false
  ;(async()=>{const routable=jobs.filter(j=>valid(j.latitude)&&valid(j.longitude));if(!routable.length||!eligible.length){setByJob({});return}
   setLoading(true)
   try{const google=await loadGoogleMaps();const service=new google.maps.DistanceMatrixService();const next:Record<string,JobProximity>={}
    await Promise.all(routable.map(job=>new Promise<void>(resolve=>{service.getDistanceMatrix({origins:eligible.map(g=>({lat:g.latitude as number,lng:g.longitude as number})),destinations:[{lat:job.latitude as number,lng:job.longitude as number}],travelMode:google.maps.TravelMode.DRIVING,drivingOptions:{departureTime:new Date(),trafficModel:google.maps.TrafficModel.BEST_GUESS},unitSystem:google.maps.UnitSystem.IMPERIAL},(result:any,status:string)=>{if(status==='OK'&&result){let best:{index:number;el:any}|null=null;(result.rows??[]).forEach((row:any,index:number)=>{const el=row.elements?.[0];if(el?.status==='OK'&&(!best||el.duration.value<best.el.duration.value))best={index,el}});if(best){next[job.id]={jobId:job.id,guard:eligible[best.index],distanceText:best.el.distance?.text??'—',durationText:best.el.duration_in_traffic?.text??best.el.duration?.text??'—',distanceMeters:best.el.distance?.value??0,durationSeconds:best.el.duration_in_traffic?.value??best.el.duration?.value??0,status:'ready'}}}resolve()} )})) )
    if(!cancelled)setByJob(next)
   }catch{if(!cancelled)setByJob({})}finally{if(!cancelled)setLoading(false)}})()
  return()=>{cancelled=true}
 },[jobKey,guardKey])
 return {byJob,loading,eligibleCount:eligible.length}
}
