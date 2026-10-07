import { BarChart3, Bell, CalendarClock, ClipboardList, Crosshair, MessageSquare, Radio, Settings, Shield, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../modules/auth/AuthProvider'
import { acceptMarketplaceJob, getAgencyWorkspace, subscribeToMarketplace, type MarketplaceJobRow } from '../modules/marketplace/marketplaceRepository'
import { getAgencySettings } from '../modules/marketplace/agencySettingsRepository'
import { useAgencyGuardState } from '../modules/marketplace/useAgencyGuardState'
import { assignGuard, assignGuardSlot, getAgencyDispatchWorkspace, getJobStaffing, subscribeToDispatch, type AgencyDispatchWorkspace, type DispatchMission, type JobStaffing } from '../modules/dispatch/dispatchRepository'
import GuardsV4 from './GuardsV4'
import ReportsV4 from './ReportsV4'
import ScheduledV4 from './ScheduledV4'
import OperationsV4 from './OperationsV4'
import MarketplaceV4 from './MarketplaceV4'
import AnalyticsV4 from './AnalyticsV4'
import MessagesV4 from './MessagesV4'
import SettingsV4 from './SettingsV4'
import './design.css'

const items=[['marketplace','Marketplace',Crosshair],['operations','Operations',Radio],['scheduled','Scheduled',CalendarClock],['guards','Guards',Users],['assignments','Assignments',ClipboardList],['reports','Reports',Shield],['analytics','Analytics',BarChart3],['messages','Messages',MessageSquare],['settings','Settings',Settings]] as const
type Page=typeof items[number][0]
const copy:Record<Page,[string,string,string]>={marketplace:['Marketplace','Live coverage exchange','Claim verified work when your team has capacity.'],operations:['Operations','Dispatch command','Staff, launch and follow accepted missions.'],scheduled:['Scheduled','Upcoming coverage','See accepted work before it enters live operations.'],guards:['Guards','Your roster','Invite, verify and manage your field team.'],assignments:['Assignments','Won work','Every accepted marketplace mission in one place.'],reports:['Reports','Mission records','Review completed field work before publication.'],analytics:['Analytics','Agency performance','Capacity, utilization and marketplace performance.'],messages:['Messages','Guard communications','Direct, broadcast and mission-specific communication.'],settings:['Settings','Agency controls','Compliance, company profile and operational preferences.']}

function activeCount(dispatch:AgencyDispatchWorkspace|null){return (dispatch?.missions??[]).filter(m=>!['open','completed','cancelled'].includes(m.status)).length}

export default function AgencyV4(){
  const auth=useAuth(); const [page,setPage]=useState<Page>('marketplace'); const [,title,desc]=copy[page]
  const live=auth.mode==='supabase'&&auth.role==='agency_admin'
  const guards=useAgencyGuardState(live)
  const [agencyName,setAgencyName]=useState('Agency')
  const [jobs,setJobs]=useState<MarketplaceJobRow[]>([])
  const [claimed,setClaimed]=useState<MarketplaceJobRow[]>([])
  const [dispatch,setDispatch]=useState<AgencyDispatchWorkspace|null>(null)
  const [loading,setLoading]=useState(live)
  const [claiming,setClaiming]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const [operationBusy,setOperationBusy]=useState('')
  const [serviceRadius,setServiceRadius]=useState(25)
  const [agencyLogo,setAgencyLogo]=useState<string|null>(null)

  const refresh=async()=>{
    if(!live)return
    try{
      const [workspace,dispatchData,settings]=await Promise.all([getAgencyWorkspace(),getAgencyDispatchWorkspace(),getAgencySettings()])
      setAgencyName(workspace.name); setJobs(workspace.open); setClaimed(workspace.claimed); setDispatch(dispatchData); setServiceRadius(Number(settings.service_radius_miles)||25); setAgencyLogo(settings.logo_url??null); setNotice('')
    }catch(error){setNotice(error instanceof Error?error.message:'Unable to sync agency workspace.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh()},[live])
  useEffect(()=>{if(!live)return;const timer=window.setInterval(()=>void refresh(),5000);const stopMarket=subscribeToMarketplace(()=>void refresh());const stopDispatch=subscribeToDispatch(()=>void refresh());return()=>{window.clearInterval(timer);stopMarket();stopDispatch()}},[live])
  const active=activeCount(dispatch)
  const sorted=useMemo(()=>[...jobs].sort((a,b)=>{const rank={emergency:0,priority:1,standard:2};return rank[a.priority]-rank[b.priority]}),[jobs])
  const claim=async(job:MarketplaceJobRow)=>{if(claiming)return;setClaiming(job.id);try{const result=await acceptMarketplaceJob(job.id);if(!result.accepted)throw new Error(result.reason||'This job is no longer available.');await refresh();setPage('operations')}catch(error){setNotice(error instanceof Error?error.message:'Unable to claim mission.')}finally{setClaiming(null)}}
  const assign=async(jobId:string,guardId:string,slotNumber?:number)=>{if(!guardId||operationBusy)return;const key=`${jobId}:${slotNumber??0}`;setOperationBusy(key);try{if(slotNumber)await assignGuardSlot(jobId,slotNumber,guardId);else await assignGuard(jobId,guardId);await refresh();setNotice('')}catch(error){setNotice(error instanceof Error?error.message:'Unable to assign guard.')}finally{setOperationBusy('')}}

  return <div className="v4-scope"><div className="v4-shell"><aside className="v4-rail"><div className="v4-brand"><div className={`v4-brand-mark ${agencyLogo?'has-logo':''}`}>{agencyLogo?<img src={agencyLogo} alt={`${agencyName} logo`}/>:'CP'}</div><div>CO PILOT<small>SECURITY MARKETPLACE</small></div></div><nav className="v4-nav">{items.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon/>{label}{id==='marketplace'&&jobs.length>0?<b className="v4-nav-count">{jobs.length}</b>:null}</button>)}</nav><div className="v4-rail-foot"><strong>{agencyName}</strong><span>{auth.user?.email??'Agency portal'}</span></div></aside><main className="v4-main"><header className="v4-topbar"><div><h1>{title}</h1><p>{agencyName} · {live?'Live':'Preview'}</p></div><div className="v4-actions"><button className="v4-button" aria-label="Notifications"><Bell size={16}/></button><button className="v4-button primary" onClick={()=>setPage('settings')}>Account</button></div></header><div className="v4-content">{notice&&<div className="v4-notice">{notice}</div>}<section className="v4-hero"><div><div className="v4-eyebrow">{copy[page][0]}</div><h2>{title}</h2><p>{desc}</p></div><span className="v4-system"><i/> {live?'LIVE SYSTEM':'PREVIEW'}</span></section>{page!=='operations'&&page!=='guards'&&page!=='reports'&&page!=='scheduled'&&page!=='analytics'&&page!=='messages'&&page!=='settings'?<section className="v4-grid v4-summary-grid"><div className="v4-card v4-metric"><span>Open jobs</span><strong>{jobs.length}</strong></div><div className="v4-card v4-metric"><span>Active missions</span><strong>{active}</strong></div><div className="v4-card v4-metric"><span>Online guards</span><strong>{guards.summary.online}</strong></div><div className="v4-card v4-metric"><span>Available</span><strong>{guards.summary.available}</strong></div></section>:null}{page==='marketplace'?<MarketplaceV4 jobs={sorted} serviceRadius={serviceRadius} busy={claiming??''} onClaim={async id=>{const job=sorted.find(item=>item.id===id);if(job)await claim(job)}}/>:page==='operations'?<OperationsV4 claimed={claimed} dispatch={dispatch} busy={operationBusy} onAssign={assign}/>:page==='guards'?<GuardsV4 live={live} onNotice={setNotice}/>:page==='reports'?<ReportsV4 live={live} onNotice={setNotice}/>:page==='scheduled'?<ScheduledV4 dispatch={dispatch}/>:page==='analytics'?<AnalyticsV4 claimed={claimed} dispatch={dispatch}/>:page==='messages'?<MessagesV4 live={live} dispatch={dispatch} onNotice={setNotice} onNavigate={p=>setPage(p)}/>:page==='settings'?<SettingsV4 live={live} onNotice={setNotice}/>:<MigrationPanel page={page}/>}</div></main></div><nav className="v4-mobile-nav">{items.slice(0,5).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon/>{label}</button>)}</nav></div>
}

function MigrationPanel({page}:{page:Page}){return <section className="v4-panel"><div className="v4-panel-head"><h3>{copy[page][1]}</h3><span>V4</span></div><div className="v4-empty"><div><strong>{copy[page][0]} redesign queued</strong><span>The existing production engine remains intact while this workspace is migrated into the new shell.</span></div></div></section>}
