import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {nativePhotoFile} from './mobile/nativePlatform'
import { Activity, AlertTriangle, BatteryMedium, BriefcaseBusiness, Camera, Check, CheckCircle2, ChevronRight, Circle, ClipboardCheck, Copy, Eye, FileText, Flame, Image, Lightbulb, MapPin, Menu, MessageCircle, Navigation, Phone, Power, RadioTower, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Send, Trash2, UserRound, Video, Waves, Wifi, X } from 'lucide-react'
import MissionReport from './MissionReport'
import type { IncidentRecord, IncidentSeverity, MissionState, PatrolEvidence } from './types'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'
import MissionMap, { type MissionMapMarker } from './modules/location/MissionMap'
import type { ActiveMissionRoute, MissionRouteResult } from './modules/location/missionRouting'
import { toMissionRuntimeRouteInput } from './modules/mission-runtime/missionRuntimeState'
import { getAgencyMessages as fetchGuardMessages, sendAgencyMessage as persistGuardMessage, getDeveloperGuardMessages, sendDeveloperGuardMessage, subscribeToAgencyMessages } from './modules/messaging/messagingRepository'
import { AppHeader, BottomNav, Metric, PhoneShell, PrimaryButton, SecondaryButton, StatusChip } from './ui'
import GuardSettingsPage from './GuardSettings'
import { getMyGuardSettings, type GuardSettings } from './modules/guard/guardSettingsRepository'
import { getMyGuardReports, publishGuardMissionReport, type MissionReportRecord } from './modules/reporting/reportingRepository'
import { getMissionEvidenceWithUrls, type MissionEvidenceMediaWithUrl } from './modules/mission/missionEvidenceRepository'
import type { GuardNavTarget } from './ui'


type EvidenceLevel = 'optional' | 'recommended' | 'required'
type Checkpoint = {
  name: string
  instructions: string[]
  photo: EvidenceLevel
  video: EvidenceLevel
  notes: EvidenceLevel
  smartReminder: string
}

const checkpoints: Checkpoint[] = [
  { name:'Exterior Perimeter', instructions:['Walk the full exterior perimeter','Look for damage, loitering, or unsecured access'], photo:'recommended', video:'optional', notes:'optional', smartReminder:'Capture the full fence line and any unsecured access point.' },
  { name:'Parking Lot', instructions:['Inspect parked vehicles and lighting','Check for suspicious activity or debris'], photo:'optional', video:'optional', notes:'optional', smartReminder:'Keep license plates out of frame unless documenting an incident.' },
  { name:'Main Entrance', instructions:['Verify entrance doors are secure','Inspect glass, locks, and vestibule'], photo:'required', video:'optional', notes:'optional', smartReminder:'Door handles, lock, and alarm indicator must be visible.' },
  { name:'Back Entrance', instructions:['Confirm employee entrance is secured','Check hinges, lock, and surrounding area'], photo:'optional', video:'optional', notes:'recommended', smartReminder:'Note any delivery activity or signs of forced entry.' },
  { name:'Rear Loading Dock', instructions:['Check delivery doors','Verify dock gate is locked','Inspect fence line and look for suspicious activity'], photo:'required', video:'optional', notes:'optional', smartReminder:'Show the dock gate lock and both delivery doors in evidence.' },
  { name:'Side Doors', instructions:['Verify all side exits are secure','Check for tampering or blocked exits'], photo:'optional', video:'optional', notes:'optional', smartReminder:'Confirm exits are unobstructed from both directions.' },
]

type GuardDashboardMetrics = {
  jobsToday: number
  onDutySeconds: number
}

function formatDutyTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}


type GuardMessageRecord={id:string;channel:'all_guards'|'active_mission'|'post_job';sender:'agency'|'guard'|'system';senderName:string;body:string;context:string;createdAt:string}

export interface GuardDashboardProps {
  state: MissionState
  runtime?: MissionRuntime | null
  checkpoint?: number
  onAdvance?: () => void
  onGoOnline?: () => void
  onGoOffline?: () => void
  onAccept?: () => void
  onDecline?: () => void
  onStartRoute?: () => void
  onMarkArrived?: () => void
  onNextCheckpoint?: () => void | Promise<void>
  onSubmitProof?: () => void | Promise<void>
  onPublishReport?: () => void | Promise<void>
  onReturnOnline?: () => void
  patrolEvidence?: PatrolEvidence[]
  onEvidenceChange?: (records: PatrolEvidence[]) => void | Promise<void>
  incidents?: IncidentRecord[]
  onIncidentsChange?: (records: IncidentRecord[]) => void | Promise<void>
  missionStartedAt?: number | null
  metrics?: GuardDashboardMetrics
}

const action = (preferred?: () => void, fallback?: () => void) => preferred ?? fallback ?? (() => undefined)

function ProfileBlock({ online = false, profile }: { online?: boolean; profile?:GuardSettings|null }) { const name=profile?.name||'Guard',initials=name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(); return <div className="profile-row"><div><small>Good Morning,</small><h2>{name}</h2><StatusChip tone={online ? 'green' : 'gray'}>{online ? 'ONLINE' : 'OFFLINE'}</StatusChip></div><div className="profile-avatar-identity"><div className={`avatar ${profile?.avatar_url?'has-photo':''}`}>{profile?.avatar_url?<img src={profile.avatar_url} alt={`${name} profile`}/>:initials}</div><small>{name}</small></div></div>
}
function PropertyHeader({ eyebrow, runtime }: { eyebrow: string; runtime?: MissionRuntime | null }) { const name=runtime?.property.name??'Property'; const address=runtime?.property.address??'Address unavailable'; return <><div className="eyebrow">{eyebrow}</div><h2 className="property-title">{name}</h2><p className="address">{address}</p></> }

function GuardHomeView({ online, metrics, onGoOnline, onGoOffline, profile }: { online: boolean; metrics: GuardDashboardMetrics; onGoOnline?: () => void; onGoOffline?: () => void; profile?:GuardSettings|null }) {
  return <>
    <ProfileBlock online={online} profile={profile}/>
    <section className={online ? 'waiting-hero' : 'offline-hero'}>
      {online ? <div className="radar"><div className="radar-sweep"/></div> : <div className="shield-orbit"><ShieldCheck/></div>}
      <h3>{online ? "You're online and available" : 'You are currently offline'}</h3>
      <p>{online ? <>We'll notify you when a new<br/>assignment is available.</> : <>Go online to receive<br/>assignments.</>}</p>
      {online ? <PrimaryButton onClick={onGoOffline}><Power/> GO OFFLINE</PrimaryButton> : <PrimaryButton onClick={onGoOnline}><Power/> GO ONLINE</PrimaryButton>}
    </section>
    <h4 className="section-label">Today at a glance</h4>
    <div className="metric-grid"><Metric value={String(metrics.jobsToday)} label="Jobs Today"/><Metric value={formatDutyTime(metrics.onDutySeconds)} label="On Duty"/><Metric value={online ? '—' : '0'} label={online ? 'Patrol Readiness' : 'Check-ins'}/></div>
    <div className={online ? 'message-card dark' : 'message-card'}><MessageCircle/><div><strong>Messages</strong><small>No unread messages</small></div><ChevronRight/></div>
  </>
}

function GuardJobsArchive({ developerGuardId }: { developerGuardId?:string }) {
  const [reports,setReports]=useState<MissionReportRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [selected,setSelected]=useState<MissionReportRecord|null>(null)
  const [media,setMedia]=useState<MissionEvidenceMediaWithUrl[]>([])
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState('')
  const load=async()=>{setLoading(true);try{setReports(await getMyGuardReports(developerGuardId));setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load report history.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[developerGuardId])
  useEffect(()=>{let alive=true;if(!selected){setMedia([]);return()=>{alive=false}};void getMissionEvidenceWithUrls(selected.job_id).then(rows=>{if(alive)setMedia(rows)}).catch(()=>{if(alive)setMedia([])});return()=>{alive=false}},[selected?.job_id])
  const publish=async(report:MissionReportRecord)=>{if(busy)return;setBusy(report.id);setError('');try{await publishGuardMissionReport(report.job_id,developerGuardId);await load();setSelected(current=>current?.id===report.id?{...current,status:'published',published_at:new Date().toISOString()}:current)}catch(e){setError(e instanceof Error?e.message:'Unable to publish report.')}finally{setBusy(null)}}
  return <section className="guard-jobs-archive"><header><div><small>JOBS & REPORTS</small><h3>Mission history</h3><p>Published and unpublished reports stay here so nothing gets stranded.</p></div><button onClick={()=>void load()}><RefreshCw/> Refresh</button></header>{error&&<div className="guard-report-error">{error}</div>}{loading?<p>Loading mission reports…</p>:reports.length?<div className="guard-report-list">{reports.map(report=>{const snapshot=report.snapshot??{};const publishable=report.status==='pending_review'||report.status==='clarification_requested';return <article key={report.id}><div><span className={`guard-report-status ${report.status}`}>{report.status==='published'?'PUBLISHED':report.status==='archived'?'ARCHIVED':'NEEDS PUBLISHING'}</span><small>{new Date(snapshot?.job?.completed_at??report.created_at).toLocaleString()}</small></div><h4>{snapshot?.property?.name??snapshot?.job?.title??'Completed mission'}</h4><p>{snapshot?.property?.address??'Mission report'}</p><footer><button onClick={()=>setSelected(report)}><Eye/> View report</button>{publishable&&<button className="publish" disabled={busy===report.id} onClick={()=>void publish(report)}><Send/> {busy===report.id?'Publishing…':'Publish to client'}</button>}</footer></article>})}</div>:<div className="guard-report-empty"><FileText/><strong>No completed reports yet</strong><span>Your completed missions will appear here.</span></div>}{selected&&<div className="guard-report-archive-overlay"><button className="guard-report-archive-close" onClick={()=>setSelected(null)}><X/></button><article><small>{selected.status==='published'?'PUBLISHED REPORT':'UNPUBLISHED REPORT'}</small><h2>{selected.snapshot?.job?.title??'Completed security mission'}</h2><p>{selected.snapshot?.property?.name??'Property'} · {selected.snapshot?.property?.address??''}</p><div className="guard-archive-media">{media.length?media.map(item=><figure key={item.id}>{item.kind==='video'?<video src={item.url} controls/>:<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt="Guard mission evidence"/></a>}<figcaption>Checkpoint {item.checkpoint_index+1}</figcaption></figure>):<div>No uploaded photo or video evidence.</div>}</div>{(selected.status==='pending_review'||selected.status==='clarification_requested')&&<button className="guard-archive-publish" disabled={busy===selected.id} onClick={()=>void publish(selected)}><Send/> {busy===selected.id?'PUBLISHING…':'PUBLISH TO CLIENT'}</button>}</article></div>}</section>
}

function GuardSectionView({ section, online, metrics, developerGuardId, profile }: { section: GuardNavTarget; online: boolean; metrics: GuardDashboardMetrics; developerGuardId?:string; profile?:GuardSettings|null }) {
  const [messages,setMessages]=useState<GuardMessageRecord[]>([])
  const [messageError,setMessageError]=useState('')
  useEffect(()=>{let alive=true;const load=()=>{const request=developerGuardId?getDeveloperGuardMessages(developerGuardId):fetchGuardMessages();return request.then(records=>{if(alive){setMessages(records as GuardMessageRecord[]);setMessageError('')}}).catch(error=>{if(alive){setMessages([]);setMessageError(error instanceof Error?error.message:'Messages unavailable.')}})};void load();const stop=subscribeToAgencyMessages(()=>void load());return()=>{alive=false;stop()}},[developerGuardId])
  const sendGuardMessage=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    const form=event.currentTarget
    const data=new FormData(form)
    const body=String(data.get('body')??'').trim()
    if(!body)return
    let message:GuardMessageRecord|null=null
    try{message=(developerGuardId?await sendDeveloperGuardMessage(developerGuardId,{channel:'active_mission',body}):await persistGuardMessage({channel:'active_mission',body})) as GuardMessageRecord;setMessageError('')}catch(error){setMessageError(error instanceof Error?error.message:'Message was not delivered.');return}
    setMessages(current=>[message,...current])
    form.reset()
  }
  if(section==='settings')return <GuardSettingsPage guardId={developerGuardId}/>
  if(section==='profile')return <GuardSettingsPage guardId={developerGuardId}/>
  if(section==='jobs')return <GuardJobsArchive developerGuardId={developerGuardId}/>
  if(section==='messages')return <>
    <ProfileBlock online={online} profile={profile}/>
    <section className="guard-message-center">
      <div className="guard-main-section-icon"><MessageCircle/></div>
      <small>MESSAGES</small>
      <h3>Agency Comms</h3>
      <p>Send and receive agency messages before, during, and after every job.</p>
      <form className="guard-message-composer" onSubmit={sendGuardMessage}>
        <textarea name="body" required placeholder="Reply to agency dispatch…"/>
        <button type="submit">Send</button>
      </form>
      {messageError&&<small className="guard-message-error">{messageError}</small>}
      <div className="guard-message-feed">{messages.length?messages.slice(0,5).map(m=><article className={m.sender} key={m.id}><strong>{m.senderName}</strong><span>{m.body}</span><small>{m.context} · {new Date(m.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></article>):<div><strong>No messages yet</strong><span>Agency broadcasts and mission instructions will appear here.</span></div>}</div>
    </section>
  </>
  const copy: Record<GuardNavTarget, { kicker: string; title: string; body: string; detail: string; icon: ReactNode }> = {
    home: { kicker:'HOME', title:'Guard Home', body:'Current duty status and availability.', detail:online?'Online and ready for assignment.':'Offline until you go online.', icon:<ShieldCheck/> },
    jobs: { kicker:'JOBS', title:'Assignments', body:online?'No active assignment is waiting right now. New jobs will appear here when the agency sends one.':'Go online to receive assignments from the agency.', detail:String(metrics.jobsToday)+' jobs today', icon:<BriefcaseBusiness/> },
    messages: { kicker:'MESSAGES', title:'Messages', body:'No unread agency messages right now.', detail:'Agency broadcasts and mission updates appear here.', icon:<MessageCircle/> },
    profile: { kicker:'PROFILE', title:'Guard Profile', body:'Your guard identity, duty status and agency relationship.', detail:online?'Status: Online':'Status: Offline', icon:<UserRound/> },
    settings: { kicker:'SETTINGS', title:'Guard Settings', body:'Manage your field profile and preferences.', detail:'Profile, notifications and work preferences', icon:<UserRound/> },
  }
  const selected = copy[section]

  return <>
    <ProfileBlock online={online} profile={profile}/>
    <section className="guard-main-section">
      <div className="guard-main-section-icon">{selected.icon}</div>
      <small>{selected.kicker}</small>
      <h3>{selected.title}</h3>
      <p>{selected.body}</p>
      <div className="guard-main-section-card"><strong>{selected.detail}</strong><span>This section is connected to the guard portal navigation.</span></div>
    </section>
  </>
}

function Offline({ next, metrics, developerGuardId, profile }: { next: () => void; metrics: GuardDashboardMetrics; developerGuardId?:string; profile?:GuardSettings|null }) {
  const [section, setSection] = useState<GuardNavTarget>('home')
  return <PhoneShell light><main className="screen-content offline-screen">{section==='home'?<GuardHomeView online={false} metrics={metrics} onGoOnline={next} profile={profile}/>:<GuardSectionView section={section} online={false} metrics={metrics} developerGuardId={developerGuardId} profile={profile}/>}</main><BottomNav light active={section} onSelect={setSection}/></PhoneShell>
}

function Waiting({ offline, metrics, developerGuardId, profile }: { offline: () => void; metrics: GuardDashboardMetrics; developerGuardId?:string; profile?:GuardSettings|null }) {
  const [section, setSection] = useState<GuardNavTarget | null>(null)
  const name=profile?.name||'Guard'
  if(section)return <PhoneShell><main className="screen-content guard-drawer-screen"><button className="guard-back-map" onClick={()=>setSection(null)}><ChevronRight/> Back to map</button><GuardSectionView section={section} online metrics={metrics} developerGuardId={developerGuardId} profile={profile}/></main></PhoneShell>
  return <PhoneShell><main className="guard-map-home">
    <div className="guard-home-map"><MissionMap markers={[]} showViewerLocation zoom={14} visualTheme="light"/></div>
    <div className="guard-waiting-radar" aria-hidden="true"><span/><span/><span/><b className="guard-radar-crosshair horizontal"/><b className="guard-radar-crosshair vertical"/><em className="guard-radar-sweep"/><i/></div>
    <header className="guard-map-top"><button onClick={()=>setSection('settings')} aria-label="Open guard menu"><Menu/></button><div><strong>CO PILOT</strong><small><i/> ONLINE</small></div><button onClick={()=>setSection('messages')} aria-label="Open messages"><MessageCircle/></button></header>
    <section className="guard-ready-card"><span className="guard-ready-handle"/><small>YOU'RE ONLINE</small><h2>Ready for requests</h2><p>Stay available. Your next security assignment will appear here.</p><div className="guard-ready-meta"><span><strong>{metrics.jobsToday}</strong><small>Jobs today</small></span><span><strong>{formatDutyTime(metrics.onDutySeconds)}</strong><small>On duty</small></span><span><strong>{name.split(' ')[0]}</strong><small>Guard</small></span></div><button className="guard-offline-pill" onClick={offline}><Power/> GO OFFLINE</button></section>
    <nav className="guard-map-dock"><button onClick={()=>setSection('jobs')}><BriefcaseBusiness/><span>Jobs</span></button><button className="guard-dock-home"><Navigation/><span>Online</span></button><button onClick={()=>setSection('profile')}><UserRound/><span>Account</span></button></nav>
  </main></PhoneShell>
}
function Assignment({ accept, decline, runtime }: { accept: () => void; decline: () => void; runtime?: MissionRuntime | null }) {
  const guardLocation=runtime?.guardLocation
  const markers=useMemo<MissionMapMarker[]>(()=>{
    const result:MissionMapMarker[]=[]
    if(Number.isFinite(runtime?.property.latitude)&&Number.isFinite(runtime?.property.longitude))result.push({id:`offer-${runtime?.jobId??'job'}`,latitude:runtime!.property.latitude!,longitude:runtime!.property.longitude!,label:runtime?.property.name??'Assignment',title:runtime?.property.name??'Assignment',subtitle:runtime?.property.address??undefined,photoUrl:runtime?.property.photoUrl??null,type:'property',active:true})
    if(Number.isFinite(guardLocation?.latitude)&&Number.isFinite(guardLocation?.longitude))result.push({id:'offer-guard',latitude:guardLocation!.latitude!,longitude:guardLocation!.longitude!,label:'You',title:'Your location',type:'guard',initials:'YOU',status:'available'})
    return result
  },[runtime,guardLocation])
  return <PhoneShell><main className="guard-offer-map"><div className="guard-home-map"><MissionMap markers={markers} showViewerLocation zoom={13}/></div><div className="guard-offer-badge"><BriefcaseBusiness/> NEW REQUEST</div><section className="guard-offer-sheet"><span className="guard-ready-handle"/>{runtime?.property.photoUrl?<img className="guard-offer-property-photo" src={runtime.property.photoUrl} alt={`${runtime.property.name} property`}/>:null}<small>SECURITY REQUEST</small><h2>{runtime?.property.name??'New assignment'}</h2><p>{runtime?.property.address??'Property address unavailable'}</p><div className="guard-offer-facts"><span><small>TYPE</small><strong>{runtime?.title??'Security patrol'}</strong></span><span><small>PRIORITY</small><strong>{runtime?.priority?.toUpperCase()??'STANDARD'}</strong></span></div><div className="guard-offer-actions"><button onClick={decline}>DECLINE</button><button className="accept" onClick={accept}><Check/> ACCEPT</button></div></section></main></PhoneShell>
}
function EnRoute({ next, runtime, profile }: { next: () => void; runtime?: MissionRuntime | null; profile?: GuardSettings | null }) {
  const [route, setRoute] = useState<MissionRouteResult | null>(null)

  const routeInput = useMemo(
    () => runtime ? toMissionRuntimeRouteInput(runtime) : null,
    [runtime]
  )

  const activeMissionRoute = useMemo<ActiveMissionRoute | null>(() => {
    if (!routeInput) return null

    return {
      missionId: routeInput.jobId,
      status: routeInput.state,
      assignedGuard: {
        guardId: routeInput.guard.id,
        name: routeInput.guard.name,
        latitude: routeInput.guard.latitude,
        longitude: routeInput.guard.longitude,
        heading: runtime?.guardLocation?.heading ?? null,
        accuracy: runtime?.guardLocation?.accuracy ?? null,
        updatedAt: runtime?.guardLocation?.updatedAt ?? null,
      },
      destination: {
        propertyId: routeInput.destination.propertyId,
        name: routeInput.destination.name,
        address: routeInput.destination.address,
        latitude: routeInput.destination.latitude,
        longitude: routeInput.destination.longitude,
      },
    }
  }, [routeInput, runtime])

  const markers = useMemo<MissionMapMarker[]>(() => {
    if (!routeInput) return []

    const initials = routeInput.guard.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return [
      {
        id: `guard-${routeInput.guard.id}`,
        latitude: routeInput.guard.latitude,
        longitude: routeInput.guard.longitude,
        label: routeInput.guard.name,
        title: routeInput.guard.name,
        type: 'guard',
        initials,
        status: 'en_route',
      },
      {
        id: `property-${routeInput.destination.propertyId ?? routeInput.jobId}`,
        latitude: routeInput.destination.latitude,
        longitude: routeInput.destination.longitude,
        label: routeInput.destination.name ?? 'Mission Property',
        title: routeInput.destination.name ?? 'Mission Property',
        subtitle: routeInput.destination.address ?? undefined,
        type: 'property',
        active: true,
      },
    ]
  }, [routeInput])

  const eta = route?.durationText ?? 'Calculating…'
  const distance = route?.distanceText ?? 'Calculating…'

  return (
    <PhoneShell>
      <AppHeader title="EN ROUTE" avatarUrl={profile?.avatar_url} guardName={profile?.name}/>

      <main className="screen-content compact-content">
        <PropertyHeader eyebrow="EN ROUTE" runtime={runtime}/>

        <div
          className="map-card guard-live-route-map"
          style={{ overflow: 'hidden' }}
        >
          {routeInput ? (
            <MissionMap
              markers={markers}
              activeMissionRoute={activeMissionRoute}
              routeCameraMode="guard"
              showViewerLocation={false}
              zoom={18}
              onRouteUpdate={setRoute}
            />
          ) : (
            <div className="guard-route-unavailable">
              <MapPin/>
              <strong>Route unavailable</strong>
              <small>Waiting for live guard and property coordinates.</small>
            </div>
          )}
        </div>

        <div className="two-stats">
          <div>
            <small>ETA</small>
            <strong>{eta}</strong>
          </div>

          <div>
            <small>DISTANCE</small>
            <strong>{distance}</strong>
          </div>
        </div>

        <div className="route-progress">
          <div>
            <span>LIVE ROUTE</span>
            <b>{route ? 'ACTIVE' : 'LOCATING'}</b>
          </div>

          <i>
            <em style={{ width: route ? '100%' : '18%' }}/>
          </i>
        </div>

        <PrimaryButton onClick={next}>
          <Navigation/> START ROUTE
        </PrimaryButton>
      </main>

      <BottomNav/>
    </PhoneShell>
  )
}

function Arrived({ next, runtime }: { next: () => void; runtime?: MissionRuntime | null }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const contactName = runtime?.client?.name ?? 'Client contact'
  const instructions = runtime?.instructions || 'No special instructions were provided.'

  const arrivalMarkers=Number.isFinite(runtime?.property.latitude)&&Number.isFinite(runtime?.property.longitude)?[{id:`arrival-${runtime?.jobId??'job'}`,latitude:runtime!.property.latitude!,longitude:runtime!.property.longitude!,label:runtime?.property.name??'Property',title:runtime?.property.name??'Property',subtitle:runtime?.property.address??undefined,type:'property' as const,active:true}]:[]
  return <PhoneShell><main className="guard-arrival-map"><div className="guard-home-map"><MissionMap markers={arrivalMarkers} showViewerLocation zoom={17}/></div><div className="guard-offer-badge"><MapPin/> DESTINATION</div><section className="guard-arrival-sheet"><span className="guard-ready-handle"/><small>YOU'RE AT THE PROPERTY</small><h2>{runtime?.property.name??'Property'}</h2><p>{runtime?.property.address??'Address unavailable'}</p><button className="guard-details-link" onClick={()=>setDetailsOpen(true)}>Mission details <ChevronRight/></button><button className="guard-arrived-pill" onClick={next}><CheckCircle2/> MARK ARRIVED</button></section></main>{detailsOpen&&<div className="capture-overlay" role="dialog" aria-modal="true"><button type="button" className="capture-backdrop" onClick={()=>setDetailsOpen(false)} aria-label="Close details"/><section className="capture-sheet notes-sheet"><div className="capture-handle"/><header><button type="button" onClick={()=>setDetailsOpen(false)}><X/></button><strong>Mission Details</strong><span/></header><p className="sheet-copy">Confirm property access, contact, and instructions before beginning patrol.</p><div className="workspace-groups"><section className="workspace-checkpoint"><header><span><small>PROPERTY</small><strong>{runtime?.property.name??'Property'}</strong></span><StatusChip tone="green">ARRIVED</StatusChip></header><div className="workspace-records"><div><span className="workspace-thumb"><MapPin/></span><span><strong>{runtime?.property.address??'Address unavailable'}</strong><small>Destination verified by marketplace routing</small></span><CheckCircle2/></div><div><span className="workspace-thumb"><Phone/></span><span><strong>{contactName}</strong><small>Client contact for this mission</small></span><CheckCircle2/></div><div><span className="workspace-thumb"><FileText/></span><span><strong>Instructions</strong><small>{instructions}</small></span><CheckCircle2/></div></div></section></div></section></div>}</PhoneShell>
}

function EvidenceAction({ icon, label, level, count, detail, checkpointName, onClick }: { icon: ReactNode; label: string; level: EvidenceLevel; count: number; detail?: string; checkpointName: string; onClick: () => void }) {
  const captured = count > 0 || Boolean(detail)
  return <button className={`evidence-action ${captured ? 'captured' : ''}`} onClick={onClick}>
    <span className={`evidence-icon ${captured ? 'evidence-thumbnail' : ''}`}>{captured ? <><span>{label === 'Photo' ? 'IMG' : label === 'Video' ? 'VID' : 'TXT'}</span><CheckCircle2/></> : icon}</span>
    <span><strong>{label}</strong><small className={`requirement ${level}`}>{captured ? (detail || `${count} captured`) : `${level}${level === 'required' ? ' before completion' : ''}`}</small>{captured && <em>{checkpointName} · Just now</em>}</span>
    <ChevronRight/>
  </button>
}

type CaptureKind = 'photo' | 'video'
function CaptureSheet({ kind, existing, onClose, onUse, onRemove }: { kind: CaptureKind; existing: number; onClose: () => void; onUse: (file?: File) => void | Promise<void>; onRemove: () => void }) {
  const [captured, setCaptured] = useState(false)
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choose=(next?:File)=>{if(!next)return;const expected=kind==='photo'?'image/':'video/';if(!next.type.startsWith(expected)){setError(kind==='photo'?'A real image is required.':'A real video is required.');return}setFile(next);setCaptured(true);setError('');setPreview(URL.createObjectURL(next))}
  const use=async()=>{if(kind==='photo'&&!file){setError('Take a real photo first.');return}setBusy(true);setError('');try{await onUse(file??undefined)}catch(e){setError(e instanceof Error?e.message:'Evidence upload failed.')}finally{setBusy(false)}}
  const title = kind === 'photo' ? 'Take Photo' : 'Record Video'
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button type="button" className="capture-backdrop" onClick={onClose} aria-label="Close capture" />
    <section className="capture-sheet">
      <div className="capture-handle"/>
      <header><button type="button" onClick={onClose}><X/></button><strong>{title}</strong><span/></header>
      <div className={`camera-preview ${captured ? 'captured' : ''}`}>
        <div className="camera-grid"/>
        {captured ? (preview?(kind==='video'?<video src={preview} controls playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<img src={preview} alt="Evidence preview" style={{width:'100%',height:'100%',objectFit:'cover'}}/>):<div className="captured-preview"><CheckCircle2/><strong>Video selected</strong><small>Ready to attach</small></div>) : <div className="camera-instructions"><Camera/><strong>Position the checkpoint in frame</strong><small>{kind==='photo'?'Your phone camera will open when you tap Take Photo.':'Your phone camera will open when you tap Record Video.'}</small></div>}
      </div>
      {!captured ? <div className="capture-controls">{kind==='photo'?<><button type="button" className="shutter photo native-camera-trigger" aria-label="Take photo" title="Take Photo" onClick={async()=>{try{const native=await nativePhotoFile();if(native){choose(native);return}document.getElementById('guard-evidence-camera')?.click()}catch(e){setError(e instanceof Error?e.message:'Camera unavailable.')}}}><i/><b>TAKE PHOTO</b></button><input id="guard-evidence-camera" type="file" accept="image/*" capture="environment" onChange={e=>choose(e.target.files?.[0])} style={{display:'none'}}/></>:<><button type="button" className="shutter video native-camera-trigger" aria-label="Record video" title="Record Video" onClick={()=>document.getElementById('guard-evidence-video')?.click()}><Video/><b>RECORD VIDEO</b></button><input id="guard-evidence-video" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" capture="environment" onChange={e=>choose(e.target.files?.[0])} style={{display:'none'}}/></>}</div> : <div className="capture-confirm">
        <SecondaryButton onClick={()=>{setCaptured(false);setFile(null);setPreview('')}}><RotateCcw/> RETAKE</SecondaryButton>
        <PrimaryButton tone={kind === 'photo' ? 'blue' : 'purple'} onClick={()=>void use()} disabled={busy}><Check/> {busy?'UPLOADING…':`USE ${kind.toUpperCase()}`}</PrimaryButton>
      </div>}
      {error&&<p style={{color:'#ff6b6b',fontWeight:700}}>{error}</p>}
      {existing > 0 && kind==='video' ? <button className="remove-evidence" onClick={onRemove}><Trash2/> Remove existing video</button> : null}
      <p className="evidence-note">Photos and videos are uploaded to the secured mission evidence record before they count toward checkpoint completion.</p>
    </section>
  </div>
}

const quickNotes = ['All secure','Lighting issue','Door unlocked','Property damage','Suspicious activity','Maintenance needed']

const incidentTypes = [
  { label:'Unsecured Door', icon:<ShieldAlert/> },
  { label:'Lighting Issue', icon:<Lightbulb/> },
  { label:'Suspicious Person', icon:<UserRound/> },
  { label:'Trespassing', icon:<AlertTriangle/> },
  { label:'Fire / Smoke', icon:<Flame/> },
  { label:'Water Leak', icon:<Waves/> },
  { label:'Property Damage', icon:<ShieldAlert/> },
  { label:'Other', icon:<Circle/> },
]

function IncidentSheet({ checkpoint, onClose, onSave, onPhotoCapture, onVideoCapture }: { checkpoint: number; onClose: () => void; onSave: (incident: IncidentRecord) => void | Promise<void>; onPhotoCapture?: (file:File,checkpoint:number)=>Promise<void>; onVideoCapture?: (file:File,checkpoint:number)=>Promise<void>; profile?: GuardSettings | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState('')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState(0)
  const [videos, setVideos] = useState(0)
  const [mediaBusy, setMediaBusy] = useState<'photo'|'video'|null>(null)
  const [peopleOrVehicles, setPeopleOrVehicles] = useState('')
  const [emergencyServices, setEmergencyServices] = useState(false)
  const current = checkpoints[checkpoint]
  const canSave = Boolean(type)
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button type="button" className="capture-backdrop" onClick={onClose} aria-label="Close incident" />
    <section className="capture-sheet incident-sheet">
      <div className="capture-handle"/>
      <header><button type="button" onClick={onClose}><X/></button><strong>Report Incident</strong><span/></header>
      <div className="incident-context"><AlertTriangle/><span><small>PATROL LOCATION</small><strong>{current.name}</strong><em>GPS and timestamp attach automatically</em></span></div>
      <h4>Incident Type</h4>
      <div className="incident-type-grid">{incidentTypes.map(item=><button type="button" key={item.label} className={type===item.label?'active':''} onClick={()=>setType(item.label)}>{item.icon}<span>{item.label}</span></button>)}</div>
      <h4>Severity</h4>
      <div className="severity-grid">
        {(['low','medium','high'] as IncidentSeverity[]).map(level=><button type="button" key={level} className={`${level} ${severity===level?'active':''}`} onClick={()=>setSeverity(level)}><i/>{level}</button>)}
      </div>
      <h4>Evidence <small>Optional</small></h4>
      <div className="incident-evidence-grid">
        <button type="button" className={photos?'attached':''} disabled={mediaBusy!==null} onClick={()=>document.getElementById('guard-incident-photo')?.click()}><Camera/><span>{mediaBusy==='photo'?'Uploading…':photos ? `${photos} photo${photos>1?'s':''}` : 'Add Photo'}</span>{photos>0&&<CheckCircle2/>}</button>
        <input id="guard-incident-photo" type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setError('');setMediaBusy('photo');try{if(!onPhotoCapture)throw new Error('Photo upload engine is unavailable.');await onPhotoCapture(file,checkpoint);setPhotos(value=>value+1)}catch(error){setError(error instanceof Error?error.message:'Unable to upload incident photo.')}finally{setMediaBusy(null)}}}/>
        <button type="button" className={videos?'attached':''} disabled={mediaBusy!==null} onClick={()=>document.getElementById('guard-incident-video')?.click()}><Video/><span>{mediaBusy==='video'?'Uploading…':videos ? `${videos} video${videos>1?'s':''}` : 'Add Video'}</span>{videos>0&&<CheckCircle2/>}</button>
        <input id="guard-incident-video" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" capture="environment" style={{display:'none'}} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setError('');setMediaBusy('video');try{if(!onVideoCapture)throw new Error('Video upload engine is unavailable.');await onVideoCapture(file,checkpoint);setVideos(value=>value+1)}catch(error){setError(error instanceof Error?error.message:'Unable to upload incident video.')}finally{setMediaBusy(null)}}}/>
      </div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what happened…" maxLength={400}/>
      <input className="incident-text-input" value={peopleOrVehicles} onChange={e=>setPeopleOrVehicles(e.target.value)} placeholder="People, vehicles, or identifying details (optional)"/>
      <label className="incident-service-toggle"><input type="checkbox" checked={emergencyServices} onChange={e=>setEmergencyServices(e.target.checked)}/><span><strong>Police or emergency services contacted</strong><small>Record this in the final mission report.</small></span></label>
      <div className="note-count">{note.length}/400</div>
      <PrimaryButton tone="orange" disabled={!canSave||busy||mediaBusy!==null} onClick={async()=>{if(!canSave||busy)return;setBusy(true);setError('');try{await onSave({id:`incident-${Date.now()}`,checkpoint,type,severity,note,photos,videos,timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),location:'',status:'draft',peopleOrVehicles,emergencyServices})}catch(e){setError(e instanceof Error?e.message:'Unable to save incident. Try again.')}finally{setBusy(false)}}}><AlertTriangle/> {busy?'SAVING…':'SAVE DRAFT'}</PrimaryButton>
      {!canSave && <p className="incident-required">Choose an incident type to continue.</p>}
      {error&&<p className="incident-required">{error}</p>}
      <p className="evidence-note">Incident evidence attaches to the mission record with checkpoint, timestamp, and location context.</p>
    </section>
  </div>
}
function NotesSheet({ existing, onClose, onSave, onRemove }: { existing: string; onClose: () => void; onSave: (note: string) => void; onRemove: () => void }) {
  const [note, setNote] = useState(existing)
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button type="button" className="capture-backdrop" onClick={onClose} aria-label="Close notes" />
    <section className="capture-sheet notes-sheet">
      <div className="capture-handle"/>
      <header><button type="button" onClick={onClose}><X/></button><strong>Checkpoint Notes</strong><span/></header>
      <p className="sheet-copy">Choose a quick note or enter a custom observation.</p>
      <div className="quick-notes">{quickNotes.map(item=><button type="button" key={item} className={note===item?'active':''} onClick={()=>setNote(item)}>{item}</button>)}</div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what you observed…" maxLength={300}/>
      <div className="note-count">{note.length}/300</div>
      <PrimaryButton tone="purple" onClick={()=>onSave(note)}><Check/> SAVE NOTE</PrimaryButton>
      {existing && <button className="remove-evidence" onClick={onRemove}><Trash2/> Remove note</button>}
    </section>
  </div>
}


function EvidenceWorkspace({ records, incidents, onClose, onIncidentsChange }: { records: PatrolEvidence[]; incidents: IncidentRecord[]; onClose: () => void; onIncidentsChange: (records: IncidentRecord[]) => void | Promise<void> }) {
  const totals = records.reduce((sum,item)=>({photos:sum.photos+item.photos,videos:sum.videos+item.videos,notes:sum.notes+(item.note?1:0)}),{photos:0,videos:0,notes:0})
  const drafts = incidents.filter(item=>item.status === 'draft')
  const [busyIncidentId,setBusyIncidentId]=useState<string|null>(null)
  const [actionError,setActionError]=useState('')
  const persistIncidentChange=async(id:string,next:IncidentRecord[])=>{
    if(busyIncidentId)return
    setBusyIncidentId(id);setActionError('')
    try{await onIncidentsChange(next)}catch(error){setActionError(error instanceof Error?error.message:'Unable to update incident. Try again.')}finally{setBusyIncidentId(null)}
  }
  const updateIncident = (id: string, patch: Partial<IncidentRecord>) => persistIncidentChange(id,incidents.map(item=>item.id===id?{...item,...patch}:item))
  const removeIncident = (id: string) => persistIncidentChange(id,incidents.filter(item=>item.id!==id))
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button type="button" className="capture-backdrop" onClick={onClose} aria-label="Close mission evidence"/>
    <section className="capture-sheet evidence-workspace-sheet">
      <div className="capture-handle"/>
      <header><button type="button" onClick={onClose}><X/></button><strong>Mission Evidence</strong><span/></header>
      <div className="workspace-summary"><div><Camera/><strong>{totals.photos}</strong><small>Photos</small></div><div><Video/><strong>{totals.videos}</strong><small>Videos</small></div><div><FileText/><strong>{totals.notes}</strong><small>Notes</small></div><div className={drafts.length?'attention':''}><AlertTriangle/><strong>{drafts.length}</strong><small>Drafts</small></div></div>
      <div className="workspace-sync"><RefreshCw/><span><strong>Mission record synchronized</strong><small>GPS, checkpoint, and capture time are attached automatically.</small></span><StatusChip tone="green">LIVE</StatusChip></div>
      <div className="workspace-groups">{checkpoints.map((checkpoint,index)=>{
        const record=records.find(item=>item.checkpoint===index)
        const checkpointIncidents=incidents.filter(item=>item.checkpoint===index)
        const empty=!record?.photos&&!record?.videos&&!record?.note&&!checkpointIncidents.length
        return <section key={checkpoint.name} className="workspace-checkpoint"><header><span><small>CHECKPOINT {index+1}</small><strong>{checkpoint.name}</strong></span><StatusChip tone={empty?'gray':'green'}>{empty?'EMPTY':'RECORDED'}</StatusChip></header>
          {empty?<div className="workspace-empty">No evidence recorded at this location.</div>:<div className="workspace-records">
            {record?.photos ? <div><span className="workspace-thumb"><Camera/></span><span><strong>{record.photos} Photo{record.photos>1?'s':''}</strong><small>Uploaded · Synced</small></span><CheckCircle2/></div>:null}
            {record?.videos ? <div><span className="workspace-thumb"><Video/></span><span><strong>{record.videos} Video{record.videos>1?'s':''}</strong><small>Checkpoint attached · Synced</small></span><CheckCircle2/></div>:null}
            {record?.note ? <div><span className="workspace-thumb"><FileText/></span><span><strong>Guard Note</strong><small>{record.note}</small></span><CheckCircle2/></div>:null}
            {checkpointIncidents.map(incident=><div className={`workspace-incident severity-${incident.severity}`} key={incident.id}><span className="workspace-thumb"><AlertTriangle/></span><span><strong>{incident.type}</strong><small>{incident.severity} · {incident.status} · {incident.timestamp}</small></span><div className="workspace-incident-actions">{incident.status==='draft'&&<button type="button" disabled={busyIncidentId!==null} onClick={()=>void updateIncident(incident.id,{status:'submitted'})}>{busyIncidentId===incident.id?'Saving…':'Submit'}</button>}{incident.status==='submitted'&&<button type="button" disabled={busyIncidentId!==null} onClick={()=>void updateIncident(incident.id,{status:'resolved'})}>{busyIncidentId===incident.id?'Saving…':'Resolve'}</button>}<button type="button" disabled={busyIncidentId!==null} onClick={()=>void removeIncident(incident.id)} aria-label="Delete incident">{busyIncidentId===incident.id?<RefreshCw/>:<Trash2/>}</button></div></div>)}
          </div>}
        </section>
      })}</div>
      {actionError&&<div className="workspace-warning"><AlertTriangle/><span><strong>Incident update failed</strong><small>{actionError}</small></span></div>}
      {drafts.length>0&&<div className="workspace-warning"><AlertTriangle/><span><strong>{drafts.length} incident draft{drafts.length>1?'s':''} must be submitted</strong><small>Mission completion remains protected until every draft is handled.</small></span></div>}
    </section>
  </div>
}

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}

function Patrol({ count, next, records, onRecordsChange, incidents, onIncidentsChange, missionStartedAt, runtime, onPhotoCapture, onVideoCapture, profile }: { count: number; next: () => void | Promise<void>; records: PatrolEvidence[]; onRecordsChange: (records: PatrolEvidence[]) => void | Promise<void>; incidents: IncidentRecord[]; onIncidentsChange: (records: IncidentRecord[]) => void | Promise<void>; missionStartedAt?: number | null; runtime?: MissionRuntime | null; onPhotoCapture?: (file:File,checkpoint:number)=>Promise<void>; onVideoCapture?: (file:File,checkpoint:number)=>Promise<void>; profile?: GuardSettings | null }) {
  const index = Math.min(count, checkpoints.length - 1)
  const current = checkpoints[index]
  const record = records.find(item => item.checkpoint === index) ?? { checkpoint:index, photos:0, videos:0, note:'' }
  const [sheet, setSheet] = useState<CaptureKind | 'notes' | 'incident' | 'workspace' | null>(null)
  const [warning, setWarning] = useState('')
  const [completing, setCompleting] = useState(false)
  const [elapsed, setElapsed] = useState(() => missionStartedAt ? Math.max(0, Math.floor((Date.now() - missionStartedAt) / 1000)) : 0)
  const [activity, setActivity] = useState<string[]>(['Mission started'])
  const previousTotals = useRef({ photos: 0, videos: 0, notes: 0, incidents: 0, checkpoint: 0 })
  const checkpointIncidents = incidents.filter(item => item.checkpoint === index)
  const checkpointDrafts = checkpointIncidents.filter(item => item.status === 'draft')
  const totals = useMemo(() => records.reduce((sum,item)=>({ photos:sum.photos+item.photos, videos:sum.videos+item.videos, notes:sum.notes+(item.note?1:0) }), {photos:0,videos:0,notes:0}), [records])
  const progress = Math.min(100, Math.round(((index + 1) / checkpoints.length) * 100))
  const estimatedRemaining = Math.max(2, (checkpoints.length - index - 1) * 2 + 1)
  const highSeverity = incidents.some(item => item.severity === 'high')
  const health = highSeverity ? 'Attention' : incidents.length ? 'Good' : 'Excellent'

  useEffect(() => { setSheet(null); setWarning('') }, [index])
  useEffect(() => {
    if (!missionStartedAt) return
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - missionStartedAt) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [missionStartedAt])
  useEffect(() => {
    const previous = previousTotals.current
    const entries: string[] = []
    if (totals.photos > previous.photos) entries.push('Photo captured')
    if (totals.videos > previous.videos) entries.push('Video recorded')
    if (totals.notes > previous.notes) entries.push('Note saved')
    if (incidents.length > previous.incidents) entries.push('Incident logged')
    if (index > previous.checkpoint) entries.push(`Checkpoint ${index} completed`)
    if (entries.length) setActivity(currentActivity => [...entries.reverse(), ...currentActivity].slice(0, 10))
    previousTotals.current = { ...totals, incidents: incidents.length, checkpoint: index }
  }, [totals, incidents.length, index])

  const update = async (patch: Partial<PatrolEvidence>) => {
    const nextRecord = { ...record, ...patch }
    await onRecordsChange([...records.filter(item => item.checkpoint !== index), nextRecord].sort((a,b)=>a.checkpoint-b.checkpoint))
    setWarning('')
  }
  const missing = useMemo(() => [
    current.photo === 'required' && record.photos === 0 ? 'photo' : '',
    current.notes === 'required' && !record.note ? 'notes' : '',
  ].filter(Boolean), [current, record])

  const complete = async () => {
    if (missing.length) { setWarning(`Required before completion: ${missing.join(', ')}`); return }
    if (checkpointDrafts.length) { setWarning('Submit or delete the incident draft before completing this checkpoint.'); return }
    if (completing) return
    setCompleting(true); setWarning('')
    try { await next() } catch (error) { setWarning(error instanceof Error ? error.message : 'Unable to complete checkpoint. Try again.') } finally { setCompleting(false) }
  }
  const started = missionStartedAt ? new Date(missionStartedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : 'Now'

  const missionStages = ['Accepted','Travel','Arrived',...checkpoints.map((_, checkpointIndex) => `C${checkpointIndex + 1}`),'Review','Complete']
  const activeStage = Math.min(3 + index, missionStages.length - 1)
  const gpsFreshness = runtime?.guardLocation?.freshness ?? 'none'
  const gpsReady = gpsFreshness === 'live' || gpsFreshness === 'stale'
  const completionReady = missing.length === 0 && checkpointDrafts.length === 0
  const smartAlert = highSeverity ? 'High-priority incident attached. Guardian remains active.' : checkpointDrafts.length ? 'Submit or delete the incident draft before completing this checkpoint.' : warning || (!completionReady ? `Complete ${missing.join(', ')} before moving on.` : current.smartReminder)

  return <PhoneShell><AppHeader title="MISSION COMMAND" avatarUrl={profile?.avatar_url} guardName={profile?.name||'Guard'}/><main className="screen-content compact-content patrol-content">
    <section className="mission-command-progress" aria-label="Mission progress">
      <div className="command-progress-copy"><small>ACTIVE MISSION</small><strong>{current.name}</strong><span>Step {activeStage + 1} of {missionStages.length}</span></div>
      <div className="command-progress-track">{missionStages.map((stage, stageIndex)=><div key={stage} className={`${stageIndex < activeStage ? 'complete' : ''} ${stageIndex === activeStage ? 'active' : ''}`}><i>{stageIndex < activeStage ? <Check/> : stageIndex + 1}</i><span>{stage}</span></div>)}</div>
    </section>
    <section className="mission-intelligence-strip">
      <div><small>MISSION</small><strong>{runtime?.title??"Mission"}</strong><span>{runtime?.property.name??"Property"}</span></div>
      <div><small>STARTED</small><strong>{started}</strong><span>{formatElapsed(elapsed)} elapsed</span></div>
      <div className={`mission-health health-${health.toLowerCase()}`}><small>MISSION HEALTH</small><strong><i/>{health}</strong><span>{incidents.length ? `${incidents.length} incident${incidents.length>1?'s':''}` : 'No incidents'}</span></div>
    </section>
    <section className="mission-live-grid">
      <div className="live-stat"><small>MISSION TIME</small><strong>{formatElapsed(elapsed)}</strong><span>Continuous duty timer</span></div>
      <button className="live-stat evidence-stat" onClick={()=>setSheet('workspace')}><small>EVIDENCE</small><strong>{totals.photos + totals.videos + totals.notes}</strong><span>{totals.photos} photos · {totals.videos} videos · {totals.notes} notes</span></button>
      <button className="live-stat incident-stat" onClick={()=>setSheet('incident')}><small>INCIDENTS</small><strong>{incidents.length}</strong><span>Tap to report</span></button>
    </section>
    <section className="guardian-command-card">
      <div className="guardian-command-heading"><span><ShieldCheck/></span><div><small>GUARDIAN</small><strong>Monitoring mission</strong></div><StatusChip tone="green">LIVE</StatusChip></div>
      <div className="guardian-command-signals"><div><Navigation/><span><strong>GPS</strong><small>{gpsFreshness==='live'?'Live':gpsFreshness==='stale'?'Last known':gpsFreshness==='expired'?'Offline':'Waiting'}</small></span></div><div><Camera/><span><strong>Evidence</strong><small>{totals.photos + totals.videos} media</small></span></div><div><FileText/><span><strong>Notes</strong><small>{totals.notes} saved</small></span></div><div><AlertTriangle/><span><strong>Incidents</strong><small>{incidents.length} logged</small></span></div></div>
      <div className="guardian-command-foot"><RadioTower/><span>{gpsReady?'Location telemetry is available for this mission.':'Location telemetry is not currently available.'}</span></div>
    </section>
    <div className="patrol-property-row"><div><small>{runtime?.property.name?.toUpperCase()??"PROPERTY"}</small><span>Checkpoint {index + 1} of {checkpoints.length} · Est. {estimatedRemaining} min remaining</span></div><div className="patrol-progress-block"><b>{progress}%</b><div className="patrol-mini-progress"><i style={{width:`${progress}%`}}/></div></div></div>
    <section className="checkpoint-hero"><div className="location-mark"><MapPin/></div><div><small>CURRENT PATROL LOCATION</small><h2>{current.name}</h2></div></section>
    <section className="mission-brief"><div className="brief-heading"><ClipboardCheck/><strong>Mission Brief</strong></div>{current.instructions.map(item => <div className="brief-item" key={item}><Circle/><span>{item}</span></div>)}<div className="checkpoint-reminder"><Lightbulb/><span><strong>Smart reminder</strong><small>{current.smartReminder}</small></span></div></section>
    <section className="evidence-section"><div className="evidence-heading"><strong>Evidence</strong><span>Capture while at this location</span></div>
      <EvidenceAction icon={<Camera/>} label="Photo" level={current.photo} count={record.photos} checkpointName={current.name} onClick={()=>setSheet('photo')}/>
      <EvidenceAction icon={<Video/>} label="Video" level="optional" count={record.videos} checkpointName={current.name} onClick={()=>setSheet('video')}/>
      <EvidenceAction icon={<FileText/>} label="Notes" level={current.notes} count={0} detail={record.note ? 'Note saved' : ''} checkpointName={current.name} onClick={()=>setSheet('notes')}/>
    </section>
    <button className={`incident-action ${checkpointIncidents.length ? 'reported' : ''}`} onClick={()=>setSheet('incident')}><span><AlertTriangle/></span><div><strong>{checkpointIncidents.length ? `${checkpointIncidents.length} Incident${checkpointIncidents.length>1?'s':''} Reported` : 'Report Incident'}</strong><small>{checkpointIncidents.length ? 'Attached to this patrol location' : 'Document an issue without leaving patrol'}</small></div><ChevronRight/></button>
    <section className="completion-readiness"><div className="evidence-heading"><strong>Ready to complete?</strong><span>{completionReady ? 'All checks passed' : `${missing.length + checkpointDrafts.length} requirement${missing.length + checkpointDrafts.length === 1 ? '' : 's'} open`}</span></div><div className="readiness-list"><span className={gpsReady ? 'ready' : ''}><CheckCircle2/> {gpsReady ? 'Guard location available' : 'Guard location unavailable'}</span><span className={missing.length === 0 ? 'ready' : ''}><CheckCircle2/> Required evidence attached</span><span className={checkpointDrafts.length === 0 ? 'ready' : ''}><CheckCircle2/> No incident draft pending</span></div></section>
    <section className="mission-activity"><div className="evidence-heading"><strong>Latest Activity</strong><span>Live mission timeline</span></div>{activity.map((item,activityIndex)=><div key={`${item}-${activityIndex}`}><i/><span>{item}</span><time>{activityIndex===0 ? 'Now' : 'Earlier'}</time></div>)}</section>
    {smartAlert && <div className={`mission-smart-alert ${highSeverity ? 'critical' : ''}`}><AlertTriangle/><span><strong>{highSeverity ? 'Mission attention required' : 'Smart checkpoint alert'}</strong><small>{smartAlert}</small></span></div>}
    <PrimaryButton tone="orange" onClick={()=>void complete()} disabled={!completionReady||completing}><Check/> {completing ? 'COMPLETING…' : completionReady ? 'COMPLETE CHECKPOINT' : 'COMPLETE REQUIREMENTS'}</PrimaryButton>
  </main><BottomNav/>
    {sheet === 'photo' && <CaptureSheet kind="photo" existing={record.photos} onClose={()=>setSheet(null)} onUse={async(file)=>{if(!file)throw new Error('A real photo is required.');if(!onPhotoCapture)throw new Error('Photo upload engine is unavailable.');await onPhotoCapture(file,index);await update({photos:record.photos+1});setSheet(null)}} onRemove={()=>setSheet(null)}/>}
    {sheet === 'video' && <CaptureSheet kind="video" existing={record.videos} onClose={()=>setSheet(null)} onUse={async(file)=>{if(!file)throw new Error('A real video is required.');if(!onVideoCapture)throw new Error('Video upload engine is unavailable.');await onVideoCapture(file,index);await update({videos:record.videos+1});setSheet(null)}} onRemove={()=>setSheet(null)}/>}
    {sheet === 'notes' && <NotesSheet existing={record.note} onClose={()=>setSheet(null)} onSave={(note)=>{void update({note}).then(()=>setSheet(null)).catch(()=>setWarning('Unable to save note. Try again.'))}} onRemove={()=>{void update({note:''}).then(()=>setSheet(null)).catch(()=>setWarning('Unable to remove note. Try again.'))}}/>}
    {sheet === 'incident' && <IncidentSheet checkpoint={index} onClose={()=>setSheet(null)} onPhotoCapture={onPhotoCapture} onVideoCapture={onVideoCapture} onSave={async(incident)=>{await onIncidentsChange([...incidents,incident]);setSheet('workspace')}}/>}
    {sheet === 'workspace' && <EvidenceWorkspace records={records} incidents={incidents} onClose={()=>setSheet(null)} onIncidentsChange={onIncidentsChange}/>}
  </PhoneShell>
}

function Review({ next, records, incidents, missionStartedAt, profile }: { next: () => void | Promise<void>; records: PatrolEvidence[]; incidents: IncidentRecord[]; missionStartedAt?: number | null; profile?: GuardSettings | null }) {
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState('')
  const submit=async()=>{if(submitting)return;setSubmitting(true);setError('');try{await next()}catch(e){setError(e instanceof Error?e.message:'Unable to submit patrol. Try again.')}finally{setSubmitting(false)}}
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  const draftCount = incidents.filter(item=>item.status === 'draft').length
  const elapsed = missionStartedAt ? formatElapsed(Math.max(0,Math.floor((Date.now()-missionStartedAt)/1000))) : '—'
  return <PhoneShell><AppHeader title="REVIEW & SUBMIT" avatarUrl={profile?.avatar_url} guardName={profile?.name||'Guard'}/><main className="screen-content compact-content review-content"><div className="review-intro"><CheckCircle2/><div><h2>Patrol complete</h2><p>Review the mission record before submitting.</p></div></div><div className="review-summary"><div><small>TIME ON SITE</small><strong>{elapsed}</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>{totalEvidence} items</strong></div></div><h4 className="section-label">PATROL LOCATIONS</h4><div className="review-list">{checkpoints.map((checkpoint,index)=>{
    const item=records.find(record=>record.checkpoint===index)
    const parts=[item?.photos?`${item.photos} photo${item.photos>1?'s':''}`:'',item?.videos?`${item.videos} video${item.videos>1?'s':''}`:'',item?.note?'1 note':''].filter(Boolean)
    return <div key={checkpoint.name}><CheckCircle2/><span><strong>{checkpoint.name}</strong><small>{parts.length?parts.join(' · '):'No evidence'}</small></span><ChevronRight/></div>
  })}</div>{incidents.length>0&&<><h4 className="section-label incident-review-label">INCIDENTS <span>{incidents.length}</span></h4><div className="incident-review-list">{incidents.map(incident=><div key={incident.id} className={`severity-${incident.severity}`}><AlertTriangle/><span><strong>{checkpoints[incident.checkpoint].name}</strong><small>{incident.type} · {incident.severity} severity · {incident.status} · {incident.timestamp}</small></span><ChevronRight/></div>)}</div></>}<div className={`review-note ${draftCount?'review-blocked':''}`}><FileText/><span><strong>{draftCount?'Mission record needs attention':'Mission record ready'}</strong><small>{draftCount?`${draftCount} incident draft${draftCount>1?'s':''} must be submitted before patrol completion.`:'All checkpoint evidence and incidents are attached.'}</small></span></div>{error&&<div className="mission-smart-alert critical"><AlertTriangle/><span><strong>Submission failed</strong><small>{error}</small></span></div>}<PrimaryButton tone="purple" onClick={()=>void submit()} disabled={draftCount>0||submitting}><Check/> {draftCount?'RESOLVE INCIDENT DRAFTS':submitting?'SUBMITTING…':'SUBMIT PATROL'}</PrimaryButton></main><BottomNav/></PhoneShell>
}
function Completed({ next, publishReport, incidents, records, missionStartedAt, runtime, profile }: { next: () => void; publishReport?: () => void | Promise<void>; incidents: IncidentRecord[]; records: PatrolEvidence[]; missionStartedAt?: number | null; runtime?: MissionRuntime | null; profile?: GuardSettings | null }) {
  const [reportOpen, setReportOpen] = useState(false)
  const [publishing,setPublishing]=useState(false)
  const [published,setPublished]=useState(false)
  const [publishError,setPublishError]=useState('')
  const publish=async()=>{if(!publishReport||publishing||published)return;setPublishing(true);setPublishError('');try{await publishReport();setPublished(true)}catch(e){setPublishError(e instanceof Error?e.message:'Unable to publish report. Try again.')}finally{setPublishing(false)}}
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  const completedAt=runtime?.timestamps.completedAt?new Date(runtime.timestamps.completedAt).getTime():Date.now()
  const elapsed=missionStartedAt?formatElapsed(Math.max(0,Math.floor((completedAt-missionStartedAt)/1000))):'—'
  return <PhoneShell><AppHeader title="MISSION COMPLETE" avatarUrl={profile?.avatar_url} guardName={profile?.name||'Guard'}/><main className="screen-content completed-screen command-complete"><div className="completion-kicker"><ShieldCheck/> MISSION SECURED</div><h2 className="property-title">{runtime?.property.name??"Property"}</h2><p>{published?'The mission report has been delivered to the client.':'The professional mission report is ready to publish directly to the client.'}</p><div className="success-orbit"><Check/></div><div className="completion-processing report-ready"><span><CheckCircle2/> Evidence synchronized</span><span><CheckCircle2/> Timeline secured</span><span><CheckCircle2/> Report ready</span></div><div className="summary-grid"><div><small>TIME ON SITE</small><strong>{elapsed}</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>{totalEvidence} Items</strong></div><div><small>INCIDENTS</small><strong>{incidents.length}</strong></div></div><PrimaryButton tone="purple" onClick={()=>setReportOpen(true)}><Eye/> VIEW MISSION REPORT</PrimaryButton>{publishError&&<div className="mission-smart-alert critical"><AlertTriangle/><span><strong>Publication failed</strong><small>{publishError}</small></span></div>}<PrimaryButton onClick={()=>void publish()} disabled={!publishReport||publishing||published}><Send/> {published?'PUBLISHED TO CLIENT':publishing?'PUBLISHING…':'PUBLISH TO CLIENT'}</PrimaryButton><SecondaryButton onClick={next}><RefreshCw/> RETURN ONLINE</SecondaryButton></main><BottomNav/>{reportOpen&&<MissionReport records={records} incidents={incidents} missionStartedAt={missionStartedAt} runtime={runtime} onClose={()=>setReportOpen(false)}/>}</PhoneShell>
}

export default function GuardDashboard(props: GuardDashboardProps & {onPhotoCapture?: (file:File,checkpoint:number)=>Promise<void>;onVideoCapture?: (file:File,checkpoint:number)=>Promise<void>;developerGuardId?:string}) {
  const dashboardMetrics = props.metrics ?? {
    jobsToday: 0,
    onDutySeconds: 0,
  }

  const [guardProfile,setGuardProfile]=useState<GuardSettings|null>(null)
  useEffect(()=>{let live=true;void getMyGuardSettings(props.developerGuardId).then(p=>{if(live)setGuardProfile(p)}).catch(error=>{if(live)console.error('Guard settings unavailable',error)});return()=>{live=false}},[props.developerGuardId])
  const { state, runtime, checkpoint=0, onAdvance, patrolEvidence=[], onEvidenceChange=()=>undefined, incidents=[], onIncidentsChange=()=>undefined, missionStartedAt=null } = props
  if (state === 'offline') return <Offline next={action(props.onGoOnline,onAdvance)} metrics={dashboardMetrics} developerGuardId={props.developerGuardId} profile={guardProfile}/>
  if (state === 'waiting') return <Waiting offline={action(props.onGoOffline,onAdvance)} metrics={dashboardMetrics} developerGuardId={props.developerGuardId} profile={guardProfile}/>
  if (state === 'assignment') return <Assignment runtime={runtime} accept={action(props.onAccept,onAdvance)} decline={action(props.onDecline)}/>
  if (state === 'enroute') return <EnRoute runtime={runtime} next={action(props.onStartRoute,onAdvance)} profile={guardProfile}/>
  if (state === 'arrived') return <Arrived runtime={runtime} next={action(props.onMarkArrived,onAdvance)}/>
  if (state === 'patrol') return <Patrol count={checkpoint} next={action(props.onNextCheckpoint,onAdvance)} records={patrolEvidence} onRecordsChange={onEvidenceChange} incidents={incidents} onIncidentsChange={onIncidentsChange} missionStartedAt={missionStartedAt} runtime={runtime} onPhotoCapture={props.onPhotoCapture} onVideoCapture={props.onVideoCapture} profile={guardProfile}/>
  if (state === 'proof') return <Review next={action(props.onSubmitProof,onAdvance)} records={patrolEvidence} incidents={incidents} missionStartedAt={missionStartedAt} profile={guardProfile}/>
  return <Completed next={action(props.onReturnOnline,onAdvance)} publishReport={props.onPublishReport} incidents={incidents} records={patrolEvidence} missionStartedAt={missionStartedAt} runtime={runtime} profile={guardProfile}/>
}
