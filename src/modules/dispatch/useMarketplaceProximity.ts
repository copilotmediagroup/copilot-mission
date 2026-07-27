import { useEffect, useMemo, useState } from 'react'
import { loadGoogleMaps } from '../maps/googleMapsLoader'

export type ProximityJob = { id:string; latitude?:number|null; longitude?:number|null }
export type ProximityGuard = { sourceId?:string; id:number; name:string; initials:string; status:string; latitude?:number|null; longitude?:number|null; freshness?:string|null; currentAddress?:string|null; photoUrl?:string|null }
export type JobProximity = {
  jobId:string
  guard:ProximityGuard
  distanceText:string
  durationText:string
  distanceMeters:number
  durationSeconds:number
  status:'ready'|'estimated'|'onsite'
}

const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const ONSITE_METERS=40

function haversineMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}){
 const r=6371000,toRad=(n:number)=>n*Math.PI/180
 const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng)
 const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
 return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}
function estimatedIntel(job:ProximityJob,eligible:ProximityGuard[]):JobProximity|null{
 if(!valid(job.latitude)||!valid(job.longitude)||!eligible.length)return null
 const destination={lat:job.latitude,lng:job.longitude}
 const ranked=eligible.map(guard=>({guard,meters:haversineMeters({lat:guard.latitude as number,lng:guard.longitude as number},destination)})).sort((a,b)=>a.meters-b.meters)
 const best=ranked[0]
 if(best.meters<=ONSITE_METERS)return{jobId:job.id,guard:best.guard,distanceText:'On site',durationText:'On site',distanceMeters:best.meters,durationSeconds:0,status:'onsite'}
 const roadMeters=best.meters*1.22
 const seconds=Math.max(60,Math.round(roadMeters/11.2))
 const miles=roadMeters/1609.344
 return{jobId:job.id,guard:best.guard,distanceText:`~${miles<10?miles.toFixed(1):Math.round(miles)} mi`,durationText:`~${Math.max(1,Math.round(seconds/60))} min`,distanceMeters:roadMeters,durationSeconds:seconds,status:'estimated'}
}

export function useMarketplaceProximity(jobs:ProximityJob[],guards:ProximityGuard[]){
 const eligible=useMemo(()=>guards.filter(g=>g.status==='available'&&valid(g.latitude)&&valid(g.longitude)&&g.freshness!=='expired'&&g.freshness!=='offline'),[guards])
 const baseline=useMemo(()=>Object.fromEntries(jobs.map(job=>[job.id,estimatedIntel(job,eligible)]).filter((entry):entry is [string,JobProximity]=>Boolean(entry[1]))),[jobs,eligible])
 const [routed,setRouted]=useState<Record<string,JobProximity>>({})
 const [loading,setLoading]=useState(false)
 const jobKey=jobs.map(j=>`${j.id}:${j.latitude}:${j.longitude}`).join('|')
 const guardKey=eligible.map(g=>`${g.sourceId??g.id}:${g.latitude}:${g.longitude}:${g.freshness}`).join('|')
 useEffect(()=>{let cancelled=false
  ;(async()=>{
   const routable=jobs.filter(j=>valid(j.latitude)&&valid(j.longitude))
   if(!routable.length||!eligible.length){setRouted({});return}
   setLoading(true)
   try{
    const google=await loadGoogleMaps()
    const service=new google.maps.DistanceMatrixService()
    const next:Record<string,JobProximity>={}
    await Promise.all(routable.map(job=>new Promise<void>(resolve=>{
     service.getDistanceMatrix({origins:eligible.map(g=>({lat:g.latitude as number,lng:g.longitude as number})),destinations:[{lat:job.latitude as number,lng:job.longitude as number}],travelMode:google.maps.TravelMode.DRIVING,drivingOptions:{departureTime:new Date(),trafficModel:google.maps.TrafficModel.BEST_GUESS},unitSystem:google.maps.UnitSystem.IMPERIAL},(result:any,status:string)=>{
      if(status==='OK'&&result){
       let best:{index:number;el:any}|null=null
       ;(result.rows??[]).forEach((row:any,index:number)=>{const el=row.elements?.[0];if(el?.status==='OK'&&(!best||(el.duration_in_traffic?.value??el.duration.value)<(best.el.duration_in_traffic?.value??best.el.duration.value)))best={index,el}})
       if(best){const distance=best.el.distance?.value??0;const duration=best.el.duration_in_traffic?.value??best.el.duration?.value??0;next[job.id]={jobId:job.id,guard:eligible[best.index],distanceText:distance<=ONSITE_METERS?'On site':best.el.distance?.text??'—',durationText:distance<=ONSITE_METERS?'On site':best.el.duration_in_traffic?.text??best.el.duration?.text??'—',distanceMeters:distance,durationSeconds:distance<=ONSITE_METERS?0:duration,status:distance<=ONSITE_METERS?'onsite':'ready'}}
      }
      resolve()
     })
    })))
    if(!cancelled)setRouted(next)
   }catch{
    if(!cancelled)setRouted({})
   }finally{if(!cancelled)setLoading(false)}
  })()
  return()=>{cancelled=true}
 },[jobKey,guardKey])
 return {byJob:{...baseline,...routed},loading,eligibleCount:eligible.length}
}
