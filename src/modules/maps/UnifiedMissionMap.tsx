import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, LocateFixed, MapPin, Navigation } from 'lucide-react'
import { loadGoogleMaps } from './googleMapsLoader'

export type MapPoint = { latitude:number|null; longitude:number|null }
export type UnifiedMissionMapProps = {
  property:{ name:string; address:string; latitude:number|null; longitude:number|null }
  guard?:{ name?:string|null; latitude:number|null; longitude:number|null; freshness?:string|null }|null
  role:'client'|'guard'|'agency'|'platform'
  useDeviceLocation?:boolean
  completed?:boolean
  className?:string
  onRouteMetrics?:(metrics:{distanceText:string;durationText:string}|null)=>void
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
const PROPERTY_ICON=svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#ef4444" fill-opacity=".22"/><circle cx="26" cy="26" r="16" fill="#ef4444"/><path d="M19 24.5 26 19l7 5.5V34H19z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M23 34v-6h6v6" fill="none" stroke="white" stroke-width="2"/></svg>')
const GUARD_ICON=svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#1684ff" fill-opacity=".22"/><circle cx="26" cy="26" r="16" fill="#1684ff"/><path d="M26 17.5 33 20v5.5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V20z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>')

export default function UnifiedMissionMap({property,guard,role,useDeviceLocation=false,completed=false,className='',onRouteMetrics}:UnifiedMissionMapProps){
 const hostRef=useRef<HTMLDivElement|null>(null),mapRef=useRef<any>(null),guardMarkerRef=useRef<any>(null),propertyMarkerRef=useRef<any>(null),rendererRef=useRef<any>(null),serviceRef=useRef<any>(null)
 const [error,setError]=useState<string|null>(null),[devicePoint,setDevicePoint]=useState<{latitude:number;longitude:number}|null>(null),[ready,setReady]=useState(0)
 const propertyPoint=useMemo(()=>validPoint(property.latitude,property.longitude),[property.latitude,property.longitude])
 const source=useDeviceLocation?devicePoint:guard
 const guardPoint=useMemo(()=>validPoint(source?.latitude,source?.longitude),[source?.latitude,source?.longitude])

 useEffect(()=>{if(!useDeviceLocation)return; if(!navigator.geolocation){setError('Location is not supported on this device.');return}
  const id=navigator.geolocation.watchPosition(p=>{setDevicePoint({latitude:p.coords.latitude,longitude:p.coords.longitude});setError(null)},e=>setError(e.message),{enableHighAccuracy:true,maximumAge:5000,timeout:15000})
  return()=>navigator.geolocation.clearWatch(id)
 },[useDeviceLocation])

 useEffect(()=>{let cancelled=false;(async()=>{if(!hostRef.current||!propertyPoint)return;try{const google=await loadGoogleMaps();if(cancelled||!hostRef.current)return
  const map=new google.maps.Map(hostRef.current,{center:propertyPoint,zoom:15,disableDefaultUI:true,clickableIcons:false,gestureHandling:'cooperative',styles:DARK_MAP_STYLE,backgroundColor:'#091722'})
  mapRef.current=map;propertyMarkerRef.current=new google.maps.Marker({map,position:propertyPoint,title:property.name,icon:{url:PROPERTY_ICON,scaledSize:new google.maps.Size(52,52),anchor:new google.maps.Point(26,26)},zIndex:3})
  serviceRef.current=new google.maps.DirectionsService();rendererRef.current=new google.maps.DirectionsRenderer({map,suppressMarkers:true,preserveViewport:false,polylineOptions:{strokeColor:'#2d92ff',strokeOpacity:.92,strokeWeight:5}});setReady(v=>v+1);setError(null)
 }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Unable to load map.')}})();return()=>{cancelled=true;guardMarkerRef.current?.setMap(null);propertyMarkerRef.current?.setMap(null);rendererRef.current?.setMap(null);mapRef.current=null}},[property.name,property.latitude,property.longitude])

 useEffect(()=>{const map=mapRef.current,google=window.google;if(!map||!google?.maps||!propertyPoint)return
  if(!guardPoint||completed){guardMarkerRef.current?.setMap(null);guardMarkerRef.current=null;rendererRef.current?.setDirections({routes:[]});map.panTo(propertyPoint);map.setZoom(16);onRouteMetrics?.(null);return}
  if(!guardMarkerRef.current)guardMarkerRef.current=new google.maps.Marker({map,position:guardPoint,title:guard?.name||'Guard',icon:{url:GUARD_ICON,scaledSize:new google.maps.Size(52,52),anchor:new google.maps.Point(26,26)},zIndex:4})
  else animateMarker(guardMarkerRef.current,guardPoint)
  serviceRef.current?.route({origin:guardPoint,destination:propertyPoint,travelMode:google.maps.TravelMode.DRIVING,provideRouteAlternatives:false},(result:any,status:string)=>{if(status===google.maps.DirectionsStatus.OK&&result){rendererRef.current?.setDirections(result);const leg=result.routes?.[0]?.legs?.[0];onRouteMetrics?.(leg?{distanceText:leg.distance?.text||'—',durationText:leg.duration?.text||'—'}:null)}else{const bounds=new google.maps.LatLngBounds();bounds.extend(guardPoint);bounds.extend(propertyPoint);map.fitBounds(bounds,70);onRouteMetrics?.(null)}})
 },[guardPoint?.lat,guardPoint?.lng,propertyPoint?.lat,propertyPoint?.lng,completed,ready])

 return <div className={`unified-mission-map role-${role} ${className}`}>
  {propertyPoint?<div ref={hostRef} className="unified-google-map"/>:<div className="unified-map-unavailable"><Building2/><strong>Property map unavailable</strong><span>This property needs verified coordinates.</span></div>}
  {error?<div className="unified-map-error">{error}</div>:null}
  <div className="unified-map-address"><MapPin/><span><small>SECURITY LOCATION</small><b>{property.name}</b><em>{property.address}</em></span></div>
  <span className={`unified-map-freshness ${guardPoint?'live':'waiting'}`}>{guardPoint?<Navigation/>:<LocateFixed/>}{guardPoint?'ROUTE LIVE':'WAITING FOR GPS'}</span>
 </div>
}
function validPoint(latitude?:number|null,longitude?:number|null){if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;return{lat:latitude,lng:longitude}}
function animateMarker(marker:any,destination:{lat:number;lng:number}){const start=marker.getPosition();if(!start){marker.setPosition(destination);return}const from={lat:start.lat(),lng:start.lng()},began=performance.now(),duration=700;const step=(now:number)=>{const p=Math.min(1,(now-began)/duration),e=1-Math.pow(1-p,3);marker.setPosition({lat:from.lat+(destination.lat-from.lat)*e,lng:from.lng+(destination.lng-from.lng)*e});if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
