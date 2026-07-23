import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Camera, Check, CheckCircle2, ChevronRight, Circle, ClipboardCheck, Clock3, Copy, FileText, Image, MapPin, MessageCircle, Navigation, Phone, Power, RefreshCw, RotateCcw, ShieldCheck, SkipForward, Trash2, Video, X } from 'lucide-react'
import type { IncidentRecord, IncidentSeverity, MissionState, PatrolEvidence, SkippedCheckpoint } from './types'
import { AppHeader, BottomNav, Metric, PhoneShell, PrimaryButton, SecondaryButton, StatusChip } from './ui'

const propertyImage = 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=85'

type EvidenceLevel = 'optional' | 'recommended' | 'required'
type Checkpoint = {
  name: string
  instructions: string[]
  photo: EvidenceLevel
  video: EvidenceLevel
  notes: EvidenceLevel
}

const checkpoints: Checkpoint[] = [
  { name:'Exterior Perimeter', instructions:['Walk the full exterior perimeter','Look for damage, loitering, or unsecured access'], photo:'recommended', video:'optional', notes:'optional' },
  { name:'Parking Lot', instructions:['Inspect parked vehicles and lighting','Check for suspicious activity or debris'], photo:'optional', video:'optional', notes:'optional' },
  { name:'Main Entrance', instructions:['Verify entrance doors are secure','Inspect glass, locks, and vestibule'], photo:'required', video:'optional', notes:'optional' },
  { name:'Back Entrance', instructions:['Confirm employee entrance is secured','Check hinges, lock, and surrounding area'], photo:'optional', video:'optional', notes:'recommended' },
  { name:'Rear Loading Dock', instructions:['Check delivery doors','Verify dock gate is locked','Inspect fence line and look for suspicious activity'], photo:'required', video:'optional', notes:'optional' },
  { name:'Side Doors', instructions:['Verify all side exits are secure','Check for tampering or blocked exits'], photo:'optional', video:'optional', notes:'optional' },
]

export interface GuardDashboardProps {
  state: MissionState
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
  skippedCheckpoints?: SkippedCheckpoint[]
  onSkippedChange?: (records: SkippedCheckpoint[]) => void
}

const action = (preferred?: () => void, fallback?: () => void) => preferred ?? fallback ?? (() => undefined)

function ProfileBlock({ online = false }: { online?: boolean }) {
  return <div className="profile-row"><div><small>Good Morning,</small><h2>David Martinez</h2><StatusChip tone={online ? 'green' : 'gray'}>{online ? 'ONLINE' : 'OFFLINE'}</StatusChip></div><div className="avatar">DM</div></div>
}
function PropertyHeader({ eyebrow }: { eyebrow: string }) { return <><div className="eyebrow">{eyebrow}</div><h2 className="property-title">Publix Super Market</h2><p className="address">12501 S Orange Blossom Trail<br/>Orlando, FL 32837</p></> }

function Offline({ next }: { next: () => void }) { return <PhoneShell light><AppHeader light/><main className="screen-content offline-screen"><ProfileBlock/><section className="offline-hero"><h3>You are currently offline</h3><p>Go online to receive<br/>assignments.</p><div className="shield-orbit"><ShieldCheck/></div><PrimaryButton onClick={next}><Power/> GO ONLINE</PrimaryButton></section><h4 className="section-label">Today at a glance</h4><div className="metric-grid"><Metric value="0" label="Jobs Today"/><Metric value="0h 00m" label="On Duty"/><Metric value="0" label="Check-ins"/></div><div className="message-card"><MessageCircle/><div><strong>Messages</strong><small>No unread messages</small></div><ChevronRight/></div></main><BottomNav light/></PhoneShell> }
function Waiting({ offline }: { offline: () => void }) { return <PhoneShell><AppHeader title="CO PILOT"/><main className="screen-content"><ProfileBlock online/><section className="waiting-hero"><div className="radar"><div className="radar-sweep"/></div><h3>You're online and available</h3><p>We'll notify you when a new<br/>assignment is available.</p><PrimaryButton onClick={offline}><Power/> GO OFFLINE</PrimaryButton></section><h4 className="section-label">Today at a glance</h4><div className="metric-grid"><Metric value="0" label="Jobs Today"/><Metric value="1h 15m" label="On Duty"/><Metric value="100%" label="Patrol Readiness" accent/></div><div className="message-card dark"><MessageCircle/><div><strong>Messages</strong><small>No unread messages</small></div><ChevronRight/></div></main><BottomNav/></PhoneShell> }
function Assignment({ accept, decline }: { accept: () => void; decline: () => void }) { return <PhoneShell><AppHeader title="NEW ASSIGNMENT"/><main className="screen-content compact-content"><PropertyHeader eyebrow="NEW ASSIGNMENT"/><img className="property-image" src={propertyImage} alt="Publix Super Market"/><div className="two-stats"><div><small>DISTANCE</small><strong>4.2 mi</strong></div><div><small>ETA</small><strong>9 min</strong></div></div><div className="info-grid"><div><small>PATROL TYPE</small><strong>Retail Patrol</strong></div><div><small>PRIORITY</small><span className="priority">MEDIUM</span></div></div><div className="payment-row"><small>ASSIGNMENT</small><strong>Marketplace Job</strong></div><SecondaryButton onClick={decline}>DECLINE</SecondaryButton><PrimaryButton onClick={accept}><Check/> ACCEPT</PrimaryButton></main><BottomNav/></PhoneShell> }
function EnRoute({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="EN ROUTE"/><main className="screen-content compact-content"><PropertyHeader eyebrow="EN ROUTE"/><div className="map-card"><div className="map-grid"/><svg viewBox="0 0 240 250" preserveAspectRatio="none"><path d="M44 220 C70 185, 72 160, 105 144 S130 92, 175 72 S187 32, 215 18"/><circle cx="44" cy="220" r="11"/><circle cx="215" cy="18" r="10" className="pin-dot"/></svg><div className="map-a">A</div><MapPin className="map-pin"/></div><div className="two-stats"><div><small>ETA</small><strong>9 min</strong></div><div><small>DISTANCE</small><strong>4.2 mi</strong></div></div><div className="route-progress"><div><span>ROUTE PROGRESS</span><b>22%</b></div><i><em/></i></div><PrimaryButton onClick={next}><Navigation/> START ROUTE</PrimaryButton></main><BottomNav/></PhoneShell> }
function Arrived({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="ARRIVED"/><main className="screen-content compact-content"><PropertyHeader eyebrow="ARRIVED"/><img className="property-image" src={propertyImage} alt="Publix Super Market"/><PrimaryButton tone="green" onClick={next}><CheckCircle2/> MARK ARRIVED</PrimaryButton><section className="property-info"><small>PROPERTY INFO</small><div><strong>Maria Contact</strong><Phone/></div><div><strong>Gate / Entry Code<br/><span>#4826</span></strong><Copy/></div><div><strong>Special Instructions<br/><span>Check back entrance and loading dock.</span></strong><ChevronRight/></div></section><SecondaryButton>VIEW DETAILS</SecondaryButton></main><BottomNav/></PhoneShell> }

function EvidenceAction({ icon, label, level, count, detail, onClick }: { icon: ReactNode; label: string; level: EvidenceLevel; count: number; detail?: string; onClick: () => void }) {
  const captured = count > 0 || Boolean(detail)
  return <button className={`evidence-action ${captured ? 'captured' : ''}`} onClick={onClick}>
    <span className="evidence-icon">{captured ? <CheckCircle2/> : icon}</span>
    <span><strong>{label}</strong><small className={`requirement ${level}`}>{captured ? (detail || `${count} captured`) : level}</small></span>
    <ChevronRight/>
  </button>
}

type CaptureKind = 'photo' | 'video'
function CaptureSheet({ kind, existing, onClose, onUse, onRemove }: { kind: CaptureKind; existing: number; onClose: () => void; onUse: () => void; onRemove: () => void }) {
  const [captured, setCaptured] = useState(false)
  const title = kind === 'photo' ? 'Take Photo' : 'Record Video'
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button className="capture-backdrop" onClick={onClose} aria-label="Close capture" />
    <section className="capture-sheet">
      <div className="capture-handle"/>
      <header><button onClick={onClose}><X/></button><strong>{title}</strong><span/></header>
      <div className={`camera-preview ${captured ? 'captured' : ''}`}>
        <div className="camera-grid"/>
        {captured ? <div className="captured-preview"><CheckCircle2/><strong>{kind === 'photo' ? 'Photo captured' : 'Video recorded'}</strong><small>Preview ready to attach</small></div> : <div className="camera-instructions"><Camera/><strong>Position the checkpoint in frame</strong><small>Smart Capture preview</small></div>}
        {kind === 'video' && !captured && <div className="recording-time">00:00</div>}
      </div>
      {!captured ? <div className="capture-controls"><button className="gallery-button"><Image/><span>Gallery</span></button><button className={`shutter ${kind}`} onClick={()=>setCaptured(true)}><i/></button><button className="flip-button"><RotateCcw/><span>Flip</span></button></div> : <div className="capture-confirm">
        <SecondaryButton onClick={()=>setCaptured(false)}><RotateCcw/> RETAKE</SecondaryButton>
        <PrimaryButton tone={kind === 'photo' ? 'blue' : 'purple'} onClick={onUse}><Check/> USE {kind.toUpperCase()}</PrimaryButton>
      </div>}
      {existing > 0 && <button className="remove-evidence" onClick={onRemove}><Trash2/> Remove existing {kind}</button>}
      <p className="prototype-note">Camera capture is simulated in this visual prototype.</p>
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
  const current = checkpoints[checkpoint]
  const canSave = Boolean(type)
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button className="capture-backdrop" onClick={onClose} aria-label="Close incident" />
    <section className="capture-sheet incident-sheet">
      <div className="capture-handle"/>
      <header><button onClick={onClose}><X/></button><strong>Report Incident</strong><span/></header>
      <div className="incident-context"><AlertTriangle/><span><small>PATROL LOCATION</small><strong>{current.name}</strong><em>GPS and timestamp attach automatically</em></span></div>
      <h4>Incident Type</h4>
      <div className="incident-type-grid">{incidentTypes.map(item=><button key={item.label} className={type===item.label?'active':''} onClick={()=>setType(item.label)}>{item.icon}<span>{item.label}</span></button>)}</div>
      <h4>Severity</h4>
      <div className="severity-grid">
        {(['low','medium','high'] as IncidentSeverity[]).map(level=><button key={level} className={`${level} ${severity===level?'active':''}`} onClick={()=>setSeverity(level)}><i/>{level}</button>)}
      </div>
      <h4>Evidence <small>Optional</small></h4>
      <div className="incident-evidence-grid">
        <button className={photos?'attached':''} onClick={()=>setPhotos(photos+1)}><Camera/><span>{photos ? `${photos} photo${photos>1?'s':''}` : 'Add Photo'}</span>{photos>0&&<CheckCircle2/>}</button>
        <button className={videos?'attached':''} onClick={()=>setVideos(videos+1)}><Video/><span>{videos ? `${videos} video${videos>1?'s':''}` : 'Add Video'}</span>{videos>0&&<CheckCircle2/>}</button>
      </div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what happened…" maxLength={400}/>
      <div className="note-count">{note.length}/400</div>
      <PrimaryButton tone="orange" onClick={()=>canSave&&onSave({id:`incident-${Date.now()}`,checkpoint,type,severity,note,photos,videos,timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),location:'28.3922, -81.4265'})}><AlertTriangle/> SAVE INCIDENT</PrimaryButton>
      {!canSave && <p className="incident-required">Choose an incident type to continue.</p>}
      <p className="prototype-note">Camera and GPS are simulated in this visual prototype.</p>
    </section>
  </div>
}
function NotesSheet({ existing, onClose, onSave, onRemove }: { existing: string; onClose: () => void; onSave: (note: string) => void; onRemove: () => void }) {
  const [note, setNote] = useState(existing)
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button className="capture-backdrop" onClick={onClose} aria-label="Close notes" />
    <section className="capture-sheet notes-sheet">
      <div className="capture-handle"/>
      <header><button onClick={onClose}><X/></button><strong>Checkpoint Notes</strong><span/></header>
      <p className="sheet-copy">Choose a quick note or enter a custom observation.</p>
      <div className="quick-notes">{quickNotes.map(item=><button key={item} className={note===item?'active':''} onClick={()=>setNote(item)}>{item}</button>)}</div>
      <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what you observed…" maxLength={300}/>
      <div className="note-count">{note.length}/300</div>
      <PrimaryButton tone="purple" onClick={()=>onSave(note)}><Check/> SAVE NOTE</PrimaryButton>
      {existing && <button className="remove-evidence" onClick={onRemove}><Trash2/> Remove note</button>}
    </section>
  </div>
}


function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
}

function SkipSheet({ checkpoint, onClose, onSkip }: { checkpoint: number; onClose: () => void; onSkip: (item: SkippedCheckpoint) => void }) {
  const reasons = ['Area inaccessible','Safety concern','Client requested skip','Obstruction or construction','Other']
  const [reason, setReason] = useState('')
  return <div className="capture-overlay" role="dialog" aria-modal="true">
    <button className="capture-backdrop" onClick={onClose} aria-label="Close skip checkpoint"/>
    <section className="capture-sheet skip-sheet">
      <div className="capture-handle"/>
      <header><button onClick={onClose}><X/></button><strong>Skip Checkpoint</strong><span/></header>
      <p className="sheet-copy">A reason is required. The agency and client will see this in the mission report.</p>
      <div className="skip-reasons">{reasons.map(item=><button key={item} className={reason===item?'active':''} onClick={()=>setReason(item)}>{item}</button>)}</div>
      <PrimaryButton tone="orange" onClick={()=>reason&&onSkip({checkpoint,reason,timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})})}><SkipForward/> CONFIRM SKIP</PrimaryButton>
      {!reason&&<p className="incident-required">Choose a reason to continue.</p>}
    </section>
  </div>
}

function Patrol({ count, next, records, onRecordsChange, incidents, onIncidentsChange, skipped, onSkippedChange }: { count: number; next: () => void; records: PatrolEvidence[]; onRecordsChange: (records: PatrolEvidence[]) => void; incidents: IncidentRecord[]; onIncidentsChange: (records: IncidentRecord[]) => void; skipped: SkippedCheckpoint[]; onSkippedChange: (records: SkippedCheckpoint[]) => void }) {
  const index = Math.min(count, checkpoints.length - 1)
  const current = checkpoints[index]
  const record = records.find(item => item.checkpoint === index) ?? { checkpoint:index, photos:0, videos:0, note:'' }
  const [sheet, setSheet] = useState<CaptureKind | 'notes' | 'incident' | 'skip' | null>(null)
  const [missionStarted] = useState(() => Date.now())
  const [checkpointStarted, setCheckpointStarted] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [warning, setWarning] = useState('')
  const checkpointIncidents = incidents.filter(item => item.checkpoint === index)

  useEffect(() => { setSheet(null); setWarning(''); setCheckpointStarted(Date.now()) }, [index])
  useEffect(() => { const timer=window.setInterval(()=>setNow(Date.now()),1000); return ()=>window.clearInterval(timer) }, [])

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

  const missionSeconds = Math.floor((now - missionStarted)/1000)
  const checkpointSeconds = Math.floor((now - checkpointStarted)/1000)
  const completedCount = index
  const remaining = checkpoints.length - index
  const estimatedMinutes = Math.max(1, remaining * 4)
  const estimatedFinish = new Date(now + estimatedMinutes*60000).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  const isTakingLong = checkpointSeconds >= 180

  const complete = () => {
    if (missing.length) { setWarning(`Required before completion: ${missing.join(', ')}`); return }
    next()
  }

  return <PhoneShell><AppHeader title="ON PATROL"/><main className="screen-content compact-content patrol-content">
    <div className="patrol-property-row"><div><small>PUBLIX SUPER MARKET</small><span>{completedCount} of {checkpoints.length} locations complete</span></div><div className="patrol-mini-progress"><i style={{width:`${(completedCount/checkpoints.length)*100}%`}}/></div></div>
    <section className="mission-intelligence">
      <div><Clock3/><span><small>MISSION TIME</small><strong>{formatDuration(missionSeconds)}</strong></span></div>
      <div><span><small>THIS LOCATION</small><strong className={isTakingLong?'warning-time':''}>{formatDuration(checkpointSeconds)}</strong></span></div>
      <div><span><small>EST. FINISH</small><strong>{estimatedFinish}</strong></span></div>
    </section>
    <div className="live-summary"><span>{incidents.length} incident{incidents.length===1?'':'s'}</span><i/> <span>{totalEvidence} evidence item{totalEvidence===1?'':'s'}</span><i/> <span>{skipped.length} skipped</span></div>
    {isTakingLong&&<div className="time-advisory"><AlertTriangle/><span><strong>Extended checkpoint time</strong><small>Take the time needed. Report an incident if something is delaying the patrol.</small></span></div>}
    <div className="mission-timeline">{checkpoints.map((cp,i)=>{const hasIncident=incidents.some(item=>item.checkpoint===i);const wasSkipped=skipped.some(item=>item.checkpoint===i);return <div key={cp.name} className={wasSkipped?'skipped':i<index?'done':i===index?'current':'upcoming'}><span>{wasSkipped?<SkipForward/>:hasIncident?<AlertTriangle/>:i<index?<Check/>:<Circle/>}</span><small>{cp.name}</small></div>})}</div>
    <section className="checkpoint-hero"><div className="location-mark"><MapPin/></div><div><small>CURRENT PATROL LOCATION</small><h2>{current.name}</h2></div></section>
    <section className="mission-brief"><div className="brief-heading"><ClipboardCheck/><strong>Mission Brief</strong></div>{current.instructions.map(item => <div className="brief-item" key={item}><Circle/><span>{item}</span></div>)}</section>
    <section className="evidence-section"><div className="evidence-heading"><strong>Evidence</strong><span>Capture while at this location</span></div>
      <EvidenceAction icon={<Camera/>} label="Photo" level={current.photo} count={record.photos} onClick={()=>setSheet('photo')}/>
      <EvidenceAction icon={<Video/>} label="Video" level={current.video} count={record.videos} onClick={()=>setSheet('video')}/>
      <EvidenceAction icon={<FileText/>} label="Notes" level={current.notes} count={0} detail={record.note ? 'Note saved' : ''} onClick={()=>setSheet('notes')}/>
    </section>
    <button className={`incident-action ${checkpointIncidents.length ? 'reported' : ''}`} onClick={()=>setSheet('incident')}><span><AlertTriangle/></span><div><strong>{checkpointIncidents.length ? `${checkpointIncidents.length} Incident${checkpointIncidents.length>1?'s':''} Reported` : 'Report Incident'}</strong><small>{checkpointIncidents.length ? 'Attached to this patrol location' : 'Document an issue without leaving patrol'}</small></div><ChevronRight/></button>
    {warning && <div className="evidence-warning">{warning}</div>}
    <button className="skip-checkpoint" onClick={()=>setSheet('skip')}><SkipForward/> Skip checkpoint</button>
    <PrimaryButton tone="orange" onClick={complete}><Check/> COMPLETE CHECKPOINT</PrimaryButton>
  </main><BottomNav/>
    {sheet === 'photo' && <CaptureSheet kind="photo" existing={record.photos} onClose={()=>setSheet(null)} onUse={()=>{update({photos:record.photos+1});setSheet(null)}} onRemove={()=>{update({photos:0});setSheet(null)}}/>}
    {sheet === 'video' && <CaptureSheet kind="video" existing={record.videos} onClose={()=>setSheet(null)} onUse={()=>{update({videos:record.videos+1});setSheet(null)}} onRemove={()=>{update({videos:0});setSheet(null)}}/>}
    {sheet === 'notes' && <NotesSheet existing={record.note} onClose={()=>setSheet(null)} onSave={(note)=>{update({note});setSheet(null)}} onRemove={()=>{update({note:''});setSheet(null)}}/>}
    {sheet === 'skip' && <SkipSheet checkpoint={index} onClose={()=>setSheet(null)} onSkip={(item)=>{onSkippedChange([...skipped,item]);setSheet(null);next()}}/>}
    {sheet === 'incident' && <IncidentSheet checkpoint={index} onClose={()=>setSheet(null)} onSave={(incident)=>{onIncidentsChange([...incidents,incident]);setSheet(null)}}/>}
  </PhoneShell>
}

function Review({ next, records, incidents, skipped }: { next: () => void; records: PatrolEvidence[]; incidents: IncidentRecord[]; skipped: SkippedCheckpoint[] }) {
  const totalEvidence = records.reduce((sum,item)=>sum+item.photos+item.videos+(item.note?1:0),0)
  return <PhoneShell><AppHeader title="REVIEW & SUBMIT"/><main className="screen-content compact-content review-content"><div className="review-intro"><CheckCircle2/><div><h2>Patrol complete</h2><p>Review the mission record before submitting.</p></div></div><div className="review-summary"><div><small>TIME ON SITE</small><strong>37 min</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>{totalEvidence} items</strong></div></div><h4 className="section-label">PATROL LOCATIONS</h4><div className="review-list">{checkpoints.map((checkpoint,index)=>{
    const item=records.find(record=>record.checkpoint===index)
    const parts=[item?.photos?`${item.photos} photo${item.photos>1?'s':''}`:'',item?.videos?`${item.videos} video${item.videos>1?'s':''}`:'',item?.note?'1 note':''].filter(Boolean)
    const skip=skipped.find(record=>record.checkpoint===index)
    return <div key={checkpoint.name} className={skip?'review-skipped':''}>{skip?<SkipForward/>:<CheckCircle2/>}<span><strong>{checkpoint.name}</strong><small>{skip?`Skipped · ${skip.reason}`:(parts.length?parts.join(' · '):'No evidence')}</small></span><ChevronRight/></div>
  })}</div>{incidents.length>0&&<><h4 className="section-label incident-review-label">INCIDENTS <span>{incidents.length}</span></h4><div className="incident-review-list">{incidents.map(incident=><div key={incident.id} className={`severity-${incident.severity}`}><AlertTriangle/><span><strong>{checkpoints[incident.checkpoint].name}</strong><small>{incident.type} · {incident.severity} severity · {incident.timestamp}</small></span><ChevronRight/></div>)}</div></>}<div className="review-note"><FileText/><span><strong>Mission record ready</strong><small>All checkpoint evidence and incidents are attached.</small></span></div><PrimaryButton tone="purple" onClick={next}><Check/> SUBMIT PATROL</PrimaryButton></main><BottomNav/></PhoneShell>
}
function Completed({ next, incidents }: { next: () => void; incidents: IncidentRecord[] }) { return <PhoneShell><AppHeader title="COMPLETED"/><main className="screen-content completed-screen"><h2 className="property-title">Publix Super Market</h2><p>Assignment complete!</p><div className="success-orbit"><Check/></div><div className="summary-grid"><div><small>TIME ON SITE</small><strong>00:37:21</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>4 Items</strong></div><div><small>INCIDENTS</small><strong>{incidents.length}</strong></div></div><PrimaryButton onClick={next}><RefreshCw/> RETURN ONLINE</PrimaryButton></main><BottomNav/></PhoneShell> }

export default function GuardDashboard(props: GuardDashboardProps) {
  const { state, checkpoint=0, onAdvance, patrolEvidence=[], onEvidenceChange=()=>undefined, incidents=[], onIncidentsChange=()=>undefined, skippedCheckpoints=[], onSkippedChange=()=>undefined } = props
  if (state === 'offline') return <Offline next={action(props.onGoOnline,onAdvance)}/>
  if (state === 'waiting') return <Waiting offline={action(props.onGoOffline,onAdvance)}/>
  if (state === 'assignment') return <Assignment accept={action(props.onAccept,onAdvance)} decline={action(props.onDecline)}/>
  if (state === 'enroute') return <EnRoute next={action(props.onStartRoute,onAdvance)}/>
  if (state === 'arrived') return <Arrived next={action(props.onMarkArrived,onAdvance)}/>
  if (state === 'patrol') return <Patrol count={checkpoint} next={action(props.onNextCheckpoint,onAdvance)} records={patrolEvidence} onRecordsChange={onEvidenceChange} incidents={incidents} onIncidentsChange={onIncidentsChange} skipped={skippedCheckpoints} onSkippedChange={onSkippedChange}/>
  if (state === 'proof') return <Review next={action(props.onSubmitProof,onAdvance)} records={patrolEvidence} incidents={incidents} skipped={skippedCheckpoints}/>
  return <Completed next={action(props.onReturnOnline,onAdvance)} incidents={incidents}/>
}
