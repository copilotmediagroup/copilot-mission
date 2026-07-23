import { Check, CheckCircle2, ChevronRight, Circle, CloudUpload, Copy, MapPin, MessageCircle, Navigation, Phone, Play, Plus, Power, RefreshCw, ShieldCheck } from 'lucide-react'
import type { MissionState } from './types'
import { AppHeader, BottomNav, Metric, PhoneShell, PrimaryButton, SecondaryButton, StatusChip } from './ui'

const propertyImage = 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=85'
const propertyImage2 = 'https://images.unsplash.com/photo-1567449303078-57ad995bd17a?auto=format&fit=crop&w=900&q=85'
const checkpoints = ['Exterior Perimeter','Parking Lot','Main Entrance','Back Entrance','Loading Dock','Side Doors']

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
function Patrol({ count, next }: { count: number; next: () => void }) { const complete = Math.min(count, 6); const nextLabel = complete >= 5 ? 'COMPLETE PATROL' : 'NEXT CHECKPOINT'; return <PhoneShell><AppHeader title="ON PATROL"/><main className="screen-content compact-content"><h2 className="property-title">Publix Super Market</h2><p className="address">Orlando, FL</p><div className="timer-card"><small>TIME ON SITE</small><strong>00:18:42</strong></div><div className="progress-ring" style={{background:`conic-gradient(#ff7a00 0 ${(complete/6)*100}%,#302317 ${(complete/6)*100}%)`}}><div><small>CHECKPOINT</small><strong>{complete} <span>of 6</span></strong></div></div><div className="check-progress"><div><span>CHECKLIST PROGRESS</span><b>{complete} of 6</b></div><i><em style={{width:`${(complete/6)*100}%`}}/></i></div><div className="checklist">{checkpoints.map((c,i)=><div key={c} className={i<complete?'done':i===complete?'current':''}>{i<complete?<CheckCircle2/>:<Circle/>}<span>{c}</span><Circle/></div>)}</div><PrimaryButton tone="orange" onClick={next}>{nextLabel} <ChevronRight/></PrimaryButton></main><BottomNav/></PhoneShell> }
function MediaTile({ video=false, image=propertyImage }: { video?: boolean; image?: string }) { return <div className="media-tile" style={{backgroundImage:`url(${image})`}}>{video&&<div className="play"><Play/></div>}</div> }
function Proof({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="UPLOAD PROOF"/><main className="screen-content compact-content"><h2 className="property-title">Publix Super Market</h2><p>Patrol completed successfully.</p><h4 className="section-label">PHOTOS</h4><div className="media-row"><MediaTile/><MediaTile image={propertyImage2}/><button className="add-media"><Plus/></button></div><h4 className="section-label">VIDEOS</h4><div className="media-row"><MediaTile video image={propertyImage2}/><button className="add-media"><Plus/></button></div><h4 className="section-label">NOTES <span>(Optional)</span></h4><div className="notes">All clear. No issues observed.<small>32/250</small></div><PrimaryButton tone="purple" onClick={next}><CloudUpload/> SUBMIT PROOF</PrimaryButton></main><BottomNav/></PhoneShell> }
function Completed({ next }: { next: () => void }) { return <PhoneShell><AppHeader title="COMPLETED"/><main className="screen-content completed-screen"><h2 className="property-title">Publix Super Market</h2><p>Assignment complete!</p><div className="success-orbit"><Check/></div><div className="summary-grid"><div><small>TIME ON SITE</small><strong>00:37:21</strong></div><div><small>CHECKPOINTS</small><strong>6 of 6</strong></div><div><small>PHOTOS / VIDEOS</small><strong>7 Files</strong></div><div><small>REPORT STATUS</small><strong>Submitted</strong></div></div><PrimaryButton onClick={next}><RefreshCw/> RETURN ONLINE</PrimaryButton></main><BottomNav/></PhoneShell> }

export default function GuardDashboard(props: GuardDashboardProps) {
  const { state, checkpoint=2, onAdvance } = props
  if (state === 'offline') return <Offline next={action(props.onGoOnline,onAdvance)}/>
  if (state === 'waiting') return <Waiting offline={action(props.onGoOffline,onAdvance)}/>
  if (state === 'assignment') return <Assignment accept={action(props.onAccept,onAdvance)} decline={action(props.onDecline)}/>
  if (state === 'enroute') return <EnRoute next={action(props.onStartRoute,onAdvance)}/>
  if (state === 'arrived') return <Arrived next={action(props.onMarkArrived,onAdvance)}/>
  if (state === 'patrol') return <Patrol count={checkpoint} next={action(props.onNextCheckpoint,onAdvance)}/>
  if (state === 'proof') return <Proof next={action(props.onSubmitProof,onAdvance)}/>
  return <Completed next={action(props.onReturnOnline,onAdvance)}/>
}
