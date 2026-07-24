import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, BadgeCheck, BarChart3, Bell, BriefcaseBusiness, Building2,
  CalendarClock, Check, ChevronDown, ChevronRight, CircleDollarSign, Clock3,
  Crosshair, Filter, Flame, Gauge, Layers3, MapPin, MessageSquare, Navigation,
  Radio, Search, Settings, ShieldCheck, Siren, SlidersHorizontal, Users, Wifi, Zap
} from 'lucide-react'

type JobKind = 'standard' | 'priority' | 'emergency'
type Job = { id:number; title:string; client:string; address:string; distance:number; eta:number; duration:number; kind:JobKind; property:string; price:number; x:number; y:number }
type Guard = { id:number; name:string; initials:string; distance:number; status:'available'|'on-mission'|'reserved'|'offline'; x:number; y:number }

const initialJobs:Job[] = [
  {id:101,title:'Immediate Property Check',client:'Riverview Commerce Center',address:'10114 Bloomingdale Ave, Riverview, FL',distance:3.4,eta:9,duration:45,kind:'standard',property:'Retail',price:85,x:18,y:34},
  {id:102,title:'Vacant Home Patrol',client:'South Fork Community',address:'7622 Summerfield Blvd, Riverview, FL',distance:4.7,eta:12,duration:60,kind:'priority',property:'Residential',price:110,x:42,y:35},
  {id:103,title:'Construction Site Sweep',client:'Riverview Build Site',address:'13209 U.S. Hwy 301, Riverview, FL',distance:6.9,eta:16,duration:60,kind:'priority',property:'Construction',price:125,x:32,y:57},
  {id:104,title:'Emergency Alarm Response',client:'Progress Village Plaza',address:'10902 Big Bend Rd, Riverview, FL',distance:1.2,eta:4,duration:30,kind:'emergency',property:'Commercial',price:150,x:74,y:24},
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

const navItems = [
  ['marketplace','Marketplace','Find Opportunities',Crosshair],['operations','Operations','Active Missions',Radio],['scheduled','Scheduled','Upcoming Jobs',CalendarClock],['guards','Guards','Manage Your Team',Users],['clients','Clients','Your Clients',Building2],['reports','Reports','Mission Reports',BriefcaseBusiness],['analytics','Analytics','Performance Center',BarChart3],['messages','Messages','Inbox & Alerts',MessageSquare],['settings','Settings','Agency Settings',Settings],
] as const
type Tab = typeof navItems[number][0]

export default function AgencyMarketplace(){
  const [tab,setTab]=useState<Tab>('marketplace'); const [jobs,setJobs]=useState(initialJobs); const [accepted,setAccepted]=useState<Job[]>([]); const [filter,setFilter]=useState<'all'|JobKind>('all'); const [toast,setToast]=useState('')
  const filtered=useMemo(()=>filter==='all'?jobs:jobs.filter(j=>j.kind===filter),[jobs,filter]); const available=guards.filter(g=>g.status==='available')
  const accept=(job:Job)=>{setJobs(v=>v.filter(j=>j.id!==job.id));setAccepted(v=>[job,...v]);setToast(`${job.title} moved to Operations. Marketplace remains open.`);setTimeout(()=>setToast(''),3200)}
  return <div className="agency-app premium-agency">
    {toast&&<div className="market-toast"><Check/>{toast}</div>}
    <aside className="agency-sidebar premium-sidebar">
      <div className="premium-logo"><ShieldCheck/><div><strong>CO PILOT</strong><span>SECURITY MARKETPLACE</span></div></div>
      <nav>{navItems.map(([id,label,sub,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon/><span><strong>{label}</strong><small>{sub}</small></span>{id==='marketplace'&&<b>{jobs.length}</b>}{id==='operations'&&<b>{accepted.length+2}</b>}{id==='scheduled'&&<b>3</b>}{id==='guards'&&<b>10</b>}{id==='reports'&&<b>1</b>}{id==='messages'&&<b>4</b>}</button>)}</nav>
      <div className="agency-mini-card"><div className="mini-agency"><span>AF</span><div><strong>Alpha Force Security</strong><small><BadgeCheck/>Verified Agency</small></div></div><div className="mini-stats"><span>Total Guards <b>10</b></span><span>Available <b>7</b></span><span>On Mission <b>2</b></span><span>Reserved <b>1</b></span></div></div>
      <div className="sidebar-version">v1.0.0.2 <span><i/>Online</span></div>
    </aside>

    <header className="agency-topbar premium-topbar">
      <div className="page-title"><h1>{tab==='marketplace'?'Marketplace':'Operations'}</h1><p>{tab==='marketplace'?'Find. Compete. Win. Protect.':'Manage active missions without leaving the market.'}</p></div>
      <div className="top-kpis"><Kpi icon={<CircleDollarSign/>} label="OPEN JOBS" value={jobs.length} tone="gold"/><Kpi icon={<Flame/>} label="PRIORITY" value={jobs.filter(j=>j.kind==='priority').length} tone="orange"/><Kpi icon={<Siren/>} label="EMERGENCY" value={jobs.filter(j=>j.kind==='emergency').length} tone="red"/><Kpi icon={<Users/>} label="ACTIVE JOBS" value={accepted.length+2} tone="green"/><Kpi icon={<ShieldCheck/>} label="ONLINE GUARDS" value={9} tone="blue"/></div>
      <div className="top-actions"><button className="icon-button"><Bell/><i>4</i></button><button className="icon-button"><MessageSquare/></button><button className="profile-pill"><span>AF</span><div><strong>Alpha Force Security</strong><small>Agency Admin</small></div><ChevronDown/></button></div>
    </header>

    <main className="agency-main premium-main">
      {tab==='marketplace'?<Marketplace jobs={jobs} filtered={filtered} filter={filter} setFilter={setFilter} accept={accept} available={available}/>:tab==='operations'?<Operations accepted={accepted} onMarketplace={()=>setTab('marketplace')}/>:<Placeholder tab={tab}/>} 
    </main>
  </div>
}

function Kpi({icon,label,value,tone}:{icon:ReactNode,label:string,value:number,tone:string}){return <div className={`top-kpi ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>}

function Marketplace({jobs,filtered,filter,setFilter,accept,available}:{jobs:Job[];filtered:Job[];filter:'all'|JobKind;setFilter:(v:'all'|JobKind)=>void;accept:(j:Job)=>void;available:Guard[]}){
 return <div className="premium-dashboard">
  <section className="live-map-panel premium-panel">
   <div className="premium-panel-head"><div><strong>LIVE MARKETPLACE MAP</strong><span><i/>LIVE</span></div><button><Layers3/>Layers<ChevronDown/></button></div>
   <div className="map-filter-row">{(['all','standard','priority','emergency'] as const).map(v=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{v==='all'?'All':v==='standard'?'Open Jobs':v}</button>)}<button onClick={()=>setFilter('all')}>My Guards</button></div>
   <div className="premium-map"><div className="route-line r1"/><div className="route-line r2"/><div className="route-line r3"/><span className="map-city c1">RIVERVIEW</span><span className="map-city c2">PROGRESS VILLAGE</span><span className="map-city c3">SOUTHSHORE</span>{filtered.map(j=><div key={j.id} className={`premium-job-pin ${j.kind}`} style={{left:`${j.x}%`,top:`${j.y}%`}}>{j.kind==='emergency'?<Siren/>:j.kind==='priority'?<Zap/>:<BriefcaseBusiness/>}<span>{j.distance} mi</span></div>)}{guards.filter(g=>g.status!=='offline').map(g=><div key={g.id} className={`premium-guard-pin ${g.status}`} style={{left:`${g.x}%`,top:`${g.y}%`}}><Users/><span>{g.name}<small>{g.distance} mi</small></span></div>)}<div className="map-zoom"><button>+</button><button>−</button><button><Crosshair/></button></div><div className="map-key"><span><i className="gold"/>Open Job</span><span><i className="orange"/>Priority</span><span><i className="red"/>Emergency</span><span><i className="green"/>My Guards</span></div></div>
  </section>

  <section className="opportunities premium-panel"><div className="premium-panel-head"><div><strong>OPEN OPPORTUNITIES <b>{jobs.length}</b></strong></div><button>Nearest<ChevronDown/></button></div><div className="premium-job-list">{filtered.map(j=><article key={j.id} className={`premium-job-card ${j.kind}`}><div className="job-card-top"><span className={`kind-chip ${j.kind}`}>{j.kind==='emergency'?<Siren/>:j.kind==='priority'?<Zap/>:<BriefcaseBusiness/>}{j.kind==='standard'?'Open Job':j.kind}</span><span>{j.distance} mi<small>ETA {j.eta} min</small></span></div><h3>{j.title}</h3><p>{j.client}<br/>{j.address}</p><div className="job-card-meta"><span><Building2/>{j.property}</span><span><Clock3/>{j.duration} min</span><span><Users/>1 Guard</span></div><div className="job-card-action"><strong>${j.price}</strong><button onClick={()=>accept(j)}>Accept</button></div></article>)}</div></section>

  <aside className="right-rail"><section className="capacity-panel premium-panel"><div className="premium-panel-head"><strong>AGENCY CAPACITY</strong></div><div className="capacity-content"><div className="capacity-ring"><span><strong>7</strong><small>Available</small></span></div><div className="capacity-breakdown"><span>Total Guards <b>10</b></span><span>Available <b>7</b></span><span>On Mission <b>2</b></span><span>Reserved <b>1</b></span><span>Offline <b>0</b></span></div></div></section><section className="active-panel premium-panel"><div className="premium-panel-head"><strong>ACTIVE OPERATIONS <b>2</b></strong><button>View All</button></div>{['Retail Store Patrol','Parking Lot Patrol'].map((t,i)=><div className="mini-operation" key={t}><div><small>#A-10{25+i}</small><span>ON MISSION</span></div><strong>{t}</strong><p>{i?'Riverview Plaza':'South Fork Community'}</p><div className="mission-person"><span>{i?'JL':'MR'}</span><div><strong>{i?'Jalen':'Marcus'}</strong><small>{i?'On Site':'En Route'}</small></div><b>{i?'18':'5'} min</b></div><div className="mission-bar"><i style={{width:i?'20%':'33%'}}/></div></div>)}</section><section className="activity-panel premium-panel"><div className="premium-panel-head"><strong>MARKETPLACE ACTIVITY</strong><span>Live Feed</span></div>{[['11:46 AM','New job posted'],['11:45 AM','Agency accepted'],['11:43 AM','New emergency job']].map((a,i)=><div className="activity-row" key={a[0]}><span className={i===2?'danger':''}>{i===2?<Siren/>:i===1?<Check/>:<BriefcaseBusiness/>}</span><small>{a[0]}</small><div><strong>{a[1]}</strong><p>{i===2?'Progress Village Plaza':'Riverview Commerce Center'}</p></div></div>)}</section></aside>

  <section className="bottom-strip premium-panel"><div className="available-guards"><div className="strip-title"><strong>AVAILABLE GUARDS <b>7</b></strong><button>View All</button></div><div className="guard-row">{available.slice(0,7).map(g=><div className="guard-face" key={g.id}><span>{g.initials}</span><strong>{g.name}</strong><small>{g.distance} mi</small></div>)}</div></div><div className="quick-actions"><div className="strip-title"><strong>QUICK ACTIONS</strong></div><div><button className="em"><Siren/>Emergency Center</button><button><Radio/>Broadcast</button><button><Users/>Guard Check-In</button><button><MessageSquare/>New Message</button></div></div></section>
 </div>
}

function Operations({accepted,onMarketplace}:{accepted:Job[];onMarketplace:()=>void}){const active=[...accepted,{...initialJobs[0],title:'Nightly Retail Patrol'}];return <section className="operations-page"><div className="operations-heading"><div><span className="eyebrow">LIVE OPERATIONS</span><h1>Work won. Teams moving.</h1><p>Manage active assignments while marketplace access stays open.</p></div><button onClick={onMarketplace}><Crosshair/>Return to Marketplace</button></div><div className="operations-capacity-banner"><div><Users/><span><strong>7 guards remain available</strong><small>Your agency can continue accepting marketplace jobs.</small></span></div><button onClick={onMarketplace}>View open jobs<ChevronRight/></button></div><div className="operations-grid">{active.map((j,i)=><article className="operation-card" key={`${j.id}-${i}`}><div className="operation-status"><span className={i===active.length-1?'active':'awaiting'}>{i===active.length-1?'Mission Active':'Awaiting Assignment'}</span><small>JOB #{j.id}</small></div><h3>{j.title}</h3><p><MapPin/>{j.address}</p><div className="operation-progress"><i style={{width:i===active.length-1?'62%':'12%'}}/></div><div className="operation-footer"><div className="guard-avatar">{i===active.length-1?'MR':'—'}</div><div><small>{i===active.length-1?'ASSIGNED GUARD':'NEXT ACTION'}</small><strong>{i===active.length-1?'Marcus Reed':'Assign available guard'}</strong></div><button>{i===active.length-1?'Open Mission':'Assign'}<ChevronRight/></button></div></article>)}</div></section>}
function Placeholder({tab}:{tab:string}){return <section className="market-placeholder"><div><Building2/></div><span className="eyebrow">MARKETPLACE FOUNDATION</span><h1>{tab[0].toUpperCase()+tab.slice(1)}</h1><p>This workspace will connect to the same marketplace, capacity, and operations engine.</p></section>}
