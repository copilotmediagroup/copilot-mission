import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, LocateFixed, MapPin, ShieldCheck } from 'lucide-react'
import { loadGoogleMaps } from './googleMapsLoader'

export type AgencyMapJob = {
  id:string
  title:string
  kind:'standard'|'priority'|'emergency'
  latitude:number|null
  longitude:number|null
}
export type AgencyMapGuard = {
  id:string
  name:string
  status:'available'|'on-mission'|'reserved'|'offline'
  latitude:number|null
  longitude:number|null
  freshness?:string|null
}
export type AgencyOperationsMapProps = {
  jobs:AgencyMapJob[]
  guards:AgencyMapGuard[]
  showJobs:boolean
  showGuards:boolean
}

const DARK_MAP_STYLE=[
 {elementType:'geometry',stylers:[{color:'#091722'}]},
 {elementType:'labels.text.stroke',stylers:[{color:'#091722'}]},
 {elementType:'labels.text.fill',stylers:[{color:'#8297aa'}]},
 {featureType:'poi',stylers:[{visibility:'off'}]},
 {featureType:'road',elementType:'geometry',stylers:[{color:'#183043'}]},
 {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#0c1d2a'}]},
 {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#21445e'}]},
 {featureType:'transit',stylers:[{visibility:'off'}]},
 {featureType:'water',elementType:'geometry',stylers:[{color:'#06101a'}]},
]
const svgIcon=(svg:string)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
const icons: Record<'standard' | 'priority' | 'emergency' | 'guard', string>={
 standard:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#eab308" fill-opacity=".22"/><circle cx="21" cy="21" r="12" fill="#eab308"/><path d="M15 20h12v9H15zM17 20v-4h8v4" fill="none" stroke="white" stroke-width="2"/></svg>'),
 priority:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#f97316" fill-opacity=".22"/><circle cx="21" cy="21" r="12" fill="#f97316"/><path d="m23 10-8 12h6l-2 10 8-13h-6z" fill="white"/></svg>'),
 emergency:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#ef4444" fill-opacity=".25"/><circle cx="21" cy="21" r="12" fill="#ef4444"/><path d="M21 12v11M21 28v2" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>'),
 guard:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="#22c55e" fill-opacity=".22"/><circle cx="22" cy="22" r="13" fill="#22c55e"/><path d="M22 13.5 29 16v5.5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V16z" fill="none" stroke="white" stroke-width="2"/></svg>')
}

export default function AgencyOperationsMap({jobs,guards,showJobs,showGuards}:AgencyOperationsMapProps){
 const hostRef=useRef<HTMLDivElement|null>(null)
 const mapRef=useRef<any>(null)
 const markersRef=useRef<any[]>([])
 const [error,setError]=useState<string|null>(null)
 const points=useMemo(()=>[
  ...(showJobs?jobs.filter(item=>valid(item.latitude,item.longitude)).map(item=>({type:'job' as const,item,lat:item.latitude as number,lng:item.longitude as number})):[]),
  ...(showGuards?guards.filter(item=>item.status!=='offline'&&valid(item.latitude,item.longitude)).map(item=>({type:'guard' as const,item,lat:item.latitude as number,lng:item.longitude as number})):[]),
 ],[jobs,guards,showJobs,showGuards])

 useEffect(()=>{let cancelled=false;(async()=>{try{const google=await loadGoogleMaps();if(cancelled||!hostRef.current)return
   mapRef.current=new google.maps.Map(hostRef.current,{center:{lat:27.89,lng:-82.32},zoom:11,disableDefaultUI:false,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,styles:DARK_MAP_STYLE,backgroundColor:'#091722'})
   setError(null)
  }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Unable to load agency map.')}
 })();return()=>{cancelled=true;markersRef.current.forEach(marker=>marker.setMap(null));markersRef.current=[];mapRef.current=null}},[])

 useEffect(()=>{const google=window.google,map=mapRef.current;if(!google?.maps||!map)return
  markersRef.current.forEach(marker=>marker.setMap(null));markersRef.current=[]
  if(!points.length){map.setCenter({lat:27.89,lng:-82.32});map.setZoom(11);return}
  const bounds=new google.maps.LatLngBounds()
  points.forEach(point=>{const position={lat:point.lat,lng:point.lng};bounds.extend(position)
   const isGuard=point.type==='guard'
   const item=point.item
   const iconUrl=isGuard?icons.guard:icons[item.kind]
   const marker=new google.maps.Marker({map,position,title:isGuard?item.name:item.title,icon:{url:iconUrl,scaledSize:new google.maps.Size(isGuard?44:42,isGuard?44:42),anchor:new google.maps.Point(isGuard?22:21,isGuard?22:21)},zIndex:isGuard?5:3})
   const info=new google.maps.InfoWindow({content:`<div style="font:600 13px system-ui;color:#0b1220;padding:2px 4px">${escapeHtml(isGuard?item.name:item.title)}<br><small style="font-weight:500">${escapeHtml(isGuard?(item.freshness||item.status):item.kind)}</small></div>`})
   marker.addListener('click',()=>info.open({map,anchor:marker}));markersRef.current.push(marker)
  })
  map.fitBounds(bounds,70);if(points.length===1)window.setTimeout(()=>map.setZoom(15),0)
 },[points])

 return <div className="agency-operations-map">
   <div ref={hostRef} className="agency-google-map"/>
   {error&&<div className="agency-map-error"><Building2/><strong>Live map unavailable</strong><span>{error}</span></div>}
   {!error&&!points.length&&<div className="agency-map-empty"><LocateFixed/><strong>No verified coordinates in this view</strong><span>Markers appear when jobs or online guards have live coordinates.</span></div>}
   <div className="agency-map-legend"><span><MapPin/> Jobs</span><span><ShieldCheck/> My Guards</span></div>
 </div>
}
function valid(lat:number|null,lng:number|null){return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]||char))}
