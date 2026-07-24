import { useEffect, useState } from 'react'
import { Clock3, Code2, X } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import { GuardianProvider } from './modules/guardian/GuardianProvider'
import GuardianButton from './modules/guardian/GuardianButton'
import { useMissionEngine } from './modules/mission/useMissionEngine'
import MissionTimeline from './modules/timeline/MissionTimeline'

const isDeveloperRoute = window.location.pathname.replace(/\/+$/, '') === '/developer'

export default function App() {
  if (isDeveloperRoute) return <ExperienceLab />
  return <GuardApp />
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
    <div className="build-badge">v0.8.2 · EVIDENCE & INCIDENT WORKSPACE</div>
  </div></GuardianProvider>
}
