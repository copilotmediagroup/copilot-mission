import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Code2, LogOut, ShieldCheck, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import { timelineEngine } from './modules/timeline/TimelineEngine'
import AgencyMarketplace from './AgencyMarketplace'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { getGuardDispatchWorkspace, getGuardOperationalMetrics, getGuardPresence, setGuardPresence, transitionGuardMission, transitionGuardSlotMission, getGuardSlotRuntime, type DispatchMission, type GuardOperationalMetrics } from './modules/dispatch/dispatchRepository'
import { getMissionRuntime, subscribeToMissionRuntime } from './modules/mission-runtime/missionRuntimeRepository'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'
import { AuthGateway } from './modules/auth/AuthGateway'
import ClientPortal from './ClientPortal'
import PlatformMissionControl from './PlatformMissionControl'
import { DeveloperPortalSwitcher, getStoredDeveloperPreview, type DeveloperAccessMode, type DeveloperPreview } from './DeveloperPortalSwitcher'
import { startGuardLocationPublisher } from './modules/location/liveLocationRepository'

const developerPath = window.location.pathname.replace(/\/+$/, '') === '/developer'

export default function App() {
  return <AuthProvider><AuthGateway><AppShell /></AuthGateway></AuthProvider>
}

function AppShell() {
  const auth = useAuth()
  const [developerMode, setDeveloperMode] = useState(() => developerPath || localStorage.getItem('co-pilot-developer-mode') === 'true')
  const [developerAccessMode, setDeveloperAccessMode] = useState<DeveloperAccessMode>('preview')
  const [previewRole, setPreviewRole] = useState<DeveloperPreview>(() => getStoredDeveloperPreview(auth.role ?? 'client'))

  useEffect(() => {
    if (!auth.role || developerMode) return
    setPreviewRole(auth.role)
  }, [auth.role, developerMode])

  const enableDeveloperMode = () => {
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

  const activeRole: DeveloperPreview = developerMode && developerAccessMode === 'preview' ? previewRole : (auth.role ?? 'client')
  const portalKey = `${developerAccessMode}:${activeRole}:${auth.user?.id ?? 'anonymous'}`
  const showDeveloperDock = import.meta.env.DEV || developerPath || localStorage.getItem('co-pilot-show-dev-dock') === 'true'

  return <div className={developerMode ? 'developer-preview-active' : ''}>
    {developerMode && <DeveloperPortalSwitcher value={previewRole} actualRole={auth.role} accessMode={developerAccessMode} onAccessModeChange={setDeveloperAccessMode} onChange={setPreviewRole} onExit={exitDeveloperMode} onSignOut={() => void auth.signOut()} />}
    <div key={portalKey} className="portal-runtime-boundary">
      {activeRole === 'guard_lab' ? <ExperienceLab /> :
        activeRole === 'guard' ? <GuardApp developerMode={developerMode} accessMode={developerAccessMode} onEnableDeveloperMode={enableDeveloperMode} /> :
        activeRole === 'agency_admin' ? <div className="portal-root"><AgencyMarketplace developerMode={developerMode} accessMode={developerAccessMode} viewedRole={activeRole} /></div> :
        activeRole === 'platform_admin' ? <PlatformMissionControl /> :
        <ClientPortal developerMode={developerMode} accessMode={developerAccessMode} />}
    </div>
    {!developerMode && showDeveloperDock && <div className="portal-session-dock"><button onClick={enableDeveloperMode}><Code2/><span>Developer Mode</span></button><button className="portal-signout" onClick={() => void auth.signOut()}><LogOut/><span>Sign Out</span></button></div>}
  </div>
}

function PortalPlaceholder({ title, body, onLogout }: { title: string; body: string; onLogout: () => void }) {
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button><div className="build-badge">LIVE LOCATION ENGINE · ACCEPTANCE BUILD</div></div></div>
}

function GuardApp({
  developerMode,
  accessMode,
  onEnableDeveloperMode,
}: {
  developerMode: boolean
  accessMode: DeveloperAccessMode
  onEnableDeveloperMode: () => void
}) {
  const auth = useAuth()
  const { mission, actions, setEvidence, setIncidents } = useMissionEngine()
  const [notice, setNotice] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [dispatchMission, setDispatchMission] = useState<DispatchMission | null>(null)
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

  const displayedMissionState =
    developerMode && developerGuardState
      ? developerGuardState
      : mission.state

  const displayedMissionRuntime = useMemo<MissionRuntime | null>(() => {
    if (!missionRuntime) return null
    if (!isDeveloperPreview || !developerGuardState) return missionRuntime

    if (developerGuardState === 'enroute') {
      return {
        ...missionRuntime,
        state: 'en_route',
      }
    }

    if (developerGuardState === 'assignment') {
      return {
        ...missionRuntime,
        state: 'offered',
      }
    }

    if (developerGuardState === 'arrived') {
      return {
        ...missionRuntime,
        state: 'active',
      }
    }

    return missionRuntime
  }, [
    missionRuntime,
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
    if (liveDispatch) {
      try { await setGuardPresence(true); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to go online'); return }
    }
    actions.goOnline()
  }
  const goOffline = async () => {
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
          onClick={() => setDeveloperGuardState(state)}
        >
          {label}
        </button>
      )}

      <button
        className={developerGuardState === null ? 'active' : ''}
        onClick={() => setDeveloperGuardState(null)}
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
