import { eventBus, type SystemEvent } from '../events/EventBus'

export type TimelineSource = 'mission' | 'guardian' | 'evidence' | 'incident' | 'system'
export type TimelineSeverity = 'info' | 'warning' | 'critical'

export type TimelineEntry = Readonly<{
  id: string
  sequence: number
  timestamp: number
  source: TimelineSource
  severity: TimelineSeverity
  type: string
  title: string
  detail: string
  state: string
  metadata: Readonly<Record<string, string | number | boolean | null>>
}>

export type TimelineFilter = 'all' | TimelineSource
export type TimelineListener = (entries: readonly TimelineEntry[]) => void

const labels: Record<string, string> = {
  MISSION_RESET: 'Mission reset',
  GUARD_ONLINE: 'Guard online',
  ASSIGNMENT_RECEIVED: 'Assignment received',
  ASSIGNMENT_ACCEPTED: 'Assignment accepted',
  ASSIGNMENT_DECLINED: 'Assignment declined',
  ROUTE_STARTED: 'Route started',
  GUARD_ARRIVED: 'Guard arrived',
  CHECKPOINT_COMPLETED: 'Checkpoint completed',
  EVIDENCE_UPDATED: 'Evidence updated',
  INCIDENTS_UPDATED: 'Incident record updated',
  PROOF_READY: 'Mission proof ready',
  MISSION_COMPLETED: 'Mission completed',
  GUARDIAN_MONITORING: 'Guardian monitoring active',
  GUARDIAN_ALERT: 'Guardian emergency activated',
  GUARDIAN_ACKNOWLEDGED: 'Emergency acknowledged',
  GUARDIAN_BACKUP_ENROUTE: 'Backup dispatched',
  GUARDIAN_RESOLVED: 'Guardian event resolved',
  GUARDIAN_RESET: 'Guardian reset',
}

function classify(event: SystemEvent): Pick<TimelineEntry, 'source' | 'severity'> {
  const type = event.payload.type
  if (type === 'EVIDENCE_UPDATED' || type === 'PROOF_READY') return { source: 'evidence', severity: 'info' }
  if (type === 'INCIDENTS_UPDATED') return { source: 'incident', severity: 'warning' }
  if (type === 'GUARDIAN_ALERT') return { source: 'guardian', severity: 'critical' }
  if (type === 'GUARDIAN_ACKNOWLEDGED' || type === 'GUARDIAN_BACKUP_ENROUTE') return { source: 'guardian', severity: 'warning' }
  if (event.channel === 'guardian') return { source: 'guardian', severity: 'info' }
  if (type === 'MISSION_RESET') return { source: 'system', severity: 'info' }
  return { source: 'mission', severity: 'info' }
}

function describe(event: SystemEvent) {
  const detail = 'detail' in event.payload ? event.payload.detail : undefined
  if (detail) return detail
  switch (event.payload.type) {
    case 'GUARDIAN_ALERT': return event.payload.silent ? 'Silent emergency signal sent to agency.' : 'Emergency signal sent to agency.'
    case 'GUARDIAN_ACKNOWLEDGED': return 'Agency acknowledged the guard emergency.'
    case 'GUARDIAN_BACKUP_ENROUTE': return 'Backup is en route to the active mission.'
    case 'GUARDIAN_RESOLVED': return 'The Guardian emergency was marked resolved.'
    case 'EVIDENCE_UPDATED': return 'Mission evidence record changed.'
    case 'INCIDENTS_UPDATED': return 'Mission incident record changed.'
    default: return `State recorded as ${event.payload.state}.`
  }
}

class CoPilotTimelineEngine {
  private entries: readonly TimelineEntry[] = Object.freeze([])
  private sequence = 0
  private listeners = new Set<TimelineListener>()

  constructor() {
    eventBus.subscribe('*', (event) => this.record(event))
  }

  private record(event: SystemEvent) {
    const classification = classify(event)
    const payload = event.payload
    const entry = Object.freeze({
      id: `timeline-${payload.id}`,
      sequence: ++this.sequence,
      timestamp: payload.timestamp,
      source: classification.source,
      severity: classification.severity,
      type: payload.type,
      title: labels[payload.type] ?? payload.type.replaceAll('_', ' ').toLowerCase(),
      detail: describe(event),
      state: payload.state,
      metadata: Object.freeze({
        channel: event.channel,
        eventId: payload.id,
        silent: 'silent' in payload ? Boolean(payload.silent) : null,
      }),
    } satisfies TimelineEntry)

    this.entries = Object.freeze([entry, ...this.entries].slice(0, 250))
    this.listeners.forEach((listener) => listener(this.entries))
  }

  subscribe(listener: TimelineListener) {
    this.listeners.add(listener)
    listener(this.entries)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getEntries(filter: TimelineFilter = 'all') {
    return filter === 'all' ? this.entries : this.entries.filter((entry) => entry.source === filter)
  }

  clear() {
    this.entries = Object.freeze([])
    this.sequence = 0
    this.listeners.forEach((listener) => listener(this.entries))
  }
}

export const timelineEngine = new CoPilotTimelineEngine()
