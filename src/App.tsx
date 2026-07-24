import { useEffect, useState } from 'react'
import { Clock3, Code2, ShieldCheck, UserRound, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'
import AgencyMarketplace from './AgencyMarketplace'
import { AuthProvider, useAuth } from './modules/auth/AuthProvider'
import { AuthGateway } from './modules/auth/AuthGateway'

const isDeveloperRoute = window.location.pathname.replace(/\/+$/, '') === '/developer'

export default function App() {
  return <AuthProvider><AuthGateway><AppShell /></AuthGateway></AuthProvider>
}

function AppShell() {
  const auth = useAuth()
  if (isDeveloperRoute) return <ExperienceLab />
  if (auth.role === 'guard') return <GuardApp />
  if (auth.role === 'agency_admin') return <div className="portal-root"><button className="portal-auth-logout" onClick={() => void auth.signOut()}>Log out</button><AgencyMarketplace /></div>
  if (auth.role === 'platform_admin') return <PortalPlaceholder title="Platform Command" body="The Platform Admin workspace is authenticated and ready for its live dashboard integration." onLogout={() => void auth.signOut()} />
  return <PortalPlaceholder title="Client Portal" body="Your secure client workspace is authenticated and ready for property and request integration." onLogout={() => void auth.signOut()} />
}

function PortalPlaceholder({ title, body, onLogout }: { title: string; body: string; onLogout: () => void }) {
  return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon"><ShieldCheck/></div><h1>{title}</h1><p>{body}</p><button onClick={onLogout}>Log out</button><div className="build-badge">v1.2.2 · AUTHENTICATION GATEWAY</div></div></div>
}

function GuardApp() {
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
    <a className="developer-link" href="/developer" aria-label="Open Experience Lab"><Code2 /></a>
    <div className="build-badge">v1.2.2 · AUTHENTICATION GATEWAY</div>
  </div></GuardianProvider>
}
