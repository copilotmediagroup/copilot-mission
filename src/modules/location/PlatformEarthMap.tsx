import { useEffect, useRef } from 'react'
import { loadGoogleMaps } from './addressSearch'
import type { MissionMapMarker } from './MissionMap'

type Props={markers:MissionMapMarker[];focusTarget?:{latitude:number;longitude:number}|null}
const HOME={lat:27.9506,lng:-82.4572,altitude:80}

export default function PlatformEarthMap({markers,focusTarget}:Props){
 const hostRef=useRef<HTMLDivElement|null>(null)
 const mapRef=useRef<any>(null)
 const markerElsRef=useRef<any[]>([])
 const steadyRef=useRef(false)
 const pendingTargetRef=useRef(focusTarget)
 pendingTargetRef.current=focusTarget
 const fly=(target:{latitude:number;longitude:number})=>{const map=mapRef.current;if(!map)return;if(!steadyRef.current){pendingTargetRef.current=target;return}map.stopCameraAnimation?.();map.flyCameraTo({endCamera:{center:{lat:target.latitude,lng:target.longitude,altitude:80},range:8500,tilt:65,heading:0},durationMillis:30000})}
 useEffect(()=>{let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled||!hostRef.current)return;const {Map3DElement}=maps3d;const map=new Map3DElement({center:HOME,range:6500,tilt:65,heading:0,mode:'SATELLITE',gestureHandling:'COOPERATIVE',defaultUIHidden:false});map.style.width='100%';map.style.height='100%';hostRef.current.replaceChildren(map);mapRef.current=map;map.addEventListener('gmp-steadychange',(event:any)=>{steadyRef.current=Boolean(event?.isSteady);if(steadyRef.current&&pendingTargetRef.current){const target=pendingTargetRef.current;pendingTargetRef.current=null;fly(target)}})})().catch(console.error);return()=>{cancelled=true;steadyRef.current=false;mapRef.current?.stopCameraAnimation?.();mapRef.current=null}},[])
 useEffect(()=>{const map=mapRef.current;if(!map)return;let cancelled=false;void(async()=>{const google=await loadGoogleMaps();const maps3d=await google.maps.importLibrary('maps3d');if(cancelled)return;markerElsRef.current.forEach(el=>el.remove());markerElsRef.current=[];for(const marker of markers){const Marker=maps3d.Marker3DInteractiveElement??maps3d.Marker3DElement;const el=new Marker({position:{lat:marker.latitude,lng:marker.longitude,altitude:80},label:marker.label||marker.title||'',extruded:marker.type==='guard',sizePreserved:true});if(el.addEventListener)el.addEventListener('gmp-click',()=>fly({latitude:marker.latitude,longitude:marker.longitude}));map.append(el);markerElsRef.current.push(el)}})();return()=>{cancelled=true}},[markers])
 useEffect(()=>{if(!focusTarget)return;fly(focusTarget)},[focusTarget?.latitude,focusTarget?.longitude])
 return <div ref={hostRef} className="platform-earth-map" aria-label="Live Google Earth platform map"/>
}
