import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Building2, LocateFixed, MapPin, Navigation, ShieldCheck } from 'lucide-react'
import { loadGoogleMaps } from './googleMapsLoader'

export type AgencyMapJob = {
  id: string
  title: string
  kind: 'standard' | 'priority' | 'emergency'
  latitude: number | null
  longitude: number | null
}

export type AgencyMapGuard = {
  id: string
  name: string
  status: 'available' | 'on-mission' | 'reserved' | 'offline'
  latitude: number | null
  longitude: number | null
  freshness?: string | null
}

export type MissionRouteContext = {
  missionId: string
  missionTitle: string
  state: 'awaiting_guard'|'offered'|'accepted'|'en_route'|'active'|'checkpoint'|'review'|'completed'|'cancelled'
  destination: { latitude:number|null; longitude:number|null }
  guard: { id:string; name:string; latitude:number|null; longitude:number|null; freshness?:string|null } | null
}

export type AgencyOperationsMapProps = {
  jobs: AgencyMapJob[]
  guards: AgencyMapGuard[]
  showJobs: boolean
  showGuards: boolean
  routeContext?: MissionRouteContext | null
  onRouteMetrics?: (metrics:{distanceText:string;durationText:string;mode:'preview'|'live'|'onsite'}|null)=>void
}

type MapPoint =
  | { type: 'job'; item: AgencyMapJob; lat: number; lng: number }
  | { type: 'guard'; item: AgencyMapGuard; lat: number; lng: number }

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#091722' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#091722' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8297aa' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#183043' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0c1d2a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#21445e' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06101a' }] },
]

const svgIcon = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
const icons: Record<'standard' | 'priority' | 'emergency' | 'guard', string> = {
  standard: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#eab308" fill-opacity=".22"/><circle cx="21" cy="21" r="12" fill="#eab308"/><path d="M15 20h12v9H15zM17 20v-4h8v4" fill="none" stroke="white" stroke-width="2"/></svg>'),
  priority: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#f97316" fill-opacity=".22"/><circle cx="21" cy="21" r="12" fill="#f97316"/><path d="m23 10-8 12h6l-2 10 8-13h-6z" fill="white"/></svg>'),
  emergency: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="19" fill="#ef4444" fill-opacity=".25"/><circle cx="21" cy="21" r="12" fill="#ef4444"/><path d="M21 12v11M21 28v2" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>'),
  guard: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="#1684ff" fill-opacity=".22"/><circle cx="22" cy="22" r="13" fill="#1684ff"/><path d="M22 13.5 29 16v5.5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V16z" fill="none" stroke="white" stroke-width="2"/></svg>'),
}

export default function AgencyOperationsMap({jobs,guards,showJobs,showGuards,routeContext,onRouteMetrics}:AgencyOperationsMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeRendererRef = useRef<any>(null)
  const routeServiceRef = useRef<any>(null)
  const routeRequestRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(0)
  const [routeStatus,setRouteStatus]=useState<'none'|'waiting'|'preview'|'routing'|'live'|'onsite'|'stale'|'unavailable'>('none')
  const [routeMetrics,setRouteMetrics]=useState<{distanceText:string;durationText:string}|null>(null)

  const points = useMemo<MapPoint[]>(() => [
    ...(showJobs ? jobs.filter((item) => valid(item.latitude, item.longitude)).map((item): MapPoint => ({type:'job',item,lat:item.latitude as number,lng:item.longitude as number})) : []),
    ...(showGuards ? guards.filter((item) => item.status !== 'offline' && valid(item.latitude, item.longitude)).map((item): MapPoint => ({type:'guard',item,lat:item.latitude as number,lng:item.longitude as number})) : []),
  ], [jobs, guards, showJobs, showGuards])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const google = await loadGoogleMaps()
        if (cancelled || !hostRef.current) return
        const map = new google.maps.Map(hostRef.current, {center:{lat:27.89,lng:-82.32},zoom:11,disableDefaultUI:false,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,styles:DARK_MAP_STYLE,backgroundColor:'#091722'})
        mapRef.current = map
        routeServiceRef.current = new google.maps.DirectionsService()
        routeRendererRef.current = new google.maps.DirectionsRenderer({map,suppressMarkers:true,preserveViewport:true,polylineOptions:{strokeColor:'#1684ff',strokeOpacity:.96,strokeWeight:6}})
        setReady(v=>v+1)
        setError(null)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load agency map.')
      }
    })()
    return () => {cancelled=true;markersRef.current.forEach((marker)=>marker.setMap(null));markersRef.current=[];routeRendererRef.current?.setMap(null);mapRef.current=null}
  }, [])

  useEffect(() => {
    const google = window.google
    const map = mapRef.current
    if (!google?.maps || !map) return
    markersRef.current.forEach((marker) => marker.setMap(null)); markersRef.current=[]
    if (!points.length) {map.setCenter({lat:27.89,lng:-82.32});map.setZoom(11);return}
    const bounds = new google.maps.LatLngBounds()
    points.forEach((point) => {
      const position={lat:point.lat,lng:point.lng};bounds.extend(position)
      const isGuard=point.type==='guard'
      const title=isGuard?point.item.name:point.item.title
      const detail=isGuard?(point.item.freshness||point.item.status):point.item.kind
      const markerSize=isGuard?44:42
      const marker=new google.maps.Marker({map,position,title,icon:{url:isGuard?icons.guard:icons[point.item.kind],scaledSize:new google.maps.Size(markerSize,markerSize),anchor:new google.maps.Point(markerSize/2,markerSize/2)},zIndex:isGuard?5:3})
      const info=new google.maps.InfoWindow({content:`<div style="font:600 13px system-ui;color:#0b1220;padding:2px 4px">${escapeHtml(title)}<br><small style="font-weight:500">${escapeHtml(detail)}</small></div>`})
      marker.addListener('click',()=>info.open({map,anchor:marker}));markersRef.current.push(marker)
    })
    if (!routeContext) {map.fitBounds(bounds,70);if(points.length===1)window.setTimeout(()=>map.setZoom(15),0)}
  }, [points,ready,routeContext?.missionId])

  useEffect(()=>{
    const google=window.google,map=mapRef.current,renderer=routeRendererRef.current,service=routeServiceRef.current
    if(!google?.maps||!map||!renderer||!service)return
    const requestId=++routeRequestRef.current
    const state=routeContext?.state
    const routeEligible=state&&['offered','accepted','en_route'].includes(state)
    const destination=routeContext&&valid(routeContext.destination.latitude,routeContext.destination.longitude)?{lat:routeContext.destination.latitude as number,lng:routeContext.destination.longitude as number}:null
    const guard=routeContext?.guard
    const origin=guard&&valid(guard.latitude,guard.longitude)?{lat:guard.latitude as number,lng:guard.longitude as number}:null
    if(!routeContext||!routeEligible){renderer.setDirections({routes:[]});setRouteMetrics(null);onRouteMetrics?.(null);setRouteStatus(routeContext?.state==='awaiting_guard'?'waiting':'none');return}
    if(!destination||!origin){renderer.setDirections({routes:[]});setRouteMetrics(null);onRouteMetrics?.(null);setRouteStatus(!origin?'waiting':'unavailable');return}
    const direct=distanceMeters(origin,destination)
    if(direct<=40){renderer.setDirections({routes:[]});map.panTo(destination);map.setZoom(17);const metrics={distanceText:'On site',durationText:'On site'};setRouteMetrics(metrics);onRouteMetrics?.({...metrics,mode:'onsite'});setRouteStatus('onsite');return}
    setRouteStatus('routing')
    const preview=state==='offered'
    renderer.setOptions({polylineOptions:{strokeColor:'#1684ff',strokeOpacity:preview?.62:.96,strokeWeight:preview?5:6}})
    service.route({origin,destination,travelMode:google.maps.TravelMode.DRIVING,drivingOptions:{departureTime:new Date(),trafficModel:google.maps.TrafficModel.BEST_GUESS},provideRouteAlternatives:false},(result:any,status:string)=>{
      if(requestId!==routeRequestRef.current)return
      if(status===google.maps.DirectionsStatus.OK&&result){
        renderer.setDirections(result)
        const leg=result.routes?.[0]?.legs?.[0]
        const bounds=new google.maps.LatLngBounds()
        points.forEach(p=>bounds.extend({lat:p.lat,lng:p.lng}));result.routes?.[0]?.overview_path?.forEach((p:any)=>bounds.extend(p));map.fitBounds(bounds,72)
        const metrics={distanceText:leg?.distance?.text||'—',durationText:leg?.duration_in_traffic?.text||leg?.duration?.text||'—'}
        setRouteMetrics(metrics);onRouteMetrics?.({...metrics,mode:preview?'preview':'live'})
        setRouteStatus(guard?.freshness==='stale'||guard?.freshness==='expired'?'stale':preview?'preview':'live')
      }else{
        renderer.setDirections({routes:[]});const bounds=new google.maps.LatLngBounds();points.forEach(p=>bounds.extend({lat:p.lat,lng:p.lng}));bounds.extend(origin);bounds.extend(destination);map.fitBounds(bounds,72);setRouteMetrics(null);onRouteMetrics?.(null);setRouteStatus('unavailable')
      }
    })
  },[routeContext?.missionId,routeContext?.state,routeContext?.destination.latitude,routeContext?.destination.longitude,routeContext?.guard?.latitude,routeContext?.guard?.longitude,routeContext?.guard?.freshness,ready])

  const label=routeStatus==='onsite'?'GUARD ON SITE':routeStatus==='live'?'LIVE ROUTE · EN ROUTE':routeStatus==='preview'?'PROPOSED ROUTE · AWAITING ACCEPTANCE':routeStatus==='stale'?'LAST KNOWN ROUTE · GPS STALE':routeStatus==='routing'?'CALCULATING FASTEST ROUTE':routeStatus==='waiting'?'WAITING FOR GUARD GPS':routeStatus==='unavailable'?'ROUTE UNAVAILABLE':null
  return <div className="agency-operations-map">
    <div ref={hostRef} className="agency-google-map" />
    {error&&<div className="agency-map-error"><Building2/><strong>Live map unavailable</strong><span>{error}</span></div>}
    {!error&&!points.length&&<div className="agency-map-empty"><LocateFixed/><strong>No verified coordinates in this view</strong><span>Markers appear when jobs or online guards have live coordinates.</span></div>}
    {label&&<div className={`operations-route-authority ${routeStatus}`}><span>{routeStatus==='unavailable'||routeStatus==='stale'?<AlertTriangle/>:<Navigation/>}</span><div><small>MISSION ROUTE AUTHORITY</small><strong>{label}</strong>{routeMetrics&&<em>{routeMetrics.durationText} · {routeMetrics.distanceText}</em>}</div></div>}
    <div className="agency-map-legend"><span><MapPin/>Jobs</span><span><ShieldCheck/>My Guards</span></div>
  </div>
}

function valid(lat:number|null|undefined,lng:number|null|undefined){return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)}
function distanceMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}){const r=6371000,toRad=(n:number)=>n*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]||char))}
