import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Archive, Camera, Bell, Building2, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Home, ImageOff, LoaderCircle, LocateFixed, LogOut, MapPin, Menu, Pencil, Plus, Radio, RefreshCw, Search, Shield, ShieldAlert, Sparkles, Trash2, X, FileText } from 'lucide-react'
import { useAuth } from './modules/auth/AuthProvider'
import { archiveClientProperty, createClientJob, createClientProperty, deleteClientProperty, getClientWorkspace, subscribeToClientWorkspace, updateClientProperty, workspaceErrorMessage, type ClientJob, type ClientProperty } from './modules/client/clientRepository'
import type { DeveloperAccessMode } from './DeveloperPortalSwitcher'
import ClientReports from './ClientReports'
import { getClientTrackingExperience, subscribeToClientTracking, type ClientTrackingExperience } from './modules/client/clientLiveTrackingRepository'
import ClientLiveTracking from './ClientLiveTracking'
import { resolveAddressSuggestion, searchAddressSuggestions, type AddressBias, type AddressSuggestion, type VerifiedAddress } from './modules/location/addressSearch'

type Section = 'overview' | 'properties' | 'request' | 'activity' | 'reports'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [propertyOpen, setPropertyOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<ClientProperty | null>(null)
  const [confirmAction, setConfirmAction] = useState<{type:'archive'|'delete';property:ClientProperty}|null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [liveTracking,setLiveTracking]=useState<ClientTrackingExperience>(null)

  const load = useCallback(async () => {
    if (isPreview) { setClientId('preview-client'); setProperties(previewProperties); setJobs(previewJobs); setError(''); setLoading(false); return }
    if (!auth.user) return
    setLoading(true); setError('')
    try {
      const workspace = await getClientWorkspace(auth.user.id)
      setClientId(workspace.clientId)
      setProperties(workspace.properties)
      setJobs(workspace.jobs)
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

  const navigate = (next: Section) => { setSection(next); setMobileNav(false) }
  const openRequest = () => {
    if (!properties.length) { setPropertyOpen(true); setNotice('Add a property before requesting security.'); return }
    setRequestOpen(true)
  }

  return <div className="client-shell">
    {developerMode && <div className={`client-environment-banner ${isPreview?'preview':'live'}`}><strong>{isPreview?'PREVIEW DATA':'LIVE TEST'}</strong><span>{isPreview?'Simulation only · no Supabase writes':'Authenticated Supabase workspace'}</span></div>}
    {notice && <div className="client-toast"><CheckCircle2/>{notice}</div>}
    <aside className={`client-sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="client-brand"><div><Shield/></div><span><b>CO PILOT</b><small>CLIENT COMMAND</small></span></div>
      <nav>
        <NavButton active={section==='overview'} icon={<Home/>} label="Overview" onClick={()=>navigate('overview')}/>
        <NavButton active={section==='properties'} icon={<Building2/>} label="Properties" count={properties.length} onClick={()=>navigate('properties')}/>
        <NavButton active={section==='request'} icon={<ShieldAlert/>} label="Request Security" onClick={()=>{navigate('request'); openRequest()}}/>
        <NavButton active={section==='activity'} icon={<Radio/>} label="Active Requests" count={activeJobs.length} onClick={()=>navigate('activity')}/><NavButton active={section==='reports'} icon={<FileText/>} label="Reports" onClick={()=>navigate('reports')}/>
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
        <div><span>CLIENT PORTAL</span><h1>{section === 'overview' ? 'Security overview' : section === 'properties' ? 'Your properties' : section === 'activity' ? 'Request activity' : section === 'reports' ? 'Mission reports' : 'Request security'}</h1></div>
        <div className="client-top-actions"><button className="client-icon-button"><Bell/></button><div className="client-user"><span>{initials(auth.profile?.full_name)}</span><div><b>{auth.profile?.full_name || 'Client'}</b><small>Approved account</small></div></div></div>
      </header>

      <div className="client-content">
        {loading ? <LoadingState/> : error ? <ErrorState message={error} retry={load}/> : <>
          {section === 'overview' && <Overview name={auth.profile?.full_name || 'there'} properties={properties} activeJobs={activeJobs} completed={completedJobs.length} onAddProperty={()=>setPropertyOpen(true)} onRequest={openRequest}/>} 
          {section === 'properties' && <PropertiesView properties={properties} onAdd={()=>{setEditingProperty(null);setPropertyOpen(true)}} onRequest={openRequest} onEdit={property=>{setEditingProperty(property);setPropertyOpen(true)}} onArchive={property=>setConfirmAction({type:'archive',property})} onDelete={property=>setConfirmAction({type:'delete',property})}/>} 
          {section === 'activity' && <ActivityView jobs={jobs} properties={properties} onRequest={openRequest} tracking={liveTracking} onViewReport={()=>setSection('reports')}/>} 
          {section === 'reports' && <ClientReports preview={isPreview}/>} 
          {section === 'request' && <RequestLanding property={selectedProperty} onRequest={openRequest} onAddProperty={()=>setPropertyOpen(true)}/>} 
        </>}
      </div>
      <div className="build-badge">CLIENT LIVE TRACKING · ACCEPTANCE BUILD</div>
    </main>

    {propertyOpen && <PropertyModal preview={isPreview} clientId={clientId} property={editingProperty} onClose={()=>{setPropertyOpen(false);setEditingProperty(null)}} onSaved={async(mode)=>{setPropertyOpen(false);setEditingProperty(null);setNotice(mode==='created'?'Property added successfully.':'Property updated everywhere.');await load()}}/>}
    {confirmAction && <ConfirmPropertyAction action={confirmAction} onClose={()=>setConfirmAction(null)} onConfirmed={async()=>{const action=confirmAction;setConfirmAction(null);try{if(!isPreview){if(action.type==='archive')await archiveClientProperty(action.property.id);else await deleteClientProperty(action.property.id)}setNotice(isPreview?'Preview simulation complete.':action.type==='archive'?'Property archived.':'Property permanently deleted.');await load()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to update property.')}}}/>} 
    {requestOpen && clientId && <RequestModal preview={isPreview} clientId={clientId} properties={properties} onClose={()=>setRequestOpen(false)} onCreated={async()=>{setRequestOpen(false);setSection('activity');setNotice('Security request submitted.');await load()}}/>}
  </div>
}

function Overview({ name, properties, activeJobs, completed, onAddProperty, onRequest }: { name:string; properties:ClientProperty[]; activeJobs:ClientJob[]; completed:number; onAddProperty:()=>void; onRequest:()=>void }) {
  const latest = activeJobs[0]
  return <>
    <section className="client-hero"><div><span className="client-eyebrow"><Sparkles/>SECURITY, ON DEMAND</span><h2>Good day, {name.split(' ')[0]}.</h2><p>Your properties, requests and live security activity are controlled from one protected workspace.</p><div className="client-hero-actions"><button className="primary" onClick={onRequest}><ShieldAlert/>Request security</button><button onClick={onAddProperty}><Plus/>Add property</button></div></div><div className="client-network-orb"><span/><Shield/><small>NETWORK READY</small></div></section>
    <section className="client-metrics">
      <Metric icon={<Building2/>} value={properties.length} label="Protected properties" detail={properties.length ? 'Ready for requests' : 'Add your first property'}/>
      <Metric icon={<Radio/>} value={activeJobs.length} label="Active requests" detail={activeJobs.length ? 'Coverage in progress' : 'No active missions'}/>
      <Metric icon={<CheckCircle2/>} value={completed} label="Completed missions" detail="Verified history"/>
    </section>
    <section className="client-grid-two">
      <div className="client-panel"><div className="client-panel-head"><div><span>LIVE ACTIVITY</span><h3>Current coverage</h3></div><Radio/></div>{latest ? <JobCard job={latest} property={properties.find(p=>p.id===latest.property_id)}/> : <EmptyState icon={<Shield/>} title="No active coverage" body="Your next security request will appear here with live status updates." action={<button onClick={onRequest}>Create request<ChevronRight/></button>}/>}</div>
      <div className="client-panel"><div className="client-panel-head"><div><span>PROPERTIES</span><h3>Coverage locations</h3></div><Building2/></div>{properties.length ? <div className="client-property-list">{properties.slice(0,3).map(property=><PropertyRow key={property.id} property={property}/>)}</div> : <EmptyState icon={<MapPin/>} title="Add your first property" body="Save a home, business or site before requesting coverage." action={<button onClick={onAddProperty}>Add property<Plus/></button>}/>}</div>
    </section>
  </>
}

function PropertiesView({ properties, onAdd, onRequest, onEdit, onArchive, onDelete }: { properties:ClientProperty[]; onAdd:()=>void; onRequest:()=>void; onEdit:(property:ClientProperty)=>void; onArchive:(property:ClientProperty)=>void; onDelete:(property:ClientProperty)=>void }) { return <section className="client-section"><div className="client-section-head"><div><span>PROPERTY DIRECTORY</span><h2>Your protected locations</h2><p>Add, update, archive, or safely remove every coverage location.</p></div><button className="primary" onClick={onAdd}><Plus/>Add property</button></div>{properties.length ? <div className="client-property-grid">{properties.map(property=><article className="client-property-card" key={property.id}><div className="property-visual">{property.photo_url?<img src={property.photo_url} alt={property.name}/>:<Building2/>}<span>READY</span></div><div className="property-copy"><small>PROPERTY</small><h3>{property.name}</h3><p><MapPin/>{property.address}</p><div className="property-primary-action"><button onClick={onRequest}>Request coverage<ChevronRight/></button></div><div className="property-management-actions"><button onClick={()=>onEdit(property)}><Pencil/>Edit</button><button onClick={()=>onArchive(property)}><Archive/>Archive</button><button className="danger" onClick={()=>onDelete(property)}><Trash2/>Delete</button></div></div></article>)}</div> : <EmptyState icon={<Building2/>} title="No properties saved" body="Add your first service location to begin requesting security." action={<button onClick={onAdd}>Add your first property<Plus/></button>}/>}</section> }

function ActivityView({ jobs, properties, onRequest, tracking, onViewReport }: { jobs:ClientJob[]; properties:ClientProperty[]; onRequest:()=>void; tracking:ClientTrackingExperience; onViewReport:()=>void }) { return <section className="client-section"><div className="client-section-head"><div><span>MISSION ACTIVITY</span><h2>Live security coverage</h2><p>One clear view from marketplace request through verified completion.</p></div><button className="primary" onClick={onRequest}><Plus/>New request</button></div>{tracking&&<ClientLiveTracking experience={tracking} onViewReport={onViewReport}/>} {!tracking&&jobs.length ? <div className="client-job-list">{jobs.map(job=><JobCard key={job.id} job={job} property={properties.find(p=>p.id===job.property_id)}/>)}</div> : !tracking ? <EmptyState icon={<Radio/>} title="No requests yet" body="Submit your first request when you need professional coverage." action={<button onClick={onRequest}>Request security<ChevronRight/></button>}/> : null}</section> }

function RequestLanding({ property, onRequest, onAddProperty }: { property?:ClientProperty; onRequest:()=>void; onAddProperty:()=>void }) { return <section className="client-section"><div className="request-landing"><div className="request-pulse"><ShieldAlert/></div><span>MARKETPLACE DISPATCH</span><h2>Professional coverage when you need it.</h2><p>Submit the location, timing and urgency. Approved agencies can respond through the marketplace.</p>{property ? <><div className="request-ready"><MapPin/><div><small>READY LOCATION</small><b>{property.name}</b><span>{property.address}</span></div><CheckCircle2/></div><button className="primary large" onClick={onRequest}>Build security request<ChevronRight/></button></> : <button className="primary large" onClick={onAddProperty}>Add a property first<Plus/></button>}</div></section> }

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
  return <Modal title={editing?'Edit property':'Add property'} eyebrow="VERIFIED COVERAGE LOCATION" onClose={onClose}><form className="client-form" onSubmit={submit}>
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

function RequestModal({ preview=false, clientId, properties, onClose, onCreated }: { preview?:boolean; clientId:string; properties:ClientProperty[]; onClose:()=>void; onCreated:()=>void }) {
  const [mode,setMode]=useState<RequestMode>('immediate'); const [priority,setPriority]=useState<Priority>('standard'); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setBusy(true);setError('');const data=new FormData(event.currentTarget);try{if(!preview)await createClientJob({clientId,propertyId:String(data.get('propertyId')),title:String(data.get('title')),instructions:String(data.get('instructions')),priority,scheduledFor:mode==='scheduled'?String(data.get('scheduledFor')):null,durationMinutes:Number(data.get('duration')||60)});await onCreated()}catch(cause){setError(cause instanceof Error?cause.message:'Unable to submit request.')}finally{setBusy(false)}}
  return <Modal title="Request security" eyebrow="MARKETPLACE DISPATCH" onClose={onClose}><form className="client-form" onSubmit={submit}><div className="request-mode-grid"><Mode active={mode==='immediate'} icon={<Radio/>} label="Immediate" onClick={()=>setMode('immediate')}/><Mode active={mode==='scheduled'} icon={<CalendarClock/>} label="Scheduled" onClick={()=>setMode('scheduled')}/><Mode active={mode==='vacation'} icon={<Home/>} label="Vacation" onClick={()=>setMode('vacation')}/></div><label>Property<select name="propertyId" required>{properties.map(p=><option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}</select></label><label>Request title<input name="title" required defaultValue={mode==='vacation'?'Vacation property check':'Security patrol request'} /></label>{mode==='scheduled'&&<label>Scheduled time<input type="datetime-local" name="scheduledFor" required/></label>}<label>Expected duration<select name="duration" defaultValue="60"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option></select></label><div><span className="form-label">Priority</span><div className="priority-grid"><button type="button" className={priority==='standard'?'active':''} onClick={()=>setPriority('standard')}>Standard</button><button type="button" className={priority==='priority'?'active priority':''} onClick={()=>setPriority('priority')}>Priority</button><button type="button" className={priority==='emergency'?'active emergency':''} onClick={()=>setPriority('emergency')}>Emergency</button></div></div><label>Instructions<textarea name="instructions" placeholder="Access notes, patrol focus, contacts or special instructions"/></label>{error&&<div className="client-form-error"><AlertTriangle/>{error}</div>}<div className="emergency-note"><ShieldAlert/><span>Emergency requests are marketplace priority requests—not a replacement for 911.</span></div><div className="client-form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Submitting…':'Submit request'}</button></div></form></Modal>
}

function Modal({ title, eyebrow, onClose, children }: { title:string; eyebrow:string; onClose:()=>void; children:React.ReactNode }) { return <div className="client-modal-layer"><button className="client-modal-scrim" onClick={onClose}/><section className="client-modal"><div className="client-modal-head"><div><span>{eyebrow}</span><h2>{title}</h2></div><button onClick={onClose}><X/></button></div>{children}</section></div> }
function Mode({ active,icon,label,onClick }:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}) { return <button type="button" className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span></button> }
function NavButton({active,icon,label,count,onClick}:{active:boolean;icon:React.ReactNode;label:string;count?:number;onClick:()=>void}) { return <button className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span>{typeof count==='number'&&<small>{count}</small>}</button> }
function Metric({icon,value,label,detail}:{icon:React.ReactNode;value:number;label:string;detail:string}) { return <article className="client-metric"><div>{icon}</div><span><b>{value}</b><strong>{label}</strong><small>{detail}</small></span></article> }
function PropertyRow({property}:{property:ClientProperty}) { return <div className="client-property-row"><div>{property.photo_url?<img src={property.photo_url} alt=""/>:<Building2/>}</div><span><b>{property.name}</b><small><MapPin/>{property.address}</small></span><CheckCircle2/></div> }
function JobCard({job,property}:{job:ClientJob;property?:ClientProperty}) { return <article className={`client-job-card priority-${job.priority}`}><div className="job-status-line"><span className={`job-status ${job.status}`}>{job.status.replace('_',' ')}</span><small>{job.priority.toUpperCase()}</small></div><h3>{job.title}</h3><p><MapPin/>{property?.name || 'Property'} · {property?.address || 'Location loading'}</p><div className="job-meta"><span><Clock3/>{job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Requested now'}</span><span>#{job.id.slice(0,8).toUpperCase()}</span></div></article> }
function EmptyState({icon,title,body,action}:{icon:React.ReactNode;title:string;body:string;action:React.ReactNode}) { return <div className="client-empty"><div>{icon}</div><h4>{title}</h4><p>{body}</p>{action}</div> }
function LoadingState(){return <div className="client-loading"><RefreshCw/><h2>Loading secure workspace</h2><p>Syncing your properties and requests…</p></div>}
function ErrorState({message,retry}:{message:string;retry:()=>void}){return <div className="client-loading error"><AlertTriangle/><h2>Workspace unavailable</h2><p>{message}</p><button onClick={retry}><RefreshCw/>Retry</button></div>}
function initials(name:string|null|undefined){return (name||'CP').split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()}
