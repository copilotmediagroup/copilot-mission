import type { IncidentRecord, MissionState, PatrolEvidence } from '../../types'

export type MissionEventType =
  | 'MISSION_RESET'
  | 'GUARD_ONLINE'
  | 'ASSIGNMENT_RECEIVED'
  | 'ASSIGNMENT_ACCEPTED'
  | 'ASSIGNMENT_DECLINED'
  | 'ROUTE_STARTED'
  | 'GUARD_ARRIVED'
  | 'CHECKPOINT_COMPLETED'
  | 'EVIDENCE_UPDATED'
  | 'INCIDENTS_UPDATED'
  | 'PROOF_READY'
  | 'MISSION_COMPLETED'

export type MissionEvent = {
  id: string
  type: MissionEventType
  timestamp: number
  state: MissionState
  detail?: string
}

export type MissionSnapshot = {
  state: MissionState
  checkpoint: number
  patrolEvidence: PatrolEvidence[]
  incidents: IncidentRecord[]
  missionStartedAt: number | null
  completedAt: number | null
  events: MissionEvent[]
}

export type MissionAction =
  | { type: 'GO_ONLINE' }
  | { type: 'GO_OFFLINE' }
  | { type: 'RECEIVE_ASSIGNMENT' }
  | { type: 'ACCEPT_ASSIGNMENT' }
  | { type: 'DECLINE_ASSIGNMENT' }
  | { type: 'START_ROUTE' }
  | { type: 'MARK_ARRIVED' }
  | { type: 'COMPLETE_CHECKPOINT' }
  | { type: 'SET_EVIDENCE'; records: PatrolEvidence[] }
  | { type: 'SET_INCIDENTS'; records: IncidentRecord[] }
  | { type: 'SUBMIT_PROOF' }
  | { type: 'RETURN_ONLINE' }

export const initialMissionSnapshot: MissionSnapshot = {
  state: 'offline',
  checkpoint: 0,
  patrolEvidence: [],
  incidents: [],
  missionStartedAt: null,
  completedAt: null,
  events: [],
}

function appendEvent(snapshot: MissionSnapshot, type: MissionEventType, detail?: string): MissionSnapshot {
  const event: MissionEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    state: snapshot.state,
    detail,
  }
  return { ...snapshot, events: [event, ...snapshot.events].slice(0, 50) }
}

function transition(snapshot: MissionSnapshot, next: MissionState, type: MissionEventType, detail?: string) {
  return appendEvent({ ...snapshot, state: next }, type, detail)
}

export function missionReducer(snapshot: MissionSnapshot, action: MissionAction): MissionSnapshot {
  switch (action.type) {
    case 'GO_ONLINE': return transition({ ...snapshot, completedAt: null }, 'waiting', 'GUARD_ONLINE')
    case 'GO_OFFLINE': return transition({ ...initialMissionSnapshot }, 'offline', 'MISSION_RESET', 'Guard went offline')
    case 'RECEIVE_ASSIGNMENT': return transition(snapshot, 'assignment', 'ASSIGNMENT_RECEIVED')
    case 'ACCEPT_ASSIGNMENT': return transition(snapshot, 'enroute', 'ASSIGNMENT_ACCEPTED')
    case 'DECLINE_ASSIGNMENT': return transition(snapshot, 'waiting', 'ASSIGNMENT_DECLINED')
    case 'START_ROUTE': return transition(snapshot, 'arrived', 'ROUTE_STARTED')
    case 'MARK_ARRIVED': return transition({ ...snapshot, checkpoint: 0, patrolEvidence: [], incidents: [], missionStartedAt: Date.now(), completedAt: null }, 'patrol', 'GUARD_ARRIVED')
    case 'COMPLETE_CHECKPOINT': {
      const checkpoint = Math.min(snapshot.checkpoint + 1, 6)
      const updated = appendEvent({ ...snapshot, checkpoint }, 'CHECKPOINT_COMPLETED', `Checkpoint ${checkpoint} completed`)
      return checkpoint >= 6 ? transition(updated, 'proof', 'PROOF_READY') : updated
    }
    case 'SET_EVIDENCE': return appendEvent({ ...snapshot, patrolEvidence: action.records }, 'EVIDENCE_UPDATED')
    case 'SET_INCIDENTS': return appendEvent({ ...snapshot, incidents: action.records }, 'INCIDENTS_UPDATED')
    case 'SUBMIT_PROOF': return transition({ ...snapshot, completedAt: Date.now() }, 'completed', 'MISSION_COMPLETED')
    case 'RETURN_ONLINE': return transition({ ...initialMissionSnapshot }, 'waiting', 'GUARD_ONLINE', 'Ready for next assignment')
    default: return snapshot
  }
}
