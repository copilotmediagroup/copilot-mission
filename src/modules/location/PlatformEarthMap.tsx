import { useEffect,useRef } from 'react'
import { loadGoogleMaps } from './addressSearch'
import type { MissionMapMarker } from './MissionMap'
type Props={markers:MissionMapMarker[];focusTarget?:{latitude:number;longitude:number}|null}
const HOME={lat:27.9506,lng:-82.4572,altitude:80}
export default function PlatformEarthMap({markers,focusTarget}:Props){
 const hostRef=useRef<HTMLDivElement|null>(null),mapRef=useRef<any>(null),markerEls=useRef<any[]>([]),steadyRef=useRef(false),pending=useRef(focusTarget),markersRef=useRef(markers);markersRef.current=markers;pending.current=focusTarget
 const fly=(target:{latitude:number;longitude:number})=>{const map=mapRef.current;if(!map||!steadyRef.current){pending.current=target;return}pending.current=null;map.stopCameraAnimation?.();map.flyCameraTo({endCamera:{center:{lat:target.latitude,lng:target.longitude,altitude:80},range:8500,tilt:65,heading:0},durationMillis:30000})}
 const renderMarkers=async()=>{const map=mapRef.current;if(!map)return;const google=await loadGoogleMaps(),maps3d=await google.maps.importLibrary('maps3d');markerEls.current.forEach(el=>el.remove());markerEls.current=[];const Marker=maps3d.Marker3DInteractiveElement??maps3d.Marker3DElement;markersRef.current.forEach(marker=>{const el=new Marker({position:{lat:marker.latitude,lng:marker.longitude,altitude:80},label:marker.label||marker.title||'',sizePreserved:true,extruded:marker.type==='guard'});el.addEventListener?.('gmp-click',()=>fly({latitude:marker.latitude,longitude:marker.longitude}));map.append(el);markerEls.current.push(el)})}
 useEffect(()=>{let cancelled=false;void(async()=>{const google=await loadGoogleMaps(),maps3d=await google.maps.importLibrary('maps3d');if(cancelled||!hostRef.current)return;const{Map3DElement}=maps3d,map=new Map3DElement({center:HOME,range:6500,tilt:65,heading:0,mode:'SATELLITE',gestureHandling:'COOPERATIVE',defaultUIHidden:false});map.style.width='100%';map.style.height='100%';hostRef.current.replaceChildren(map);mapRef.current=map;await renderMarkers();map.addEventListener('gmp-steadychange',(e:any)=>{steadyRef.current=Boolean(e?.isSteady);if(steadyRef.current&&pending.current){const target=pending.current;pending.current=null;map.stopCameraAnimation?.();map.flyCameraTo({endCamera:{center:{lat:target.latitude,lng:target.longitude,altitude:80},range:8500,tilt:65,heading:0},durationMillis:30000})}})})().catch(console.error);return()=>{cancelled=true;steadyRef.current=false;mapRef.current?.stopCameraAnimation?.();mapRef.current=null}},[])
 useEffect(()=>{void renderMarkers().catch(console.error)},[markers])
 useEffect(()=>{if(focusTarget)fly(focusTarget)},[focusTarget?.latitude,focusTarget?.longitude])
 return <div ref={hostRef} className="platform-earth-map" aria-label="Live Google Earth platform map"/>
}
