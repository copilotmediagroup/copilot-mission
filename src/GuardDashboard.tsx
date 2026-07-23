import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Camera, Check, CheckCircle2, ChevronRight, Circle, ClipboardCheck, Copy, FileText, MapPin, MessageCircle, Navigation, Phone, Play, Power, RefreshCw, ShieldCheck, Video } from 'lucide-react'
import type { MissionState } from './types'
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

function EvidenceAction({ icon, label, level, captured, onClick }: { icon: ReactNode; label: string; level: EvidenceLevel; captured: boolean; onClick: () => void }) {
  return <button className={`evidence-action ${captured ? 'captured' : ''}`} onClick={onClick}>
    <span className="evidence-icon">{captured ? <CheckCircle2/> : icon}</span>
    <span><strong>{label}</strong><small className={`requirement ${level}`}>{captured ? 'Captured' : level}</small></span>
    <ChevronRight/>
  </button>
}

function Patrol({ count, next }: { count: number; next: () => void }) {
  const index = Math.min(count, checkpoints.length - 1)
  const current = checkpoints[index]
  const [photo, setPhoto] = useState(false)
  const [video, setVideo] = useState(false)
  const [notes, setNotes] = useState(false)
  const [warning, setWarning] = useState('')

  useEffect(() => { setPhoto(false); setVideo(false); setNotes(false); setWarning('') }, [index])

  const missing = useMemo(() => [
    current.photo === 'required' && !photo ? 'photo' : '',
    current.video === 'required' && !video ? 'video' : '',
    current.notes === 'required' && !notes ? 'notes' : '',
  ].filter(Boolean), [current, photo, video, notes])

  const complete = () => {
    if (missing.length) {
      setWarning(`Required before completion: ${missing.join(', ')}`)
      return
    }
    next()
  }

  return <PhoneShell><AppHeader title="ON PATROL"/><main className="screen-content compact-content patrol-content">
    <div className="patrol-property-row"><div><small>PUBLIX SUPER MARKET</small><span>Checkpoint {index + 1} of {checkpoints.length}</span></div><div className="patrol-mini-progress"><i style={{width:`${((index + 1)/checkpoints.length)*100}%`}}/></div></div>
    <section className="checkpoint-hero"><div className="location-mark"><MapPin/></div><div><small>CURRENT PATROL LOCATION</small><h2>{current.name}</h2></div></section>
    <section className="mission-brief"><div className="brief-heading"><ClipboardCheck/><strong>Mission Brief</strong></div>{current.instructions.map(item => <div className="brief-item" key={item}><Circle/><span>{item}</span></div>)}</section>
    <section className="evidence-section"><div className="evidence-heading"><strong>Evidence</strong><span>Capture only what is needed</span></div>
      <EvidenceAction icon={<Camera/>} label="Photo" level={current.photo} captured={photo} onClick={()=>setPhoto(v=>!v)}/>
      <EvidenceAction icon={<Video/>} label="Video" level={current.video} captured={video} onClick={()=>setVideo(v=>!v)}/>
      <EvidenceAction icon={<FileText/>} label="Notes" level={current.notes} captured={notes} onClick={()=>setNotes(v=>!v)}/>
    </section>
    {warning && <div className="evidence-warning">{warning}</div>}
    <PrimaryButton tone="orange" onClick={complete}><Check/> COMPLETE CHECKPOINT</PrimaryButton>
  </main><BottomNav/></PhoneShell>
}

const reviewItems = [
  ['Exterior Perimeter','1 photo'],['Parking Lot','No evidence'],['Main Entrance','1 photo'],['Back Entrance','1 note'],['Rear Loading Dock','1 photo'],['Side Doors','No evidence'],
]
function Review({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="REVIEW & SUBMIT"/><main className="screen-content compact-content review-content"><div className="review-intro"><CheckCircle2/><div><h2>Patrol complete</h2><p>Review the mission record before submitting.</p></div></div><div className="review-summary"><div><small>TIME ON SITE</small><strong>37 min</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>4 items</strong></div></div><h4 className="section-label">PATROL LOCATIONS</h4><div className="review-list">{reviewItems.map(([name,evidence])=><div key={name}><CheckCircle2/><span><strong>{name}</strong><small>{evidence}</small></span><ChevronRight/></div>)}</div><div className="review-note"><FileText/><span><strong>Final patrol note</strong><small>All areas checked. No issues observed.</small></span></div><PrimaryButton tone="purple" onClick={next}><Check/> SUBMIT PATROL</PrimaryButton></main><BottomNav/></PhoneShell> }
function Completed({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="COMPLETED"/><main className="screen-content completed-screen"><h2 className="property-title">Publix Super Market</h2><p>Assignment complete!</p><div className="success-orbit"><Check/></div><div className="summary-grid"><div><small>TIME ON SITE</small><strong>00:37:21</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>EVIDENCE</small><strong>4 Items</strong></div><div><small>REPORT STATUS</small><strong>Submitted</strong></div></div><PrimaryButton onClick={next}><RefreshCw/> RETURN ONLINE</PrimaryButton></main><BottomNav/></PhoneShell> }

export default function GuardDashboard(props: GuardDashboardProps) {
  const { state, checkpoint=0, onAdvance } = props
  if (state === 'offline') return <Offline next={action(props.onGoOnline,onAdvance)}/>
  if (state === 'waiting') return <Waiting offline={action(props.onGoOffline,onAdvance)}/>
  if (state === 'assignment') return <Assignment accept={action(props.onAccept,onAdvance)} decline={action(props.onDecline)}/>
  if (state === 'enroute') return <EnRoute next={action(props.onStartRoute,onAdvance)}/>
  if (state === 'arrived') return <Arrived next={action(props.onMarkArrived,onAdvance)}/>
  if (state === 'patrol') return <Patrol count={checkpoint} next={action(props.onNextCheckpoint,onAdvance)}/>
  if (state === 'proof') return <Review next={action(props.onSubmitProof,onAdvance)}/>
  return <Completed next={action(props.onReturnOnline,onAdvance)}/>
}
