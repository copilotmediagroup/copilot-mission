import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from './addressSearch'
import type { MissionMapMarker } from './MissionMap'

type Props={markers:MissionMapMarker[];focusTarget?:{latitude:number;longitude:number}|null}
const HOME={lat:27.9506,lng:-82.4572,altitude:0}
const waitForFlight=(map:any,endCamera:any,durationMillis:number)=>new Promise<void>((resolve,reject)=>{let done=false;const finish=()=>{if(done)return;done=true;map.removeEventListener?.('gmp-animationend',finish);resolve()};map.addEventListener?.('gmp-animationend',finish,{once:true});try{const result=map.flyCameraTo({endCamera,durationMillis});Promise.resolve(result).catch(reject);window.setTimeout(finish,durationMillis+1500)}catch(error){reject(error)}})

export default function PlatformEarthMap({markers,focusTarget}:Props){
 const hostRef=useRef<HTMLDivElement|null>(null)
 const mapRef=useRef<any>(null)
 const markerElsRef=useRef<any[]>([])
 const flightIdRef=useRef(0)
 const pendingTargetRef=useRef(focusTarget)
 pendingTargetRef.current=focusTarget
 const flyToTarget=async(map:any,target:{latitude:number;longitude:number})=>{const flightId=++flightIdRef.current;map.stopCameraAnimation?.();const center=map.center??HOME;const fromLat=Number(center.lat??center.latitude??HOME.lat),fromLng=Number(center.lng??center.longitude??HOME.lng);const distance=Math.hypot(target.latitude-fromLat,target.longitude-fromLng);if(distance<0.8){await waitForFlight(map,{center:{lat:target.latitude,lng:target.longitude,altitude:0},range:2500,tilt:58,heading:0},6500);return}const cruiseRange=Math.min(5000000,Math.max(900000,distance*140000));await waitForFlight(map,{center:{lat:fromLat,lng:fromLng,altitude:0},range:cruiseRange,tilt:20,heading:0},6000);if(flightIdRef.current!==flightId)return;await waitForFlight(map,{center:{lat:target.latitude,lng:target.longitude,altitude:0},range:cruiseRange,tilt:20,heading:0},16000);if(flightIdRef.current!==flightId)return;await waitForFlight(map,{center:{lat:target.latitude,lng:target.longitude,altitude:0},range:2500,tilt:58,heading:0},8000)}
 useEffect(()=>{let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled||!hostRef.current)return;const Map3DElement=maps3d.Map3DElement;const map=new Map3DElement({center:HOME,range:180000,tilt:45,heading:0,mode:'SATELLITE',gestureHandling:'COOPERATIVE'});map.style.width='100%';map.style.height='100%';hostRef.current.replaceChildren(map);mapRef.current=map;const pending=pendingTargetRef.current;if(pending)void flyToTarget(map,pending)})().catch(console.error);return()=>{cancelled=true;flightIdRef.current++;mapRef.current?.stopCameraAnimation?.();mapRef.current=null}},[])
 useEffect(()=>{const map=mapRef.current;if(!map)return;let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled)return;markerElsRef.current.forEach(el=>el.remove());markerElsRef.current=[];for(const marker of markers){const Marker=maps3d.Marker3DInteractiveElement??maps3d.Marker3DElement;const el=new Marker({position:{lat:marker.latitude,lng:marker.longitude,altitude:0},label:marker.label||marker.title||'',extruded:marker.type==='guard',sizePreserved:true});if(el.addEventListener)el.addEventListener('gmp-click',()=>void flyToTarget(map,{latitude:marker.latitude,longitude:marker.longitude}));map.append(el);markerElsRef.current.push(el)}})();return()=>{cancelled=true}},[markers])
 useEffect(()=>{const map=mapRef.current;if(!map||!focusTarget)return;void flyToTarget(map,focusTarget)},[focusTarget?.latitude,focusTarget?.longitude])
 return <div ref={hostRef} className="platform-earth-map" aria-label="Live Google Earth platform map"/>
}
