import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Archive, Camera, Bell, Building2, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Home, ImageOff, LoaderCircle, LocateFixed, LogOut, MapPin, Menu, Pencil, Plus, Radio, RefreshCw, Search, Settings, Shield, ShieldAlert, Sparkles, Trash2, Upload, UserRound, X, FileText } from 'lucide-react'
import { useAuth } from './modules/auth/AuthProvider'
import { archiveClientProperty, createClientJob, getClientJobStaffing, subscribeToClientStaffing, createClientProperty, deleteClientProperty, getClientJobEstimate, getClientWorkspace, subscribeToClientWorkspace, updateClientProperty, workspaceErrorMessage, type ClientJob, type ClientPaymentProfile, type ClientProperty, type JobEstimate } from './modules/client/clientRepository'
import { authorizeMaverickJobPayment, deleteMaverickPaymentMethod, getMaverickPaymentConfig, saveMaverickPaymentMethod } from './modules/payments/maverickPaymentRepository'
import { NmiPayments } from '@nmipayments/nmi-pay-react'
import type { DeveloperAccessMode } from './DeveloperPortalSwitcher'
import ClientReports from './ClientReportsCalendar'
import { getClientTrackingExperience, subscribeToClientTracking, type ClientTrackingExperience } from './modules/client/clientLiveTrackingRepository'
import ClientLiveTracking from './ClientLiveTracking'
import { createDeveloperSandboxJob, getDeveloperSandboxJobs } from './modules/developer/developerSandbox'
import { loadGoogleMaps, resolveAddressSuggestion, searchAddressSuggestions, type AddressBias, type AddressSuggestion, type VerifiedAddress } from './modules/location/addressSearch'

type Section = 'overview' | 'properties' | 'request' | 'activity' | 'reports' | 'billing' | 'settings'
type RequestMode = 'immediate' | 'scheduled' | 'vacation'
type Priority = 'standard' | 'priority' | 'emergency'

const previewProperties: ClientProperty[] = [{ id:'preview-property', client_id:'preview-client', name:'Holly Grove Residence', address:'8624 Holly Grove Court, Riverview, FL', street:'8624 Holly Grove Court', city:'Riverview', state:'FL', postal_code:'33569', formatted_address:'8624 Holly Grove Court, Riverview, FL', latitude:27.85, longitude:-82.30, geocoding_provider:'preview', geocoding_place_id:'preview-holly-grove', photo_path:null, photo_url:null, archived_at:null, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }]
const previewJobs: ClientJob[] = [{ id:'preview-job-001', client_id:'preview-client', property_id:'preview-property', title:'Preview Security Patrol', instructions:'Simulation only', priority:'standard', status:'open', scheduled_for:null, duration_minutes:60, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }]

export default function ClientPortal({ developerMode=false, accessMode='live' }: { developerMode?:boolean; accessMode?:DeveloperAccessMode }) {
  const auth = useAuth()
  const isPreview = developerMode && accessMode === 'preview'
  const [section, setSection] = useState<Section>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [properties, setProperties] = useState<ClientProperty[]>([])
  const [jobs, setJobs] = useState<ClientJob[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [paymentProfile,setPaymentProfile]=useState<ClientPaymentProfile|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [propertyOpen, setPropertyOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<ClientProperty | null>(null)
  const [confirmAction, setConfirmAction] = useState<{type:'archive'|'delete';property:ClientProperty}|null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [liveTracking,setLiveTracking]=useState<ClientTrackingExperience>(null)

  const load = useCallback(async () => {
    if (isPreview) { const sandbox=getDeveloperSandboxJobs().map(j=>({id:j.id,client_id:'preview-client',property_id:'preview-property',title:j.title,instructions:'Developer test job — no real payment',priority:j.priority,status:j.state==='open'?'open':j.state,scheduled_for:null,duration_minutes:j.durationMinutes,created_at:j.createdAt,updated_at:j.createdAt} as ClientJob)); setClientId('preview-client'); setPaymentProfile(null); setProperties(previewProperties); setJobs([...sandbox,...previewJobs]); setError(''); setLoading(false); return }
    if (!auth.user) return
    setLoading(true); setError('')
    try {
      const workspace = await getClientWorkspace(auth.user.id)
      setClientId(workspace.clientId)
      setProperties(workspace.properties)
      setJobs(workspace.jobs)
      setPaymentProfile(workspace.paymentProfile)
    } catch (cause) {
      setError(workspaceErrorMessage(cause))
    } finally { setLoading(false) }
  }, [auth.user, isPreview])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (isPreview || !clientId) return
    return subscribeToClientWorkspace(clientId, () => void load())
  }, [clientId, load, isPreview])
  useEffect(()=>{
    if(isPreview||!clientId)return
    const loadTracking=()=>void getClientTrackingExperience().then(setLiveTracking).catch(()=>setLiveTracking(null))
    loadTracking()
    return subscribeToClientTracking(loadTracking)
  },[isPreview,clientId])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(timer) }, [notice])

  const activeJobs = useMemo(() => jobs.filter(job => !['completed','cancelled'].includes(job.status)), [jobs])
  const completedJobs = useMemo(() => jobs.filter(job => job.status === 'completed'), [jobs])
  const selectedProperty = properties[0]

  const latestActiveJob = activeJobs[0]
  const clientCommand = liveTracking
    ? { tone:'live', icon:<Radio/>, eyebrow:'LIVE COVERAGE', title:'Track your active guard', copy:'Your live mission is running now. Open the tracking view for route, status, and report handoff.', action:'Track live coverage', secondary:'Reports', onAction:()=>setSection('activity'), onSecondary:()=>setSection('reports') }
    : latestActiveJob
      ? { tone:'active', icon:<ShieldAlert/>, eyebrow:'REQUEST ACTIVE', title:'Security request in progress', copy:'Stay close to status updates and tracking. The mission card shows property, urgency, and timing.', action:'View activity', secondary:'New request', onAction:()=>setSection('activity'), onSecondary:()=>openRequest() }
      : !properties.length
        ? { tone:'setup', icon:<Building2/>, eyebrow:'START HERE', title:'Add your first property', copy:'Clients need a verified property before requesting coverage. Add the location once, then requests are one tap.', action:'Add property', secondary:'How requests work', onAction:()=>setPropertyOpen(true), onSecondary:()=>setSection('request') }
        : completedJobs.length
          ? { tone:'report', icon:<FileText/>, eyebrow:'READY WORKSPACE', title:'Reports and requests ready', copy:'Your property is ready for new coverage and completed mission reports stay one click away.', action:'Request security', secondary:'View reports', onAction:()=>openRequest(), onSecondary:()=>setSection('reports') }
          : { tone:'ready', icon:<Shield/>, eyebrow:'READY TO REQUEST', title:'Coverage is ready when you need it', copy:'Choose your property, urgency, and duration. Approved agencies can respond through the marketplace.', action:'Request security', secondary:'Manage properties', onAction:()=>openRequest(), onSecondary:()=>setSection('properties') }

  const navigate = (next: Section) => { setSection(next); setMobileNav(false) }
  const openRequest = () => {
    if (!properties.length) { setPropertyOpen(true); setNotice('Add a property before requesting security.'); return }
    if (!isPreview && !paymentProfile?.maverick_customer_vault_id) { setSection('billing'); setNotice('Add a payment method before requesting security.'); return }
    setRequestOpen(true)
  }

  return <div className="client-shell">
    {developerMode && <div className={`client-environment-banner ${isPreview?'preview':'live'}`}><strong>{isPreview?'ADMIN TEST MODE — NO REAL CHARGES':'LIVE PRODUCTION ACCESS'}</strong><span>{isPreview?'Sandbox data only · payment processor disabled':'Authenticated production workspace · real actions possible'}</span></div>}
    {notice && <div className="client-toast"><CheckCircle2/>{notice}</div>}
    <aside className={`client-sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="client-brand"><div className={auth.profile?.avatar_url ? 'has-brand-image' : ''}>{auth.profile?.avatar_url ? <img src={auth.profile.avatar_url} alt="Client branding"/> : <Shield/>}</div><span><b>CO PILOT</b><small>CLIENT COMMAND</small></span></div>
      <nav>
        <NavButton active={section==='overview'} icon={<Home/>} label="Overview" onClick={()=>navigate('overview')}/>
        <NavButton active={section==='properties'} icon={<Building2/>} label="Properties" count={properties.length} onClick={()=>navigate('properties')}/>
        <NavButton active={section==='request'} icon={<ShieldAlert/>} label="Request Security" onClick={()=>{navigate('request'); openRequest()}}/>
        <NavButton active={section==='activity'} icon={<Radio/>} label="Active Requests" count={activeJobs.length} onClick={()=>navigate('activity')}/><NavButton active={section==='reports'} icon={<FileText/>} label="Reports" onClick={()=>navigate('reports')}/><NavButton active={section==='billing'} icon={<Shield/>} label="Billing" onClick={()=>navigate('billing')}/><NavButton active={section==='settings'} icon={<Settings/>} label="Settings" onClick={()=>navigate('settings')}/>
      </nav>
      <div className="client-sidebar-bottom">
        <div className="client-secure"><Shield/><span><b>Secure workspace</b><small>Session protected</small></span></div>
        <button onClick={() => void auth.signOut()}><LogOut/>Log out</button>
      </div>
    </aside>
    {mobileNav && <button className="client-nav-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}

    <main className="client-main">
      <header className="client-topbar">
        <button className="client-menu" onClick={()=>setMobileNav(true)}><Menu/></button>
        <div><span>CLIENT PORTAL</span><h1>{section === 'overview' ? 'Security overview' : section === 'properties' ? 'Your properties' : section === 'activity' ? 'Request activity' : section === 'reports' ? 'Mission reports' : section === 'billing' ? 'Billing & payment' : section === 'settings' ? 'Account settings' : 'Request security'}</h1></div>
        <div className="client-top-actions"><button className="client-icon-button" type="button" onClick={()=>{setSection('activity');setNotice('Active requests and alerts opened.')}} aria-label="Open client alerts"><Bell/></button><div className="client-user"><span className={auth.profile?.avatar_url ? 'has-brand-image' : ''}>{auth.profile?.avatar_url ? <img src={auth.profile.avatar_url} alt="Client branding"/> : initials(auth.profile?.full_name)}</span><div><b>{auth.profile?.full_name || 'Client'}</b><small>Approved account</small></div></div></div>
      </header>

      <div className="client-content">
        {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={load}/> : <>
          {section === 'overview' && <Overview name={auth.profile?.full_name || 'there'} properties={properties} activeJobs={activeJobs} completed={completedJobs.length} onAddProperty={()=>setPropertyOpen(true)} onRequest={openRequest}/>}
          {section === 'properties' && <PropertiesView properties={properties} onAdd={()=>{setEditingProperty(null);setPropertyOpen(true)}} onRequest={openRequest} onEdit={property=>{setEditingProperty(property);setPropertyOpen(true)}} onArchive={property=>setConfirmAction({type:'archive',property})} onDelete={property=>setConfirmAction({type:'delete',property})}/>}
          {section === 'activity' && <ActivityView jobs={jobs} properties={properties} onRequest={openRequest} tracking={liveTracking} onViewReport={()=>setSection('reports')}/>}
          {section === 'reports' && <ClientReports preview={isPreview}/>}
          {section === 'billing' && <BillingView preview={isPreview} paymentProfile={paymentProfile} onSaved={load}/>}
          {section === 'settings' && <ClientSettings preview={isPreview} onNotice={setNotice} onPublished={()=>void auth.refreshProfile()} onDeactivated={()=>void auth.signOut()}/>}
          {section === 'request' && <RequestLanding property={selectedProperty} onRequest={openRequest} onAddProperty={()=>setPropertyOpen(true)}/>}
        </>}
      </div>
      <div className="build-badge">CLIENT LIVE TRACKING · ACCEPTANCE BUILD</div>
    </main>

    {propertyOpen && <PropertyModal preview={isPreview} clientId={clientId} property={editingProperty} onClose={()=>{setPropertyOpen(false);setEditingProperty(null)}} onSaved={async(mode)=>{setPropertyOpen(false);setEditingProperty(null);setNotice(mode==='created'?'Property added successfully.':'Property updated everywhere.');await load()}}/>}
    {confirmAction && <ConfirmPropertyAction action={confirmAction} onClose={()=>setConfirmAction(null)} onConfirmed={async()=>{const action=confirmAction;setConfirmAction(null);try{if(!isPreview){if(action.type==='archive')await archiveClientProperty(action.property.id);else await deleteClientProperty(action.property.id)}setNotice(isPreview?'Preview simulation complete.':action.type==='archive'?'Property archived.':'Property permanently deleted.');await load()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to update property.')}}}/>}
    {requestOpen && clientId && <RequestModal preview={isPreview} clientId={clientId} properties={properties} paymentProfile={paymentProfile} onClose={()=>setRequestOpen(false)} onCreated={async()=>{setRequestOpen(false);setSection('activity');setNotice('Security request submitted.');await load()}}/>}
  </div>
}


function ClientSettings({preview,onNotice,onPublished,onDeactivated}:{preview:boolean;onNotice:(s:string)=>void;onPublished:()=>void;onDeactivated:()=>void}){
  const [account,setAccount]=useState<import('./modules/client/clientRepository').ClientAccountSettings|null>(null),[name,setName]=useState(''),[phone,setPhone]=useState(''),[image,setImage]=useState<string|null>(null),[saved,setSaved]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false)
  const repo=()=>import('./modules/client/clientRepository')
  useEffect(()=>{if(preview){const a={user_id:'preview',full_name:'Client',phone:'',avatar_url:null,account_status:'approved',email:'client@example.com',created_at:new Date().toISOString()};setAccount(a);setName('Client');setSaved(JSON.stringify({name:'Client',phone:'',image:null}));return}void repo().then(r=>r.getClientAccountSettings()).then(a=>{setAccount(a);setName(a.full_name||'');setPhone(a.phone||'');setImage(a.avatar_url);setSaved(JSON.stringify({name:a.full_name||'',phone:a.phone||'',image:a.avatar_url}))}).catch(e=>onNotice(e instanceof Error?e.message:'Account settings unavailable.'))},[preview])
  const dirty=JSON.stringify({name,phone,image})!==saved
  const upload=async(file?:File)=>{if(!file)return;setBusy(true);try{const url=preview?URL.createObjectURL(file):await (await repo()).uploadClientBranding(file);setImage(url);onNotice('Brand image uploaded. Save changes to publish it.')}catch(e){onNotice(e instanceof Error?e.message:'Upload failed.')}finally{setBusy(false)}}
  const save=async()=>{setBusy(true);try{if(!preview){const next=await (await repo()).saveClientAccountSettings({fullName:name,phone,avatarUrl:image});setAccount(next)}setSaved(JSON.stringify({name,phone,image}));onPublished();onNotice('Client account settings saved and branding published.')}catch(e){onNotice(e instanceof Error?e.message:'Unable to save settings.')}finally{setBusy(false)}}
  const deactivate=async()=>{if(confirm!=='DEACTIVATE'||busy)return;if(!window.confirm('Deactivate this client account? Active requests must be completed or cancelled first.'))return;setBusy(true);try{if(!preview)await (await repo()).deactivateClientAccount(confirm);onNotice('Client account deactivated.');onDeactivated()}catch(e){onNotice(e instanceof Error?e.message:'Unable to deactivate account.');setBusy(false)}}
  if(!account)return <div className="client-loading"><RefreshCw/><h2>Loading account settings</h2></div>
  return <section className="client-settings-page"><div className="client-settings-hero"><small>CLIENT SETTINGS</small><h2>Account & branding</h2><p>Manage the identity clients and security partners see across your workspace.</p></div><div className="client-settings-grid"><section className="client-settings-card"><div className="client-settings-title"><UserRound/><div><h3>Profile & branding</h3><p>Use a personal photo or company logo.</p></div></div><div className="client-branding-upload"><div>{image?<img src={image} alt="Client branding"/>:<UserRound/>}</div><span><b>Account image</b><small>JPG, PNG or WebP · maximum 5 MB</small><label><Upload/> Upload photo or logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e.target.files?.[0])}/></label></span></div><label className="client-settings-field">Name or company name<input value={name} onChange={e=>setName(e.target.value)}/></label><label className="client-settings-field">Email<input value={account.email} disabled/></label><label className="client-settings-field">Phone<input value={phone} onChange={e=>setPhone(e.target.value)}/></label><button className="client-settings-save" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Saving…':dirty?'Save changes':'Saved'}</button></section><section className="client-settings-card danger"><div className="client-settings-title"><Trash2/><div><h3>Deactivate account</h3><p>Disable marketplace access without deleting protected mission, billing or report history.</p></div></div><div className="client-deactivate-note"><ShieldAlert/><span>Deactivation is blocked while you have active security requests.</span></div><label className="client-settings-field">Type DEACTIVATE to confirm<input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="DEACTIVATE"/></label><button className="client-deactivate-button" disabled={busy||confirm!=='DEACTIVATE'} onClick={()=>void deactivate()}>Deactivate account</button></section></div></section>
}

type ClientCommand={tone:string;icon:React.ReactNode;eyebrow:string;title:string;copy:string;action:string;secondary:string;onAction:()=>void;onSecondary:()=>void}
function ClientCommandStrip({command}:{command:ClientCommand}){return <section className={`client-command-strip ${command.tone}`}><div className="client-command-icon">{command.icon}</div><div className="client-command-copy"><small>{command.eyebrow}</small><strong>{command.title}</strong><span>{command.copy}</span></div><div className="client-command-actions"><button type="button" className="primary" onClick={command.onAction}>{command.action}<ChevronRight/></button><button type="button" onClick={command.onSecondary}>{command.secondary}</button></div></section>}

function Overview({ name, properties, activeJobs, completed, onAddProperty, onRequest }: { name:string; properties:ClientProperty[]; activeJobs:ClientJob[]; completed:number; onAddProperty:()=>void; onRequest:()=>void }) {
  const latest=activeJobs[0]
  return <div className="client-v3-home">
    <ClientCityMap properties={properties}/>
    <section className="client-v3-sheet">

      <div className="client-v3-handle"/><div className="client-v3-welcome"><div><small>GOOD {new Date().getHours()<12?'MORNING':new Date().getHours()<18?'AFTERNOON':'EVENING'}</small><h2>What do you need protected, {name.split(' ')[0]}?</h2></div><div className="client-v3-avatar">{name.split(/\s+/).map(v=>v[0]).join('').slice(0,2).toUpperCase()}</div></div>
      <div className="client-v3-services">
        <button className="urgent" onClick={onRequest}><span><ShieldAlert/></span><b>Guard now</b><small>On-demand coverage</small><ChevronRight/></button>
        <button onClick={onRequest}><span><CalendarClock/></span><b>Schedule</b><small>Plan coverage ahead</small><ChevronRight/></button>
        <button onClick={onRequest}><span><Home/></span><b>Vacation watch</b><small>Property check-ins</small><ChevronRight/></button>
      </div>
      {latest?<div className="client-v3-live"><div className="client-v3-live-head"><span><Radio/>LIVE REQUEST</span><b>Track coverage <ChevronRight/></b></div><JobCard job={latest} property={properties.find(p=>p.id===latest.property_id)}/></div>:<div className="client-v3-trust"><div><Shield/><span><b>Verified agencies</b><small>Credential-gated marketplace</small></span></div><div><CheckCircle2/><span><b>{completed} missions completed</b><small>Reports stay in your account</small></span></div></div>}
    </section>
  </div>
}
function ClientCityMap({properties}:{properties:ClientProperty[]}){
  const mapRef=useCallback((node:HTMLDivElement|null)=>{if(!node)return;let cancelled=false;void loadGoogleMaps().then(google=>{if(cancelled)return;const valid=properties.filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));const primary=valid[0];const city=(primary?.city||'Tampa').trim();const center=primary?{lat:Number(primary.latitude),lng:Number(primary.longitude)}:{lat:27.9506,lng:-82.4572};const map=new google.maps.Map(node,{center,zoom:11,mapTypeId:google.maps.MapTypeId.ROADMAP,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false,gestureHandling:'greedy',styles:[{featureType:'poi',stylers:[{visibility:'off'}]}]});const geocoder=new google.maps.Geocoder();const fitCity=()=>geocoder.geocode({address:city+', FL, USA'},(results:any[],status:string)=>{if(status==='OK'&&results?.[0]?.geometry?.viewport){map.fitBounds(results[0].geometry.viewport,28);const once=google.maps.event.addListenerOnce(map,'idle',()=>{if((map.getZoom()||0)>12)map.setZoom(12);google.maps.event.removeListener(once)})}else{map.setCenter(center);map.setZoom(11)}});fitCity();valid.forEach(p=>new google.maps.Marker({map,position:{lat:Number(p.latitude),lng:Number(p.longitude)},title:p.name}));}).catch(()=>{});return()=>{cancelled=true}},[properties]);
  return <section className="client-v3-map-hero client-v3-real-map"><div ref={mapRef} className="client-v3-google-map"/><div className="client-v3-map-top"><span><LocateFixed/>Co Pilot network</span><span className="client-v3-city-chip">CITY VIEW</span></div><div className="client-v3-map-status"><span/><b>{properties.length?properties.length+' protected '+(properties.length===1?'property':'properties'):'Security network ready'}</b><small>City-wide coverage view</small></div></section>
}

function PropertiesView({ properties, onAdd, onRequest, onEdit, onArchive, onDelete }: { properties:ClientProperty[]; onAdd:()=>void; onRequest:()=>void; onEdit:(property:ClientProperty)=>void; onArchive:(property:ClientProperty)=>void; onDelete:(property:ClientProperty)=>void }) { return <section className="client-section"><div className="client-section-head"><div><span>PROPERTY DIRECTORY</span><h2>Your protected locations</h2><p>Add, update, archive, or safely remove every coverage location.</p></div><button className="primary" onClick={onAdd}><Plus/>Add property</button></div>{properties.length ? <div className="client-property-grid">{properties.map(property=><article className="client-property-card" key={property.id}><div className="property-visual">{property.photo_url?<img src={property.photo_url} alt={property.name}/>:<Building2/>}<span>READY</span></div><div className="property-copy"><small>PROPERTY</small><h3>{property.name}</h3><p><MapPin/>{property.address}</p><div className="property-primary-action"><button onClick={onRequest}>Request coverage<ChevronRight/></button></div><div className="property-management-actions"><button onClick={()=>onEdit(property)}><Pencil/>Edit</button><button onClick={()=>onArchive(property)}><Archive/>Archive</button><button className="danger" onClick={()=>onDelete(property)}><Trash2/>Delete</button></div></div></article>)}</div> : <EmptyState icon={<Building2/>} title="No properties saved" body="Add your first service location to begin requesting security." action={<button onClick={onAdd}>Add your first property<Plus/></button>}/>}</section> }

function ActivityView({ jobs, properties, onRequest, tracking, onViewReport }: { jobs:ClientJob[]; properties:ClientProperty[]; onRequest:()=>void; tracking:ClientTrackingExperience; onViewReport:()=>void }) { return <section className="client-section"><div className="client-section-head"><div><span>MISSION ACTIVITY</span><h2>Live security coverage</h2><p>One clear view from marketplace request through verified completion.</p></div><button className="primary" onClick={onRequest}><Plus/>New request</button></div>{tracking&&<ClientLiveTracking experience={tracking} onViewReport={onViewReport}/>} {!tracking&&jobs.length ? <div className="client-job-list">{jobs.map(job=><JobCard key={job.id} job={job} property={properties.find(p=>p.id===job.property_id)}/>)}</div> : !tracking ? <EmptyState icon={<Radio/>} title="No requests yet" body="Submit your first request when you need professional coverage." action={<button onClick={onRequest}>Request security<ChevronRight/></button>}/> : null}</section> }

function RequestLanding({ property, onRequest, onAddProperty }: { property?:ClientProperty; onRequest:()=>void; onAddProperty:()=>void }) { return <section className="client-section"><div className="request-landing"><div className="request-pulse"><ShieldAlert/></div><span>MARKETPLACE ROUTING</span><h2>Professional coverage when you need it.</h2><p>Submit the location, timing and urgency. Approved agencies can respond through the marketplace.</p>{property ? <><div className="request-ready"><MapPin/><div><small>READY LOCATION</small><b>{property.name}</b><span>{property.address}</span></div><CheckCircle2/></div><button className="primary large" onClick={onRequest}>Build security request<ChevronRight/></button></> : <button className="primary large" onClick={onAddProperty}>Add a property first<Plus/></button>}</div></section> }

function PropertyModal({ preview=false, clientId, property, onClose, onSaved }: { preview?:boolean; clientId:string|null; property:ClientProperty|null; onClose:()=>void; onSaved:(mode:'created'|'updated')=>void }) {
  const editing=Boolean(property)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [query,setQuery]=useState(property?.formatted_address||property?.address||'')
  const [results,setResults]=useState<AddressSuggestion[]>([])
  const [selected,setSelected]=useState<VerifiedAddress|null>(property?{formattedAddress:property.formatted_address||property.address,street:property.street||'',city:property.city||'',state:property.state||'',postalCode:property.postal_code||'',country:'United States',countryCode:'us',latitude:property.latitude||0,longitude:property.longitude||0,provider:'google',providerId:property.geocoding_place_id||property.id}:null)
  const [searching,setSearching]=useState(false)
  const [searchError,setSearchError]=useState('')
  const [removePhoto,setRemovePhoto]=useState(false)
  const [photoPreview,setPhotoPreview]=useState(property?.photo_url||'')
  const [bias,setBias]=useState<AddressBias>({latitude:27.8661,longitude:-82.3265})

  useEffect(()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(position=>setBias({latitude:position.coords.latitude,longitude:position.coords.longitude}),()=>{}, {enableHighAccuracy:false,timeout:4000,maximumAge:300000})},[])
  useEffect(()=>{if(selected || query.trim().length < 4){setResults([]);setSearching(false);return}const controller=new AbortController();const timer=window.setTimeout(async()=>{setSearching(true);setSearchError('');try{setResults(await searchAddressSuggestions(query,controller.signal,bias))}catch(cause){if(!controller.signal.aborted)setSearchError(cause instanceof Error?cause.message:'Unable to search addresses.')}finally{if(!controller.signal.aborted)setSearching(false)}},350);return()=>{window.clearTimeout(timer);controller.abort()}},[query,selected,bias])
  const choose=async(suggestion:AddressSuggestion)=>{setSearching(true);setSearchError('');try{const address=await resolveAddressSuggestion(suggestion);setSelected(address);setQuery(address.formattedAddress);setResults([])}catch(cause){setSearchError(cause instanceof Error?cause.message:'Unable to verify address.')}finally{setSearching(false)}}
  const changeQuery=(value:string)=>{setQuery(value);setSelected(null)}
  const photoChanged=(file?:File)=>{if(!file)return;setRemovePhoto(false);setPhotoPreview(URL.createObjectURL(file))}
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!clientId||!selected)return;const photo=(event.currentTarget.elements.namedItem('photo') as HTMLInputElement)?.files?.[0]||null;if(!editing&&!photo){setError('Add a clear picture of the property before saving.');return}if(photo&&(!photo.type.startsWith('image/')||photo.size>8*1024*1024)){setError(photo.size>8*1024*1024?'Property photo must be 8 MB or smaller.':'Property photo must be an image file.');return}setBusy(true);setError('');const data=new FormData(event.currentTarget);try{if(preview){await onSaved(property?'updated':'created');return}const common={name:String(data.get('name')),address:selected.formattedAddress,street:selected.street,city:selected.city,state:selected.state,postalCode:selected.postalCode,latitude:selected.latitude,longitude:selected.longitude,provider:selected.provider,providerId:selected.providerId};if(property)await updateClientProperty({...common,propertyId:property.id,photo,removePhoto});else await createClientProperty({...common,clientId,photo:photo!});await onSaved(property?'updated':'created')}catch(cause){setError(cause instanceof Error?cause.message:'Unable to save property.')}finally{setBusy(false)}}
  return <Modal title={editing?'Edit property':'Add property'} eyebrow="VERIFIED COVERAGE LOCATION" onClose={onClose}><form className="client-form client-property-form" onSubmit={submit}>
    <label>Property name<input name="name" required defaultValue={property?.name||''} placeholder="Home, office or site name"/></label>
    <label>Property photo<div className="property-photo-upload">{photoPreview&&!removePhoto?<img src={photoPreview} alt="Property preview"/>:<ImageOff/>}<span><b>{editing?'Replace property picture':'Add a clear property picture'}</b><small>Updates flow to Marketplace, Agency, Guard, and Mission Control.</small></span><input type="file" name="photo" accept="image/*" onChange={event=>photoChanged(event.target.files?.[0])}/></div></label>
    {editing&&property?.photo_url&&<button className="remove-photo-button" type="button" onClick={()=>{setRemovePhoto(true);setPhotoPreview('')}}><ImageOff/>Remove current photo</button>}
    <label className="address-search-label">Property address<div className={`address-search-box ${selected?'verified':''}`}><Search/><input value={query} onChange={event=>changeQuery(event.target.value)} autoComplete="off" required placeholder="Start typing street, city, state or ZIP"/>{searching?<LoaderCircle className="address-spinner"/>:selected?<Check className="address-check"/>:null}</div><small className="address-help">Select the verified result whenever the address changes.</small></label>
    {results.length>0&&<div className="address-results" role="listbox">{results.map(result=><button type="button" key={result.providerId} onClick={()=>void choose(result)}><MapPin/><span><b>{result.primaryText}</b><small>{result.secondaryText}</small></span><ChevronRight/></button>)}</div>}
    {searchError&&<div className="client-form-error"><AlertTriangle/>{searchError}</div>}
    {selected&&<div className="verified-address-card"><div><LocateFixed/></div><span><small>VERIFIED MAP LOCATION</small><b>{selected.formattedAddress}</b><em>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</em></span><CheckCircle2/></div>}
    {error&&<div className="client-form-error"><AlertTriangle/>{error}</div>}
    <div className="client-form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!selected}>{busy?'Saving…':editing?'Save changes':'Save verified property'}</button></div>
  </form></Modal>
}

function ConfirmPropertyAction({action,onClose,onConfirmed}:{action:{type:'archive'|'delete';property:ClientProperty};onClose:()=>void;onConfirmed:()=>void}) {
  const archive=action.type==='archive'
  return <Modal title={archive?'Archive property':'Delete property'} eyebrow="PROPERTY MANAGEMENT" onClose={onClose}><div className="property-confirm"><div className={archive?'archive':'delete'}>{archive?<Archive/>:<Trash2/>}</div><h3>{archive?'Remove this property from active use?':'Permanently delete this property?'}</h3><p>{archive?'The property will disappear from new request selection while all mission history remains protected.':'Permanent deletion is allowed only when the property has no mission history. Properties tied to missions must be archived instead.'}</p><strong>{action.property.name}</strong><span>{action.property.address}</span><div className="client-form-actions"><button onClick={onClose}>Cancel</button><button className={archive?'primary':'danger-confirm'} onClick={onConfirmed}>{archive?'Archive property':'Delete permanently'}</button></div></div></Modal>
}

function BillingView({preview,paymentProfile,onSaved}:{preview:boolean;paymentProfile:ClientPaymentProfile|null;onSaved:()=>void}) {
  const saved=Boolean(paymentProfile?.maverick_customer_vault_id),[publicKey,setPublicKey]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{if(preview){setMessage('Preview mode — live payment services are disabled.');return}void getMaverickPaymentConfig().then(c=>setPublicKey(String(c.publicKey||'').trim())).catch(e=>setMessage(e instanceof Error?e.message:'Payment form unavailable.'))},[preview])
  const save=async()=>{if(preview){setMessage('Preview mode does not save payment methods.');return}if(!token)return;setBusy(true);setMessage('Saving payment method…');try{await saveMaverickPaymentMethod(token);setToken('');setMessage('Payment method saved securely.');await onSaved()}catch(e){setMessage(e instanceof Error?e.message:'Unable to save payment method.')}finally{setBusy(false)}}
  const remove=async()=>{if(preview){setMessage('Preview mode does not remove payment methods.');return}if(!window.confirm('Remove this saved payment method? You will need to add a card before requesting security again.'))return;setBusy(true);setMessage('Removing payment method…');try{await deleteMaverickPaymentMethod();setToken('');setMessage('Payment method removed.');await onSaved()}catch(e){setMessage(e instanceof Error?e.message:'Unable to remove payment method.')}finally{setBusy(false)}}
  return <section className="client-section"><div className="client-panel billing-hero"><span className="client-eyebrow"><Shield/>SECURE BILLING</span><h2>Payment method</h2><p>Add your card once. Future security requests automatically use your saved payment method.</p>{saved&&<div className="billing-saved-card"><div><small>DEFAULT PAYMENT METHOD</small><strong>{paymentProfile?.maverick_payment_brand||'Card'} •••• {paymentProfile?.maverick_payment_last4||'••••'}</strong><span>Stored securely with the processor.</span><button type="button" className="billing-delete-card" disabled={busy} onClick={()=>void remove()}><Trash2/>Remove card</button></div><CheckCircle2/></div>}<div className="billing-card-entry"><div><strong>{saved?'Replace payment method':'Add payment method'}</strong><span>{saved?'Enter a new card to replace the default.':'This becomes your default card for security requests.'}</span></div>{publicKey?<NmiPayments tokenizationKey={publicKey} paymentMethods={['card']} layout="singleLine" appearance={{theme:'dark',layoutSpacing:'compact',textSize:'default',radiusSize:'larger'}} onChange={e=>setToken(e.complete?e.token:'')}/>:<div className="payment-component-loading">Loading secure card form…</div>}<button className="primary" type="button" disabled={!token||busy} onClick={()=>void save()}>{busy?'Saving…':saved?'Replace saved card':'Save card'}</button>{message&&<small>{message}</small>}</div></div></section>
}

function RequestModal({ preview=false, clientId, properties, paymentProfile, onClose, onCreated }: { preview?:boolean; clientId:string; properties:ClientProperty[]; paymentProfile:ClientPaymentProfile|null; onClose:()=>void; onCreated:()=>void }) {
  const [mode,setMode]=useState<RequestMode>('immediate')
  const [priority,setPriority]=useState<Priority>('standard')
  const [serviceType,setServiceType]=useState('unarmed_patrol')
  const [duration,setDuration]=useState('60')
  const [guardCount,setGuardCount]=useState('1')
  const [scheduledFor,setScheduledFor]=useState('')
  const [vacationStart,setVacationStart]=useState('')
  const [vacationEnd,setVacationEnd]=useState('')
  const [vacationChecks,setVacationChecks]=useState('1')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [selectedPropertyId,setSelectedPropertyId]=useState(properties[0]?.id||'')
  const [serverEstimate,setServerEstimate]=useState<JobEstimate|null>(null)
  const [estimateLoading,setEstimateLoading]=useState(false)
  const [estimateError,setEstimateError]=useState('')
  const [estimateKey,setEstimateKey]=useState('')
  const modeHelp:Record<RequestMode,{title:string;copy:string}>={immediate:{title:'Immediate request',copy:'Send this to the marketplace now for live coverage.'},scheduled:{title:'Scheduled coverage',copy:'Choose a specific date and time for planned patrol or site coverage.'},vacation:{title:'Vacation watch',copy:'Use this when the property needs repeated checks while you are away.'}}
  const services=mode==='vacation'?[['mobile_patrol','Vacation property check']]:[['unarmed_patrol','Unarmed guard'],['armed_guard','Armed guard']]
  useEffect(()=>{setPriority('standard');if(mode==='vacation'){setServiceType('mobile_patrol');setDuration('30')}else if(serviceType==='mobile_patrol'){setServiceType('unarmed_patrol');setDuration('60')}},[mode])
  useEffect(()=>{if(!selectedPropertyId&&properties[0]?.id)setSelectedPropertyId(properties[0].id)},[properties,selectedPropertyId])
  const hasProperties=properties.length>0
  const hasSavedCard=Boolean(paymentProfile?.maverick_customer_vault_id)
  const quoteReady=Boolean(selectedPropertyId&&(mode!=='scheduled'||scheduledFor)&&(mode!=='vacation'||(vacationStart&&vacationEnd&&Number(vacationChecks)>=1&&Number(vacationChecks)<=3)))
  const currentEstimateKey=[selectedPropertyId,serviceType,priority,duration,guardCount,mode,scheduledFor,vacationStart,vacationEnd,vacationChecks].join('|')
  const verifiedEstimate=serverEstimate&&estimateKey===currentEstimateKey?serverEstimate:null
  useEffect(()=>{
    if(preview){return}
    if(!quoteReady){setServerEstimate(null);setEstimateKey('');setEstimateError('');setEstimateLoading(false);return}
    let cancelled=false
    const requestKey=currentEstimateKey
    setServerEstimate(null);setEstimateKey('');setEstimateError('');setEstimateLoading(true)
    const timer=window.setTimeout(()=>{
      void getClientJobEstimate({propertyId:selectedPropertyId,serviceType,priority,durationMinutes:Number(duration||60),scheduledFor:mode==='scheduled'&&scheduledFor?scheduledFor:null,requestedStart:mode,vacationStartDate:mode==='vacation'?vacationStart:null,vacationEndDate:mode==='vacation'?vacationEnd:null,vacationChecksPerDay:mode==='vacation'?Number(vacationChecks):null,guardCount:mode==='vacation'?1:Number(guardCount)}).then(estimate=>{if(!cancelled){setServerEstimate(estimate);setEstimateKey(requestKey)}}).catch(cause=>{if(!cancelled){setServerEstimate(null);setEstimateError(workspaceErrorMessage(cause,'Unable to calculate the secure price.'))}}).finally(()=>{if(!cancelled)setEstimateLoading(false)})
    },180)
    return()=>{cancelled=true;window.clearTimeout(timer)}
  },[preview,quoteReady,selectedPropertyId,serviceType,priority,duration,scheduledFor,mode,vacationStart,vacationEnd,vacationChecks,guardCount])
  const estimatedCents=verifiedEstimate?.total_cents||0
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(!hasProperties){setError('Add a verified property before requesting coverage.');return}
    if(!preview&&!hasSavedCard){setError('Add a payment method in Billing before requesting security.');return}
    if(!selectedPropertyId){setError('Choose a property before requesting coverage.');return}
    if(mode==='scheduled'&&!scheduledFor){setError('Choose the scheduled coverage date and time.');return}
    if(mode==='vacation'&&(!vacationStart||!vacationEnd||Number(vacationChecks)<1||Number(vacationChecks)>3)){setError('Choose valid Vacation Watch dates and checks per day.');return}
    if(preview){setBusy(true);setError('');try{const data=new FormData(event.currentTarget);const property=properties.find(p=>p.id===selectedPropertyId)||properties[0];createDeveloperSandboxJob({title:String(data.get('title')||'Test security request'),client:'Admin Test Client',address:property?.address||'Test property',property:property?.name||'Test Property',latitude:property?.latitude??null,longitude:property?.longitude??null,priority,durationMinutes:Number(duration||60),guardCount:mode==='vacation'?1:Number(guardCount),serviceType,requestedStart:mode,estimatedTotalCents:0});await onCreated()}catch(cause){setError(cause instanceof Error?cause.message:'Preview submit failed.')}finally{setBusy(false)};return}
    if(estimateError){setError(estimateError);return}
    if(!quoteReady){setError('Complete the required request details before submitting.');return}
    if(estimateKey!==currentEstimateKey){setError('Wait for the secure server price before submitting.');return}
    if(!verifiedEstimate||estimateLoading){setError('Wait for the secure server price before submitting.');return}
    const quotedEstimate=verifiedEstimate
    const submittedRequestKey=currentEstimateKey
    const data=new FormData(event.currentTarget)
    const requestSnapshot={propertyId:selectedPropertyId,serviceType,priority,durationMinutes:Number(duration||60),scheduledFor:mode==='scheduled'?scheduledFor:null,requestedStart:mode,vacationStartDate:mode==='vacation'?vacationStart:null,vacationEndDate:mode==='vacation'?vacationEnd:null,vacationChecksPerDay:mode==='vacation'?Number(vacationChecks):null,guardCount:mode==='vacation'?1:Number(guardCount)}
    setBusy(true);setError('')
    try{
      if(!quotedEstimate)throw new Error('Secure price verification expired. Please try again.')
      const confirmedEstimate=await getClientJobEstimate(requestSnapshot)
      if(confirmedEstimate.total_cents!==quotedEstimate.total_cents){setServerEstimate(confirmedEstimate);setEstimateKey(submittedRequestKey);setEstimateError('');throw new Error(`The secure price changed to $${Math.round(confirmedEstimate.total_cents/100)}. Review the updated total and submit again.`)}
      const job=await createClientJob({clientId,propertyId:requestSnapshot.propertyId,title:String(data.get('title')),instructions:String(data.get('instructions')),priority:requestSnapshot.priority,scheduledFor:requestSnapshot.scheduledFor,durationMinutes:requestSnapshot.durationMinutes,serviceType:requestSnapshot.serviceType,requestedStart:requestSnapshot.requestedStart,contactPhone:String(data.get('contactPhone')||''),accessNotes:String(data.get('accessNotes')||''),vacationStartDate:requestSnapshot.vacationStartDate,vacationEndDate:requestSnapshot.vacationEndDate,vacationChecksPerDay:requestSnapshot.vacationChecksPerDay,guardCount:requestSnapshot.guardCount})
      const payment=await authorizeMaverickJobPayment({jobId:job.id,useSavedCard:true,action:'auth'})
      if(!payment.approved){setError(payment.message||'Payment authorization declined.');return}
      await onCreated()
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to submit request and authorize payment.')}
    finally{setBusy(false)}
  }
  return <Modal title="Request security" eyebrow="PROFESSIONAL COVERAGE" onClose={onClose} className="client-request-v3"><form className="client-form" onSubmit={submit}><div className="request-mode-grid"><Mode active={mode==='immediate'} icon={<Radio/>} label="Now" onClick={()=>setMode('immediate')}/><Mode active={mode==='scheduled'} icon={<CalendarClock/>} label="Scheduled" onClick={()=>setMode('scheduled')}/><Mode active={mode==='vacation'} icon={<Home/>} label="Vacation" onClick={()=>setMode('vacation')}/></div><div className="client-request-guidance"><CalendarClock/><span><strong>{modeHelp[mode].title}</strong><small>{modeHelp[mode].copy}</small></span></div><label>Property<select name="propertyId" required disabled={!hasProperties} value={selectedPropertyId} onChange={e=>setSelectedPropertyId(e.target.value)}>{!hasProperties&&<option value="">Add a verified property first</option>}{properties.map(p=><option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}</select></label><label>Service type<select value={serviceType} onChange={e=>setServiceType(e.target.value)}>{services.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Request title<input name="title" required defaultValue={serviceType==='armed_guard'?'Armed security request':mode==='vacation'?'Vacation property check':'Security patrol request'} /></label>{mode==='scheduled'&&<label>Scheduled time<input type="datetime-local" name="scheduledFor" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)} required/></label>}{mode==='vacation'&&<div className="vacation-package"><div className="vacation-date-grid"><label>Watch starts<input type="date" value={vacationStart} onChange={e=>setVacationStart(e.target.value)} required/></label><label>Watch ends<input type="date" value={vacationEnd} min={vacationStart||undefined} onChange={e=>setVacationEnd(e.target.value)} required/></label></div><label>Property checks per day<select value={vacationChecks} onChange={e=>setVacationChecks(e.target.value)}><option value="1">1 check per day</option><option value="2">2 checks per day</option><option value="3">3 checks per day</option></select></label><div className="vacation-price-summary"><span><small>DAYS</small><strong>{verifiedEstimate?.vacation_start_date&&verifiedEstimate?.vacation_end_date?Math.floor((new Date(`${verifiedEstimate.vacation_end_date}T12:00:00`).getTime()-new Date(`${verifiedEstimate.vacation_start_date}T12:00:00`).getTime())/86400000)+1:'—'}</strong></span><span><small>TOTAL CHECKS</small><strong>{verifiedEstimate?.vacation_total_visits||'—'}</strong></span><span><small>PER CHECK</small><strong>{verifiedEstimate?.vacation_total_visits?`$${Math.round(verifiedEstimate.total_cents/verifiedEstimate.vacation_total_visits/100)}`:'—'}</strong></span><span><small>PACKAGE TOTAL</small><strong>{verifiedEstimate?`$${Math.round(verifiedEstimate.total_cents/100)}`:!preview&&estimateLoading?'…':'—'}</strong></span></div></div>}{mode!=='vacation'&&<label>Guards needed<select value={guardCount} onChange={e=>setGuardCount(e.target.value)}>{Array.from({length:20},(_,i)=>i+1).map(count=><option key={count} value={count}>{count} guard{count===1?'':'s'}</option>)}</select></label>}{mode!=='vacation'&&<label>Coverage duration<select name="duration" value={duration} onChange={e=>setDuration(e.target.value)}><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>}<label>Best contact phone<input name="contactPhone" type="tel" placeholder="Phone for agency/guard questions"/></label><div className="client-request-guidance"><Shield/><span><strong>{mode==='immediate'?'On-demand pricing':mode==='scheduled'?'Scheduled pricing':'Per-visit pricing'}</strong><small>{mode==='immediate'?'Now coverage includes the on-demand dispatch premium.':mode==='scheduled'?'Planned coverage uses the lower scheduled rate.':'Vacation Watch is billed per completed property check.'}</small></span></div><label>Guard instructions<textarea name="instructions" placeholder="Patrol focus, access notes, contacts, areas to avoid"/></label><label>Access notes<textarea name="accessNotes" placeholder="Gate code, entry point, parking, property manager, lockbox, concierge, etc."/></label><div className="client-payment-box"><div><strong>{!preview&&estimateLoading?'Calculating secure price…':estimatedCents?`$${Math.round(estimatedCents/100)} estimated total`:'Complete request details for price'}</strong><span>{preview?'ADMIN TEST MODE: $0 simulated authorization. Maverick/NMI is never contacted.':verifiedEstimate?'Price verified by Co Pilot server. This amount will be authorized on your default Billing card when you submit.':quoteReady?'Waiting for the server-authoritative price.':'Complete the required request details to calculate the secure price.'}</span></div>{hasSavedCard?<div className="saved-card-row"><CheckCircle2/><span><b>{paymentProfile?.maverick_payment_brand||'Saved card'} ending {paymentProfile?.maverick_payment_last4||'••••'}</b><small>Default payment method from Billing.</small></span></div>:!preview?<div className="client-form-error"><AlertTriangle/>Add a payment method in Billing before requesting security.</div>:null}</div>{!preview&&estimateError&&<div className="client-form-error"><AlertTriangle/>{estimateError}</div>}<div className="client-request-summary"><strong>What happens after submit?</strong><span>Co Pilot authorizes payment, routes this to compliant agencies, then holds agency payout until the mission report is approved.</span></div>{error&&<div className="client-form-error"><AlertTriangle/>{error}</div>}<div className="emergency-note"><ShieldAlert/><span>If you or anyone is in immediate danger, call 911. Co Pilot connects you with private security agencies and is not a replacement for police, fire, or EMS.</span></div><div className="client-form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||(!preview&&estimateLoading)||!hasProperties||!selectedPropertyId||(!preview&&(!hasSavedCard||!quoteReady||!verifiedEstimate||Boolean(estimateError)))}>{busy?'Submitting…':!preview&&estimateLoading?'Calculating price…':hasProperties?(preview?'Preview submit':'Authorize & submit'):'Add property first'}</button></div></form></Modal>
}

function Modal({ title, eyebrow, onClose, children, className='' }: { title:string; eyebrow:string; onClose:()=>void; children:React.ReactNode; className?:string }) { return <div className="client-modal-layer"><button type="button" className="client-modal-scrim" onClick={onClose} aria-label="Close modal"/><section className={`client-modal ${className}`.trim()}><div className="client-modal-head"><div><span>{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={onClose}><X/></button></div>{children}</section></div> }
function Mode({ active,icon,label,onClick }:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}) { return <button type="button" className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span></button> }
function NavButton({active,icon,label,count,onClick}:{active:boolean;icon:React.ReactNode;label:string;count?:number;onClick:()=>void}) { return <button type="button" className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span>{typeof count==='number'&&<small>{count}</small>}</button> }
function Metric({icon,value,label,detail}:{icon:React.ReactNode;value:number;label:string;detail:string}) { return <article className="client-metric"><div>{icon}</div><span><b>{value}</b><strong>{label}</strong><small>{detail}</small></span></article> }
function PropertyRow({property}:{property:ClientProperty}) { return <div className="client-property-row"><div>{property.photo_url?<img src={property.photo_url} alt=""/>:<Building2/>}</div><span><b>{property.name}</b><small><MapPin/>{property.address}</small></span><CheckCircle2/></div> }
function JobCard({job,property}:{job:ClientJob;property?:ClientProperty}) {
  const stage=clientJobStage(job)
  const [staffing,setStaffing]=useState<Awaited<ReturnType<typeof getClientJobStaffing>>|null>(null)
  useEffect(()=>{if((job.required_guards??1)<=1)return;const load=()=>void getClientJobStaffing(job.id).then(setStaffing).catch(()=>{});load();return subscribeToClientStaffing(load)},[job.id,job.required_guards])
  const estimate=job.estimated_total_cents?('$'+Math.round(job.estimated_total_cents/100)):null
  const paymentUnknown=job.payment_status==='authorization_unknown'
  return <article className={`client-job-card priority-${job.priority}`}><div className="job-status-line"><span className={`job-status ${job.status}`}>{stage.label}</span><small>{job.priority==='emergency'?'PRIORITY RESPONSE':job.priority.toUpperCase()}</small></div><h3>{job.title}</h3>{paymentUnknown&&<div className="client-job-stage"><div><small>PAYMENT REVIEW</small><strong>Payment confirmation is pending</strong><span>Do not submit this request again. Co Pilot has blocked a duplicate charge while the processor result is reconciled.</span></div><b>HOLD</b></div>}<p><MapPin/>{property?.name || 'Property'} · {property?.address || 'Location loading'}</p><div className="client-job-stage"><div><small>CURRENT STEP</small><strong>{stage.title}</strong><span>{stage.copy}</span></div><b>{stage.step}</b></div><div className="client-job-track">{stage.steps.map((label,index)=><span key={label} className={index<=stage.active?'active':''}>{label}</span>)}</div>{staffing&&<div className="client-job-stage"><div><small>GUARD STAFFING</small><strong>{staffing.filled_slots}/{staffing.required_guards} guards staffed</strong><span>{staffing.completed_slots?`${staffing.completed_slots} completed · `:''}{staffing.active_slots?`${staffing.active_slots} on site · `:''}{staffing.en_route_slots?`${staffing.en_route_slots} en route · `:''}{staffing.accepted_slots} confirmed</span></div><b>{staffing.completed_slots}/{staffing.required_guards}</b></div>}<div className="job-meta"><span><Clock3/>{job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Requested now'}</span>{estimate&&<span>{estimate} estimate · {job.payout_status?.replaceAll('_',' ')||'payout pending'}</span>}<span>#{job.id.slice(0,8).toUpperCase()}</span></div></article>
}
function clientJobStage(job:ClientJob){
  const status=String(job.status)
  const normalized=status.replace('_',' ')
  const steps=['Requested','Agency','Guard','Live','Report']
  if(status==='open')return {label:normalized,title:'Waiting for agency claim',copy:'Your request is visible to approved agencies. The next update is an agency accepting the mission.',step:'1/5',active:0,steps}
  if(['accepted','assigned','offered'].includes(status))return {label:normalized,title:'Agency accepted — guard assignment next',copy:'An agency owns this request now. The next update is guard assignment and confirmation.',step:'2/5',active:1,steps}
  if(status==='en_route')return {label:'guard en route',title:'Guard is on the way',copy:'Live tracking is active. Watch ETA, route, and destination progress from Activity.',step:'3/5',active:2,steps}
  if(['arrived','active'].includes(status))return {label:normalized,title:'Guard is on site',copy:'Coverage is in progress. The report becomes available after completion and agency review.',step:'4/5',active:3,steps}
  if(['review','completed'].includes(status))return {label:normalized,title:'Report stage',copy:'The mission is finished. Review the completed security report when it is published.',step:'5/5',active:4,steps}
  if(status==='cancelled')return {label:'cancelled',title:'Request cancelled',copy:'This mission is no longer active. Create a new request when coverage is needed again.',step:'—',active:0,steps}
  return {label:normalized,title:'Request updating',copy:'The marketplace is syncing this request. Watch this card for the next status update.',step:'—',active:0,steps}
}
function EmptyState({icon,title,body,action}:{icon:React.ReactNode;title:string;body:string;action:React.ReactNode}) { return <div className="client-empty"><div>{icon}</div><h4>{title}</h4><p>{body}</p>{action}</div> }
function LoadingState(){return <div className="client-loading"><RefreshCw/><h2>Loading secure workspace</h2><p>Syncing your properties and requests…</p></div>}
function ErrorState({message,retry}:{message:string;retry:()=>void}){return <div className="client-loading error"><AlertTriangle/><h2>Workspace unavailable</h2><p>{message}</p><button onClick={retry}><RefreshCw/>Retry</button></div>}
function initials(name:string|null|undefined){return (name||'CP').split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()}
