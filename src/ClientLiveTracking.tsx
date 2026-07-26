import { Check, CheckCircle2, Clock3, FileText, Navigation, Radio, Shield, UserRound } from 'lucide-react'
import type { ClientTrackingExperience, TrackingTimelineEvent } from './modules/client/clientLiveTrackingRepository'
import ClientMissionMap from './ClientMissionMap'

type Props={experience:ClientTrackingExperience;onViewReport:()=>void}
const stages=['marketplace','offered','accepted','en_route','active','checkpoint','review','completed']
const labels:Record<string,string>={marketplace:'Finding coverage',awaiting_guard:'Agency preparing',offered:'Guard assigned',accepted:'Guard confirmed',en_route:'Guard en route',active:'Patrol active',checkpoint:'Patrol active',review:'Mission review',completed:'Mission complete'}

export default function ClientLiveTracking({experience,onViewReport}:Props){
 if(!experience)return null
 const state=experience.mission.state||'marketplace';const completed=state==='completed';const published=experience.report?.status==='published'
 const stageIndex=Math.max(0,stages.indexOf(state));const guard=experience.guard
 return <section className={`client-tracking-experience ${completed?'complete':''}`}>
  <div className="tracking-hero">
   <div className="tracking-status-copy"><span className="tracking-live-label"><Radio/>{completed?'MISSION RECORD':'LIVE MISSION'}</span><h2>{published?'Your verified report is ready.':labels[state]||'Security request active'}</h2><p>{statusMessage(state,guard?.name)}</p></div>
   {published?<button className="tracking-report-action" onClick={onViewReport}><FileText/>View verified report</button>:experience.eta_minutes?<div className="tracking-eta"><small>ESTIMATED ARRIVAL</small><strong>{experience.eta_minutes} min</strong><span>{experience.distance_miles} miles away</span></div>:null}
  </div>

  <div className="tracking-map-panel">
   <ClientMissionMap experience={experience} completed={completed}/>
   <div className="tracking-mission-card">
    {guard?<div className="tracking-guard"><span><UserRound/></span><div><small>ASSIGNED PROFESSIONAL</small><strong>{guard.name}</strong><em>{experience.agency?.name||'Approved security agency'}{guard.badge_number?` · Badge ${guard.badge_number}`:''}</em></div><CheckCircle2/></div>:<div className="tracking-guard waiting"><span><Shield/></span><div><small>MARKETPLACE DISPATCH</small><strong>Locating approved coverage</strong><em>Your request is visible to qualified agencies.</em></div></div>}
    <div className="tracking-metrics"><div><Navigation/><span><small>STATUS</small><b>{labels[state]||state.replaceAll('_',' ')}</b></span></div><div><Clock3/><span><small>UPDATED</small><b>{relativeTime(experience.mission.updated_at||experience.created_at)}</b></span></div></div>
   </div>
  </div>

  <div className="tracking-progress" aria-label="Mission progress">{['Requested','Assigned','En route','On site','Complete'].map((label,index)=>{const thresholds=[0,1,3,4,7];const active=stageIndex>=thresholds[index];return <div className={active?'active':''} key={label}><i>{active?<Check/>:index+1}</i><span>{label}</span></div>})}</div>
  <div className="tracking-timeline"><div className="tracking-section-heading"><span><small>MISSION TIMELINE</small><h3>Updates as they happen</h3></span><b>{experience.timeline.length} events</b></div>{buildTimeline(experience.timeline,state,experience.created_at).map(item=><div className="tracking-event" key={item.key}><i><Check/></i><span><strong>{item.label}</strong><small>{formatTime(item.time)}</small></span></div>)}</div>
 </section>
}

function statusMessage(state:string,name?:string){if(state==='marketplace')return 'Approved agencies are reviewing your request.';if(state==='offered'||state==='awaiting_guard')return 'The agency is confirming the right professional for your property.';if(state==='accepted')return `${name||'Your guard'} is preparing to begin the route.`;if(state==='en_route')return `${name||'Your guard'} is traveling to your property now.`;if(['active','checkpoint'].includes(state))return `${name||'Your guard'} is on site and completing the patrol.`;if(state==='review')return 'The patrol is finished and the agency is verifying the mission record.';if(state==='completed')return 'Coverage is complete. The verified mission record replaces live tracking.';return 'Your security request is progressing.'}
function relativeTime(value:string|null){if(!value)return 'Just now';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return 'Just now';if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;return `${Math.floor(seconds/3600)} hr ago`}
function formatTime(value:string){return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(value))}
function eventLabel(type:string){const map:Record<string,string>={job_created:'Security requested',agency_claimed:'Agency accepted mission',guard_assigned:'Guard assigned',guard_accepted:'Guard confirmed assignment',route_started:'Guard started route',guard_arrived:'Guard arrived',mission_started:'Patrol started',checkpoint_completed:'Checkpoint completed',mission_completed:'Patrol finished',report_published:'Verified report published'};return map[type]||type.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function buildTimeline(events:TrackingTimelineEvent[],state:string,created:string){const rows=events.map(e=>({key:String(e.id),label:eventLabel(e.event_type),time:e.created_at}));if(!rows.length)rows.push({key:'created',label:'Security requested',time:created});if(state==='marketplace'&&rows.length===1)rows.push({key:'marketplace',label:'Request entered agency marketplace',time:created});return rows.slice(-10).reverse()}
