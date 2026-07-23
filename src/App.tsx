import { useCallback, useEffect, useState } from 'react'
import { Code2 } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import ExperienceLab from './ExperienceLab'
import type { IncidentRecord, MissionState, PatrolEvidence, SkippedCheckpoint } from './types'

const isDeveloperRoute = window.location.pathname.replace(/\/+$/, '') === '/developer'

export default function App() {
  if (isDeveloperRoute) return <ExperienceLab />
  return <GuardApp />
}

function GuardApp() {
  const [state, setState] = useState<MissionState>('offline')
  const [checkpoint, setCheckpoint] = useState(0)
  const [notice, setNotice] = useState('')
  const [patrolEvidence, setPatrolEvidence] = useState<PatrolEvidence[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [skippedCheckpoints, setSkippedCheckpoints] = useState<SkippedCheckpoint[]>([])

  useEffect(() => {
    if (state !== 'waiting') return
    setNotice('Scanning for nearby assignments…')
    const assignmentTimer = window.setTimeout(() => {
      setNotice('New assignment received')
      setState('assignment')
    }, 4200)
    return () => window.clearTimeout(assignmentTimer)
  }, [state])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const goTo = useCallback((next: MissionState) => {
    if (next === 'patrol') { setCheckpoint(0); setPatrolEvidence([]); setIncidents([]); setSkippedCheckpoints([]) }
    setState(next)
  }, [])

  const nextCheckpoint = useCallback(() => {
    setCheckpoint(current => {
      if (current >= 5) {
        setState('proof')
        return 6
      }
      return current + 1
    })
  }, [])

  return <div className={`guard-app state-${state}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    {notice && <div className="mission-toast">{notice}</div>}
    <div className="production-stage" key={state}>
      <GuardDashboard
        state={state}
        checkpoint={checkpoint}
        patrolEvidence={patrolEvidence}
        onEvidenceChange={setPatrolEvidence}
        incidents={incidents}
        onIncidentsChange={setIncidents}
        skippedCheckpoints={skippedCheckpoints}
        onSkippedChange={setSkippedCheckpoints}
        onGoOnline={() => goTo('waiting')}
        onGoOffline={() => goTo('offline')}
        onAccept={() => goTo('enroute')}
        onDecline={() => goTo('waiting')}
        onStartRoute={() => goTo('arrived')}
        onMarkArrived={() => goTo('patrol')}
        onNextCheckpoint={nextCheckpoint}
        onSubmitProof={() => goTo('completed')}
        onReturnOnline={() => goTo('waiting')}
      />
    </div>
    <a className="developer-link" href="/developer" aria-label="Open Experience Lab"><Code2 /></a>
    <div className="build-badge">v0.7.0</div>
  </div>
}
