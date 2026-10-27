import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Code2, LogOut, ShieldCheck, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import { publishMyMissionReport, publishGuardMissionReport } from './modules/reporting/reportingRepository'
import { uploadMissionPhoto, uploadMissionVideo } from './modules/mission/missionEvidenceRepository'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import { timelineEngine } from './modules/timeline/TimelineEngine'
import AgencyV4 from './v4/AgencyV4'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { getGuardDispatchWorkspace, getGuardOperationalMetrics, getGuardPresence, setGuardPresence, subscribeToDispatch, transitionGuardMission, transitionGuardSlotMission, getGuardSlotRuntime, type DispatchMission, type GuardOperationalMetrics } from './modules/dispatch/dispatchRepository'
import { getMissionRuntime, subscribeToMissionRuntime } from './modules/mission-runtime/missionRuntimeRepository'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'
import { AuthGateway } from './modules/auth/AuthGateway'
import ClientPortal from './ClientPortal'
import OwnerV4 from './v4/OwnerV4'
import { DeveloperPortalSwitcher, getStoredDeveloperPreview, type DeveloperAccessMode, type DeveloperPreview } from './DeveloperPortalSwitcher'
import { startGuardLocationPublisher } from './modules/location/liveLocationRepository'
import {startNativeGuardBackgroundLocation} from './mobile/nativeBackgroundLocation'
import {consumeStoredNativePushAction,currentNativeCoordinates,registerNativePush,storeNativePushAction,type NativePushAction} from './mobile/nativePlatform'
import {mobileTarget,roleAllowedForMobile} from './mobile/mobileTarget'
import {persistNativePushToken} from './mobile/pushTokenRepository'
import { getDeveloperLiveAccounts,setDeveloperGuardPresence,getDeveloperGuardWorkspace,getDeveloperGuardOperationalMetrics,getDeveloperGuardSlotRuntime, transitionDeveloperGuardMission,type DeveloperLiveAccounts } from './modules/developer/developerLiveRepository'
import EarthFlightLab from './EarthFlightLab'

const cleanPath = window.location.pathname.replace(/\/+$/, '')
const developerPath = cleanPath === '/developer'
const earthFlightLabPath = cleanPath === '/earth-flight-lab'

export default function App() {
  console.info('[ROUTE-PROBE] App build route-probe-20261009-0320', window.location.pathname)
  if (earthFlightLabPath) return <EarthFlightLab />
  return <AuthProvider><AuthGateway><AppShell /></AuthGateway></AuthProvider>
}

function AppShell() {
  const auth = useAuth()
  const nativeTarget=mobileTarget()
  useEffect(()=>{
    if(!nativeTarget||auth.phase!=='ready'||!auth.user||!roleAllowedForMobile(auth.role))return
    let cleanup:(()=>Promise<void>)|null=null
    let cancelled=false
    void registerNativePush(registration=>{if(!cancelled)void persistNativePushToken(registration,nativeTarget).catch(error=>console.warn('Native push token persistence failed',error))},action=>{if(!cancelled)storeNativePushAction(action,nativeTarget)}).then(fn=>{
      if(cancelled){if(fn)void fn();return}
      cleanup=fn
    }).catch(error=>console.warn('Native push registration unavailable',error))
    return()=>{cancelled=true;if(cleanup)void cleanup()}
  },[nativeTarget,auth.phase,auth.user?.id,auth.role])
  if(nativeTarget&&!roleAllowedForMobile(auth.role)) return <PortalPlaceholder title="Wrong account type" body={nativeTarget==='guard'?'CO PILOT GUARD requires an approved Guard account.':'CO PILOT SECURITY requires an approved Client account.'} onLogout={()=>void auth.signOut()}/>
  const [developerMode, setDeveloperMode] = useState(() => developerPath || localStorage.getItem('co-pilot-developer-mode') === 'true')
  const [developerAccessMode, setDeveloperAccessMode] = useState<DeveloperAccessMode>('preview')
  const [previewRole, setPreviewRole] = useState<DeveloperPreview>(() => getStoredDeveloperPreview(auth.role ?? 'client'))
  const [developerAccounts,setDeveloperAccounts]=useState<DeveloperLiveAccounts|null>(null)
  const [developerTargets,setDeveloperTargets]=useState(()=>({client:localStorage.getItem('co-pilot-dev-client')||'',agency:localStorage.getItem('co-pilot-dev-agency')||'',guard:localStorage.getItem('co-pilot-dev-guard')||''}))

  useEffect(() => {
    if (auth.role && auth.role !== 'platform_admin' && developerMode) { localStorage.removeItem('co-pilot-developer-mode'); setDeveloperMode(false); window.history.replaceState(null, '', '/'); return }
    if (!auth.role || developerMode) return
    setPreviewRole(auth.role)
  }, [auth.role, developerMode])

  const enableDeveloperMode = () => {
    if (auth.role !== 'platform_admin') return
    localStorage.setItem('co-pilot-developer-mode', 'true')
    setPreviewRole(auth.role ?? 'client')
    setDeveloperMode(true)
    window.history.replaceState(null, '', '/developer')
  }

  const exitDeveloperMode = () => {
    localStorage.removeItem('co-pilot-developer-mode')
    localStorage.removeItem('co-pilot-developer-preview-role')
    setDeveloperMode(false)
    if (auth.role) setPreviewRole(auth.role)
    window.history.replaceState(null, '', '/')
  }

  const adminDeveloperMode = developerMode && auth.role === 'platform_admin'
  useEffect(()=>{if(!adminDeveloperMode)return;void getDeveloperLiveAccounts().then(accounts=>{setDeveloperAccounts(accounts);setDeveloperTargets(current=>{const client=accounts.clients.some(a=>a.id===current.client)?current.client:(accounts.clients[0]?.id||'');const agency=accounts.agencies.some(a=>a.id===current.agency)?current.agency:(accounts.agencies[0]?.id||'');const guard=accounts.guards.some(a=>a.id===current.guard)?current.guard:(accounts.guards[0]?.id||'');if(client)localStorage.setItem('co-pilot-dev-client',client);if(agency)localStorage.setItem('co-pilot-dev-agency',agency);if(guard)localStorage.setItem('co-pilot-dev-guard',guard);return{client,agency,guard}})}).catch(()=>setDeveloperAccounts(null))},[adminDeveloperMode])
  const changeDeveloperTarget=(kind:'client'|'agency'|'guard',id:string)=>{setDeveloperTargets(current=>({...current,[kind]:id}));localStorage.setItem(`co-pilot-dev-${kind}`,id)}
  const activeRole: DeveloperPreview = adminDeveloperMode && developerAccessMode === 'preview' ? previewRole : (auth.role ?? 'client')
  const activeDeveloperTarget=activeRole==='client'?developerTargets.client:activeRole==='agency_admin'?developerTargets.agency:activeRole==='guard'?developerTargets.guard:''
  const portalKey = `${developerAccessMode}:${activeRole}:${activeDeveloperTarget}:${auth.user?.id ?? 'anonymous'}`
  const showDeveloperDock = auth.role === 'platform_admin'

  return <div className={adminDeveloperMode ? 'developer-preview-active' : ''} data-route-probe="APP-SHELL-20261009-0320">
    {adminDeveloperMode && <DeveloperPortalSwitcher value={previewRole} actualRole={auth.role} accessMode={developerAccessMode} onAccessModeChange={setDeveloperAccessMode} onChange={setPreviewRole} onExit={exitDeveloperMode} onSignOut={() => void auth.signOut()} accounts={developerAccounts} targets={developerTargets} onTargetChange={changeDeveloperTarget} />}
    <div key={portalKey} className="portal-runtime-boundary">
      {activeRole === 'guard_lab' ? <ExperienceLab /> :
        activeRole === 'guard' ? <GuardApp developerMode={adminDeveloperMode} accessMode={developerAccessMode} developerGuardId={adminDeveloperMode&&developerAccessMode==='preview'?developerTargets.guard:undefined} onEnableDeveloperMode={enableDeveloperMode} /> :
        activeRole === 'agency_admin' ? <AgencyV4 preview={adminDeveloperMode && developerAccessMode === 'preview'} developerAgencyId={adminDeveloperMode&&developerAccessMode==='preview'?developerTargets.agency:undefined} /> :
        activeRole === 'platform_admin' ? <OwnerV4 /> :
        <ClientPortal developerMode={adminDeveloperMode} accessMode={developerAccessMode} developerClientId={adminDeveloperMode&&developerAccessMode==='preview'?developerTargets.client:undefined} />}
    </div>
    {!adminDeveloperMode && showDeveloperDock && <div className="portal-session-dock"><button onClick={enableDeveloperMode}><Code2/><span>Developer Mode</span></button><button className="portal-signout" onClick={() => void auth.signOut()}><LogOut/><span>Sign Out</span></button></div>}
  </div>
}

function PortalPlaceholder({ title, body, onLogout }: { title: string; body: string; onLogout: () => void }) {
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button></div></div>
}

function GuardApp({
  developerMode,
  accessMode,
  onEnableDeveloperMode,
  developerGuardId,
}: {
  developerMode: boolean
  accessMode: DeveloperAccessMode
  developerGuardId?: string
  onEnableDeveloperMode: () => void
}) {
  const auth = useAuth()
  const { mission, actions, setEvidence, setIncidents } = useMissionEngine()
  const [notice, setNotice] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [dispatchMission, setDispatchMission] = useState<DispatchMission | null>(null)
  const [nativePushJobId,setNativePushJobId]=useState<string|null>(null)
  useEffect(()=>{
    if(mobileTarget()!=='guard')return
    const open=(action:NativePushAction|null)=>{if(action?.jobId)setNativePushJobId(action.jobId)}
    open(consumeStoredNativePushAction('guard'))
    const onAction=(event:Event)=>open((event as CustomEvent<NativePushAction>).detail)
    window.addEventListener('co-pilot-native-push-action',onAction)
    return()=>window.removeEventListener('co-pilot-native-push-action',onAction)
  },[])
  const [guardMetrics, setGuardMetrics] = useState<GuardOperationalMetrics | null>(null)
  const [missionRuntime, setMissionRuntime] = useState<MissionRuntime | null>(null)
  const [developerGuardState, setDeveloperGuardState] = useState<typeof mission.state | null>(null)

  const canReadLiveDispatch =
    auth.mode === 'supabase' &&
    auth.role === 'guard'

  const isDeveloperPreview =
    developerMode &&
    accessMode === 'preview'

  const liveDispatch =
    canReadLiveDispatch &&
    !isDeveloperPreview

  useEffect(()=>{if(!isDeveloperPreview||!developerGuardId)return;let cancelled=false;const sync=()=>void Promise.all([getDeveloperGuardWorkspace(developerGuardId),getDeveloperGuardOperationalMetrics(developerGuardId)]).then(async ([workspace,metrics])=>{if(cancelled)return;setGuardMetrics(metrics);const online=workspace.guard.availability!=='offline';const assignment=workspace.assignment??null;setDispatchMission(assignment);let runtime:MissionRuntime|null=null;if(assignment){if(assignment.multi_guard_slot){const slot=await getDeveloperGuardSlotRuntime(developerGuardId,assignment.job_id);runtime=slot?{jobId:assignment.job_id,assignmentId:assignment.assignment_id,state:slot.state,version:slot.version,checkpointIndex:slot.checkpoint_index,evidence:slot.evidence,incidents:slot.incidents,missionStartedAt:slot.mission_started_at,priority:assignment.priority,title:assignment.title,instructions:assignment.instructions,client:{id:assignment.job_id,name:assignment.client.display_name},agency:{id:assignment.agency_id,name:'Assigned agency'},guard:assignment.guard?{id:assignment.guard.id,name:assignment.guard.name,badgeNumber:assignment.guard.badge_number,availability:assignment.guard.availability}:null,property:{id:assignment.job_id,name:assignment.property.name,address:assignment.property.address,latitude:assignment.property.latitude,longitude:assignment.property.longitude,photoUrl:assignment.property.photo_url},guardLocation:null,timestamps:{createdAt:assignment.assigned_at,assignedAt:assignment.assigned_at,acceptedAt:assignment.accepted_at,routeStartedAt:slot.route_started_at,arrivedAt:slot.arrived_at,completedAt:slot.completed_at,updatedAt:slot.updated_at},timeline:[]}:null}else runtime=await getMissionRuntime(assignment.job_id);if(cancelled)return;setMissionRuntime(runtime)}else setMissionRuntime(null);const hydratedState:typeof mission.state=assignment?(runtime?.state==='accepted'?'enroute':runtime?.state==='en_route'?'arrived':runtime?.state==='active'||runtime?.state==='checkpoint'?'patrol':runtime?.state==='review'?'proof':runtime?.state==='completed'?'completed':'assignment'):(online?'waiting':'offline');setDeveloperGuardState(hydratedState)}).catch(error=>{if(!cancelled)setNotice(error instanceof Error?error.message:'Unable to load real guard state')});sync();const timer=window.setInterval(sync,3000);return()=>{cancelled=true;window.clearInterval(timer)}},[isDeveloperPreview,developerGuardId])


  const displayedMissionState =
    isDeveloperPreview
      ? (developerGuardState ?? 'waiting')
      : mission.state

  const displayedMissionRuntime = useMemo<MissionRuntime | null>(() => {
    const baseRuntime=missionRuntime
    if (!baseRuntime) return null
    if (!isDeveloperPreview || !developerGuardState) return baseRuntime

    if (developerGuardState === 'enroute') {
      return {
        ...baseRuntime,
        state: 'en_route',
      }
    }

    if (developerGuardState === 'assignment') {
      return {
        ...baseRuntime,
        state: 'offered',
      }
    }

    if (developerGuardState === 'arrived') {
      return {
        ...baseRuntime,
        state: 'active',
      }
    }

    return missionRuntime
  }, [
    missionRuntime,
    isDeveloperPreview,
    developerGuardState,
  ])

  const authoritativeRuntime = (isDeveloperPreview || liveDispatch) ? missionRuntime : null
  const effectiveCheckpoint = authoritativeRuntime?.checkpointIndex ?? mission.checkpoint
  const effectiveEvidence = authoritativeRuntime?.evidence ?? mission.patrolEvidence
  const effectiveIncidents = authoritativeRuntime?.incidents ?? mission.incidents
  const effectiveMissionStartedAt = authoritativeRuntime?.missionStartedAt
    ? new Date(authoritativeRuntime.missionStartedAt).getTime()
    : mission.missionStartedAt

  const refreshDeveloperRuntime = async () => {
    if (!isDeveloperPreview || !dispatchMission) return null
    const runtime = dispatchMission.multi_guard_slot && developerGuardId ? await getDeveloperGuardSlotRuntime(developerGuardId,dispatchMission.job_id).then(slot=>slot?{...missionRuntime!,state:slot.state,version:slot.version,checkpointIndex:slot.checkpoint_index,evidence:slot.evidence,incidents:slot.incidents,missionStartedAt:slot.mission_started_at,timestamps:{...missionRuntime!.timestamps,routeStartedAt:slot.route_started_at,arrivedAt:slot.arrived_at,completedAt:slot.completed_at,updatedAt:slot.updated_at}}:missionRuntime) : await getMissionRuntime(dispatchMission.job_id)
    setMissionRuntime(runtime)
    return runtime
  }

  const loadDispatch = useCallback(async () => {
    if (!canReadLiveDispatch) return
    // Completed missions remain pinned until the guard explicitly returns online.
    // Realtime/polling refreshes must never dismiss an unpublished report screen.
    if (mission.state === 'completed' && dispatchMission?.job_id) return

    try {
      const [workspace, operationalMetrics] = await Promise.all([
        getGuardDispatchWorkspace(),
        getGuardOperationalMetrics(),
      ])

      setGuardMetrics(operationalMetrics)

      const assignment = workspace.assignment

      // A completed assignment can disappear from the active dispatch workspace before
      // the guard has reviewed/published the report. Keep the completed mission snapshot
      // mounted until the guard explicitly chooses RETURN ONLINE. This prevents the
      // 3-second dispatch refresh from stranding an unpublished report.
      if (!assignment && mission.state === 'completed' && dispatchMission?.job_id && missionRuntime?.state === 'completed') {
        return
      }

      setDispatchMission(assignment)

      if (!assignment) {
        setMissionRuntime(null)

        const presence = await getGuardPresence()

        actions.hydrateLiveState(
          presence.availability === 'offline' ? 'offline' : 'waiting'
        )

        timelineEngine.hydrateMissionEvents(
          workspace.events ?? [],
          presence.availability === 'offline' ? 'offline' : 'waiting'
        )

        return
      }

      const slotRuntime = assignment.multi_guard_slot ? await getGuardSlotRuntime(assignment.job_id) : null
      const runtime: MissionRuntime | null = assignment.multi_guard_slot
        ? slotRuntime ? {
            jobId:assignment.job_id, assignmentId:assignment.assignment_id, state:slotRuntime.state, version:slotRuntime.version,
            checkpointIndex:slotRuntime.checkpoint_index, evidence:slotRuntime.evidence, incidents:slotRuntime.incidents, missionStartedAt:slotRuntime.mission_started_at,
            priority:assignment.priority,title:assignment.title,instructions:assignment.instructions,
            client:{id:assignment.job_id,name:assignment.client.display_name},agency:{id:assignment.agency_id,name:'Assigned agency'},
            guard:assignment.guard?{id:assignment.guard.id,name:assignment.guard.name,badgeNumber:assignment.guard.badge_number,availability:assignment.guard.availability}:null,
            property:{id:assignment.job_id,name:assignment.property.name,address:assignment.property.address,latitude:assignment.property.latitude,longitude:assignment.property.longitude,photoUrl:assignment.property.photo_url},guardLocation:null,
            timestamps:{createdAt:assignment.assigned_at,assignedAt:assignment.assigned_at,acceptedAt:assignment.accepted_at,routeStartedAt:slotRuntime.route_started_at,arrivedAt:slotRuntime.arrived_at,completedAt:slotRuntime.completed_at,updatedAt:slotRuntime.updated_at},timeline:[]
          } : null
        : await getMissionRuntime(assignment.job_id)
      if (!runtime) { actions.hydrateLiveState('assignment'); return }
      setMissionRuntime(runtime)

      const startedAt = runtime.missionStartedAt
        ? new Date(runtime.missionStartedAt).getTime()
        : runtime.timestamps.acceptedAt
          ? new Date(runtime.timestamps.acceptedAt).getTime()
          : null

      switch (runtime.state) {
        case 'awaiting_guard':
          actions.hydrateLiveState('assignment')
          break

        case 'offered':
          actions.hydrateLiveState('assignment')
          break

        case 'accepted':
          actions.hydrateLiveState('enroute', startedAt)
          break

        case 'en_route':
          actions.hydrateLiveState('arrived', startedAt)
          break

        case 'active':
          actions.hydrateLiveState(
            'patrol',
            startedAt,
            runtime.checkpointIndex,
            runtime.evidence,
            runtime.incidents
          )
          break

        case 'checkpoint':
          actions.hydrateLiveState(
            'patrol',
            startedAt,
            runtime.checkpointIndex,
            runtime.evidence,
            runtime.incidents
          )
          break

        case 'review':
          actions.hydrateLiveState(
            'proof',
            startedAt,
            6,
            runtime.evidence,
            runtime.incidents
          )
          break

        case 'completed':
          actions.hydrateLiveState(
            'completed',
            startedAt,
            6,
            runtime.evidence,
            runtime.incidents,
            runtime.timestamps.completedAt
              ? new Date(runtime.timestamps.completedAt).getTime()
              : null
          )
          break

        case 'cancelled':
          actions.hydrateLiveState('waiting')
          break
      }

      timelineEngine.hydrateMissionEvents(
        workspace.events ?? [],
        runtime.state
      )
    } catch (error) {
      console.error('[GuardApp] load runtime failed', error)

      setNotice(
        error instanceof Error
          ? error.message
          : 'Unable to load mission.'
      )
    }
  }, [canReadLiveDispatch, actions, mission.state, dispatchMission?.job_id, missionRuntime?.state])

  useEffect(() => {
    if (canReadLiveDispatch) void loadDispatch()
  }, [canReadLiveDispatch, loadDispatch])

  // Listen even while the Guard is idle. Assignment events happen before a
  // mission exists, so mission-only subscriptions cannot discover new offers.
  useEffect(() => {
    if (!canReadLiveDispatch) return
    const stop = subscribeToDispatch(() => void loadDispatch())
    const timer = window.setInterval(() => void loadDispatch(), 3000)
    return () => { stop(); window.clearInterval(timer) }
  }, [canReadLiveDispatch, loadDispatch])
  useEffect(()=>{
    if(!nativePushJobId||!canReadLiveDispatch)return
    if(nativePushJobId===dispatchMission?.job_id){void loadDispatch();setNativePushJobId(null);return}
    void loadDispatch()
  },[nativePushJobId,canReadLiveDispatch,dispatchMission?.job_id,loadDispatch])

  useEffect(() => {
    if (!canReadLiveDispatch || !dispatchMission?.job_id) return

    return subscribeToMissionRuntime(
      dispatchMission.job_id,
      () => void loadDispatch()
    )
  }, [canReadLiveDispatch, dispatchMission?.job_id, loadDispatch])


  useEffect(() => {
    const locationEnabled =
      liveDispatch &&
      mission.state !== 'offline' &&
      mission.state !== 'completed'

    const input={
      enabled:Boolean(locationEnabled),
      jobId:dispatchMission?.job_id??null,
      onError:(message:string)=>setNotice(
        message.toLowerCase().includes('denied')
          ? 'Location permission is required for live operations.'
          : message
      ),
    }

    if(mobileTarget()==='guard'){
      let cleanup:(()=>void)|null=null
      let cancelled=false
      void startNativeGuardBackgroundLocation(input).then(fn=>{
        if(cancelled)fn()
        else cleanup=fn
      }).catch(error=>input.onError(error instanceof Error?error.message:'Unable to start background location'))
      return()=>{cancelled=true;cleanup?.()}
    }

    return startGuardLocationPublisher(input)
  }, [liveDispatch, mission.state, dispatchMission?.job_id])

  useEffect(() => {
    if (!liveDispatch) return
    void getGuardPresence().then((presence) => {
      if (presence.availability === 'available' && mission.state === 'offline') actions.goOnline()
      if (presence.availability === 'offline' && mission.state === 'waiting') actions.goOffline()
    }).catch((error) => setNotice(error instanceof Error ? error.message : 'Guard presence unavailable'))
  }, [liveDispatch])

  useEffect(() => {
    if (liveDispatch || mission.state !== 'waiting') return
    setNotice('Scanning for nearby assignments…')
    const assignmentTimer = window.setTimeout(() => {
      setNotice('New assignment received')
      actions.receiveAssignment()
    }, 4200)
    return () => window.clearTimeout(assignmentTimer)
  }, [mission.state, actions, liveDispatch])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const goOnline = async () => {
    if (isDeveloperPreview) {
      try { if(!developerGuardId)throw new Error('Selected guard is unavailable.');await setDeveloperGuardPresence(developerGuardId,true);const workspace=await getDeveloperGuardWorkspace(developerGuardId);const online=workspace.guard.availability!=='offline';const next=online?'waiting':'offline';setDeveloperGuardState(next);if(!online)throw new Error('Guard did not enter online state.') } catch(error){setNotice(error instanceof Error?error.message:'Unable to set real guard online');return}
      return
    }
    if (liveDispatch) {
      try { await setGuardPresence(true); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to go online'); return }
    }
    actions.goOnline()
  }
  const goOffline = async () => {
    if (isDeveloperPreview) {
      try { if(!developerGuardId)throw new Error('Selected guard is unavailable.');await setDeveloperGuardPresence(developerGuardId,false);const workspace=await getDeveloperGuardWorkspace(developerGuardId);const offline=workspace.guard.availability==='offline';const next=offline?'offline':'waiting';setDeveloperGuardState(next);if(!offline)throw new Error('Guard did not enter offline state.') } catch(error){setNotice(error instanceof Error?error.message:'Unable to set real guard offline');return}
      return
    }
    if (liveDispatch) {
      try { await setGuardPresence(false); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to go offline'); return }
    }
    actions.goOffline()
  }

  const returnOnline = async () => {
    if (liveDispatch) {
      try {
        const presence = await setGuardPresence(true)

        if (presence.availability !== 'available') {
          throw new Error('Unable to return online. The completed mission is still finalizing.')
        }

        // The completed mission is intentionally pinned against background refreshes.
        // Clear that pin only after the authoritative presence RPC confirms availability.
        setDispatchMission(null)
        setMissionRuntime(null)
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Unable to return online'
        )
        return
      }
    }

    actions.returnOnline()
  }

  const liveTransition = (input:{jobId:string;action:'accept'|'decline'|'start_route'|'mark_arrived'|'save_payload'|'complete_checkpoint'|'submit';expectedVersion?:number;checkpoint?:number;evidence?:import('./types').PatrolEvidence[];incidents?:import('./types').IncidentRecord[]}) =>
    dispatchMission?.multi_guard_slot ? transitionGuardSlotMission(input) : transitionGuardMission(input)

  const accept = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try {
        await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'accept'})
        const workspace=await getDeveloperGuardWorkspace(developerGuardId)
        setDispatchMission(workspace.assignment??null)
        const runtime=workspace.assignment?await getMissionRuntime(workspace.assignment.job_id):null
        setMissionRuntime(runtime)
        setDeveloperGuardState('enroute')
        return
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to accept assignment'); return }
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'accept',expectedVersion:missionRuntime?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to accept assignment'); return }
    }
    actions.acceptAssignment()
  }
  const decline = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'decline'});setDispatchMission(null);setMissionRuntime(null);setDeveloperGuardState('waiting');return }
      catch(error){setNotice(error instanceof Error?error.message:'Unable to decline assignment');return}
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'decline',expectedVersion:missionRuntime?.version}); setDispatchMission(null); setMissionRuntime(null) }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to decline assignment'); return }
    }
    actions.declineAssignment()
  }

  const startRoute = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'start_route',expectedVersion:missionRuntime?.version}); return }
      catch(error){setNotice(error instanceof Error?error.message:'Unable to start route');return}
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'start_route',expectedVersion:missionRuntime?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to start route'); return }
      return
    }
    actions.startRoute()
  }

  const markArrived = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'mark_arrived',expectedVersion:missionRuntime?.version}); return }
      catch(error){setNotice(error instanceof Error?error.message:'Unable to mark arrival');return}
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'mark_arrived',expectedVersion:missionRuntime?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to mark arrival'); return }
      return
    }
    actions.markArrived()
  }

  const updateEvidence = async (records: import('./types').PatrolEvidence[]) => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:records,incidents:effectiveIncidents}); await refreshDeveloperRuntime(); return }
      catch(error){ setNotice(error instanceof Error?error.message:'Unable to save evidence'); await refreshDeveloperRuntime(); throw error }
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:records,incidents:effectiveIncidents}); await loadDispatch(); return }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save evidence'); await loadDispatch(); throw error }
    }
    setEvidence(records)
  }

  const updateIncidents = async (records: import('./types').IncidentRecord[]) => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) {
      try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:effectiveEvidence,incidents:records}); await refreshDeveloperRuntime(); return }
      catch(error){ setNotice(error instanceof Error?error.message:'Unable to save incident'); await refreshDeveloperRuntime(); throw error }
    }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:effectiveEvidence,incidents:records}); await loadDispatch(); return }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save incident'); await loadDispatch(); throw error }
    }
    setIncidents(records)
  }

  const nextCheckpoint = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) { try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'complete_checkpoint',expectedVersion:missionRuntime?.version,checkpoint:effectiveCheckpoint,evidence:effectiveEvidence,incidents:effectiveIncidents}); await refreshDeveloperRuntime(); return } catch(error){setNotice(error instanceof Error?error.message:'Unable to complete checkpoint');await refreshDeveloperRuntime();throw error} }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'complete_checkpoint',expectedVersion:missionRuntime?.version,checkpoint:effectiveCheckpoint,evidence:effectiveEvidence,incidents:effectiveIncidents}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to complete checkpoint'); await loadDispatch(); throw error }
      return
    }
    actions.completeCheckpoint()
  }

  const submitProof = async () => {
    if (isDeveloperPreview && developerGuardId && dispatchMission) { try { await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,multiGuardSlot:!!dispatchMission.multi_guard_slot,action:'submit',expectedVersion:missionRuntime?.version,evidence:effectiveEvidence,incidents:effectiveIncidents}); await refreshDeveloperRuntime(); return } catch(error){setNotice(error instanceof Error?error.message:'Unable to submit mission');await refreshDeveloperRuntime();throw error} }
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'submit',expectedVersion:missionRuntime?.version,evidence:effectiveEvidence,incidents:effectiveIncidents}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to submit mission'); await loadDispatch(); throw error }
      return
    }
    actions.submitProof()
  }

  const publishReport = async () => {
    if (!dispatchMission?.job_id) throw new Error('Completed mission is unavailable.')
    if (isDeveloperPreview && developerGuardId) { await publishGuardMissionReport(dispatchMission.job_id, developerGuardId) }
    else { await publishMyMissionReport(dispatchMission.job_id) }
    setNotice('Mission report published to client.')
  }

  return <GuardianProvider missionState={displayedMissionState}><div className={`guard-app state-${displayedMissionState}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    {notice && <div className="mission-toast">{notice}</div>}

    <div className="production-workspace">
      <div className="production-stage" key={displayedMissionState}>
      <GuardDashboard
        onSignOut={()=>void auth.signOut()}
        developerGuardId={developerMode&&developerGuardId?developerGuardId:undefined}
        state={displayedMissionState}
        runtime={displayedMissionRuntime}
        metrics={guardMetrics ? {
          jobsToday: guardMetrics.jobs_today,
          onDutySeconds: guardMetrics.on_duty_seconds,
        } : undefined}
        checkpoint={effectiveCheckpoint}
        patrolEvidence={effectiveEvidence}
        onEvidenceChange={updateEvidence}
        onPhotoCapture={async(file,checkpoint)=>{const guardId=isDeveloperPreview?(developerGuardId||''):'';if(!dispatchMission?.job_id)throw new Error('Active guard mission is unavailable.');if(isDeveloperPreview&&!guardId)throw new Error('Selected guard is unavailable.');const coords=await currentNativeCoordinates().catch(()=>null);await uploadMissionPhoto({jobId:dispatchMission.job_id,guardId:guardId||undefined,checkpoint,file,developerTest:isDeveloperPreview,latitude:coords?.latitude??null,longitude:coords?.longitude??null})}}
        onVideoCapture={async(file,checkpoint)=>{const guardId=isDeveloperPreview?(developerGuardId||''):'';if(!dispatchMission?.job_id)throw new Error('Active guard mission is unavailable.');if(isDeveloperPreview&&!guardId)throw new Error('Selected guard is unavailable.');const coords=await currentNativeCoordinates().catch(()=>null);await uploadMissionVideo({jobId:dispatchMission.job_id,guardId:guardId||undefined,checkpoint,file,developerTest:isDeveloperPreview,latitude:coords?.latitude??null,longitude:coords?.longitude??null})}}
        incidents={effectiveIncidents}
        missionStartedAt={effectiveMissionStartedAt}
        onIncidentsChange={updateIncidents}
        onGoOnline={() => void goOnline()}
        onGoOffline={() => void goOffline()}
        onAccept={() => void accept()}
        onDecline={() => void decline()}
        onStartRoute={() => void startRoute()}
        onMarkArrived={() => void markArrived()}
        onNextCheckpoint={() => void nextCheckpoint()}
        onSubmitProof={() => void submitProof()}
        onPublishReport={() => publishReport()}
        onReturnOnline={() => void returnOnline()}
        onOpenTimeline={() => setTimelineOpen(true)}
      />
      </div>
      <MissionTimeline className={timelineOpen ? 'timeline-open' : ''} onClose={() => setTimelineOpen(false)}/>
    </div>
    {timelineOpen && <button className="timeline-scrim" onClick={() => setTimelineOpen(false)} aria-label="Close mission timeline"><X/></button>}
    {!developerMode && <button className="developer-link" onClick={onEnableDeveloperMode} aria-label="Open Developer Mode"><Code2 /></button>}
    <div className="build-badge">LIVE LOCATION ENGINE · ACCEPTANCE BUILD</div>
  </div></GuardianProvider>
}
