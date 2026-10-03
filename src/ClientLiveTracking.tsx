import { Building2, Check, CheckCircle2, Clock3, FileText, LocateFixed, MapPin, Navigation, Radio, Shield, UserRound } from 'lucide-react'
import type { ClientTrackingExperience, TrackingTimelineEvent } from './modules/client/clientLiveTrackingRepository'
import MissionMap, { type MissionMapMarker } from './modules/location/MissionMap'
import type { ActiveMissionRoute } from './modules/location/missionRouting'
import { withdrawClientJob } from './modules/client/clientRepository'
import { useState } from 'react'

type Props={experience:ClientTrackingExperience;onViewReport:()=>void}
const stages=['marketplace','offered','accepted','en_route','active','checkpoint','review','completed']
const labels:Record<string,string>={marketplace:'Finding coverage',awaiting_guard:'Agency preparing',offered:'Guard assigned',accepted:'Guard confirmed',en_route:'Guard en route',active:'Patrol active',checkpoint:'Patrol active',review:'Mission review',completed:'Mission complete'}

export default function ClientLiveTracking({experience,onViewReport}:Props){
 const [withdrawing,setWithdrawing]=useState(false)
 const [withdrawError,setWithdrawError]=useState('')
 if(!experience)return null
 const state=experience.mission.state||'marketplace';const completed=state==='completed';const published=experience.report?.status==='published'
 const stageIndex=Math.max(0,stages.indexOf(state));const guard=experience.guard

 const clientMapMarkers:MissionMapMarker[]=[]

 if(
   experience.property.latitude!=null &&
   experience.property.longitude!=null
 ){
   clientMapMarkers.push({
     id:`property-${experience.property.id}`,
     latitude:experience.property.latitude,
     longitude:experience.property.longitude,
     label:experience.property.name,
     title:experience.property.name,
     subtitle:experience.property.address,
     photoUrl:experience.property.photo_url,
     type:'property',
     active:!completed,
   })
 }

 if(
   guard &&
   guard.latitude!=null &&
   guard.longitude!=null &&
   !completed
 ){
   clientMapMarkers.push({
     id:`guard-${guard.id}`,
     latitude:guard.latitude,
     longitude:guard.longitude,
     label:guard.name,
     title:guard.name,
     subtitle:experience.agency?.name||'Assigned security guard',
     initials:guard.name.split(' ').map(v=>v[0]).join('').slice(0,2),
     type:'guard',
     status:guard.freshness,
     distance:experience.distance_miles??undefined,
   })
 }

 const activeMissionRoute:ActiveMissionRoute|null=guard &&
   guard.latitude!=null &&
   guard.longitude!=null &&
   experience.property.latitude!=null &&
   experience.property.longitude!=null &&
   !completed
   ? {
     missionId:experience.job_id,
     status:state,
     assignedGuard:{guardId:guard.id,name:guard.name,latitude:guard.latitude,longitude:guard.longitude,heading:null,accuracy:null,updatedAt:experience.mission.updated_at||experience.created_at},
     destination:{propertyId:experience.property.id,name:experience.property.name,address:experience.property.address,latitude:experience.property.latitude,longitude:experience.property.longitude},
   }
   : null

 const canWithdraw=
   experience.job_status==='open' &&
   ['marketplace','awaiting_guard'].includes(state)

 async function withdrawRequest(){
   if(!canWithdraw||withdrawing)return

   if(!window.confirm('Withdraw this security request?'))return

   setWithdrawError('')
   setWithdrawing(true)

   try{
     if(!experience) return
     await withdrawClientJob(experience.job_id)
   }catch(error){
     setWithdrawError(
       error instanceof Error
         ? error.message
         : 'Unable to withdraw request.'
     )
   }finally{
     setWithdrawing(false)
   }
 }

 return <section className={`client-tracking-experience ${completed?'complete':''}`}>
  <div className="tracking-hero">
   <div className="tracking-status-copy"><span className="tracking-live-label"><Radio/>{completed?'MISSION RECORD':'LIVE MISSION'}</span><h2>{published?'Your verified report is ready.':labels[state]||'Security request active'}</h2><p>{statusMessage(state,guard?.name)}</p></div>
   {published?<button className="tracking-report-action" onClick={onViewReport}><FileText/>View verified report</button>:experience.eta_minutes?<div className="tracking-eta"><small>ESTIMATED ARRIVAL</small><strong>{experience.eta_minutes} min</strong><span>{experience.distance_miles} miles away</span></div>:null}
   {canWithdraw&&(
    <div className="tracking-withdraw-wrap">
     <button
      type="button"
      className="tracking-withdraw-action"
      onClick={()=>void withdrawRequest()}
      disabled={withdrawing}
     >
      {withdrawing?'Withdrawing…':'Withdraw Request'}
     </button>

     {withdrawError
      ? <div className="tracking-withdraw-error">{withdrawError}</div>
      : null}
    </div>
   )}
  </div>

  <div className="tracking-map-panel">
   <div className="client-live-map" aria-label="Live mission map">
    <MissionMap
     markers={clientMapMarkers}
     activeMissionRoute={activeMissionRoute}
     routeCameraMode="agency"
     showViewerLocation={false}
     zoom={18}
    />
   </div>
   <div className="tracking-mission-card">
    {guard?<div className="tracking-guard"><span><UserRound/></span><div><small>ASSIGNED PROFESSIONAL</small><strong>{guard.name}</strong><em>{experience.agency?.name||'Approved security agency'}{guard.badge_number?` · Badge ${guard.badge_number}`:''}</em></div><CheckCircle2/></div>:<div className="tracking-guard waiting"><span><Shield/></span><div><small>MARKETPLACE ROUTING</small><strong>Locating approved coverage</strong><em>Your request is visible to qualified agencies.</em></div></div>}
    <div className="tracking-metrics"><div><Navigation/><span><small>STATUS</small><b>{labels[state]||state.replaceAll('_',' ')}</b></span></div><div><Clock3/><span><small>UPDATED</small><b>{relativeTime(experience.mission.updated_at||experience.created_at)}</b></span></div></div>
   </div>
  </div>

  <div className="tracking-progress" aria-label="Mission progress">{['Requested','Assigned','En route','On site','Complete'].map((label,index)=>{const thresholds=[0,1,3,4,7];const active=stageIndex>=thresholds[index];return <div className={active?'active':''} key={label}><i>{active?<Check/>:index+1}</i><span>{label}</span></div>})}</div>
  <div className="tracking-timeline"><div className="tracking-section-heading"><span><small>MISSION TIMELINE</small><h3>Updates as they happen</h3></span><b>{experience.timeline.length} events</b></div>{buildTimeline(experience.timeline,state,experience.created_at).map(item=><div className="tracking-event" key={item.key}><i><Check/></i><span><strong>{item.label}</strong><small>{formatTime(item.time)}</small></span></div>)}</div>
 </section>
}

function statusMessage(state:string,name?:string){if(state==='marketplace')return 'Approved agencies are reviewing your request.';if(state==='offered'||state==='awaiting_guard')return 'The agency is confirming the right professional for your property.';if(state==='accepted')return `${name||'Your guard'} is preparing to begin the route.`;if(state==='en_route')return `${name||'Your guard'} is traveling to your property now.`;if(['active','checkpoint'].includes(state))return `${name||'Your guard'} is on site and completing the patrol.`;if(state==='review')return 'The patrol is finished and the agency is verifying the mission record.';if(state==='completed')return 'Coverage is complete. The verified mission record replaces live tracking.';return 'Your security request is progressing.'}
function freshnessLabel(value?:string){return value==='live'?'LIVE GPS':value==='stale'?'GPS DELAYED':value==='expired'?'GPS UNAVAILABLE':'WAITING FOR GPS'}
function relativeTime(value:string|null){if(!value)return 'Just now';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return 'Just now';if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;return `${Math.floor(seconds/3600)} hr ago`}
function formatTime(value:string){return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(value))}
function eventLabel(type:string){const map:Record<string,string>={job_created:'Security requested',agency_claimed:'Agency accepted mission',guard_assigned:'Guard assigned',guard_accepted:'Guard confirmed assignment',route_started:'Guard started route',guard_arrived:'Guard arrived',mission_started:'Patrol started',checkpoint_completed:'Checkpoint completed',mission_completed:'Patrol finished',report_published:'Verified report published'};return map[type]||type.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function buildTimeline(events:TrackingTimelineEvent[],state:string,created:string){const rows=events.map(e=>({key:String(e.id),label:eventLabel(e.event_type),time:e.created_at}));if(!rows.length)rows.push({key:'created',label:'Security requested',time:created});if(state==='marketplace'&&rows.length===1)rows.push({key:'marketplace',label:'Request entered agency marketplace',time:created});return rows.slice(-10).reverse()}
