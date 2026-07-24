import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { IncidentRecord, PatrolEvidence } from '../../types'
import { eventBus } from '../events/EventBus'
import { initialMissionSnapshot, missionReducer } from './MissionEngine'

export function useMissionEngine() {
  const [mission, dispatch] = useReducer(missionReducer, initialMissionSnapshot)
  const publishedEventId = useRef<string | null>(null)

  useEffect(() => {
    const latest = mission.events[0]
    if (!latest || latest.id === publishedEventId.current) return
    publishedEventId.current = latest.id
    eventBus.publish({ channel: 'mission', payload: latest })
  }, [mission.events])

  const actions = useMemo(() => ({
    goOnline: () => dispatch({ type: 'GO_ONLINE' }),
    goOffline: () => dispatch({ type: 'GO_OFFLINE' }),
    receiveAssignment: () => dispatch({ type: 'RECEIVE_ASSIGNMENT' }),
    acceptAssignment: () => dispatch({ type: 'ACCEPT_ASSIGNMENT' }),
    declineAssignment: () => dispatch({ type: 'DECLINE_ASSIGNMENT' }),
    startRoute: () => dispatch({ type: 'START_ROUTE' }),
    markArrived: () => dispatch({ type: 'MARK_ARRIVED' }),
    completeCheckpoint: () => dispatch({ type: 'COMPLETE_CHECKPOINT' }),
    submitProof: () => dispatch({ type: 'SUBMIT_PROOF' }),
    returnOnline: () => dispatch({ type: 'RETURN_ONLINE' }),
  }), [])

  const setEvidence = useCallback((records: PatrolEvidence[]) => {
    dispatch({ type: 'SET_EVIDENCE', records })
  }, [])

  const setIncidents = useCallback((records: IncidentRecord[]) => {
    dispatch({ type: 'SET_INCIDENTS', records })
  }, [])

  return { mission, actions, setEvidence, setIncidents }
}
