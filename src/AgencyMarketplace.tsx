import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle, BadgeCheck, BriefcaseBusiness, Building2, CalendarClock, Check,
  ChevronRight, CircleDollarSign, Clock3, Crosshair, MapPin, Navigation,
  Radio, ShieldCheck, Siren, SlidersHorizontal, Users, Wifi, Zap
} from 'lucide-react'

type JobKind = 'standard' | 'priority' | 'emergency'
type Job = {
  id: number
  title: string
  client: string
  address: string
  distance: number
  eta: number
  duration: number
  kind: JobKind
  property: string
  requirements: string[]
  x: number
  y: number
}

type Guard = {
  id: number
  name: string
  initials: string
  distance: number
  status: 'available' | 'on-mission' | 'reserved' | 'offline'
  x: number
  y: number
}

const initialJobs: Job[] = [
  { id: 101, title: 'Immediate Property Check', client: 'Riverview Commerce Center', address: '10114 Bloomingdale Ave', distance: 2.4, eta: 7, duration: 45, kind: 'priority', property: 'Retail Center', requirements: ['Armed optional', 'Photo proof'], x: 68, y: 29 },
  { id: 102, title: 'Vacant Home Patrol', client: 'Holly Grove Residences', address: '8624 Holly Grove Ct', distance: 4.8, eta: 12, duration: 30, kind: 'standard', property: 'Residential', requirements: ['Exterior patrol'], x: 29, y: 38 },
  { id: 103, title: 'Emergency Alarm Response', client: 'Brandon Medical Plaza', address: '2020 W Brandon Blvd', distance: 6.1, eta: 15, duration: 60, kind: 'emergency', property: 'Medical Office', requirements: ['Immediate response', 'Incident report'], x: 77, y: 65 },
  { id: 104, title: 'Closing Escort', client: 'South Shore Pharmacy', address: '11230 US Hwy 301', distance: 3.6, eta: 10, duration: 25, kind: 'standard', property: 'Retail', requirements: ['Scheduled 10:30 PM'], x: 43, y: 72 },
  { id: 105, title: 'Construction Site Sweep', client: 'Bayline Development', address: '7402 Progress Blvd', distance: 7.2, eta: 18, duration: 75, kind: 'priority', property: 'Construction', requirements: ['Flashlight', 'Video proof'], x: 17, y: 67 },
]

const guards: Guard[] = [
  { id: 1, name: 'Marcus Reed', initials: 'MR', distance: 1.8, status: 'available', x: 55, y: 47 },
  { id: 2, name: 'Tasha Greene', initials: 'TG', distance: 3.1, status: 'available', x: 36, y: 57 },
  { id: 3, name: 'Derrick Lane', initials: 'DL', distance: 4.6, status: 'on-mission', x: 64, y: 76 },
  { id: 4, name: 'Nia Brooks', initials: 'NB', distance: 5.4, status: 'reserved', x: 22, y: 24 },
  { id: 5, name: 'Caleb Stone', initials: 'CS', distance: 6.2, status: 'available', x: 83, y: 44 },
  { id: 6, name: 'Andre King', initials: 'AK', distance: 7.7, status: 'offline', x: 12, y: 49 },
  { id: 7, name: 'Maya Fields', initials: 'MF', distance: 8.1, status: 'available', x: 72, y: 18 },
  { id: 8, name: 'Luis Grant', initials: 'LG', distance: 9.3, status: 'available', x: 49, y: 20 },
  { id: 9, name: 'Jamal Price', initials: 'JP', distance: 10.4, status: 'available', x: 88, y: 72 },
  { id: 10, name: 'Alicia Moore', initials: 'AM', distance: 11.2, status: 'offline', x: 31, y: 84 },
]

const tabs = [
  ['marketplace', 'Marketplace'], ['operations', 'Operations'], ['scheduled', 'Scheduled'],
  ['reports', 'Reports'], ['guards', 'Guards']
] as const

type Tab = typeof tabs[number][0]

export default function AgencyMarketplace() {
  const [tab, setTab] = useState<Tab>('marketplace')
  const [jobs, setJobs] = useState(initialJobs)
  const [acceptedJobs, setAcceptedJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(initialJobs[0])
  const [filter, setFilter] = useState<'all' | JobKind>('all')
  const [toast, setToast] = useState('')

  const availableGuards = guards.filter(g => g.status === 'available')
  const activeCount = guards.filter(g => g.status === 'on-mission').length + acceptedJobs.length
  const filteredJobs = useMemo(() => filter === 'all' ? jobs : jobs.filter(job => job.kind === filter), [filter, jobs])

  const acceptJob = (job: Job) => {
    if (!availableGuards.length) return
    setJobs(current => current.filter(item => item.id !== job.id))
    setAcceptedJobs(current => [{ ...job }, ...current])
    setSelectedJob(null)
    setToast(`${job.title} secured. Marketplace access remains active.`)
    window.setTimeout(() => setToast(''), 3200)
  }

  const kindLabel = (kind: JobKind) => kind === 'emergency' ? 'Emergency' : kind === 'priority' ? 'Priority' : 'Open Job'

  return <div className="agency-app">
    {toast && <div className="market-toast"><Check />{toast}</div>}
    <header className="agency-topbar">
      <div className="agency-brand">
        <div className="agency-logo"><ShieldCheck /></div>
        <div><strong>Sentinel Protective Services</strong><span><BadgeCheck /> Verified Marketplace Agency</span></div>
      </div>
      <div className="agency-live"><span className="live-dot" />Marketplace Live</div>
      <button className="agency-profile">AF</button>
    </header>

    <aside className="agency-sidebar">
      <div className="sidebar-title">CO PILOT <span>SECURITY</span></div>
      <nav>
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          {id === 'marketplace' && <Crosshair />}{id === 'operations' && <Radio />}{id === 'scheduled' && <CalendarClock />}{id === 'reports' && <BriefcaseBusiness />}{id === 'guards' && <Users />}
          <span>{label}</span>
          {id === 'marketplace' && <b>{jobs.length}</b>}
          {id === 'operations' && <b>{acceptedJobs.length + 1}</b>}
        </button>)}
      </nav>
      <div className="capacity-card">
        <div className="capacity-card-head"><span>Guard Capacity</span><Wifi /></div>
        <strong>{availableGuards.length} available</strong>
        <div className="capacity-bar"><i style={{width: `${availableGuards.length / guards.length * 100}%`}} /></div>
        <small>{guards.length} total · {activeCount} active · 1 reserved</small>
      </div>
    </aside>

    <main className="agency-main">
      {tab === 'marketplace' && <>
        <section className="market-heading">
          <div><span className="eyebrow">AGENCY MARKETPLACE</span><h1>Find the next assignment.</h1><p>Open opportunities remain available while your active teams work.</p></div>
          <div className="market-metrics">
            <Metric icon={<BriefcaseBusiness />} value={jobs.length} label="Open jobs" />
            <Metric icon={<Users />} value={availableGuards.length} label="Available guards" />
            <Metric icon={<Navigation />} value="7 min" label="Best ETA" />
          </div>
        </section>

        <section className="market-layout">
          <div className="market-map-card">
            <div className="map-toolbar">
              <div className="filter-pills">
                {(['all','standard','priority','emergency'] as const).map(item => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'Everything' : item}</button>)}
              </div>
              <button className="map-filter"><SlidersHorizontal /></button>
            </div>
            <div className="market-map">
              <div className="road road-a"/><div className="road road-b"/><div className="road road-c"/><div className="road road-d"/>
              <span className="district d1">RIVERVIEW</span><span className="district d2">BRANDON</span><span className="district d3">PROGRESS VILLAGE</span>
              {filteredJobs.map(job => <button key={job.id} style={{left:`${job.x}%`,top:`${job.y}%`}} onClick={() => setSelectedJob(job)} className={`job-pin ${job.kind} ${selectedJob?.id === job.id ? 'selected' : ''}`}>
                {job.kind === 'emergency' ? <Siren/> : job.kind === 'priority' ? <Zap/> : <MapPin/>}<span>{job.distance} mi</span>
              </button>)}
              {guards.filter(g => g.status !== 'offline').map(guard => <div key={guard.id} style={{left:`${guard.x}%`,top:`${guard.y}%`}} className={`guard-pin ${guard.status}`} title={`${guard.name} · ${guard.status}`}><span>{guard.initials}</span></div>)}
              <div className="map-legend"><span><i className="legend-job"/>Open job</span><span><i className="legend-priority"/>Priority</span><span><i className="legend-emergency"/>Emergency</span><span><i className="legend-guard"/>Your guards</span></div>
            </div>
          </div>

          <aside className="opportunity-panel">
            <div className="panel-head"><div><span>LIVE OPPORTUNITIES</span><strong>{filteredJobs.length} nearby jobs</strong></div><Radio /></div>
            <div className="opportunity-list">
              {filteredJobs.map(job => <button key={job.id} onClick={() => setSelectedJob(job)} className={`opportunity-card ${job.kind} ${selectedJob?.id === job.id ? 'selected' : ''}`}>
                <div className="opportunity-top"><span className={`kind-chip ${job.kind}`}>{job.kind === 'emergency' && <Siren/>}{job.kind === 'priority' && <Zap/>}{kindLabel(job.kind)}</span><small>{job.distance} mi</small></div>
                <strong>{job.title}</strong><span>{job.client}</span>
                <div className="opportunity-meta"><span><Clock3/>{job.duration} min</span><span><Navigation/>{job.eta} min ETA</span></div>
              </button>)}
            </div>
          </aside>
        </section>

        {selectedJob && <section className={`job-drawer ${selectedJob.kind}`}>
          <div className="drawer-accent" />
          <div className="drawer-primary">
            <span className={`kind-chip ${selectedJob.kind}`}>{selectedJob.kind === 'emergency' && <Siren/>}{selectedJob.kind === 'priority' && <Zap/>}{kindLabel(selectedJob.kind)}</span>
            <h2>{selectedJob.title}</h2><p><MapPin />{selectedJob.address}</p>
          </div>
          <div className="drawer-facts">
            <div><small>PROPERTY</small><strong>{selectedJob.property}</strong></div>
            <div><small>DISTANCE</small><strong>{selectedJob.distance} miles</strong></div>
            <div><small>EST. ARRIVAL</small><strong>{selectedJob.eta} minutes</strong></div>
            <div><small>DURATION</small><strong>{selectedJob.duration} minutes</strong></div>
          </div>
          <div className="capacity-match">
            <div className="match-icon"><Users /></div>
            <div><small>CAPACITY MATCH</small><strong>{availableGuards.length} guards available</strong><span>Closest: {availableGuards[0]?.name} · {availableGuards[0]?.distance} mi</span></div>
          </div>
          <button className={`accept-job ${selectedJob.kind}`} onClick={() => acceptJob(selectedJob)}>{selectedJob.kind === 'emergency' ? 'Accept Emergency' : 'Accept Job'}<ChevronRight /></button>
        </section>}
      </>}

      {tab === 'operations' && <Operations acceptedJobs={acceptedJobs} onMarketplace={() => setTab('marketplace')} />}
      {tab !== 'marketplace' && tab !== 'operations' && <Placeholder tab={tab} />}
    </main>
  </div>
}

function Metric({icon,value,label}:{icon:ReactNode,value:string|number,label:string}) {
  return <div className="market-metric"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function Operations({acceptedJobs,onMarketplace}:{acceptedJobs:Job[],onMarketplace:()=>void}) {
  const active = [{...initialJobs[1], title:'Nightly Perimeter Patrol', client:'Harbor Point Apartments'}, ...acceptedJobs]
  return <section className="operations-page">
    <div className="operations-heading"><div><span className="eyebrow">LIVE OPERATIONS</span><h1>Work won. Teams moving.</h1><p>Manage assignments without leaving new opportunities behind.</p></div><button onClick={onMarketplace}><Crosshair/>Return to Marketplace</button></div>
    <div className="operations-capacity-banner"><div><Users/><span><strong>{guards.filter(g=>g.status==='available').length} guards remain available</strong><small>Your agency can continue accepting marketplace jobs.</small></span></div><button onClick={onMarketplace}>View {initialJobs.length-acceptedJobs.length} open jobs<ChevronRight/></button></div>
    <div className="operations-grid">
      {active.map((job,index)=><article className="operation-card" key={`${job.id}-${index}`}>
        <div className="operation-status"><span className={index===0?'active':'awaiting'}>{index===0?'Mission Active':'Awaiting Assignment'}</span><small>JOB #{job.id}</small></div>
        <h3>{job.title}</h3><p><MapPin/>{job.address}</p>
        <div className="operation-progress"><i style={{width:index===0?'62%':'12%'}}/></div>
        <div className="operation-footer"><div className="guard-avatar">{index===0?'DL':'—'}</div><div><small>{index===0?'ASSIGNED GUARD':'NEXT ACTION'}</small><strong>{index===0?'Derrick Lane':'Assign available guard'}</strong></div><button>{index===0?'Open Mission':'Assign'}<ChevronRight/></button></div>
      </article>)}
    </div>
  </section>
}

function Placeholder({tab}:{tab:string}) {
  return <section className="market-placeholder"><div><Building2/></div><span className="eyebrow">COMING NEXT</span><h1>{tab.charAt(0).toUpperCase()+tab.slice(1)}</h1><p>This workspace will plug into the same marketplace capacity and operations engine.</p></section>
}
