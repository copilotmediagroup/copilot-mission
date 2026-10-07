import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Code2, LogOut, ShieldCheck, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import { timelineEngine } from './modules/timeline/TimelineEngine'
import AgencyV4 from './v4/AgencyV4'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { getGuardDispatchWorkspace, getGuardOperationalMetrics, getGuardPresence, setGuardPresence, transitionGuardMission, transitionGuardSlotMission, getGuardSlotRuntime, type DispatchMission, type GuardOperationalMetrics } from './modules/dispatch/dispatchRepository'
import { getMissionRuntime, subscribeToMissionRuntime } from './modules/mission-runtime/missionRuntimeRepository'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'
import { AuthGateway } from './modules/auth/AuthGateway'
import ClientPortal from './ClientPortal'
import OwnerV4 from './v4/OwnerV4'
import { DeveloperPortalSwitcher, getStoredDeveloperPreview, type DeveloperAccessMode, type DeveloperPreview } from './DeveloperPortalSwitcher'
import { startGuardLocationPublisher } from './modules/location/liveLocationRepository'
import { getDeveloperSandboxJobs, subscribeDeveloperSandbox, setDeveloperSandboxGuardPresence } from './modules/developer/developerSandbox'
import { getDeveloperLiveAccounts,setDeveloperGuardPresence,getDeveloperGuardWorkspace, transitionDeveloperGuardMission,type DeveloperLiveAccounts } from './modules/developer/developerLiveRepository'

const developerPath = window.location.pathname.replace(/\/+$/, '') === '/developer'

export default function App() {
  return <AuthProvider><AuthGateway><AppShell /></AuthGateway></AuthProvider>
}

function AppShell() {
  const auth = useAuth()
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

  return <div className={adminDeveloperMode ? 'developer-preview-active' : ''}>
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
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button><div className="build-badge">LIVE LOCATION ENGINE · ACCEPTANCE BUILD</div></div></div>
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
  const [guardMetrics, setGuardMetrics] = useState<GuardOperationalMetrics | null>(null)
  const [missionRuntime, setMissionRuntime] = useState<MissionRuntime | null>(null)
  const [developerGuardState, setDeveloperGuardState] = useState<typeof mission.state | null>(()=>{
    if(!(developerMode&&accessMode==='preview')) return null
    try { const v=window.sessionStorage.getItem('copilot:developer:guard-state'); return (v as typeof mission.state|null)||null } catch { return null }
  })
  const [sandboxJobs,setSandboxJobs]=useState(()=>developerMode&&accessMode==='preview'?getDeveloperSandboxJobs():[])

  const canReadLiveDispatch =
    auth.mode === 'supabase' &&
    auth.role === 'guard'

  const isDeveloperPreview =
    developerMode &&
    accessMode === 'preview'

  const liveDispatch =
    canReadLiveDispatch &&
    !isDeveloperPreview

  useEffect(()=>{if(!isDeveloperPreview||!developerGuardId)return;let cancelled=false;const sync=()=>void getDeveloperGuardWorkspace(developerGuardId).then(async workspace=>{if(cancelled)return;const online=workspace.guard.availability!=='offline';const assignment=workspace.assignment??null;setDispatchMission(assignment);let runtime:MissionRuntime|null=null;if(assignment){runtime=await getMissionRuntime(assignment.job_id);if(cancelled)return;setMissionRuntime(runtime)}else setMissionRuntime(null);const hydratedState:typeof mission.state=assignment?(runtime?.state==='accepted'||runtime?.state==='en_route'?'enroute':runtime?.state==='active'?'arrived':runtime?.state==='completed'?'completed':'assignment'):(online?'waiting':'offline');setDeveloperGuardState(hydratedState);try{window.sessionStorage.setItem('copilot:developer:guard-state',hydratedState)}catch{}}).catch(error=>{if(!cancelled)setNotice(error instanceof Error?error.message:'Unable to load real guard state')});sync();const timer=window.setInterval(sync,3000);return()=>{cancelled=true;window.clearInterval(timer)}},[isDeveloperPreview,developerGuardId])

  useEffect(()=>{if(!isDeveloperPreview){setSandboxJobs([]);return}const sync=()=>setSandboxJobs(getDeveloperSandboxJobs());sync();return subscribeDeveloperSandbox(sync)},[isDeveloperPreview])
  const sandboxJob=sandboxJobs.find(job=>job.state==='assigned'||job.state==='claimed'||job.state==='open')??sandboxJobs[0]??null
  const sandboxRuntime=useMemo<MissionRuntime|null>(()=>sandboxJob?({
    jobId:sandboxJob.id,assignmentId:sandboxJob.id,state:'offered',version:1,checkpointIndex:0,evidence:[],incidents:[],missionStartedAt:null,
    priority:sandboxJob.priority,title:sandboxJob.title,instructions:'Developer sandbox request — no real charge',
    client:{id:'preview-client',name:sandboxJob.client},agency:{id:'preview-agency',name:'Developer Agency'},guard:null,
    property:{id:'preview-property',name:sandboxJob.property,address:sandboxJob.address,latitude:sandboxJob.latitude??null,longitude:sandboxJob.longitude??null,photoUrl:sandboxJob.photoUrl??null},guardLocation:null,
    timestamps:{createdAt:sandboxJob.createdAt,assignedAt:sandboxJob.createdAt,acceptedAt:null,routeStartedAt:null,arrivedAt:null,completedAt:null,updatedAt:sandboxJob.createdAt},timeline:[]
  } as MissionRuntime):null,[sandboxJob])

  const displayedMissionState =
    developerMode && developerGuardState
      ? developerGuardState
      : mission.state

  const displayedMissionRuntime = useMemo<MissionRuntime | null>(() => {
    const baseRuntime=isDeveloperPreview?(missionRuntime??sandboxRuntime??null):missionRuntime
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
    sandboxRuntime,
    isDeveloperPreview,
    developerGuardState,
  ])

  const loadDispatch = useCallback(async () => {
    if (!canReadLiveDispatch) return

    try {
      const [workspace, operationalMetrics] = await Promise.all([
        getGuardDispatchWorkspace(),
        getGuardOperationalMetrics(),
      ])

      setDispatchMission(workspace.assignment)
      setGuardMetrics(operationalMetrics)

      const assignment = workspace.assignment

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
  }, [canReadLiveDispatch, actions])

  useEffect(() => {
    if (canReadLiveDispatch) void loadDispatch()
  }, [canReadLiveDispatch, loadDispatch])
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

    return startGuardLocationPublisher({
      enabled: locationEnabled,
      jobId: dispatchMission?.job_id ?? null,
      onError: message =>
        setNotice(
          message.includes('denied')
            ? 'Location permission is required for live operations.'
            : message
        ),
    })
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
      setDeveloperGuardState('waiting')
      setDeveloperSandboxGuardPresence(true)
      try { if(developerGuardId) await setDeveloperGuardPresence(developerGuardId,true) } catch(error){setNotice(error instanceof Error?error.message:'Unable to set real guard online');return}
      try { window.sessionStorage.setItem('copilot:developer:guard-state','waiting') } catch {}
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
      setDeveloperGuardState('offline')
      setDeveloperSandboxGuardPresence(false)
      try { if(developerGuardId) await setDeveloperGuardPresence(developerGuardId,false) } catch(error){setNotice(error instanceof Error?error.message:'Unable to set real guard offline');return}
      try { window.sessionStorage.setItem('copilot:developer:guard-state','offline') } catch {}
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
          throw new Error('Mission must be completed before returning online')
        }

        await loadDispatch()
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
        await transitionDeveloperGuardMission({guardId:developerGuardId,jobId:dispatchMission.job_id,action:'accept',expectedVersion:missionRuntime?.version})
        const workspace=await getDeveloperGuardWorkspace(developerGuardId)
        setDispatchMission(workspace.assignment??null)
        const runtime=workspace.assignment?await getMissionRuntime(workspace.assignment.job_id):null
        setMissionRuntime(runtime)
        setDeveloperGuardState('enroute')
        try { window.sessionStorage.setItem('copilot:developer:guard-state','enroute') } catch {}
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
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'decline',expectedVersion:missionRuntime?.version}); setDispatchMission(null); setMissionRuntime(null) }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to decline assignment'); return }
    }
    actions.declineAssignment()
  }

  const startRoute = async () => {
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'start_route',expectedVersion:missionRuntime?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to start route'); return }
      return
    }
    actions.startRoute()
  }

  const markArrived = async () => {
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'mark_arrived',expectedVersion:missionRuntime?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to mark arrival'); return }
      return
    }
    actions.markArrived()
  }

  const updateEvidence = async (records: import('./types').PatrolEvidence[]) => {
    setEvidence(records)
    if (!liveDispatch || !dispatchMission) return
    try { await liveTransition({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:records,incidents:mission.incidents}); await loadDispatch() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save evidence'); await loadDispatch() }
  }

  const updateIncidents = async (records: import('./types').IncidentRecord[]) => {
    setIncidents(records)
    if (!liveDispatch || !dispatchMission) return
    try { await liveTransition({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:missionRuntime?.version,evidence:mission.patrolEvidence,incidents:records}); await loadDispatch() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save incident'); await loadDispatch() }
  }

  const nextCheckpoint = async () => {
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'complete_checkpoint',expectedVersion:missionRuntime?.version,checkpoint:mission.checkpoint,evidence:mission.patrolEvidence,incidents:mission.incidents}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to complete checkpoint') }
      return
    }
    actions.completeCheckpoint()
  }

  const submitProof = async () => {
    if (liveDispatch && dispatchMission) {
      try { await liveTransition({jobId:dispatchMission.job_id,action:'submit',expectedVersion:missionRuntime?.version,evidence:mission.patrolEvidence,incidents:mission.incidents}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to submit mission') }
      return
    }
    actions.submitProof()
  }

  return <GuardianProvider missionState={displayedMissionState}><div className={`guard-app state-${displayedMissionState}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    {notice && <div className="mission-toast">{notice}</div>}

    {developerMode && <div className="guard-developer-state-preview">
      <strong>GUARD STATE</strong>

      {([
        ['offline', 'Offline'],
        ['waiting', 'Waiting'],
        ['assignment', 'Assignment'],
        ['enroute', 'En Route'],
        ['arrived', 'Arrived'],
        ['patrol', 'Patrol'],
        ['proof', 'Review'],
        ['completed', 'Complete'],
      ] as const).map(([state, label]) =>
        <button
          key={state}
          className={displayedMissionState === state ? 'active' : ''}
          onClick={() => {setDeveloperGuardState(state);try{window.sessionStorage.setItem('copilot:developer:guard-state',state)}catch{}}}
        >
          {label}
        </button>
      )}

      <button
        className={developerGuardState === null ? 'active' : ''}
        onClick={() => {setDeveloperGuardState(null);try{window.sessionStorage.removeItem('copilot:developer:guard-state')}catch{}}}
      >
        LIVE STATE
      </button>
    </div>}

    <div className="production-workspace">
      <div className="production-stage" key={displayedMissionState}>
      <GuardDashboard
        state={displayedMissionState}
        runtime={displayedMissionRuntime}
        metrics={guardMetrics ? {
          jobsToday: guardMetrics.jobs_today,
          onDutySeconds: guardMetrics.on_duty_seconds,
        } : undefined}
        checkpoint={mission.checkpoint}
        patrolEvidence={mission.patrolEvidence}
        onEvidenceChange={(records) => void updateEvidence(records)}
        incidents={mission.incidents}
        missionStartedAt={mission.missionStartedAt}
        onIncidentsChange={(records) => void updateIncidents(records)}
        onGoOnline={() => void goOnline()}
        onGoOffline={() => void goOffline()}
        onAccept={() => void accept()}
        onDecline={() => void decline()}
        onStartRoute={() => void startRoute()}
        onMarkArrived={() => void markArrived()}
        onNextCheckpoint={() => void nextCheckpoint()}
        onSubmitProof={() => void submitProof()}
        onReturnOnline={() => void returnOnline()}
      />
      </div>
      <MissionTimeline className={timelineOpen ? 'timeline-open' : ''} onClose={() => setTimelineOpen(false)}/>
    </div>
    <div className="mission-utility-dock">
      <GuardianButton missionState={mission.state}/>
      <button className="timeline-trigger" onClick={() => setTimelineOpen(true)} aria-label="Open mission timeline"><Clock3/><span>Timeline</span></button>
    </div>
    {timelineOpen && <button className="timeline-scrim" onClick={() => setTimelineOpen(false)} aria-label="Close mission timeline"><X/></button>}
    {!developerMode && <button className="developer-link" onClick={onEnableDeveloperMode} aria-label="Open Developer Mode"><Code2 /></button>}
    <div className="build-badge">LIVE LOCATION ENGINE · ACCEPTANCE BUILD</div>
  </div></GuardianProvider>
}
