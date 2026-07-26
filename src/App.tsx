import { useCallback, useEffect, useState } from 'react'
import { Clock3, Code2, LogOut, ShieldCheck, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import AgencyMarketplace from './AgencyMarketplace'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { getGuardDispatchWorkspace, getGuardPresence, getGuardMissionSnapshot, setGuardPresence, subscribeToDispatch, transitionGuardMission, type DispatchMission, type MissionEngineRecord } from './modules/dispatch/dispatchRepository'
import { AuthGateway } from './modules/auth/AuthGateway'
import ClientPortal from './ClientPortal'
import PlatformMissionControl from './PlatformMissionControl'
import { DeveloperPortalSwitcher, getStoredDeveloperPreview, type DeveloperAccessMode, type DeveloperPreview } from './DeveloperPortalSwitcher'
import { useGuardLocationPublisher } from './modules/location/useGuardLocationPublisher'

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

  return <div className={developerMode ? 'developer-preview-active' : ''}>
    {developerMode && <DeveloperPortalSwitcher value={previewRole} actualRole={auth.role} accessMode={developerAccessMode} onAccessModeChange={setDeveloperAccessMode} onChange={setPreviewRole} onExit={exitDeveloperMode} onSignOut={() => void auth.signOut()} />}
    <div key={portalKey} className="portal-runtime-boundary">
      {activeRole === 'guard_lab' ? <ExperienceLab /> :
        activeRole === 'guard' ? <GuardApp developerMode={developerMode} onEnableDeveloperMode={enableDeveloperMode} /> :
        activeRole === 'agency_admin' ? <div className="portal-root"><AgencyMarketplace developerMode={developerMode} accessMode={developerAccessMode} viewedRole={activeRole} /></div> :
        activeRole === 'platform_admin' ? <PlatformMissionControl /> :
        <ClientPortal developerMode={developerMode} accessMode={developerAccessMode} />}
    </div>
    {!developerMode && <div className="portal-session-dock"><button onClick={enableDeveloperMode}><Code2/><span>Developer Mode</span></button><button className="portal-signout" onClick={() => void auth.signOut()}><LogOut/><span>Sign Out</span></button></div>}
  </div>
}

function PortalPlaceholder({ title, body, onLogout }: { title: string; body: string; onLogout: () => void }) {
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button><div className="build-badge">MISSION ENGINE · ACCEPTANCE BUILD</div></div></div>
}

function GuardApp({ developerMode, onEnableDeveloperMode }: { developerMode: boolean; onEnableDeveloperMode: () => void }) {
  const auth = useAuth()
  const { mission, actions, setEvidence, setIncidents } = useMissionEngine()
  const [notice, setNotice] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [dispatchMission, setDispatchMission] = useState<DispatchMission | null>(null)
  const [engineMission, setEngineMission] = useState<MissionEngineRecord | null>(null)
  const liveDispatch = auth.mode === 'supabase' && auth.role === 'guard'
  const reportLocationError = useCallback((message:string) => setNotice(message), [])
  useGuardLocationPublisher(liveDispatch && mission.state !== 'offline', reportLocationError)

  const loadDispatch = useCallback(async () => {
    if (!liveDispatch) return
    try {
      const workspace = await getGuardDispatchWorkspace()
      setDispatchMission(workspace.assignment)
      const assignment = workspace.assignment
      if (!assignment) {
        setEngineMission(null)
        const presence = await getGuardPresence()
        actions.hydrateLiveState(presence.availability === 'offline' ? 'offline' : 'waiting')
        return
      }

      const snapshot = await getGuardMissionSnapshot(assignment.job_id)
      const engine = snapshot.mission
      setEngineMission(engine)
      const startedAt = engine?.mission_started_at ? new Date(engine.mission_started_at).getTime() : (assignment.accepted_at ? new Date(assignment.accepted_at).getTime() : null)
      if (!engine || engine.state === 'offered') {
        if (mission.state !== 'assignment') setNotice('New assignment received')
        actions.hydrateLiveState('assignment')
      } else if (engine.state === 'accepted') {
        actions.hydrateLiveState('enroute', startedAt)
      } else if (engine.state === 'en_route') {
        actions.hydrateLiveState('arrived', startedAt)
      } else if (engine.state === 'active' || engine.state === 'checkpoint') {
        actions.hydrateLiveState('patrol', startedAt, engine.checkpoint_index, engine.evidence ?? [], engine.incidents ?? [])
      } else if (engine.state === 'review') {
        actions.hydrateLiveState('proof', startedAt, 6, engine.evidence ?? [], engine.incidents ?? [])
      } else if (engine.state === 'completed') {
        actions.hydrateLiveState('completed', startedAt, 6, engine.evidence ?? [], engine.incidents ?? [], engine.completed_at ? new Date(engine.completed_at).getTime() : null)
      } else {
        const presence = await getGuardPresence()
        actions.hydrateLiveState(presence.availability === 'offline' ? 'offline' : 'waiting')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Mission Engine unavailable')
    }
  }, [liveDispatch, mission.state, actions])

  useEffect(() => { if (liveDispatch) void loadDispatch() }, [liveDispatch, loadDispatch])
  useEffect(() => liveDispatch ? subscribeToDispatch(() => void loadDispatch()) : undefined, [liveDispatch, loadDispatch])

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

  const accept = async () => {
    if (liveDispatch && dispatchMission) {
      try { await transitionGuardMission({jobId:dispatchMission.job_id,action:'accept',expectedVersion:engineMission?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to accept assignment'); return }
    }
    actions.acceptAssignment()
  }
  const decline = async () => {
    if (liveDispatch && dispatchMission) {
      try { await transitionGuardMission({jobId:dispatchMission.job_id,action:'decline',expectedVersion:engineMission?.version}); setDispatchMission(null); setEngineMission(null) }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to decline assignment'); return }
    }
    actions.declineAssignment()
  }

  const startRoute = async () => {
    if (liveDispatch && dispatchMission) {
      try { await transitionGuardMission({jobId:dispatchMission.job_id,action:'start_route',expectedVersion:engineMission?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to start route'); return }
      return
    }
    actions.startRoute()
  }

  const markArrived = async () => {
    if (liveDispatch && dispatchMission) {
      try { await transitionGuardMission({jobId:dispatchMission.job_id,action:'mark_arrived',expectedVersion:engineMission?.version}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to mark arrival'); return }
      return
    }
    actions.markArrived()
  }

  const updateEvidence = async (records: import('./types').PatrolEvidence[]) => {
    setEvidence(records)
    if (!liveDispatch || !dispatchMission) return
    try { const next=await transitionGuardMission({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:engineMission?.version,evidence:records,incidents:mission.incidents}); setEngineMission(next) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save evidence'); await loadDispatch() }
  }

  const updateIncidents = async (records: import('./types').IncidentRecord[]) => {
    setIncidents(records)
    if (!liveDispatch || !dispatchMission) return
    try { const next=await transitionGuardMission({jobId:dispatchMission.job_id,action:'save_payload',expectedVersion:engineMission?.version,evidence:mission.patrolEvidence,incidents:records}); setEngineMission(next) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save incident'); await loadDispatch() }
  }

  const nextCheckpoint = async () => {
    if (liveDispatch && dispatchMission) {
      try { await transitionGuardMission({jobId:dispatchMission.job_id,action:'complete_checkpoint',expectedVersion:engineMission?.version,checkpoint:mission.checkpoint,evidence:mission.patrolEvidence,incidents:mission.incidents}); await loadDispatch() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to complete checkpoint') }
      return
    }
    actions.completeCheckpoint()
  }

  const submitProof = async () => {
    if (liveDispatch && dispatchMission) {
      try { const completed=await transitionGuardMission({jobId:dispatchMission.job_id,action:'submit',expectedVersion:engineMission?.version,evidence:mission.patrolEvidence,incidents:mission.incidents}); setEngineMission(completed); actions.hydrateLiveState('completed', completed.mission_started_at ? new Date(completed.mission_started_at).getTime() : mission.missionStartedAt, 6, completed.evidence ?? [], completed.incidents ?? [], completed.completed_at ? new Date(completed.completed_at).getTime() : Date.now()) }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to submit mission') }
      return
    }
    actions.submitProof()
  }

  return <GuardianProvider missionState={mission.state}><div className={`guard-app state-${mission.state}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    {notice && <div className="mission-toast">{notice}</div>}
    <div className="production-workspace">
      <div className="production-stage" key={mission.state}>
      <GuardDashboard
        state={mission.state}
        assignment={dispatchMission}
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
        onReturnOnline={actions.returnOnline}
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
    <div className="build-badge">MISSION ENGINE · ACCEPTANCE BUILD</div>
  </div></GuardianProvider>
}
