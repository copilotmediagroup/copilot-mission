import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle, BadgeCheck, BarChart3, Bell, BriefcaseBusiness, Building2, ClipboardList,
  CalendarClock, Check, ChevronDown, ChevronRight, CircleDollarSign, Clock3,
  Crosshair, Filter, Flame, Gauge, Layers3, MapPin, MessageSquare, Navigation,
  Radio, Search, Settings, ShieldCheck, Siren, SlidersHorizontal, Users, Wifi, Zap, Bug, Database, LockKeyhole, X, UserPlus, Copy, LoaderCircle, Mail
} from 'lucide-react'
import { useAuth, type AppRole } from './modules/auth/AuthProvider'
import type { DeveloperAccessMode } from './DeveloperPortalSwitcher'
import { acceptMarketplaceJob, getAgencyWorkspace, subscribeToMarketplace, type MarketplaceJobRow } from './modules/marketplace/marketplaceRepository'
import { createGuardInvitation, getGuardRoster, guardActivationUrl, revokeGuardInvitation, type GuardRoster as GuardRosterData } from './modules/marketplace/guardOnboardingRepository'
import { useAgencyGuardState } from './modules/marketplace/useAgencyGuardState'
import { assignGuard, getAgencyDispatchWorkspace, subscribeToDispatch, type AgencyDispatchWorkspace, type DispatchMission } from './modules/dispatch/dispatchRepository'
import ReportingWorkspace from './ReportingWorkspace'
import { getAgencyLiveLocations, subscribeToLocationChanges, type GuardLiveLocation } from './modules/location/liveLocationRepository'
import MissionMap, { type MissionMapMarker } from './modules/location/MissionMap'
import type { ActiveMissionRoute } from './modules/location/missionRouting'
import ThemeToggle from './modules/theme/ThemeToggle'
import { getAgencyMessages as fetchAgencyMessages, sendAgencyMessage as persistAgencyMessage, subscribeToAgencyMessages } from './modules/messaging/messagingRepository'

type JobKind = 'standard' | 'priority' | 'emergency'
type Job = { id:string; title:string; client:string; address:string; distance:number; eta:number; duration:number; kind:JobKind; property:string; price:number; x:number; y:number; latitude?:number|null; longitude?:number|null; live?:boolean; photoUrl?:string|null; currentAddress?:string|null }
type Guard = { id:string|number; name:string; initials:string; distance:number; status:'available'|'on-mission'|'reserved'|'offline'; x:number; y:number; latitude?:number|null; longitude?:number|null; photoUrl?:string|null; currentAddress?:string|null; gpsFreshness?:string|null; source?:'roster'|'live-location'|'fallback' }
type Activity = { id:number; time:string; type:'new'|'accepted'|'emergency'|'assigned'; title:string; location:string }

const initialJobs:Job[] = [
  {id:'101',title:'Immediate Property Check',client:'Riverview Commerce Center',address:'10114 Bloomingdale Ave, Riverview, FL',distance:3.4,eta:9,duration:45,kind:'standard',property:'Retail',price:85,x:18,y:34},
  {id:'102',title:'Vacant Home Patrol',client:'South Fork Community',address:'7622 Summerfield Blvd, Riverview, FL',distance:4.7,eta:12,duration:60,kind:'priority',property:'Residential',price:110,x:42,y:35},
  {id:'103',title:'Construction Site Sweep',client:'Riverview Build Site',address:'13209 U.S. Hwy 301, Riverview, FL',distance:6.9,eta:16,duration:60,kind:'priority',property:'Construction',price:125,x:32,y:57},
  {id:'104',title:'Priority Alarm Response',client:'Progress Village Plaza',address:'10902 Big Bend Rd, Riverview, FL',distance:1.2,eta:4,duration:30,kind:'emergency',property:'Commercial',price:150,x:74,y:24},
]

const incomingJobs:Job[] = [
  {id:'105',title:'Evening Apartment Patrol',client:'Bloomingdale Apartments',address:'3950 Bell Shoals Rd, Valrico, FL',distance:5.2,eta:13,duration:45,kind:'standard',property:'Multifamily',price:95,x:52,y:24},
  {id:'106',title:'Priority Business Check',client:'Brandon Medical Plaza',address:'2020 W Brandon Blvd, Brandon, FL',distance:7.8,eta:18,duration:40,kind:'priority',property:'Medical',price:135,x:27,y:44},
]

const initialActivity:Activity[] = [
  {id:1,time:'11:46 AM',type:'new',title:'New job posted',location:'Riverview Commerce Center'},
  {id:2,time:'11:45 AM',type:'accepted' as const,title:'Agency accepted',location:'Vacant Home Patrol'},
  {id:3,time:'11:43 AM',type:'emergency',title:'New priority response',location:'Progress Village Plaza'},
]

const guards:Guard[] = [
  {id:1,name:'Marcus',initials:'MR',distance:.8,status:'available',x:58,y:31},
  {id:2,name:'Jalen',initials:'JL',distance:1.6,status:'available',x:69,y:47},
  {id:3,name:'Tyler',initials:'TY',distance:2.3,status:'available',x:22,y:64},
  {id:4,name:'Derrick',initials:'DL',distance:3.1,status:'available',x:43,y:77},
  {id:5,name:'Kevin',initials:'KV',distance:4.2,status:'available',x:61,y:83},
  {id:6,name:'Rico',initials:'RC',distance:4.6,status:'available',x:78,y:69},
  {id:7,name:'Anthony',initials:'AN',distance:5.1,status:'available',x:84,y:39},
  {id:8,name:'Nia',initials:'NB',distance:3.8,status:'reserved',x:35,y:18},
  {id:9,name:'Caleb',initials:'CS',distance:6.1,status:'on-mission',x:15,y:76},
  {id:10,name:'Andre',initials:'AK',distance:8.4,status:'offline',x:88,y:82},
]

function agencyMapRadians(value:number){return value*Math.PI/180}
function agencyMapDistanceMiles(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
  const earthMiles=3958.8
  const dLat=agencyMapRadians(b.latitude-a.latitude)
  const dLng=agencyMapRadians(b.longitude-a.longitude)
  const lat1=agencyMapRadians(a.latitude)
  const lat2=agencyMapRadians(b.latitude)
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
  return 2*earthMiles*Math.asin(Math.min(1,Math.sqrt(h)))
}
function agencyEtaMinutes(distanceMiles:number){
  if(!Number.isFinite(distanceMiles))return 0
  return Math.max(3,Math.round((distanceMiles/28)*60)+2)
}
function enhanceJobWithNearestGuard(job:Job,allGuards:Guard[]):Job{
  if(job.latitude==null||job.longitude==null)return job
  const candidates=allGuards.filter(g=>g.status!=='offline'&&g.latitude!=null&&g.longitude!=null)
  if(!candidates.length)return job
  const best=candidates.reduce((winner,g)=>{
    const distance=agencyMapDistanceMiles(
      {latitude:job.latitude as number,longitude:job.longitude as number},
      {latitude:g.latitude as number,longitude:g.longitude as number},
    )
    return !winner||distance<winner.distance?{guard:g,distance}:winner
  },null as null|{guard:Guard;distance:number})
  if(!best)return job
  const distance=Number(best.distance.toFixed(1))
  return {...job,distance,eta:agencyEtaMinutes(best.distance)}
}

function normalizeGuardAvailability(value:string|undefined|null):Guard['status']{
  if(value==='on_mission')return 'on-mission'
  if(value==='reserved')return 'reserved'
  if(value==='available')return 'available'
  return 'offline'
}

function guardInitials(name:string){
  return name.split(' ').map(v=>v[0]).join('').slice(0,2).toUpperCase() || 'G'
}

function hasLiveCoordinates(value:{latitude?:number|null;longitude?:number|null}){
  return value.latitude!=null && value.longitude!=null && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
}

function isActiveAgencyMission(status?:string|null){
  if(!status)return false
  return !['open','completed','cancelled'].includes(status)
}

function activeAgencyMissionCount(dispatch:AgencyDispatchWorkspace|null,accepted:Job[]){
  if(dispatch){
    return dispatch.missions.filter(mission=>isActiveAgencyMission(mission.status)).length
  }
  return accepted.length
}

const navItems = [
  ['marketplace','Marketplace','Find Opportunities',Crosshair],['operations','Operations','Active Missions',Radio],['scheduled','Scheduled','Upcoming Jobs',CalendarClock],['guards','Guards','Manage Your Team',Users],['assignments','Assignments','Won Marketplace Jobs',ClipboardList],['reports','Reports','Mission Reports',BriefcaseBusiness],['analytics','Analytics','Performance Center',BarChart3],['messages','Messages','Inbox & Alerts',MessageSquare],['settings','Settings','Agency Settings',Settings],
] as const
type Tab = typeof navItems[number][0]

export default function AgencyMarketplace({developerMode=false,accessMode='live',viewedRole='agency_admin'}:{developerMode?:boolean;accessMode?:DeveloperAccessMode;viewedRole?:AppRole}){
  const { mode, role, user, status, phase } = useAuth()
  const [tab,setTab]=useState<Tab>('marketplace')
  const [jobs,setJobs]=useState<Job[]>([])
  const [accepted,setAccepted]=useState<Job[]>([])
  const [agencyId,setAgencyId]=useState<string | null>(null)
  const [agencyName,setAgencyName]=useState('Alpha Force Security')
  const [claimingId,setClaimingId]=useState<string | null>(null)
  const [filter,setFilter]=useState<'all'|JobKind>('all')
  const [toast,setToast]=useState('')
  const [activity,setActivity]=useState<Activity[]>([])
  const [incomingIndex,setIncomingIndex]=useState(0)
  const [diagnosticsOpen,setDiagnosticsOpen]=useState(false)
  const [lastError,setLastError]=useState<string | null>(null)
  const [realtimeState,setRealtimeState]=useState<'idle'|'connected'|'preview'>('idle')
  const [marketplaceLoading,setMarketplaceLoading]=useState(false)
  const [lastWorkspaceSyncAt,setLastWorkspaceSyncAt]=useState<number | null>(null)
  const [focusedMissionId,setFocusedMissionId]=useState<string | null>(null)
  const [dispatch,setDispatch]=useState<AgencyDispatchWorkspace|null>(null)
  const [reportCount,setReportCount]=useState(0)
  const [liveLocations,setLiveLocations]=useState<GuardLiveLocation[]>([])
  const isRoleMatch=role==='agency_admin'
  const isPreview=developerMode && accessMode==='preview'
  const guardState=useAgencyGuardState(!isPreview&&mode==='supabase'&&isRoleMatch)

  /*
   * Agency guard map source of truth.
   *
   * A guard who is online under this agency must appear on the Agency map
   * whether or not they have an active assignment. The live location RPC is
   * authoritative for GPS, while the roster is authoritative for membership.
   * Merge both instead of only trusting assignments or stale roster status.
   */
  const liveGuards:Guard[]=useMemo(()=>{
    const byId=new Map<string,Guard>()

    guardState.guards.forEach(g=>{
      const location=liveLocations.find(item=>String(item.guard_id)===String(g.id))
      const status=normalizeGuardAvailability(location?.availability ?? g.availability)
      byId.set(String(g.id),{
        id:g.id,
        name:g.name,
        initials:guardInitials(g.name),
        distance:0,
        status,
        x:50,
        y:50,
        latitude:location?.latitude ?? null,
        longitude:location?.longitude ?? null,
        currentAddress:(location as any)?.current_address ?? null,
        gpsFreshness:location?.freshness ?? null,
        source:'roster',
      })
    })

    liveLocations.forEach(location=>{
      const key=String(location.guard_id)
      const existing=byId.get(key)
      const status=normalizeGuardAvailability(location.availability)
      byId.set(key,{
        id:location.guard_id,
        name:existing?.name || location.name || 'Security Guard',
        initials:existing?.initials || guardInitials(location.name || 'Security Guard'),
        distance:existing?.distance ?? 0,
        status,
        x:existing?.x ?? 50,
        y:existing?.y ?? 50,
        latitude:location.latitude ?? existing?.latitude ?? null,
        longitude:location.longitude ?? existing?.longitude ?? null,
        currentAddress:(location as any)?.current_address ?? existing?.currentAddress ?? null,
        gpsFreshness:location.freshness ?? existing?.gpsFreshness ?? null,
        source:existing ? 'roster' : 'live-location',
      })
    })

    return Array.from(byId.values())
  },[guardState.guards,liveLocations])

  const runtimeGuards=isPreview?guards:liveGuards
  const guardSummary=isPreview?{total:guards.length,online:guards.filter(g=>g.status!=='offline').length,offline:guards.filter(g=>g.status==='offline').length,available:guards.filter(g=>g.status==='available').length,reserved:guards.filter(g=>g.status==='reserved').length,on_mission:guards.filter(g=>g.status==='on-mission').length}:guardState.summary
  const filtered=useMemo(()=>filter==='all'?jobs:jobs.filter(j=>j.kind===filter),[jobs,filter])
  const available=runtimeGuards.filter(g=>g.status==='available')
  const activeOperationCount=isPreview?2:activeAgencyMissionCount(dispatch,accepted)

  const mapLiveJob=(row:MarketplaceJobRow,index:number):Job=>({
    id:row.id,title:row.title,client:row.client?.display_name||'Marketplace Client',
    address:row.property?.address||'Verified property',distance:Number((1.2+(index%7)*.9).toFixed(1)),
    eta:4+(index%6)*3,duration:row.duration_minutes,kind:row.priority,
    property:row.property?.name||'Property',price:row.payout_cents?Math.round(row.payout_cents/100):0,
    x:50,y:50,
    latitude:row.property?.latitude ?? null,
    longitude:row.property?.longitude ?? null,
    live:true,
    photoUrl:row.property?.photo_url||null,
  })

  const loadDispatch=async()=>{
    if(isPreview||mode!=='supabase')return
    try{setDispatch(await getAgencyDispatchWorkspace());setLastError(null)}catch(error){setLastError(error instanceof Error?error.message:'Agency workspace unavailable.')}
  }

  const loadMarketplace=async(options?:{background?:boolean})=>{
    const background=Boolean(options?.background)
    if(!background)setMarketplaceLoading(true)
    try {
      const data=await getAgencyWorkspace()
      setAgencyId(data.agencyId)
      setAgencyName(data.name)
      setJobs(data.open.map(mapLiveJob))
      setAccepted(data.claimed.map(mapLiveJob))
      setLastError(null)
      void loadDispatch()
      return data.agencyId
    } catch (error) {
      const message=error instanceof Error?error.message:'Unable to load marketplace.'
      setLastError(message)
      if(background)return null
      throw error
    } finally {
      if(!background)setMarketplaceLoading(false)
      setLastWorkspaceSyncAt(Date.now())
    }
  }


  useEffect(()=>{
    if(isPreview||mode!=='supabase'||!isRoleMatch)return
    const loadLocations=()=>void getAgencyLiveLocations()
      .then(setLiveLocations)
      .catch(error=>setLastError(error instanceof Error?error.message:'Live locations unavailable.'))
    loadLocations()
    const heartbeat=window.setInterval(loadLocations,5000)
    const unsubscribe=subscribeToLocationChanges(loadLocations)
    return()=>{window.clearInterval(heartbeat);unsubscribe()}
  },[isPreview,mode,isRoleMatch])

  useEffect(()=>{
    setJobs([])
    setAccepted([])
    setActivity([])
    setIncomingIndex(0)
    setAgencyId(null)
    setLastError(null)
    setDispatch(null)
    setFocusedMissionId(null)
    setLastWorkspaceSyncAt(null)
    setRealtimeState(isPreview?'preview':'idle')
    if(isPreview){
      setJobs(initialJobs)
      setActivity(initialActivity)
      setMarketplaceLoading(false)
      setLastWorkspaceSyncAt(Date.now())
    } else {
      setMarketplaceLoading(mode==='supabase')
    }
  },[isPreview,mode,accessMode])

  useEffect(()=>{
    if(isPreview||mode!=='supabase'||!user?.id||!isRoleMatch)return
    let active=true
    loadMarketplace().catch(error=>{if(!active)return;const message=error instanceof Error?error.message:'Unable to load marketplace.';setLastError(message);setToast(developerMode?`Marketplace blocked: ${message}`:message)})
    return()=>{active=false}
  },[mode,user?.id,isPreview,developerMode,isRoleMatch,accessMode])

  useEffect(()=>{
    if(isPreview){setRealtimeState('preview');return}
    if(mode!=='supabase'||!agencyId)return
    setRealtimeState('connected')

    const syncMarketplace=()=>{
      void loadMarketplace({background:true})
    }

    /*
     * Agencies may keep this screen open for hours waiting for work.
     * Realtime should update instantly, but the heartbeat below is the
     * production safety net for browser sleep, realtime reconnects,
     * Supabase publication delays, or hidden-tab throttling.
     */
    const heartbeat=window.setInterval(syncMarketplace,5000)
    const stopMarket=subscribeToMarketplace(syncMarketplace)
    const stopDispatch=subscribeToDispatch(()=>{void loadDispatch();syncMarketplace()})

    return()=>{
      window.clearInterval(heartbeat)
      stopMarket()
      stopDispatch()
    }
  },[mode,agencyId,isPreview])

  useEffect(()=>{
    if(!isPreview||incomingIndex>=incomingJobs.length) return
    const timer=window.setTimeout(()=>{
      const job=incomingJobs[incomingIndex]
      setJobs(v=>[job,...v])
      const nextActivity: Activity = {
        id: Date.now(),
        time: 'Now',
        type: job.kind === 'emergency' ? 'emergency' : 'new',
        title: job.kind === 'priority' ? 'New priority job' : 'New job posted',
        location: job.client,
      }
      setActivity(current => [nextActivity, ...current].slice(0, 6))
      setToast(`${job.title} just entered the marketplace.`)
      setIncomingIndex(i=>i+1)
    },9000+incomingIndex*6000)
    return ()=>window.clearTimeout(timer)
  },[incomingIndex,isPreview])

  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),3200);return()=>window.clearTimeout(timer)},[toast])

  const openAgencyMessages=()=>{setTab('messages');setToast('Messages and alerts opened.')}
  const openAgencySettings=()=>{setTab('settings');setToast('Agency settings opened.')}
  const openAgencyOperations=()=>{setTab('operations');setToast('Active operations opened.')}
  const openAgencyGuards=()=>{setTab('guards');setToast('Guard workspace opened.')}

  const accept=async(job:Job)=>{
    if(claimingId)return
    if(isPreview){setToast(isRoleMatch?'Preview Mode: claim simulated only.':'Preview Mode: signed in as Client. Switch to an approved Agency account for Live Test.');return}
    if(mode==='supabase'){
      if(!agencyId){setToast(`Signed in as ${role?.replace('_',' ')??'user'}. Agency actions require an approved Agency account.`);return}
      if(job.kind==='emergency'){
        const hasAvailableGuard=available.length>0
        const message=hasAvailableGuard
          ? 'Priority Response requires immediate dispatch confirmation. Claim this mission and assign a guard now?'
          : 'No available guards are online. Priority Response requires immediate dispatch. Claim anyway and assign a guard as soon as one becomes available?'
        if(!window.confirm(message)){setToast(hasAvailableGuard?'Priority Response claim cancelled.':'Priority Response claim cancelled — no available guard online.');return}
      }
      setClaimingId(job.id)
      try{
        const result=await acceptMarketplaceJob(job.id)
        if(!result.accepted){
          const messages:Record<string,string>={ALREADY_CLAIMED_OR_UNAVAILABLE:'Another agency claimed this mission first or it is no longer open.'}
          if(result.reason==='ALREADY_CLAIMED_OR_UNAVAILABLE') setJobs(v=>v.filter(j=>j.id!==job.id))
          setToast(messages[result.reason||'']||'Unable to claim this mission. Refresh and try again.');return}
        await loadMarketplace()
        setTab('operations')
        setToast(`${job.title} is claimed. Assign an available guard now.`)
      }catch(error){setToast(error instanceof Error?error.message:'Unable to claim mission.')}
      finally{setClaimingId(null)}
      return
    }
    setJobs(v=>v.filter(j=>j.id!==job.id));setAccepted(v=>[job,...v])
    setActivity(current => [{id:Date.now(),time:'Now',type:'accepted' as const,title:`${agencyName} accepted`,location:job.title},...current].slice(0,6))
    setToast(`${job.title} locked to ${agencyName} and moved to Operations.`)
  }
  const pageLabel = tab==='marketplace'?'Marketplace':tab==='reports'?'Reports':tab==='operations'?'Operations':tab==='guards'?'Guards':tab==='assignments'?'Assignments':tab==='analytics'?'Analytics':tab==='messages'?'Messages':tab==='settings'?'Settings':'Scheduled'
  const pageCopy = tab==='marketplace'?'Find. Compete. Win. Protect.':tab==='reports'?'Review completed missions and publish verified reports.':tab==='operations'?'Manage active missions without leaving the market.':tab==='guards'?'Manage the verified professionals owned by this agency.':tab==='assignments'?'Review won marketplace jobs and assignment status.':tab==='analytics'?'Track capacity, activity, and operational readiness.':tab==='messages'?'Review alerts, broadcasts, and mission messages.':tab==='settings'?'Manage this agency workspace and account controls.':'Review upcoming and scheduled coverage.'
  const commandMissions=(dispatch?.missions??[]).filter(m=>!['completed','cancelled'].includes(m.status))
  const commandNeedsGuard=commandMissions.filter(m=>m.status==='awaiting_guard'||!m.guard_id)
  const commandLive=commandMissions.filter(m=>['en_route','arrived','active'].includes(m.status))
  const commandReview=commandMissions.filter(m=>(m.status as string)==='review')
  const commandNext=commandNeedsGuard.length?{tone:'urgent',icon:<AlertTriangle/>,eyebrow:'NEXT ACTION',title:'Assign guard to '+commandNeedsGuard.length+' mission'+(commandNeedsGuard.length===1?'':'s'),copy:'Claimed work should never sit without an owner. Open Operations and dispatch the guard.',action:'Open Operations',secondary:'Guard Roster',onAction:()=>setTab('operations'),onSecondary:()=>setTab('guards')}:commandLive.length?{tone:'live',icon:<Navigation/>,eyebrow:'LIVE WORK',title:'Track '+commandLive.length+' active mission'+(commandLive.length===1?'':'s'),copy:'Live route and on-site jobs are running now. Keep the map and operations board one click away.',action:'Live Map',secondary:'Operations',onAction:()=>{setFocusedMissionId(commandLive[0]?.job_id??null);setTab('marketplace');setToast('Live map focused on active mission.')},onSecondary:()=>setTab('operations')}:commandReview.length?{tone:'review',icon:<ClipboardList/>,eyebrow:'REPORT READY',title:commandReview.length+' report'+(commandReview.length===1?'':'s')+' need review',copy:'Completed field work should move quickly into clean client-facing reports.',action:'Review Reports',secondary:'Operations',onAction:()=>setTab('reports'),onSecondary:()=>setTab('operations')}:jobs.length?{tone:'market',icon:<BriefcaseBusiness/>,eyebrow:'MARKET READY',title:String(jobs.length)+' open opportunit'+(jobs.length===1?'y':'ies')+' available',copy:'Open jobs are visible now. Claim work, then immediately assign guard coverage.',action:'Open Marketplace',secondary:'Capacity',onAction:()=>setTab('marketplace'),onSecondary:()=>setTab('analytics')}:guardSummary.available?{tone:'ready',icon:<ShieldCheck/>,eyebrow:'STANDING BY',title:String(guardSummary.available)+' guard'+(guardSummary.available===1?'':'s')+' ready',copy:'No open jobs are waiting, but your available guard capacity is visible and ready.',action:'View Guards',secondary:'Settings',onAction:()=>setTab('guards'),onSecondary:()=>setTab('settings')}:{tone:'quiet',icon:<Users/>,eyebrow:'SETUP NEEDED',title:'No available guards online',copy:'Invite or activate guards so the agency can accept jobs with confidence.',action:'Manage Guards',secondary:'Marketplace',onAction:()=>setTab('guards'),onSecondary:()=>setTab('marketplace')}

  return <div className="agency-app premium-agency">
    {developerMode&&<div className={`developer-runtime-banner ${isPreview?'preview':'live'}`}><div><CodeStatus preview={isPreview}/><span><strong>{isPreview?'PREVIEW MODE':'LIVE TEST'}</strong><small>Authenticated: {role?.replace('_',' ')??'unknown'} · Viewing: {viewedRole.replace('_',' ')}</small></span></div><button onClick={()=>setDiagnosticsOpen(true)}><Bug/>Diagnostics</button></div>}
    {diagnosticsOpen&&<DeveloperDiagnostics onClose={()=>setDiagnosticsOpen(false)} authRole={role} viewedRole={viewedRole} accountStatus={status} authPhase={phase} agencyId={agencyId} agencyName={agencyName} preview={isPreview} realtimeState={realtimeState} lastError={lastError} jobs={jobs} accepted={accepted}/>}
    {toast&&<div className="market-toast"><Check/>{toast}</div>}
    <aside className="agency-sidebar premium-sidebar">
      <div className="premium-logo"><ShieldCheck/><div><strong>CO PILOT</strong><span>SECURITY MARKETPLACE</span></div></div>
      <nav>{navItems.map(([id,label,sub,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon/><span><strong>{label}</strong><small>{sub}</small></span>{id==='marketplace'&&<b>{jobs.length}</b>}{id==='operations'&&<b>{activeOperationCount}</b>}{id==='scheduled'&&<b>{isPreview?3:0}</b>}{id==='guards'&&<b>{guardSummary.total}</b>}{id==='reports'&&<b>{isPreview?1:reportCount}</b>}{id==='messages'&&<b>{isPreview?4:0}</b>}</button>)}</nav>
      <div className="agency-mini-card"><div className="mini-agency"><span>AF</span><div><strong>{agencyName}</strong><small><BadgeCheck/>Verified Agency</small></div></div><div className="mini-stats"><span>Total Guards <b>{guardSummary.total}</b></span><span>Available <b>{guardSummary.available}</b></span><span>On Mission <b>{guardSummary.on_mission}</b></span><span>Reserved <b>{guardSummary.reserved}</b></span></div></div>
      <div className="sidebar-version">LIVE LOCATION <span className={`backend-mode ${mode}`}><i/>{mode === 'supabase' ? 'Supabase Connected' : 'Mock Mode'}</span></div>
    </aside>

    <header className="agency-topbar premium-topbar">
      <div className="page-title"><div className="foundation-status"><span className={mode}><Wifi/>{mode === 'supabase' ? 'SUPABASE CONNECTED' : 'BACKEND READY · MOCK DATA'}</span><small>{role ?? 'role pending'}</small></div><h1>{pageLabel}</h1><p>{pageCopy}</p></div>
      <div className="top-kpis"><Kpi icon={<CircleDollarSign/>} label="OPEN JOBS" value={jobs.length} tone="gold"/><Kpi icon={<Flame/>} label="PRIORITY" value={jobs.filter(j=>j.kind==='priority').length} tone="orange"/><Kpi icon={<Siren/>} label="PRIORITY RESPONSE" value={jobs.filter(j=>j.kind==='emergency').length} tone="red"/><Kpi icon={<Users/>} label="ACTIVE JOBS" value={activeOperationCount} tone="green"/><Kpi icon={<ShieldCheck/>} label="ONLINE GUARDS" value={guardSummary.online} tone="blue"/></div>
      <div className="top-actions"><ThemeToggle/><button className="icon-button" type="button" onClick={openAgencyMessages} aria-label="Open alerts"><Bell/>{isPreview&&<i>4</i>}</button><button className="icon-button" type="button" onClick={openAgencyMessages} aria-label="Open messages"><MessageSquare/></button><button className="profile-pill" type="button" onClick={openAgencySettings}><span>AF</span><div><strong>{agencyName}</strong><small>Agency Admin</small></div><ChevronDown/></button></div>
    </header>

    <main className="agency-main premium-main">
      <AgencyCommandStrip command={commandNext}/>
      {tab==='marketplace'?<Marketplace jobs={jobs} filtered={filtered} filter={filter} setFilter={setFilter} accept={job=>void accept(job)} available={available} allGuards={runtimeGuards} activity={activity} loading={marketplaceLoading} lastSyncAt={lastWorkspaceSyncAt} realtimeState={realtimeState} focusedMissionId={focusedMissionId} preview={isPreview} dispatch={dispatch} liveLocations={liveLocations} onOpenGuards={openAgencyGuards} onOpenOperations={openAgencyOperations} onOpenMessages={openAgencyMessages} onToast={setToast}/>:tab==='operations'?<Operations accepted={accepted} preview={isPreview} dispatch={dispatch} onAssign={async(jobId,guardId)=>{try{await assignGuard(jobId,guardId);await loadDispatch();await loadMarketplace();setToast('Assignment sent to guard in real time.')}catch(error){setToast(error instanceof Error?error.message:'Unable to assign guard.')}}} onMarketplace={()=>setTab('marketplace')} onMissionMap={jobId=>{setFocusedMissionId(jobId);setTab('marketplace');setToast('Live map focused on selected mission.')}}/>:tab==='guards'?<GuardsWorkspace preview={isPreview} onToast={setToast} authoritativeGuards={guardState.guards} onRosterChanged={guardState.refresh}/>:tab==='reports'?<ReportingWorkspace preview={isPreview} onCount={setReportCount}/>:<OperationalWorkspace tab={tab} jobs={jobs} accepted={accepted} dispatch={dispatch} guards={runtimeGuards} guardSummary={guardSummary} activity={activity} agencyName={agencyName} onNavigate={setTab}/>}
    </main>
  </div>
}

type AgencyCommand={tone:string;icon:ReactNode;eyebrow:string;title:string;copy:string;action:string;secondary:string;onAction:()=>void;onSecondary:()=>void}
function AgencyCommandStrip({command}:{command:AgencyCommand}){return <section className={`agency-command-strip ${command.tone}`}><div className="agency-command-icon">{command.icon}</div><div className="agency-command-copy"><small>{command.eyebrow}</small><strong>{command.title}</strong><span>{command.copy}</span></div><div className="agency-command-actions"><button type="button" className="primary" onClick={command.onAction}>{command.action}<ChevronRight/></button><button type="button" onClick={command.onSecondary}>{command.secondary}</button></div></section>}

function Kpi({icon,label,value,tone}:{icon:ReactNode,label:string,value:number,tone:string}){return <div className={`top-kpi ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>}
function marketplaceJobGuidance(job:Job,availableCount:number){
  const priority=job.kind==='emergency'
    ? {title:'Priority Response',copy:'Requires fast review, claim confirmation, and immediate guard dispatch.'}
    : job.kind==='priority'
      ? {title:'Higher-priority opportunity',copy:'Good fit when you have guard capacity ready and can respond quickly.'}
      : {title:'Standard open job',copy:'Routine coverage opportunity. Claim only when you can assign a guard next.'}
  const capacity=availableCount>0
    ? {label:`${availableCount} guard${availableCount===1?'':'s'} available`,tone:'ready'}
    : {label:'No available guards online',tone:'warn'}
  return {...priority,capacity,after:'After claim: moves to Operations → assign guard → track route → review report.'}
}
function Marketplace({jobs,filtered,filter,setFilter,accept,available,allGuards,activity,loading,lastSyncAt,realtimeState,focusedMissionId,preview,dispatch,liveLocations,onOpenGuards,onOpenOperations,onOpenMessages,onToast}:{jobs:Job[];filtered:Job[];filter:'all'|JobKind;setFilter:(v:'all'|JobKind)=>void;accept:(j:Job)=>void;available:Guard[];allGuards:Guard[];activity:Activity[];loading:boolean;lastSyncAt:number|null;realtimeState:'idle'|'connected'|'preview';focusedMissionId:string|null;preview:boolean;dispatch:AgencyDispatchWorkspace|null;liveLocations:GuardLiveLocation[];onOpenGuards:()=>void;onOpenOperations:()=>void;onOpenMessages:()=>void;onToast:(message:string)=>void}){
 const [mapMode,setMapMode]=useState<'all'|'standard'|'priority'|'emergency'|'guards'>('all')
 const [sortNearest,setSortNearest]=useState(true)
 const [dismissStandbyOverlay,setDismissStandbyOverlay]=useState(false)
 const syncLabel=preview?'Preview sync':lastSyncAt?`Synced ${new Date(lastSyncAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:realtimeState==='connected'?'Connecting sync':'Waiting for sync'

 const jobsWithProximity=useMemo(()=>filtered.map(job=>enhanceJobWithNearestGuard(job,allGuards)),[filtered,allGuards])
 const sortedOpportunityJobs=useMemo(()=>[...jobsWithProximity].sort((a,b)=>sortNearest?(a.distance-b.distance):a.title.localeCompare(b.title)),[jobsWithProximity,sortNearest])

 const liveMissions = dispatch?.missions ?? []
 const liveActiveMissions = liveMissions.filter(mission=>isActiveAgencyMission(mission.status))

 const activeAssignedMissions = liveActiveMissions.filter(mission =>
   Boolean(mission.guard_id) &&
   !['completed','cancelled'].includes(mission.status) &&
   mission.property.latitude != null &&
   mission.property.longitude != null
 )

 const focusedMission = focusedMissionId
   ? activeAssignedMissions.find(mission => String(mission.job_id) === String(focusedMissionId)) ?? null
   : null

 const routedMission =
   (focusedMission && (
     liveLocations.some(location =>
       String(location.guard_id) === String(focusedMission.guard_id) &&
       location.latitude != null &&
       location.longitude != null
     ) ||
     allGuards.some(guard =>
       String(guard.id) === String(focusedMission.guard_id) &&
       hasLiveCoordinates(guard)
     )
   ) ? focusedMission : null) ??
   activeAssignedMissions.find(mission =>
     liveLocations.some(location =>
       String(location.guard_id) === String(mission.guard_id) &&
       location.latitude != null &&
       location.longitude != null
     ) ||
     allGuards.some(guard =>
       String(guard.id) === String(mission.guard_id) &&
       hasLiveCoordinates(guard)
     )
   ) ?? null

 const routedGuardLocation =
   routedMission
     ? liveLocations.find(location =>
         String(location.guard_id) === String(routedMission.guard_id) &&
         location.latitude != null &&
         location.longitude != null
       ) ?? null
     : null

 const routedRosterGuard =
   routedMission
     ? allGuards.find(guard =>
         String(guard.id) === String(routedMission.guard_id) &&
         hasLiveCoordinates(guard)
       ) ?? null
     : null

 const routeGuardLatitude =
   routedGuardLocation?.latitude ??
   routedRosterGuard?.latitude ??
   null

 const routeGuardLongitude =
   routedGuardLocation?.longitude ??
   routedRosterGuard?.longitude ??
   null

 const activeMissionRoute:ActiveMissionRoute|null =
   routedMission &&
   routeGuardLatitude != null &&
   routeGuardLongitude != null &&
   routedMission.property.latitude != null &&
   routedMission.property.longitude != null
     ? {
         missionId:routedMission.job_id,
         status:routedGuardLocation?.mission_state ?? routedMission.status,

         assignedGuard:{
           guardId:String(routedMission.guard_id),
           name:routedGuardLocation?.name ?? routedRosterGuard?.name ?? routedMission.guard?.name ?? 'Assigned Guard',
           latitude:routeGuardLatitude,
           longitude:routeGuardLongitude,
           updatedAt:routedGuardLocation?.last_location_at ?? null,
         },

         destination:{
           name:routedMission.property.name,
           address:routedMission.property.address,
           latitude:routedMission.property.latitude,
           longitude:routedMission.property.longitude,
         },
       }
     : null

 const routeStatusLabel = activeMissionRoute
   ? `${activeMissionRoute.assignedGuard.name || 'Assigned guard'} → ${activeMissionRoute.destination.name || 'Destination'}`
   : null

 const activeDestinationMarker:MissionMapMarker | null =
   routedMission &&
   routedMission.property.latitude != null &&
   routedMission.property.longitude != null
     ? {
         id:`assigned-destination-${routedMission.job_id}`,
         latitude:routedMission.property.latitude,
         longitude:routedMission.property.longitude,
         label:`${routedMission.property.name} — ${routedMission.property.address}`,
         title:routedMission.property.name,
         subtitle:routedMission.property.address,
         address:routedMission.property.address,
         photoUrl:routedMission.property.photo_url ?? null,
         propertyType:routedMission.priority==='emergency'?'Priority Response Destination':'Assigned Destination',
         ownerName:routedMission.client.display_name,
         status:'destination',
         type:'property' as const,
         active:true,
       }
     : null

 const visibleGuards=allGuards.filter(g=>g.status!=='offline')
 const onlineGuardsMissingGps=visibleGuards.filter(g=>!hasLiveCoordinates(g)).length
 const guardMarkers=visibleGuards
   .filter(hasLiveCoordinates)
   .map(g=>({
       id:`guard-${g.id}`,
       latitude:g.latitude as number,
       longitude:g.longitude as number,
       label:g.name,
       title:g.name,
       subtitle:g.currentAddress || `${(g.latitude as number).toFixed(5)}, ${(g.longitude as number).toFixed(5)}`,
       address:g.currentAddress ?? null,
       currentAddress:g.currentAddress ?? null,
       initials:g.initials,
       photoUrl:g.photoUrl ?? null,
       status:g.gpsFreshness && g.gpsFreshness!=='live' ? `${g.status} · ${g.gpsFreshness} gps` : g.status,
       distance:g.distance,
       type:'guard' as const,
     }))

 const visibleMapJobs=jobsWithProximity
   .filter(j=>mapMode!=='guards')
   .filter(j=>mapMode==='all'||j.kind===mapMode)
 const visibleMapGuards=(mapMode==='all'||mapMode==='guards'||Boolean(activeMissionRoute))?guardMarkers:[]

 const mapMarkers:MissionMapMarker[] = [
   ...(activeDestinationMarker ? [activeDestinationMarker] : []),

   ...visibleMapJobs
     .filter(j=>j.latitude!=null && j.longitude!=null)
     .map(j=>({
       id:`job-${j.id}`,
       latitude:j.latitude as number,
       longitude:j.longitude as number,
       label:`${j.title} — ${j.address}`,
       title:j.title,
       subtitle:j.address,
       address:j.address,
       photoUrl:j.photoUrl ?? null,
       propertyType:j.property,
       distance:j.distance,
       eta:j.eta,
       duration:j.duration,
       price:j.price,
       type:j.kind==='emergency'
         ? 'emergency' as const
         : j.kind==='priority'
           ? 'priority' as const
           : 'job' as const,
     })),

   ...visibleMapGuards,
 ]

 const capacityNeedsAssignment=liveActiveMissions.filter(m=>m.status==='awaiting_guard'||!m.guard_id).length
 const marketStandby=!loading&&jobs.length===0&&liveActiveMissions.length===0
 const showStandbyOverlay=marketStandby&&!dismissStandbyOverlay
 useEffect(()=>{if(!marketStandby)setDismissStandbyOverlay(false)},[marketStandby])
 const commandTone=capacityNeedsAssignment?'urgent':available.length?'ready':'blocked'
 const commandTitle=capacityNeedsAssignment?'Dispatch needs assignment':available.length?'Marketplace standby — ready':'Marketplace blocked'
 const commandCopy=capacityNeedsAssignment?String(capacityNeedsAssignment)+' claimed mission'+(capacityNeedsAssignment===1?'':'s')+' need guard assignment before new claims.':available.length?'No open jobs right now. Your guard capacity is online and the marketplace feed is listening in real time.':'No available guards are online. Activate guards before claiming work.'
 return <div className="premium-dashboard">
  <section className="mobile-market-kpis" aria-label="Marketplace status">
    <div className="gold"><small>OPEN</small><strong>{jobs.length}</strong></div>
    <div className="orange"><small>PRIORITY</small><strong>{jobs.filter(j=>j.kind==='priority').length}</strong></div>
    <div className="red"><small>PRIORITY RESPONSE</small><strong>{jobs.filter(j=>j.kind==='emergency').length}</strong></div>
    <div className="green"><small>ACTIVE</small><strong>{preview?2:liveActiveMissions.length}</strong></div>
    <div className="blue"><small>GUARDS</small><strong>{allGuards.filter(g=>g.status!=='offline').length}</strong></div>
  </section>
  <section className={'market-command-panel '+commandTone}>
    <div className="market-command-icon"><ShieldCheck/></div>
    <div><small>AGENCY COMMAND CENTER</small><strong>{commandTitle}</strong><span>{commandCopy}</span></div>
    <div className="market-command-actions"><button type="button" className="primary" onClick={capacityNeedsAssignment?onOpenOperations:available.length?onOpenGuards:onOpenGuards}>{capacityNeedsAssignment?'Open Operations':available.length?'View Guards':'Manage Guards'}</button><button type="button" className="priority" onClick={()=>{setMapMode('emergency');setFilter('emergency');onToast('Priority Response layer opened.')}}>Priority Response</button><button type="button" onClick={onOpenMessages}>Message Guards</button><button type="button" onClick={onOpenMessages}>Broadcast</button></div>
  </section>
  <section className="live-map-panel premium-panel">
   <div className="premium-panel-head"><div><strong>LIVE MARKETPLACE MAP</strong><span><i/> {visibleGuards.length} ONLINE GUARD{visibleGuards.length===1?'':'S'} · {syncLabel}</span></div><button type="button" onClick={()=>{setMapMode(current=>current==='guards'?'all':'guards');onToast(mapMode==='guards'?'All live layers enabled.':'Showing guard layer only.')}}><Layers3/>Layers<ChevronDown/></button></div>
   <div className="map-filter-row">{(['all','standard','priority','emergency'] as const).map(v=><button key={v} type="button" className={mapMode===v?'active':''} onClick={()=>{setMapMode(v);setFilter(v)}}>{v==='all'?'All':v==='standard'?'Open Jobs':v==='emergency'?'Priority Response':v==='priority'?'Priority':v}</button>)}<button type="button" className={mapMode==='guards'?'active':''} onClick={()=>setMapMode('guards')}>My Guards</button></div>
   <div className="premium-map">
    {!preview&&onlineGuardsMissingGps>0&&<div className="agency-map-gps-warning"><Wifi/> {onlineGuardsMissingGps} online guard{onlineGuardsMissingGps===1?'':'s'} awaiting GPS fix</div>}
    <MissionMap
      markers={mapMarkers}
      activeMissionRoute={activeMissionRoute}
      routeCameraMode="agency"
      showViewerLocation={false}
      showCameraStatus={false}
    />
    {marketStandby&&<div className="security-map-layer" aria-hidden="true"><i className="coverage-ring coverage-a"/><i className="coverage-ring coverage-b"/><i className="coverage-ring coverage-c"/><span>SERVICE AREA LIVE</span></div>}
    {showStandbyOverlay&&<div className="market-standby-overlay"><button className="market-standby-close" type="button" aria-label="Dismiss marketplace standby panel" onClick={()=>setDismissStandbyOverlay(true)}><X/></button><div><ShieldCheck/></div><small>LIVE MARKETPLACE STANDBY</small><strong>{available.length} guard{available.length===1?'':'s'} ready</strong><span>Coverage is live. New verified jobs and Priority Response requests will appear on this map the moment they enter the marketplace.</span><nav><button type="button" onClick={onOpenGuards}>View Guards</button><button type="button" onClick={onOpenMessages}>Message Guards</button><button type="button" onClick={()=>{setMapMode('guards');onToast('Guard readiness layer opened.')}}>Guard Layer</button></nav></div>}
    {routeStatusLabel&&<div className="agency-live-route-badge"><Navigation/> LIVE ROUTE · {routeStatusLabel}</div>}
    <div className="map-key">
      <span><i className="gold"/>Open Job</span>
      <span><i className="orange"/>Priority</span>
      <span><i className="red"/>Priority Response</span>
      <span><i className="green"/>My Guards</span>
    </div>
  </div>
  </section>

  <section className="opportunities premium-panel"><div className="premium-panel-head"><div><strong>OPEN OPPORTUNITIES <b>{jobs.length}</b></strong></div><button type="button" onClick={()=>{setSortNearest(value=>!value);onToast(sortNearest?'Sorting opportunities A-Z.':'Sorting opportunities by nearest guard.')}}>{sortNearest?'Nearest':'A-Z'}<ChevronDown/></button></div><div className="premium-job-list">{sortedOpportunityJobs.length?sortedOpportunityJobs.map(j=>{const guidance=marketplaceJobGuidance(j,available.length);return <article key={j.id} className={`premium-job-card ${j.kind}`}><div className="job-card-top"><span className={`kind-chip ${j.kind}`}>{j.kind==='emergency'?<Siren/>:j.kind==='priority'?<Zap/>:<BriefcaseBusiness/>}{j.kind==='standard'?'Open Job':j.kind==='emergency'?'Priority Response':j.kind==='priority'?'Priority':j.kind}</span><span>{j.distance} mi<small>ETA {j.eta} min</small></span></div>{j.photoUrl&&<div className="marketplace-property-photo"><img src={j.photoUrl} alt={`${j.property} property`}/></div>}<h3>{j.title}</h3><p>{j.client}<br/>{j.address}</p><div className="job-card-meta"><span><Building2/>{j.property}</span><span><Clock3/>{j.duration} min</span><span><Users/>1 guard</span></div><div className="marketplace-job-guidance"><small>WHY THIS MATTERS</small><strong>{guidance.title}</strong><span>{guidance.copy}</span><em>{guidance.after}</em></div><div className={`marketplace-job-capacity ${guidance.capacity.tone}`}><Users/><span>{guidance.capacity.label}</span></div><div className="job-card-action"><button onClick={()=>accept(j)}>{available.length?'Claim Mission':'Claim carefully'}</button></div></article>}):<div className="marketplace-list-state empty compact-standby"><BriefcaseBusiness/><strong>{loading?'Loading opportunities':'No claimable jobs'}</strong><small>{loading?'Checking the live marketplace.':'The map and command center are already showing standby status.'}</small></div>}</div></section>

  <aside className="right-rail"><section className="capacity-panel premium-panel"><div className="premium-panel-head"><strong>AGENCY CAPACITY</strong></div><div className="capacity-content"><div className="capacity-ring"><span><strong>{available.length}</strong><small>Available</small></span></div><div className="capacity-breakdown"><span>Total Guards <b>{allGuards.length}</b></span><span>Available <b>{available.length}</b></span><span>On Mission <b>{allGuards.filter(g=>g.status==='on-mission').length}</b></span><span>Reserved <b>{allGuards.filter(g=>g.status==='reserved').length}</b></span><span>Offline <b>{allGuards.filter(g=>g.status==='offline').length}</b></span></div></div><div className={`capacity-next-action ${capacityNeedsAssignment?'urgent':available.length?'ready':'blocked'}`}><strong>{capacityNeedsAssignment?'Assign waiting mission':available.length?'Ready to claim work':'Capacity blocked'}</strong><span>{capacityNeedsAssignment?`${capacityNeedsAssignment} claimed mission${capacityNeedsAssignment===1?'':'s'} need guard assignment now.`:available.length?'You have available guards. Claim work only when you can assign immediately.':'No guards are available. Manage the roster before accepting new work.'}</span><button type="button" onClick={capacityNeedsAssignment?onOpenOperations:onOpenGuards}>{capacityNeedsAssignment?'Open Operations':available.length?'View Guards':'Manage Guards'}</button></div></section><section className="active-panel premium-panel"><div className="premium-panel-head"><strong>ACTIVE OPERATIONS <b>{preview?2:liveActiveMissions.length}</b></strong><button type="button" onClick={onOpenOperations}>View All</button></div>{preview?['Retail Store Patrol','Parking Lot Patrol'].map((t,i)=><div className="mini-operation" key={t}><div><small>#A-10{25+i}</small><span>ON MISSION</span></div><strong>{t}</strong><p>{i?'Riverview Plaza':'South Fork Community'}</p><div className="mission-person"><span>{i?'JL':'MR'}</span><div><strong>{i?'Jalen':'Marcus'}</strong><small>{i?'On Site':'En Route'}</small></div><b>{i?'18':'5'} min</b></div><div className="mission-bar"><i style={{width:i?'20%':'33%'}}/></div></div>):liveActiveMissions.length?liveActiveMissions.slice(0,4).map(m=><div className="mini-operation" key={m.job_id}><div><small>{m.job_id.slice(0,8)}</small><span>{m.status.replace('_',' ').toUpperCase()}</span></div><strong>{m.title}</strong><p>{m.property.name}</p><div className="mission-person"><span>{m.guard?.name?.split(' ').map(v=>v[0]).join('').slice(0,2)??'—'}</span><div><strong>{m.guard?.name??'Awaiting guard'}</strong><small>{m.guard?'Assigned':'Needs assignment'}</small></div><b>{m.duration_minutes} min</b></div><div className="mission-bar"><i style={{width:m.status==='completed'?'100%':m.status==='active'?'65%':m.status==='en_route'?'42%':'22%'}}/></div></div>):<div className="marketplace-list-state empty compact-standby"><Radio/><strong>Operations clear</strong><small>No guard is currently assigned to a live mission.</small></div>}</section><section className="activity-panel premium-panel"><div className="premium-panel-head"><strong>MARKETPLACE ACTIVITY</strong><span>{preview?'Preview Feed':'Live Feed'}</span></div>{activity.length?activity.map(a=><div className="activity-row" key={a.id}><span className={a.type==='emergency'?'danger':''}>{a.type==='emergency'?<Siren/>:a.type==='accepted'?<Check/>:a.type==='assigned'?<Users/>:<BriefcaseBusiness/>}</span><small>{a.time}</small><div><strong>{a.title}</strong><p>{a.location}</p></div></div>):<div className="marketplace-list-state empty compact-standby"><Radio/><strong>Feed listening</strong><small>Live mission events will stream here.</small></div>}</section></aside>

  <section className="bottom-strip premium-panel"><div className="available-guards"><div className="strip-title"><strong>AVAILABLE GUARDS <b>{available.length}</b></strong><button type="button" onClick={onOpenGuards}>View All</button></div><div className="guard-row">{available.slice(0,7).map(g=><div className="guard-face" key={g.id}><span>{g.initials}</span><strong>{g.name}</strong><small>{g.distance} mi</small></div>)}</div></div><div className="quick-actions"><div className="strip-title"><strong>QUICK ACTIONS</strong></div><div><button type="button" className="em" onClick={()=>{setMapMode('emergency');setFilter('emergency');onToast('Priority Response Center opened.')}}><Siren/>Priority Response Center</button><button type="button" onClick={()=>{onOpenMessages();onToast('Broadcast center opened.')}}><Radio/>Broadcast</button><button type="button" onClick={()=>{onOpenGuards();onToast('Guard check-in opened.')}}><Users/>Guard Check-In</button><button type="button" onClick={()=>{onOpenMessages();onToast('New message composer opened.')}}><MessageSquare/>New Message</button></div></div></section>
 </div>
}

function Operations({accepted,preview,dispatch,onAssign,onMarketplace,onMissionMap}:{accepted:Job[];preview:boolean;dispatch:AgencyDispatchWorkspace|null;onAssign:(jobId:string,guardId:string)=>Promise<void>;onMarketplace:()=>void;onMissionMap:(jobId:string)=>void}){
  const missions:DispatchMission[]=dispatch?.missions??[]
  const claimed:DispatchMission[]=missions.length?missions:accepted.map(j=>({assignment_id:j.id,job_id:j.id,agency_id:'preview',guard_id:null,status:'awaiting_guard',assigned_at:new Date().toISOString(),offered_at:null,accepted_at:null,declined_at:null,locked_at:null,title:j.title,instructions:null,priority:j.kind,scheduled_for:null,duration_minutes:j.duration,property:{name:j.property,address:j.address,latitude:null,longitude:null,photo_url:j.photoUrl??null},client:{display_name:j.client},guard:null} as DispatchMission))
  const guards=dispatch?.guards??[]
  const availableGuards=guards.filter(g=>g.availability==='available')
  const openMissions=claimed.filter(m=>!['completed','cancelled'].includes(m.status))
  const needsGuard=openMissions.filter(m=>m.status==='awaiting_guard'||!m.guard_id)
  const awaitingResponse=openMissions.filter(m=>['offered','accepted','assigned'].includes(m.status))
  const liveRoute=openMissions.filter(m=>['en_route','arrived','active'].includes(m.status))
  const reviewQueue=openMissions.filter(m=>(m.status as string)==='review')
  const completed=claimed.filter(m=>['completed','cancelled'].includes(m.status))
  const operationsSyncLabel=preview?'Preview operations':dispatch?'Live dispatch synced':'Waiting for dispatch sync'
  const commandTitle=needsGuard.length?'Assign guards now':liveRoute.length?'Track live coverage':reviewQueue.length?'Review completed reports':'Operations clear'
  const commandCopy=needsGuard.length?`${needsGuard.length} mission${needsGuard.length===1?'':'s'} cannot move until a guard is assigned.`:liveRoute.length?`${liveRoute.length} mission${liveRoute.length===1?' is':'s are'} moving or on site. Keep map and details visible.`:reviewQueue.length?`${reviewQueue.length} report${reviewQueue.length===1?'':'s'} need agency review before the client sees final proof.`:'No urgent dispatch action is waiting right now.'
  const buckets=[
    {key:'needs',title:'Needs guard',copy:'Accepted jobs waiting for assignment.',missions:needsGuard},
    {key:'waiting',title:'Guard response',copy:'Offer sent or guard confirmed.',missions:awaitingResponse},
    {key:'live',title:'Live route / on site',copy:'Guard is moving or working the job.',missions:liveRoute},
    {key:'review',title:'Review',copy:'Patrol finished and report flow is next.',missions:reviewQueue},
  ]
  const visibleBuckets=buckets.filter(bucket=>bucket.missions.length>0)
  const progress=(status:string)=>status==='awaiting_guard'?12:status==='offered'?25:status==='accepted'?38:status==='en_route'?55:status==='arrived'?68:status==='active'?78:status==='review'?92:status==='completed'?100:8
  const actionLabel=(status:string)=>status==='offered'?'Awaiting response':status==='accepted'?'Guard confirmed':status==='en_route'?'View live route':status==='arrived'?'Guard arrived':status==='active'?'Track on site':status==='review'?'Review report':'Locked'
  const assignGuard=(mission:DispatchMission,guardId:string)=>{if(!guardId)return;const guard=guards.find(g=>g.id===guardId);if(!guard)return;const ok=window.confirm('Assign '+guard.name+' to '+mission.title+'?');if(ok)void onAssign(mission.job_id,guardId)}
  return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">AGENCY OPERATIONS</span><h1>Dispatch board</h1><p>Accepted missions are grouped by next action so nothing gets lost after a claim.</p></div><button type="button" onClick={onMarketplace}>Return to Marketplace</button></div><div className="operations-command-panel"><div><small>{operationsSyncLabel}</small><strong>{commandTitle}</strong><span>{commandCopy}</span></div><div className="operations-command-actions"><button type="button" className={needsGuard.length?'hot':''} onClick={onMarketplace}>Marketplace</button><button type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>Top of board</button></div></div><div className="operations-capacity-banner"><div><Users/><span><strong>{preview?'Preview agency assignment workspace':`${availableGuards.length} guards available`}</strong><small>{needsGuard.length?`${needsGuard.length} mission${needsGuard.length===1?'':'s'} need guard assignment now.`:'No accepted mission is waiting for assignment.'}</small></span></div>{!availableGuards.length&&<button type="button" disabled><AlertTriangle/>No available guards</button>}</div><section className="operations-summary-grid"><article><small>NEEDS GUARD</small><strong>{needsGuard.length}</strong></article><article><small>WAITING</small><strong>{awaitingResponse.length}</strong></article><article><small>LIVE</small><strong>{liveRoute.length}</strong></article><article><small>REVIEW</small><strong>{reviewQueue.length}</strong></article></section>{visibleBuckets.map(bucket=><section className="operations-bucket" key={bucket.key}><div className="operations-bucket-head"><div><strong>{bucket.title}</strong><small>{bucket.copy}</small></div><b>{bucket.missions.length}</b></div>{bucket.missions.length?<div className={`operations-grid ${bucket.missions.length===1?'single':''}`}>{bucket.missions.map(m=>{const stage=agencyMissionStage(m);return <article className={`operation-card ${m.status==='awaiting_guard'?'needs-action':''}`} key={m.job_id}><div className="operation-status"><span className={m.guard?'active':'awaiting'}>{stage.label}</span><small>{m.job_id.slice(0,8)}</small></div><h3>{m.title}</h3><p><MapPin/>{m.property.name} · {m.property.address}</p>{m.priority==='emergency'&&<div className="operation-warning"><Siren/>Priority Response — assign and track immediately.</div>}<div className="operation-stage-card"><div><small>CURRENT STEP</small><strong>{stage.title}</strong><span>{stage.copy}</span></div><b>{stage.step}</b></div><div className="operation-stage-track">{stage.steps.map((label,index)=><span key={label} className={index<=stage.active?'active':''}>{label}</span>)}</div><div className="operation-progress"><i style={{width:`${progress(m.status)}%`}}/></div><div className="operation-footer"><div className="guard-avatar">{m.guard?.name?.split(' ').map(v=>v[0]).join('').slice(0,2)??'—'}</div><div><small>{m.guard?'ASSIGNED GUARD':'NEXT ACTION'}</small><strong>{m.guard?.name??'Select an available guard'}</strong></div>{(m.status==='awaiting_guard'||!m.guard_id)?(availableGuards.length?<select aria-label="Assign guard" defaultValue="" onChange={e=>assignGuard(m,e.target.value)}><option value="" disabled>Assign guard</option>{availableGuards.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>:<button type="button" disabled>No guards</button>):(['en_route','arrived','active'].includes(m.status)?<button type="button" className="operation-map-action" onClick={()=>onMissionMap(m.job_id)}>Open Map</button>:<button type="button" disabled>{actionLabel(m.status)}</button>)}</div></article>})}</div>:null}</section>)}{!openMissions.length&&<div className="marketplace-list-state empty"><Radio/><strong>No active agency operations</strong><small>Claim a marketplace mission and it will move here for assignment and tracking.</small></div>}{completed.length>0&&<section className="operations-bucket muted"><div className="operations-bucket-head"><div><strong>Recently closed</strong><small>Completed or cancelled missions are kept out of live operation counts.</small></div><b>{completed.length}</b></div></section>}</section>
}
function agencyMissionStage(m:DispatchMission){
  const status=String(m.status)
  const label=status.replace('_',' ').toUpperCase()
  const steps=['Claimed','Assign','Confirm','Route','Report']
  if(status==='awaiting_guard'||!m.guard_id)return {label,title:'Assign a guard now',copy:'This mission is owned by your agency but has no guard attached yet. Pick an available guard before it stalls.',step:'2/5',active:1,steps}
  if(status==='offered')return {label,title:'Waiting for guard response',copy:'The assignment was sent. Watch for guard acceptance or reassign quickly if they do not respond.',step:'3/5',active:2,steps}
  if(status==='accepted')return {label,title:'Guard confirmed',copy:'The guard accepted the mission. The next stage is route tracking and arrival at the property.',step:'3/5',active:2,steps}
  if(status==='en_route')return {label:'GUARD EN ROUTE',title:'Track the live route',copy:'Guard movement is active. Use Map to monitor ETA, destination, and route progress.',step:'4/5',active:3,steps}
  if(['arrived','active'].includes(status))return {label,title:'Guard on site',copy:'Coverage is underway. Keep operations visible until completion and report handoff.',step:'4/5',active:3,steps}
  if(status==='review')return {label,title:'Review the report',copy:'Field work is complete. Review and publish the client-facing mission report.',step:'5/5',active:4,steps}
  if(status==='completed')return {label,title:'Mission complete',copy:'The job has been closed and should live in report history, not active dispatch.',step:'5/5',active:4,steps}
  if(status==='cancelled')return {label:'CANCELLED',title:'Mission cancelled',copy:'This operation is closed and no longer needs dispatch action.',step:'—',active:0,steps}
  return {label,title:'Mission syncing',copy:'Status is updating. Keep this card visible until the next dispatch action appears.',step:'—',active:0,steps}
}

function GuardsWorkspace({preview,onToast,authoritativeGuards,onRosterChanged}:{preview:boolean;onToast:(message:string)=>void;authoritativeGuards:GuardRosterData['guards'];onRosterChanged:()=>Promise<void>}){
  const [roster,setRoster]=useState<GuardRosterData>({guards:[],invitations:[]})
  const [loading,setLoading]=useState(!preview)
  const [busy,setBusy]=useState(false)
  const [inviteLink,setInviteLink]=useState('')
  const load=async()=>{if(preview)return;setLoading(true);try{setRoster(await getGuardRoster())}catch(error){onToast(error instanceof Error?error.message:'Unable to load Guard roster.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[preview])
  useEffect(()=>{if(!preview)setRoster(current=>({...current,guards:authoritativeGuards}))},[authoritativeGuards,preview])
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(preview){onToast('Preview mode blocks Guard invitations.');return}setBusy(true);setInviteLink('');const form=new FormData(event.currentTarget);try{const invite=await createGuardInvitation({fullName:String(form.get('fullName')),email:String(form.get('email')),phone:String(form.get('phone')??''),badgeNumber:String(form.get('badgeNumber')??'')});const link=guardActivationUrl(invite.token,invite.email);setInviteLink(link);await navigator.clipboard?.writeText(link);event.currentTarget.reset();await load();await onRosterChanged();onToast('Secure Guard activation link created and copied.')}catch(error){onToast(error instanceof Error?error.message:'Unable to invite Guard.')}finally{setBusy(false)}}
  return <section className="guards-workspace"><div className="operations-heading"><div><span className="eyebrow">AGENCY ENGINE · GUARD ONBOARDING</span><h1>Build your verified Guard roster.</h1><p>Only this Agency can invite, activate, and own its Guard memberships.</p></div></div><div className="guards-layout"><form className="guard-invite-card premium-panel" onSubmit={submit}><div className="premium-panel-head"><strong>ADD GUARD</strong><span>Secure invitation</span></div><label>Full name<input name="fullName" required placeholder="Guard’s legal name"/></label><label>Email address<input name="email" type="email" required placeholder="guard@email.com"/></label><div className="guard-form-row"><label>Phone<input name="phone" type="tel" placeholder="Optional"/></label><label>Badge / employee ID<input name="badgeNumber" placeholder="Optional"/></label></div><button className="guard-primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<UserPlus/>}{busy?'Creating invitation…':'Create Guard invitation'}</button><small>Public signup remains Client and Agency only. Guards activate through this Agency-owned link.</small>{inviteLink&&<div className="guard-invite-link"><strong>Activation link ready</strong><input readOnly value={inviteLink}/><button type="button" onClick={()=>{void navigator.clipboard?.writeText(inviteLink);onToast('Activation link copied.')}}><Copy/>Copy link</button></div>}</form><div className="guard-roster-card premium-panel"><div className="premium-panel-head"><strong>GUARD ROSTER <b>{roster.guards.length}</b></strong><span>{loading?'Synchronizing…':'Database authority'}</span></div>{roster.guards.length?roster.guards.map(g=><article className="guard-roster-row" key={g.id}><span>{g.name.split(' ').map(v=>v[0]).join('').slice(0,2)}</span><div><strong>{g.name}</strong><small>{g.email}{g.badge_number?` · ${g.badge_number}`:''}</small></div><b className={g.availability}>{g.availability.replace('_',' ')}</b></article>):<div className="marketplace-list-state empty"><Users/><strong>No activated Guards</strong><small>Create the first secure invitation to begin your roster.</small></div>}</div></div><div className="guard-pending premium-panel"><div className="premium-panel-head"><strong>INVITATIONS <b>{roster.invitations.length}</b></strong><span>7-day activation window</span></div>{roster.invitations.length?roster.invitations.map(i=><article className="guard-invitation-row" key={i.id}><div><strong>{i.full_name}</strong><small>{i.email} · Expires {new Date(i.expires_at).toLocaleDateString()}</small></div><span className={i.status}>{i.status}</span>{i.status==='pending'&&<button onClick={async()=>{try{await revokeGuardInvitation(i.id);await load();onToast('Guard invitation revoked.')}catch(error){onToast(error instanceof Error?error.message:'Unable to revoke invitation.')}}}><X/>Revoke</button>}</article>):<div className="marketplace-list-state empty"><Mail/><strong>No invitations</strong><small>Pending and completed Guard invitations appear here.</small></div>}</div></section>
}

type AgencyMessageRecord={id:string;channel:'all_guards'|'active_mission'|'post_job';sender:'agency'|'guard'|'system';senderName:string;body:string;context:string;createdAt:string}
const agencyMessageStoreKey='copilot-agency-message-center-v1'
function loadAgencyMessages():AgencyMessageRecord[]{
  if(typeof window==='undefined')return []
  try{const parsed=JSON.parse(window.localStorage.getItem(agencyMessageStoreKey)??'[]');return Array.isArray(parsed)?parsed:[]}catch{return []}
}
function saveAgencyMessages(messages:AgencyMessageRecord[]){
  if(typeof window!=='undefined')window.localStorage.setItem(agencyMessageStoreKey,JSON.stringify(messages.slice(0,80)))
}

function OperationalWorkspace({tab,jobs,accepted,dispatch,guards,guardSummary,activity,agencyName,onNavigate}:{tab:Tab;jobs:Job[];accepted:Job[];dispatch:AgencyDispatchWorkspace|null;guards:Guard[];guardSummary:{total:number;online:number;offline:number;available:number;reserved:number;on_mission:number};activity:Activity[];agencyName:string;onNavigate:(tab:Tab)=>void}){
  const missions=dispatch?.missions??[]
  const active=missions.filter(m=>isActiveAgencyMission(m.status))
  const scheduled=missions.filter(m=>Boolean(m.scheduled_for)&&!['completed','cancelled'].includes(m.status))
  const [agencyMessages,setAgencyMessages]=useState<AgencyMessageRecord[]>(loadAgencyMessages)
  useEffect(()=>saveAgencyMessages(agencyMessages),[agencyMessages])
  const latestMission=active[0]??missions[0]??null
  const messageThreads=[
    {key:'all_guards' as const,title:'All Guards',copy:'Agency-wide broadcast before, during, or after jobs.',count:guards.length},
    {key:'active_mission' as const,title:'Mission Thread',copy:latestMission?'Attach message to '+latestMission.title:'No mission selected yet; messages still stay visible.',count:active.length},
    {key:'post_job' as const,title:'Post-Job Follow-up',copy:'After-action notes, clarifications, and report follow-up.',count:missions.filter(m=>['review','completed'].includes(String(m.status))).length},
  ]
  useEffect(()=>{let alive=true;const load=()=>fetchAgencyMessages().then(records=>{if(alive&&records.length)setAgencyMessages(records as AgencyMessageRecord[])}).catch(()=>undefined);load();const stop=subscribeToAgencyMessages(load);return()=>{alive=false;stop()}},[])
  const sendAgencyMessage=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    const form=event.currentTarget
    const data=new FormData(form)
    const body=String(data.get('body')??'').trim()
    if(!body)return
    const channel=(String(data.get('channel')??'all_guards') as AgencyMessageRecord['channel'])
    const thread=messageThreads.find(t=>t.key===channel)
    let message:AgencyMessageRecord|null=null
    try{message=await persistAgencyMessage({channel,body,jobId:channel==='active_mission'?latestMission?.job_id??null:null}) as AgencyMessageRecord}catch{message=null}
    message=message??{id:crypto.randomUUID(),channel,sender:'agency',senderName:agencyName||'Agency',body,context:thread?.title??'Agency message',createdAt:new Date().toISOString()}
    setAgencyMessages(current=>[message,...current])
    form.reset()
  }
  if(tab==='scheduled')return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">SCHEDULED COVERAGE</span><h1>Upcoming jobs</h1><p>Scheduled missions stay visible here before they enter live operations.</p></div><button type="button" onClick={()=>onNavigate('marketplace')}><Crosshair/>Marketplace</button></div><div className="operations-grid">{scheduled.length?scheduled.map(m=><article className="operation-card" key={m.job_id}><div className="operation-status"><span>{m.status.replace('_',' ').toUpperCase()}</span><small>{m.scheduled_for?new Date(m.scheduled_for).toLocaleString():'Unscheduled'}</small></div><h3>{m.title}</h3><p><MapPin/>{m.property.address}</p><div className="operation-footer"><div className="guard-avatar">{m.guard?.name?.split(' ').map(v=>v[0]).join('').slice(0,2)??'—'}</div><div><small>{m.guard?'ASSIGNED':'ASSIGNMENT'}</small><strong>{m.guard?.name??'Awaiting guard'}</strong></div><button type="button" onClick={()=>onNavigate('operations')}>Open</button></div></article>):<div className="marketplace-list-state empty"><CalendarClock/><strong>No scheduled jobs</strong><small>Accepted jobs with a future start time will appear here.</small></div>}</div></section>
  if(tab==='assignments')return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">WON MARKETPLACE JOBS</span><h1>Assignments</h1><p>Every accepted mission is tracked until it is assigned, worked, and closed.</p></div><button type="button" onClick={()=>onNavigate('operations')}><Radio/>Open operations</button></div><div className="operations-grid">{(missions.length?missions:accepted.map(j=>({job_id:j.id,status:'awaiting_guard',title:j.title,property:{address:j.address,name:j.property},guard:null,duration_minutes:j.duration} as any))).map(m=><article className="operation-card" key={m.job_id}><div className="operation-status"><span className={m.guard?'active':'awaiting'}>{String(m.status).replace('_',' ').toUpperCase()}</span><small>{String(m.job_id).slice(0,8)}</small></div><h3>{m.title}</h3><p><MapPin/>{m.property.address}</p><div className="operation-footer"><div className="guard-avatar">{m.guard?.name?.split(' ').map((v:string)=>v[0]).join('').slice(0,2)??'—'}</div><div><small>{m.guard?'ASSIGNED GUARD':'NEXT ACTION'}</small><strong>{m.guard?.name??'Assign a guard'}</strong></div><button type="button" onClick={()=>onNavigate('operations')}>Manage</button></div></article>)}</div>{!missions.length&&!accepted.length&&<div className="marketplace-list-state empty"><ClipboardList/><strong>No won assignments</strong><small>Claim a marketplace opportunity to start assignment.</small></div>}</section>
  if(tab==='analytics'){
    const reviewCount=missions.filter(m=>(m.status as string)==='review').length
    const readinessTitle=guardSummary.available?'Ready to accept work':'Setup needed'
    const readinessCopy=guardSummary.available?'Available guard capacity is online. Keep response time tight and claim jobs you can assign immediately.':'No guards are available. Activate or invite guards before accepting new marketplace work.'
    const readinessTone=guardSummary.available?'ready':'blocked'
    const utilization=guardSummary.total?Math.round((guardSummary.on_mission/guardSummary.total)*100):0
    const availablePct=guardSummary.total?Math.round((guardSummary.available/guardSummary.total)*100):0
    const activeCopy=active.length?active.length+' live mission'+(active.length===1?' is':'s are')+' in progress. Keep Operations visible until each job reaches report review.':'No active missions right now. Watch Marketplace for the next opportunity.'
    const marketCopy=jobs.length?jobs.length+' open opportunit'+(jobs.length===1?'y is':'ies are')+' waiting in Marketplace. Confirm guard capacity before claiming.':'No open opportunities. Use downtime to clean up reports, roster, and readiness.'
    return <section className="operations-page analytics-page"><div className="operations-heading analytics-hero"><div><span className="eyebrow">PERFORMANCE CENTER</span><h1>Agency analytics</h1><p>Track capacity, activity, readiness, and the next operational move from one executive view.</p></div><button type="button" onClick={()=>onNavigate('reports')}><BriefcaseBusiness/>Reports</button></div><div className={'analytics-command-panel '+readinessTone}><div className="analytics-command-icon"><Gauge/></div><div><small>AGENCY READINESS</small><strong>{readinessTitle}</strong><span>{readinessCopy}</span></div><div className="analytics-command-actions"><button type="button" className="primary" onClick={()=>onNavigate(guardSummary.available?'marketplace':'guards')}>{guardSummary.available?'Open Marketplace':'Manage Guards'}</button><button type="button" onClick={()=>onNavigate('operations')}>Operations</button></div></div><section className="analytics-score-grid"><article><small>AVAILABLE</small><strong>{guardSummary.available}</strong><span>{guardSummary.total} total guards</span></article><article><small>ACTIVE MISSIONS</small><strong>{active.length}</strong><span>{utilization}% guard utilization</span></article><article><small>OPEN MARKET</small><strong>{jobs.length}</strong><span>{jobs.length?'Actionable now':'No claims waiting'}</span></article><article><small>REPORT FLOW</small><strong>{reviewCount}</strong><span>Needs agency review</span></article></section><div className="analytics-workbench"><article className="analytics-insight-card primary"><div className="analytics-card-head"><span><Users/></span><div><small>CAPACITY READINESS</small><h3>Guard coverage strength</h3></div></div><p>{guardSummary.available} available of {guardSummary.total} total guards. {readinessCopy}</p><div className="analytics-meter"><i style={{width:availablePct+'%'}}/></div><div className="analytics-action-row"><div><small>ONLINE GUARDS</small><strong>{guardSummary.online} reachable now</strong></div><button type="button" onClick={()=>onNavigate('guards')}>Roster</button></div></article><article className="analytics-insight-card"><div className="analytics-card-head"><span><Radio/></span><div><small>MISSION LOAD</small><h3>Live operations</h3></div></div><p>{activeCopy}</p><div className="analytics-mini-list"><span>On mission <b>{guardSummary.on_mission}</b></span><span>Reserved <b>{guardSummary.reserved}</b></span><span>Offline <b>{guardSummary.offline}</b></span></div><div className="analytics-action-row"><div><small>DISPATCH BOARD</small><strong>{active.length} active mission{active.length===1?'':'s'}</strong></div><button type="button" onClick={()=>onNavigate('operations')}>Open</button></div></article><article className="analytics-insight-card"><div className="analytics-card-head"><span><BriefcaseBusiness/></span><div><small>MARKETPLACE FLOW</small><h3>Open opportunities</h3></div></div><p>{marketCopy}</p><div className="analytics-mini-list"><span>Open jobs <b>{jobs.length}</b></span><span>Won jobs <b>{accepted.length}</b></span><span>Scheduled <b>{scheduled.length}</b></span></div><div className="analytics-action-row"><div><small>CLAIM CONTROL</small><strong>{jobs.length?'Review claimable work':'No open work'}</strong></div><button type="button" onClick={()=>onNavigate('marketplace')}>Market</button></div></article></div></section>
  }
  if(tab==='messages')return <section className="operations-page messages-page"><div className="operations-heading messages-hero"><div><span className="eyebrow">INBOX & COMMAND COMMS</span><h1>Messages</h1><p>Agency and guards can communicate before the job, during live coverage, and after the report handoff.</p></div><button type="button" onClick={()=>onNavigate('marketplace')}>Back to market</button></div><section className="messages-command-panel"><div><small>ALWAYS-ON COMMS</small><strong>{guards.length} guard{guards.length===1?'':'s'} reachable · {agencyMessages.length} message{agencyMessages.length===1?'':'s'}</strong><span>Use this page for broadcasts, active mission instructions, and post-job clarification. Messages remain visible even when no mission is currently active.</span></div><div className="messages-command-actions"><button type="button" onClick={()=>onNavigate('guards')}>View Guards</button><button type="button" onClick={()=>onNavigate('operations')}>Operations</button></div></section><div className="messages-shell"><aside className="message-thread-list">{messageThreads.map(thread=><button type="button" key={thread.key}><span><MessageSquare/></span><div><strong>{thread.title}</strong><small>{thread.copy}</small></div><b>{thread.count}</b></button>)}<div className="message-safety-note"><ShieldCheck/><span><strong>Communication rule</strong><small>Do not hide messaging behind job state. Guards need agency contact before, during, and after every mission.</small></span></div></aside><main className="message-workspace"><form className="message-composer" onSubmit={sendAgencyMessage}><div><label>Thread<select name="channel" defaultValue="all_guards"><option value="all_guards">All Guards broadcast</option><option value="active_mission">Active mission thread</option><option value="post_job">Post-job follow-up</option></select></label></div><label>Message<textarea name="body" required placeholder="Type instructions, guard update, client clarification, or post-job note…"/></label><div className="message-composer-actions"><small>Visible to agency dispatch now. Backend realtime table is the next persistence layer.</small><button type="submit">Send Message</button></div></form><section className="message-feed"><div className="message-feed-head"><strong>Conversation feed</strong><span>{agencyMessages.length?agencyMessages.length+' total':'No messages yet'}</span></div>{agencyMessages.length?agencyMessages.map(m=><article className={'message-bubble '+m.sender} key={m.id}><div><strong>{m.senderName}</strong><small>{m.context} · {new Date(m.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></div><p>{m.body}</p></article>):<div className="messages-empty-state"><MessageSquare/><strong>No messages yet</strong><small>Send the first agency broadcast or mission instruction. This composer stays available before, during, and after jobs.</small></div>}{activity.length>0&&<div className="message-activity-rail"><strong>Recent system alerts</strong>{activity.slice(0,4).map(a=><span key={a.id}>{a.title}<small>{a.time}</small></span>)}</div>}</section></main></div></section>
  if(tab==='settings')return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">AGENCY SETTINGS</span><h1>{agencyName}</h1><p>Workspace controls are connected to live marketplace state.</p></div><button type="button" onClick={()=>onNavigate('guards')}><Users/>Manage guards</button></div><div className="operations-grid"><article className="operation-card"><div className="operation-status"><span className="active">CONNECTED</span><small>Supabase</small></div><h3>Agency workspace</h3><p><ShieldCheck/>Verified agency access controls are active.</p><div className="operation-footer"><div className="guard-avatar">AF</div><div><small>AGENCY</small><strong>{agencyName}</strong></div><button type="button" onClick={()=>onNavigate('analytics')}>Analytics</button></div></article><article className="operation-card"><div className="operation-status"><span>ROSTER</span><small>{guards.length} guards</small></div><h3>Guard controls</h3><p><Users/>Invite, review, and manage your guard team.</p><div className="operation-footer"><div className="guard-avatar">{guardSummary.total}</div><div><small>TEAM SIZE</small><strong>{guardSummary.online} online now</strong></div><button type="button" onClick={()=>onNavigate('guards')}>Open</button></div></article></div></section>
  return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">AGENCY WORKSPACE</span><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1><p>This workspace is wired into the agency navigation and operational state.</p></div><button type="button" onClick={()=>onNavigate('marketplace')}><Crosshair/>Marketplace</button></div></section>
}

function CodeStatus({preview}:{preview:boolean}){return preview?<LockKeyhole/>:<Database/>}
function DeveloperDiagnostics({onClose,authRole,viewedRole,accountStatus,authPhase,agencyId,agencyName,preview,realtimeState,lastError,jobs,accepted}:{onClose:()=>void;authRole:AppRole|null;viewedRole:AppRole;accountStatus:string|null;authPhase:string;agencyId:string|null;agencyName:string;preview:boolean;realtimeState:string;lastError:string|null;jobs:Job[];accepted:Job[]}){
  const selected=accepted[0]??jobs[0]
  const Row=({label,value,state='neutral'}:{label:string;value:string;state?:'good'|'warn'|'bad'|'neutral'})=><div className="diagnostic-row"><span>{label}</span><strong className={state}>{value}</strong></div>
  return <div className="developer-diagnostics-scrim" onClick={onClose}><aside className="developer-diagnostics" onClick={e=>e.stopPropagation()}><header><div><Bug/><span><strong>Developer Diagnostics</strong><small>RC1 matched foundation</small></span></div><button onClick={onClose}><X/></button></header><section><h3>Identity & Access</h3><Row label="Authenticated role" value={authRole?.replace('_',' ')??'unknown'} state={authRole==='agency_admin'?'good':'warn'}/><Row label="Viewing portal" value={viewedRole.replace('_',' ')}/><Row label="Access mode" value={preview?'Preview — writes blocked':'Live Test — real permissions'} state={preview?'warn':'good'}/><Row label="Account status" value={accountStatus??'unknown'} state={accountStatus==='approved'?'good':'warn'}/><Row label="Auth phase" value={authPhase} state={authPhase==='ready'?'good':'warn'}/></section><section><h3>Marketplace Health</h3><Row label="Agency record" value={agencyId?`${agencyName} · ${agencyId.slice(0,8)}…`:'Not resolved'} state={agencyId?'good':'bad'}/><Row label="Marketplace query" value={lastError?`Failed: ${lastError}`:(preview?'Simulated data':'Connected')} state={lastError?'bad':preview?'warn':'good'}/><Row label="Realtime" value={realtimeState} state={realtimeState==='connected'?'good':realtimeState==='preview'?'warn':'neutral'}/><Row label="Open missions" value={String(jobs.length)}/><Row label="Claimed missions" value={String(accepted.length)}/></section><section><h3>Mission Inspector</h3>{selected?<><Row label="Mission ID" value={selected.id}/><Row label="Title" value={selected.title}/><Row label="Current state" value={accepted.some(j=>j.id===selected.id)?'claimed':'open'} state="good"/><Row label="Priority" value={selected.kind}/><Row label="Property" value={selected.address}/></>:<p className="diagnostic-empty">No mission is available to inspect.</p>}</section>{lastError&&<section className="diagnostic-error"><h3>Last Supabase Error</h3><code>{lastError}</code></section>}</aside></div>
}
