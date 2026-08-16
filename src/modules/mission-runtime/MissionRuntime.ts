export type MissionRuntimeState =
  | 'awaiting_guard'
  | 'offered'
  | 'accepted'
  | 'en_route'
  | 'active'
  | 'checkpoint'
  | 'review'
  | 'completed'
  | 'cancelled'

export type MissionRuntimePriority =
  | 'standard'
  | 'priority'
  | 'emergency'

export type MissionRuntimeFreshness =
  | 'none'
  | 'live'
  | 'stale'
  | 'expired'

export type MissionRuntimeClient = {
  id: string
  name: string
}

export type MissionRuntimeAgency = {
  id: string
  name: string
}

export type MissionRuntimeGuard = {
  id: string
  name: string
  badgeNumber: string | null

  availability:
    | 'offline'
    | 'available'
    | 'reserved'
    | 'on_mission'
}

export type MissionRuntimeProperty = {
  id: string
  name: string
  address: string

  latitude: number | null
  longitude: number | null

  photoUrl: string | null
}

export type MissionRuntimeLocation = {
  latitude: number | null
  longitude: number | null

  heading: number | null
  accuracy: number | null

  updatedAt: string | null
  freshness: MissionRuntimeFreshness
}

export type MissionRuntimeTimestamps = {
  createdAt: string

  assignedAt: string | null
  acceptedAt: string | null
  routeStartedAt: string | null
  arrivedAt: string | null
  completedAt: string | null

  updatedAt: string
}

export type MissionRuntimeEvent = {
  id: number | string
  jobId: string
  type: string
  createdAt: string
  payload: Record<string, unknown>
}

export type MissionRuntime = {
  /*
   * CANONICAL MISSION IDENTITY
   *
   * jobId === marketplace_jobs.id
   *
   * There is intentionally no second mission UUID.
   */
  jobId: string

  /*
   * Relationship record between mission,
   * agency and assigned guard.
   */
  assignmentId: string | null

  state: MissionRuntimeState
  version: number

  /*
   * Canonical mission execution state.
   *
   * These values come directly from mission_engine_state.
   * Screens must not reconstruct them locally.
   */
  checkpointIndex: number
  evidence: import('../../types').PatrolEvidence[]
  incidents: import('../../types').IncidentRecord[]
  missionStartedAt: string | null

  priority: MissionRuntimePriority

  title: string
  instructions: string | null

  client: MissionRuntimeClient

  agency: MissionRuntimeAgency | null
  guard: MissionRuntimeGuard | null

  property: MissionRuntimeProperty

  /*
   * Assigned guard live GPS.
   *
   * This is NOT viewer/browser location.
   */
  guardLocation: MissionRuntimeLocation | null

  timestamps: MissionRuntimeTimestamps

  timeline: MissionRuntimeEvent[]
}

export type MissionRuntimeRouteInput = {
  jobId: string
  state: MissionRuntimeState

  guard: {
    id: string
    name: string
    latitude: number
    longitude: number
  }

  destination: {
    propertyId: string
    name: string
    address: string
    latitude: number
    longitude: number
  }
}
