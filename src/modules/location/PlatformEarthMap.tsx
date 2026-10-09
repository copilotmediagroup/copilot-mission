import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from './addressSearch'
import type { MissionMapMarker } from './MissionMap'

type Props={markers:MissionMapMarker[];focusTarget?:{latitude:number;longitude:number}|null}
const HOME={lat:27.9506,lng:-82.4572,altitude:0}

export default function PlatformEarthMap({markers,focusTarget}:Props){
 const hostRef=useRef<HTMLDivElement|null>(null)
 const mapRef=useRef<any>(null)
 const markerElsRef=useRef<any[]>([])
 const lastTargetRef=useRef('')
 useEffect(()=>{let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled||!hostRef.current)return;const Map3DElement=maps3d.Map3DElement;const map=new Map3DElement({center:HOME,range:180000,tilt:45,heading:0,mode:'SATELLITE',gestureHandling:'COOPERATIVE'});map.style.width='100%';map.style.height='100%';hostRef.current.replaceChildren(map);mapRef.current=map})().catch(console.error);return()=>{cancelled=true;mapRef.current?.stopCameraAnimation?.();mapRef.current=null}},[])
 useEffect(()=>{const map=mapRef.current;if(!map)return;let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled)return;markerElsRef.current.forEach(el=>el.remove());markerElsRef.current=[];for(const marker of markers){const Marker=maps3d.Marker3DInteractiveElement??maps3d.Marker3DElement;const el=new Marker({position:{lat:marker.latitude,lng:marker.longitude,altitude:0},label:marker.label||marker.title||'',extruded:marker.type==='guard',sizePreserved:true});if(el.addEventListener)el.addEventListener('gmp-click',()=>{map.stopCameraAnimation?.();map.flyCameraTo({endCamera:{center:{lat:marker.latitude,lng:marker.longitude,altitude:0},range:2500,tilt:58,heading:0},durationMillis:4500})});map.append(el);markerElsRef.current.push(el)}})();return()=>{cancelled=true}},[markers])
 useEffect(()=>{const map=mapRef.current;if(!map||!focusTarget)return;const key=`${focusTarget.latitude},${focusTarget.longitude}`;if(lastTargetRef.current===key)return;lastTargetRef.current=key;map.stopCameraAnimation?.();map.flyCameraTo({endCamera:{center:{lat:focusTarget.latitude,lng:focusTarget.longitude,altitude:0},range:2500,tilt:58,heading:0},durationMillis:30000})},[focusTarget?.latitude,focusTarget?.longitude])
 return <div ref={hostRef} className="platform-earth-map" aria-label="Live Google Earth platform map"/>
}
