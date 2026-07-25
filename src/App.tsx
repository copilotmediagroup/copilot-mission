import { useEffect, useState } from 'react'
import { Clock3, Code2, LogOut, ShieldCheck, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import AgencyMarketplace from './AgencyMarketplace'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { AuthGateway } from './modules/auth/AuthGateway'
import ClientPortal from './ClientPortal'
import PlatformMissionControl from './PlatformMissionControl'
import { DeveloperPortalSwitcher, getStoredDeveloperPreview, type DeveloperAccessMode, type DeveloperPreview } from './DeveloperPortalSwitcher'

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
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button><div className="build-badge">RC1 · FOUNDATION LOCK</div></div></div>
}

function GuardApp({ developerMode, onEnableDeveloperMode }: { developerMode: boolean; onEnableDeveloperMode: () => void }) {
  const { mission, actions, setEvidence, setIncidents } = useMissionEngine()
  const [notice, setNotice] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)

  useEffect(() => {
    if (mission.state !== 'waiting') return
    setNotice('Scanning for nearby assignments…')
    const assignmentTimer = window.setTimeout(() => {
      setNotice('New assignment received')
      actions.receiveAssignment()
    }, 4200)
    return () => window.clearTimeout(assignmentTimer)
  }, [mission.state, actions])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  return <GuardianProvider missionState={mission.state}><div className={`guard-app state-${mission.state}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    {notice && <div className="mission-toast">{notice}</div>}
    <div className="production-workspace">
      <div className="production-stage" key={mission.state}>
      <GuardDashboard
        state={mission.state}
        checkpoint={mission.checkpoint}
        patrolEvidence={mission.patrolEvidence}
        onEvidenceChange={setEvidence}
        incidents={mission.incidents}
        missionStartedAt={mission.missionStartedAt}
        onIncidentsChange={setIncidents}
        onGoOnline={actions.goOnline}
        onGoOffline={actions.goOffline}
        onAccept={actions.acceptAssignment}
        onDecline={actions.declineAssignment}
        onStartRoute={actions.startRoute}
        onMarkArrived={actions.markArrived}
        onNextCheckpoint={actions.completeCheckpoint}
        onSubmitProof={actions.submitProof}
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
    <div className="build-badge">RC1 · FOUNDATION LOCK</div>
  </div></GuardianProvider>
}
