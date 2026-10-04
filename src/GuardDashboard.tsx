import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, BatteryMedium, BriefcaseBusiness, Camera, Check, CheckCircle2, ChevronRight, Circle, ClipboardCheck, Copy, Eye, FileText, Flame, Image, Lightbulb, MapPin, MessageCircle, Navigation, Phone, Power, RadioTower, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Trash2, UserRound, Video, Waves, Wifi, X } from 'lucide-react'
import MissionReport from './MissionReport'
import type { IncidentRecord, IncidentSeverity, MissionState, PatrolEvidence } from './types'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'
import MissionMap, { type MissionMapMarker } from './modules/location/MissionMap'
import type { ActiveMissionRoute, MissionRouteResult } from './modules/location/missionRouting'
import { toMissionRuntimeRouteInput } from './modules/mission-runtime/missionRuntimeState'
import { AppHeader, BottomNav, Metric, PhoneShell, PrimaryButton, SecondaryButton, StatusChip } from './ui'
import type { GuardNavTarget } from './ui'

const propertyImage = 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=85'

type EvidenceLevel = 'optional' | 'recommended' | 'required'
type Checkpoint = {
  name: string
  instructions: string[]
  photo: EvidenceLevel
  video: EvidenceLevel
  notes: EvidenceLevel
  smartReminder: string
  previousVisit: { when: string; result: string; evidence: string; duration: string }
}

const checkpoints: Checkpoint[] = [
  { name:'Exterior Perimeter', instructions:['Walk the full exterior perimeter','Look for damage, loitering, or unsecured access'], photo:'recommended', video:'optional', notes:'optional', smartReminder:'Capture the full fence line and any unsecured access point.', previousVisit:{when:'2 days ago',result:'No issues reported',evidence:'2 photos',duration:'1m 54s'} },
  { name:'Parking Lot', instructions:['Inspect parked vehicles and lighting','Check for suspicious activity or debris'], photo:'optional', video:'optional', notes:'optional', smartReminder:'Keep license plates out of frame unless documenting an incident.', previousVisit:{when:'2 days ago',result:'Lighting normal',evidence:'1 photo',duration:'2m 11s'} },
  { name:'Main Entrance', instructions:['Verify entrance doors are secure','Inspect glass, locks, and vestibule'], photo:'required', video:'optional', notes:'optional', smartReminder:'Door handles, lock, and alarm indicator must be visible.', previousVisit:{when:'2 days ago',result:'No issues reported',evidence:'3 photos',duration:'1m 42s'} },
  { name:'Back Entrance', instructions:['Confirm employee entrance is secured','Check hinges, lock, and surrounding area'], photo:'optional', video:'optional', notes:'recommended', smartReminder:'Note any delivery activity or signs of forced entry.', previousVisit:{when:'2 days ago',result:'Delivery area clear',evidence:'1 note',duration:'2m 06s'} },
  { name:'Rear Loading Dock', instructions:['Check delivery doors','Verify dock gate is locked','Inspect fence line and look for suspicious activity'], photo:'required', video:'optional', notes:'optional', smartReminder:'Show the dock gate lock and both delivery doors in evidence.', previousVisit:{when:'2 days ago',result:'Dock secure',evidence:'3 photos',duration:'2m 34s'} },
  { name:'Side Doors', instructions:['Verify all side exits are secure','Check for tampering or blocked exits'], photo:'optional', video:'optional', notes:'optional', smartReminder:'Confirm exits are unobstructed from both directions.', previousVisit:{when:'2 days ago',result:'No issues reported',evidence:'1 photo',duration:'1m 37s'} },
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
  onNextCheckpoint?: () => void
  onSubmitProof?: () => void
  onReturnOnline?: () => void
  patrolEvidence?: PatrolEvidence[]
  onEvidenceChange?: (records: PatrolEvidence[]) => void
  incidents?: IncidentRecord[]
  onIncidentsChange?: (records: IncidentRecord[]) => void
  missionStartedAt?: number | null
  metrics?: GuardDashboardMetrics
}

const action = (preferred?: () => void, fallback?: () => void) => preferred ?? fallback ?? (() => undefined)

function ProfileBlock({ online = false }: { online?: boolean }) {
  return <div className="profile-row"><div><small>Good Morning,</small><h2>David Martinez</h2><StatusChip tone={online ? 'green' : 'gray'}>{online ? 'ONLINE' : 'OFFLINE'}</StatusChip></div><div className="avatar">DM</div></div>
}
function PropertyHeader({ eyebrow, runtime }: { eyebrow: string; runtime?: MissionRuntime | null }) { const name=runtime?.property.name??'Property'; const address=runtime?.property.address??'Address unavailable'; return <><div className="eyebrow">{eyebrow}</div><h2 className="property-title">{name}</h2><p className="address">{address}</p></> }

function GuardHomeView({ online, metrics, onGoOnline, onGoOffline }: { online: boolean; metrics: GuardDashboardMetrics; onGoOnline?: () => void; onGoOffline?: () => void }) {
  return <>
    <ProfileBlock online={online}/>
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

function GuardSectionView({ section, online, metrics }: { section: GuardNavTarget; online: boolean; metrics: GuardDashboardMetrics }) {
  const copy: Record<GuardNavTarget, { kicker: string; title: string; body: string; detail: string; icon: ReactNode }> = {
    home: { kicker:'HOME', title:'Guard Home', body:'Current duty status and availability.', detail:online?'Online and ready for assignment.':'Offline until you go online.', icon:<ShieldCheck/> },
    jobs: { kicker:'JOBS', title:'Assignments', body:online?'No active assignment is waiting right now. New jobs will appear here when the agency sends one.':'Go online to receive assignments from the agency.', detail:String(metrics.jobsToday)+' jobs today', icon:<BriefcaseBusiness/> },
    messages: { kicker:'MESSAGES', title:'Messages', body:'No unread agency messages right now.', detail:'Agency broadcasts and mission updates appear here.', icon:<MessageCircle/> },
    profile: { kicker:'PROFILE', title:'David Martinez', body:'Guard profile, duty status, GPS permission, and roster identity are managed by the assigned agency.', detail:online?'Status: Online':'Status: Offline', icon:<UserRound/> },
  }
  const selected = copy[section]

  return <>
    <ProfileBlock online={online}/>
    <section className="guard-main-section">
      <div className="guard-main-section-icon">{selected.icon}</div>
      <small>{selected.kicker}</small>
      <h3>{selected.title}</h3>
      <p>{selected.body}</p>
      <div className="guard-main-section-card"><strong>{selected.detail}</strong><span>{section === 'jobs' ? 'Current mission workflow will open here when assigned.' : 'This section is connected to the guard portal navigation.'}</span></div>
    </section>
  </>
}

function Offline({ next, metrics }: { next: () => void; metrics: GuardDashboardMetrics }) {
  const [section, setSection] = useState<GuardNavTarget>('home')
  return <PhoneShell light><AppHeader light/><main className="screen-content offline-screen">{section==='home'?<GuardHomeView online={false} metrics={metrics} onGoOnline={next}/>:<GuardSectionView section={section} online={false} metrics={metrics}/>}</main><BottomNav light active={section} onSelect={setSection}/></PhoneShell>
}

function Waiting({ offline, metrics }: { offline: () => void; metrics: GuardDashboardMetrics }) {
  const [section, setSection] = useState<GuardNavTarget>('home')
  return <PhoneShell><AppHeader title="CO PILOT"/><main className="screen-content">{section==='home'?<GuardHomeView online metrics={metrics} onGoOffline={offline}/>:<GuardSectionView section={section} online metrics={metrics}/>}</main><BottomNav active={section} onSelect={setSection}/></PhoneShell>
}
function Assignment({ accept, decline, runtime }: { accept: () => void; decline: () => void; runtime?: MissionRuntime | null }) { return <PhoneShell><AppHeader title="NEW ASSIGNMENT"/><main className="screen-content compact-content"><PropertyHeader eyebrow="NEW ASSIGNMENT" runtime={runtime}/><img className="property-image" src={runtime?.property.photoUrl??propertyImage} alt={runtime?.property.name??"Property"}/><div className="two-stats"><div><small>DISTANCE</small><strong>4.2 mi</strong></div><div><small>ETA</small><strong>9 min</strong></div></div><div className="info-grid"><div><small>PATROL TYPE</small><strong>{runtime?.title??'Mission'}</strong></div><div><small>PRIORITY</small><span className="priority">{runtime?.priority?.toUpperCase()??'STANDARD'}</span></div></div><div className="payment-row"><small>ASSIGNMENT</small><strong>Marketplace Job</strong></div><SecondaryButton onClick={decline}>DECLINE</SecondaryButton><PrimaryButton onClick={accept}><Check/> ACCEPT</PrimaryButton></main><BottomNav/></PhoneShell> }
function EnRoute({ next, runtime }: { next: () => void; runtime?: MissionRuntime | null }) {
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
      <AppHeader title="EN ROUTE"/>

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

  return <PhoneShell><AppHeader title="ARRIVED"/><main className="screen-content compact-content"><PropertyHeader eyebrow="ARRIVED" runtime={runtime}/><img className="property-image" src={runtime?.property.photoUrl??propertyImage} alt={runtime?.property.name??"Property"}/><PrimaryButton tone="green" onClick={next}><CheckCircle2/> MARK ARRIVED</PrimaryButton><section className="property-info"><small>PROPERTY INFO</small><button type="button" onClick={()=>setDetailsOpen(true)}><strong>{contactName}</strong><Phone/></button><button type="button" onClick={()=>void navigator.clipboard?.writeText(runtime?.property.address??'')}><strong>Property Address<br/><span>{runtime?.property.address??'Address unavailable'}</span></strong><Copy/></button><button type="button" onClick={()=>setDetailsOpen(true)}><strong>Special Instructions<br/><span>{instructions}</span></strong><ChevronRight/></button></section><SecondaryButton onClick={()=>setDetailsOpen(true)}>VIEW DETAILS</SecondaryButton></main><BottomNav/>{detailsOpen&&<div className="capture-overlay" role="dialog" aria-modal="true"><button type="button" className="capture-backdrop" onClick={()=>setDetailsOpen(false)} aria-label="Close details"/><section className="capture-sheet notes-sheet"><div className="capture-handle"/><header><button type="button" onClick={()=>setDetailsOpen(false)}><X/></button><strong>Mission Details</strong><span/></header><p className="sheet-copy">Confirm property access, contact, and instructions before beginning patrol.</p><div className="workspace-groups"><section className="workspace-checkpoint"><header><span><small>PROPERTY</small><strong>{runtime?.property.name??'Property'}</strong></span><StatusChip tone="green">ARRIVED</StatusChip></header><div className="workspace-records"><div><span className="workspace-thumb"><MapPin/></span><span><strong>{runtime?.property.address??'Address unavailable'}</strong><small>Destination verified by marketplace routing</small></span><CheckCircle2/></div><div><span className="workspace-thumb"><Phone/></span><span><strong>{contactName}</strong><small>Client contact for this mission</small></span><CheckCircle2/></div><div><span className="workspace-thumb"><FileText/></span><span><strong>Instructions</strong><small>{instructions}</small></span><CheckCircle2/></div></div></section></div></section></div>}</PhoneShell>
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
function CaptureSheet({ kind, existing, onClose, onUse, onRemove }: { kind: CaptureKind; existing: number; onClose: () => void; onUse: () => void; onRemove: () => void }) {
  const [captured, setCaptured] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<'rear'|'front'>('rear')
  const title = kind === 'photo' ? 'Take Photo' : 'Record Video'
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button type="button" className="capture-backdrop" onClick={onClose} aria-label="Close capture" />
    <section className="capture-sheet">
      <div className="capture-handle"/>
      <header><button type="button" onClick={onClose}><X/></button><strong>{title}</strong><span/></header>
      <div className={`camera-preview ${captured ? 'captured' : ''}`}>
        <div className="camera-grid"/>
        {captured ? <div className="captured-preview"><CheckCircle2/><strong>{kind === 'photo' ? 'Photo captured' : 'Video recorded'}</strong><small>Preview ready to attach</small></div> : <div className="camera-instructions"><Camera/><strong>Position the checkpoint in frame</strong><small>{cameraFacing === 'rear' ? 'Rear camera' : 'Front camera'} · Smart Capture preview</small></div>}
        {kind === 'video' && !captured && <div className="recording-time">00:00</div>}
      </div>
      {!captured ? <div className="capture-controls"><button type="button" className="gallery-button" onClick={()=>setCaptured(true)}><Image/><span>Gallery</span></button><button type="button" className={`shutter ${kind}`} onClick={()=>setCaptured(true)}><i/></button><button type="button" className="flip-button" onClick={()=>setCameraFacing(value=>value==='rear'?'front':'rear')}><RotateCcw/><span>{cameraFacing === 'rear' ? 'Flip' : 'Rear'}</span></button></div> : <div className="capture-confirm">
        <SecondaryButton onClick={()=>setCaptured(false)}><RotateCcw/> RETAKE</SecondaryButton>
        <PrimaryButton tone={kind === 'photo' ? 'blue' : 'purple'} onClick={onUse}><Check/> USE {kind.toUpperCase()}</PrimaryButton>
      </div>}
      {existing > 0 && <button className="remove-evidence" onClick={onRemove}><Trash2/> Remove existing {kind}</button>}
      <p className="prototype-note">Capture attaches to the live mission record; device camera permissions power production media capture.</p>
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

function IncidentSheet({ checkpoint, onClose, onSave }: { checkpoint: number; onClose: () => void; onSave: (incident: IncidentRecord) => void }) {
  const [type, setType] = useState('')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState(0)
  const [videos, setVideos] = useState(0)
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
        <button type="button" className={photos?'attached':''} onClick={()=>setPhotos(photos+1)}><Camera/><span>{photos ? `${photos} photo${photos>1?'s':''}` : 'Add Photo'}</span>{photos>0&&<CheckCircle2/>}</button>
        <button type="button" className={videos?'attached':''} onClick={()=>setVideos(videos+1)}><Video/><span>{videos ? `${videos} video${videos>1?'s':''}` : 'Add Video'}</span>{videos>0&&<CheckCircle2/>}</button>
      </div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what happened…" maxLength={400}/>
      <input className="incident-text-input" value={peopleOrVehicles} onChange={e=>setPeopleOrVehicles(e.target.value)} placeholder="People, vehicles, or identifying details (optional)"/>
      <label className="incident-service-toggle"><input type="checkbox" checked={emergencyServices} onChange={e=>setEmergencyServices(e.target.checked)}/><span><strong>Police or emergency services contacted</strong><small>Record this in the final mission report.</small></span></label>
      <div className="note-count">{note.length}/400</div>
      <PrimaryButton tone="orange" disabled={!canSave} onClick={()=>canSave&&onSave({id:`incident-${Date.now()}`,checkpoint,type,severity,note,photos,videos,timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),location:'28.3922, -81.4265',status:'draft',peopleOrVehicles,emergencyServices})}><AlertTriangle/> SAVE DRAFT</PrimaryButton>
      {!canSave && <p className="incident-required">Choose an incident type to continue.</p>}
      <p className="prototype-note">Incident evidence attaches to the mission record with checkpoint, timestamp, and location context.</p>
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


function EvidenceWorkspace({ records, incidents, onClose, onIncidentsChange }: { records: PatrolEvidence[]; incidents: IncidentRecord[]; onClose: () => void; onIncidentsChange: (records: IncidentRecord[]) => void }) {
  const totals = records.reduce((sum,item)=>({photos:sum.photos+item.photos,videos:sum.videos+item.videos,notes:sum.notes+(item.note?1:0)}),{photos:0,videos:0,notes:0})
  const drafts = incidents.filter(item=>item.status === 'draft')
  const updateIncident = (id: string, patch: Partial<IncidentRecord>) => onIncidentsChange(incidents.map(item=>item.id===id?{...item,...patch}:item))
  const removeIncident = (id: string) => onIncidentsChange(incidents.filter(item=>item.id!==id))
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
            {record?.photos ? <div><span className="workspace-thumb"><Camera/></span><span><strong>{record.photos} Photo{record.photos>1?'s':''}</strong><small>GPS verified · Synced</small></span><CheckCircle2/></div>:null}
            {record?.videos ? <div><span className="workspace-thumb"><Video/></span><span><strong>{record.videos} Video{record.videos>1?'s':''}</strong><small>Checkpoint attached · Synced</small></span><CheckCircle2/></div>:null}
            {record?.note ? <div><span className="workspace-thumb"><FileText/></span><span><strong>Guard Note</strong><small>{record.note}</small></span><CheckCircle2/></div>:null}
            {checkpointIncidents.map(incident=><div className={`workspace-incident severity-${incident.severity}`} key={incident.id}><span className="workspace-thumb"><AlertTriangle/></span><span><strong>{incident.type}</strong><small>{incident.severity} · {incident.status} · {incident.timestamp}</small></span><div className="workspace-incident-actions">{incident.status==='draft'&&<button type="button" onClick={()=>updateIncident(incident.id,{status:'submitted'})}>Submit</button>}{incident.status==='submitted'&&<button type="button" onClick={()=>updateIncident(incident.id,{status:'resolved'})}>Resolve</button>}<button type="button" onClick={()=>removeIncident(incident.id)} aria-label="Delete incident"><Trash2/></button></div></div>)}
          </div>}
        </section>
      })}</div>
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

function Patrol({ count, next, records, onRecordsChange, incidents, onIncidentsChange, missionStartedAt, runtime }: { count: number; next: () => void; records: PatrolEvidence[]; onRecordsChange: (records: PatrolEvidence[]) => void; incidents: IncidentRecord[]; onIncidentsChange: (records: IncidentRecord[]) => void; missionStartedAt?: number | null; runtime?: MissionRuntime | null }) {
  const index = Math.min(count, checkpoints.length - 1)
  const current = checkpoints[index]
  const record = records.find(item => item.checkpoint === index) ?? { checkpoint:index, photos:0, videos:0, note:'' }
  const [sheet, setSheet] = useState<CaptureKind | 'notes' | 'incident' | 'workspace' | null>(null)
  const [warning, setWarning] = useState('')
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

  const update = (patch: Partial<PatrolEvidence>) => {
    const nextRecord = { ...record, ...patch }
    onRecordsChange([...records.filter(item => item.checkpoint !== index), nextRecord].sort((a,b)=>a.checkpoint-b.checkpoint))
    setWarning('')
  }
  const missing = useMemo(() => [
    current.photo === 'required' && record.photos === 0 ? 'photo' : '',
    current.video === 'required' && record.videos === 0 ? 'video' : '',
    current.notes === 'required' && !record.note ? 'notes' : '',
  ].filter(Boolean), [current, record])

  const complete = () => {
    if (missing.length) { setWarning(`Required before completion: ${missing.join(', ')}`); return }
    next()
  }
  const started = missionStartedAt ? new Date(missionStartedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : 'Now'

  const missionStages = ['Accepted','Travel','Arrived',...checkpoints.map((_, checkpointIndex) => `C${checkpointIndex + 1}`),'Review','Complete']
  const activeStage = Math.min(3 + index, missionStages.length - 1)
  const guardianReady = true
  const gpsReady = true
  const completionReady = missing.length === 0 && guardianReady && gpsReady && checkpointDrafts.length === 0
  const smartAlert = highSeverity ? 'High-priority incident attached. Guardian remains active.' : checkpointDrafts.length ? 'Submit or delete the incident draft before completing this checkpoint.' : warning || (!completionReady ? `Complete ${missing.join(', ')} before moving on.` : current.smartReminder)

  return <PhoneShell><AppHeader title="MISSION COMMAND"/><main className="screen-content compact-content patrol-content">
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
      <div className="guardian-command-signals"><div><Navigation/><span><strong>GPS</strong><small>Active</small></span></div><div><Activity/><span><strong>Motion</strong><small>Normal</small></span></div><div><BatteryMedium/><span><strong>Battery</strong><small>82%</small></span></div><div><Wifi/><span><strong>Connection</strong><small>Excellent</small></span></div></div>
      <div className="guardian-command-foot"><RadioTower/><span>Check-in secure · Guardian is recording mission continuity.</span></div>
    </section>
    <div className="patrol-property-row"><div><small>{runtime?.property.name?.toUpperCase()??"PROPERTY"}</small><span>Checkpoint {index + 1} of {checkpoints.length} · Est. {estimatedRemaining} min remaining</span></div><div className="patrol-progress-block"><b>{progress}%</b><div className="patrol-mini-progress"><i style={{width:`${progress}%`}}/></div></div></div>
    <section className="checkpoint-hero"><div className="location-mark"><MapPin/></div><div><small>CURRENT PATROL LOCATION</small><h2>{current.name}</h2></div></section>
    <section className="mission-brief"><div className="brief-heading"><ClipboardCheck/><strong>Mission Brief</strong></div>{current.instructions.map(item => <div className="brief-item" key={item}><Circle/><span>{item}</span></div>)}<div className="checkpoint-reminder"><Lightbulb/><span><strong>Smart reminder</strong><small>{current.smartReminder}</small></span></div></section>
    <section className="evidence-section"><div className="evidence-heading"><strong>Evidence</strong><span>Capture while at this location</span></div>
      <EvidenceAction icon={<Camera/>} label="Photo" level={current.photo} count={record.photos} checkpointName={current.name} onClick={()=>setSheet('photo')}/>
      <EvidenceAction icon={<Video/>} label="Video" level={current.video} count={record.videos} checkpointName={current.name} onClick={()=>setSheet('video')}/>
      <EvidenceAction icon={<FileText/>} label="Notes" level={current.notes} count={0} detail={record.note ? 'Note saved' : ''} checkpointName={current.name} onClick={()=>setSheet('notes')}/>
    </section>
    <button className={`incident-action ${checkpointIncidents.length ? 'reported' : ''}`} onClick={()=>setSheet('incident')}><span><AlertTriangle/></span><div><strong>{checkpointIncidents.length ? `${checkpointIncidents.length} Incident${checkpointIncidents.length>1?'s':''} Reported` : 'Report Incident'}</strong><small>{checkpointIncidents.length ? 'Attached to this patrol location' : 'Document an issue without leaving patrol'}</small></div><ChevronRight/></button>
    <section className="checkpoint-history"><div className="evidence-heading"><strong>Previous Visit</strong><span>{current.previousVisit.when}</span></div><div className="previous-visit-grid"><span><small>RESULT</small><strong>{current.previousVisit.result}</strong></span><span><small>EVIDENCE</small><strong>{current.previousVisit.evidence}</strong></span><span><small>DURATION</small><strong>{current.previousVisit.duration}</strong></span></div></section>
    <section className="completion-readiness"><div className="evidence-heading"><strong>Ready to complete?</strong><span>{completionReady ? 'All checks passed' : `${missing.length + checkpointDrafts.length} requirement${missing.length + checkpointDrafts.length === 1 ? '' : 's'} open`}</span></div><div className="readiness-list"><span className={gpsReady ? 'ready' : ''}><CheckCircle2/> GPS within checkpoint radius</span><span className={guardianReady ? 'ready' : ''}><CheckCircle2/> Guardian connection secure</span><span className={missing.length === 0 ? 'ready' : ''}><CheckCircle2/> Required evidence attached</span><span className={checkpointDrafts.length === 0 ? 'ready' : ''}><CheckCircle2/> No incident draft pending</span></div></section>
    <section className="mission-activity"><div className="evidence-heading"><strong>Latest Activity</strong><span>Live mission timeline</span></div>{activity.map((item,activityIndex)=><div key={`${item}-${activityIndex}`}><i/><span>{item}</span><time>{activityIndex===0 ? 'Now' : 'Earlier'}</time></div>)}</section>
    {smartAlert && <div className={`mission-smart-alert ${highSeverity ? 'critical' : ''}`}><AlertTriangle/><span><strong>{highSeverity ? 'Mission attention required' : 'Smart checkpoint alert'}</strong><small>{smartAlert}</small></span></div>}
    <PrimaryButton tone="orange" onClick={complete} disabled={!completionReady}><Check/> {completionReady ? 'COMPLETE CHECKPOINT' : 'COMPLETE REQUIREMENTS'}</PrimaryButton>
  </main><BottomNav/>
    {sheet === 'photo' && <CaptureSheet kind="photo" existing={record.photos} onClose={()=>setSheet(null)} onUse={()=>{update({photos:record.photos+1});setSheet(null)}} onRemove={()=>{update({photos:0});setSheet(null)}}/>}
    {sheet === 'video' && <CaptureSheet kind="video" existing={record.videos} onClose={()=>setSheet(null)} onUse={()=>{update({videos:record.videos+1});setSheet(null)}} onRemove={()=>{update({videos:0});setSheet(null)}}/>}
    {sheet === 'notes' && <NotesSheet existing={record.note} onClose={()=>setSheet(null)} onSave={(note)=>{update({note});setSheet(null)}} onRemove={()=>{update({note:''});setSheet(null)}}/>}
    {sheet === 'incident' && <IncidentSheet checkpoint={index} onClose={()=>setSheet(null)} onSave={(incident)=>{onIncidentsChange([...incidents,incident]);setSheet('workspace')}}/>}
    {sheet === 'workspace' && <EvidenceWorkspace records={records} incidents={incidents} onClose={()=>setSheet(null)} onIncidentsChange={onIncidentsChange}/>}
  </PhoneShell>
}

function Review({ next, records, incidents }: { next: () => void; records: PatrolEvidence[]; incidents: IncidentRecord[] }) {
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  const draftCount = incidents.filter(item=>item.status === 'draft').length
  return <PhoneShell><AppHeader title="REVIEW & SUBMIT"/><main className="screen-content compact-content review-content"><div className="review-intro"><CheckCircle2/><div><h2>Patrol complete</h2><p>Review the mission record before submitting.</p></div></div><div className="review-summary"><div><small>TIME ON SITE</small><strong>37 min</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>{totalEvidence} items</strong></div></div><h4 className="section-label">PATROL LOCATIONS</h4><div className="review-list">{checkpoints.map((checkpoint,index)=>{
    const item=records.find(record=>record.checkpoint===index)
    const parts=[item?.photos?`${item.photos} photo${item.photos>1?'s':''}`:'',item?.videos?`${item.videos} video${item.videos>1?'s':''}`:'',item?.note?'1 note':''].filter(Boolean)
    return <div key={checkpoint.name}><CheckCircle2/><span><strong>{checkpoint.name}</strong><small>{parts.length?parts.join(' · '):'No evidence'}</small></span><ChevronRight/></div>
  })}</div>{incidents.length>0&&<><h4 className="section-label incident-review-label">INCIDENTS <span>{incidents.length}</span></h4><div className="incident-review-list">{incidents.map(incident=><div key={incident.id} className={`severity-${incident.severity}`}><AlertTriangle/><span><strong>{checkpoints[incident.checkpoint].name}</strong><small>{incident.type} · {incident.severity} severity · {incident.status} · {incident.timestamp}</small></span><ChevronRight/></div>)}</div></>}<div className={`review-note ${draftCount?'review-blocked':''}`}><FileText/><span><strong>{draftCount?'Mission record needs attention':'Mission record ready'}</strong><small>{draftCount?`${draftCount} incident draft${draftCount>1?'s':''} must be submitted before patrol completion.`:'All checkpoint evidence and incidents are attached.'}</small></span></div><PrimaryButton tone="purple" onClick={next} disabled={draftCount>0}><Check/> {draftCount?'RESOLVE INCIDENT DRAFTS':'SUBMIT PATROL'}</PrimaryButton></main><BottomNav/></PhoneShell>
}
function Completed({ next, incidents, records, missionStartedAt, runtime }: { next: () => void; incidents: IncidentRecord[]; records: PatrolEvidence[]; missionStartedAt?: number | null; runtime?: MissionRuntime | null }) {
  const [reportOpen, setReportOpen] = useState(false)
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  return <PhoneShell><AppHeader title="MISSION COMPLETE"/><main className="screen-content completed-screen command-complete"><div className="completion-kicker"><ShieldCheck/> MISSION SECURED</div><h2 className="property-title">{runtime?.property.name??"Property"}</h2><p>The professional mission report is ready for agency review and client delivery.</p><div className="success-orbit"><Check/></div><div className="completion-processing report-ready"><span><CheckCircle2/> Evidence synchronized</span><span><CheckCircle2/> Timeline secured</span><span><CheckCircle2/> Report ready</span></div><div className="summary-grid"><div><small>TIME ON SITE</small><strong>00:37:21</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>{totalEvidence} Items</strong></div><div><small>INCIDENTS</small><strong>{incidents.length}</strong></div></div><PrimaryButton tone="purple" onClick={()=>setReportOpen(true)}><Eye/> VIEW MISSION REPORT</PrimaryButton><SecondaryButton onClick={next}><RefreshCw/> RETURN ONLINE</SecondaryButton></main><BottomNav/>{reportOpen&&<MissionReport records={records} incidents={incidents} missionStartedAt={missionStartedAt} onClose={()=>setReportOpen(false)}/>}</PhoneShell>
}

export default function GuardDashboard(props: GuardDashboardProps) {
  const dashboardMetrics = props.metrics ?? {
    jobsToday: 0,
    onDutySeconds: 0,
  }

  const { state, runtime, checkpoint=0, onAdvance, patrolEvidence=[], onEvidenceChange=()=>undefined, incidents=[], onIncidentsChange=()=>undefined, missionStartedAt=null } = props
  if (state === 'offline') return <Offline next={action(props.onGoOnline,onAdvance)} metrics={dashboardMetrics}/>
  if (state === 'waiting') return <Waiting offline={action(props.onGoOffline,onAdvance)} metrics={dashboardMetrics}/>
  if (state === 'assignment') return <Assignment runtime={runtime} accept={action(props.onAccept,onAdvance)} decline={action(props.onDecline)}/>
  if (state === 'enroute') return <EnRoute runtime={runtime} next={action(props.onStartRoute,onAdvance)}/>
  if (state === 'arrived') return <Arrived runtime={runtime} next={action(props.onMarkArrived,onAdvance)}/>
  if (state === 'patrol') return <Patrol count={checkpoint} next={action(props.onNextCheckpoint,onAdvance)} records={patrolEvidence} onRecordsChange={onEvidenceChange} incidents={incidents} onIncidentsChange={onIncidentsChange} missionStartedAt={missionStartedAt} runtime={runtime}/>
  if (state === 'proof') return <Review next={action(props.onSubmitProof,onAdvance)} records={patrolEvidence} incidents={incidents}/>
  return <Completed next={action(props.onReturnOnline,onAdvance)} incidents={incidents} records={patrolEvidence} missionStartedAt={missionStartedAt} runtime={runtime}/>
}
