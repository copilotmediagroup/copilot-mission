import type {
  MissionRuntime,
  MissionRuntimeState,
} from './MissionRuntime'

export type MissionRuntimeValidationIssue = {
  code: string
  message: string
}

export type MissionRuntimeValidationResult = {
  valid: boolean
  issues: MissionRuntimeValidationIssue[]
}

function validCoordinate(
  latitude: number | null,
  longitude: number | null
) {
  if (
    latitude == null ||
    longitude == null
  ) {
    return false
  }

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

function stateRequiresAssignment(
  state: MissionRuntimeState
) {
  return ![
    'awaiting_guard',
    'cancelled',
  ].includes(state)
}

function stateRequiresGuard(
  state: MissionRuntimeState
) {
  return [
    'offered',
    'accepted',
    'en_route',
    'active',
    'checkpoint',
    'review',
    'completed',
  ].includes(state)
}

export function validateMissionRuntime(
  mission: MissionRuntime
): MissionRuntimeValidationResult {
  const issues: MissionRuntimeValidationIssue[] = []

  if (!mission.jobId) {
    issues.push({
      code: 'MISSING_JOB_ID',
      message:
        'Mission runtime requires canonical jobId.',
    })
  }

  if (!mission.title) {
    issues.push({
      code: 'MISSING_TITLE',
      message:
        'Mission runtime requires a title.',
    })
  }

  if (
    !Number.isInteger(mission.checkpointIndex) ||
    mission.checkpointIndex < 0 ||
    mission.checkpointIndex > 6
  ) {
    issues.push({
      code: 'INVALID_CHECKPOINT_INDEX',
      message:
        'Mission runtime checkpointIndex must be an integer from 0 through 6.',
    })
  }

  if (!Array.isArray(mission.evidence)) {
    issues.push({
      code: 'INVALID_EVIDENCE',
      message:
        'Mission runtime evidence must be an array.',
    })
  }

  if (!Array.isArray(mission.incidents)) {
    issues.push({
      code: 'INVALID_INCIDENTS',
      message:
        'Mission runtime incidents must be an array.',
    })
  }

  if (!mission.client?.id) {
    issues.push({
      code: 'MISSING_CLIENT',
      message:
        'Mission runtime requires client identity.',
    })
  }

  if (!mission.property?.id) {
    issues.push({
      code: 'MISSING_PROPERTY',
      message:
        'Mission runtime requires property identity.',
    })
  }

  if (
    stateRequiresAssignment(mission.state) &&
    !mission.assignmentId
  ) {
    issues.push({
      code: 'MISSING_ASSIGNMENT',
      message:
        `State ${mission.state} requires assignmentId.`,
    })
  }

  if (
    stateRequiresGuard(mission.state) &&
    !mission.guard
  ) {
    issues.push({
      code: 'MISSING_GUARD',
      message:
        `State ${mission.state} requires an assigned guard.`,
    })
  }

  if (
    mission.state === 'en_route' &&
    !validCoordinate(
      mission.guardLocation?.latitude ?? null,
      mission.guardLocation?.longitude ?? null
    )
  ) {
    issues.push({
      code: 'MISSING_EN_ROUTE_GPS',
      message:
        'En-route mission requires valid assigned guard GPS.',
    })
  }

  if (
    mission.state === 'en_route' &&
    !validCoordinate(
      mission.property.latitude,
      mission.property.longitude
    )
  ) {
    issues.push({
      code: 'MISSING_DESTINATION_GPS',
      message:
        'En-route mission requires valid property coordinates.',
    })
  }

  if (
    mission.guardLocation?.freshness === 'live' &&
    mission.guardLocation.updatedAt == null
  ) {
    issues.push({
      code: 'LIVE_LOCATION_WITHOUT_TIMESTAMP',
      message:
        'Live guard location requires updatedAt.',
    })
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export function assertMissionRuntime(
  mission: MissionRuntime
): MissionRuntime {
  const result =
    validateMissionRuntime(mission)

  if (!result.valid) {
    throw new Error(
      [
        'INVALID_MISSION_RUNTIME',
        ...result.issues.map(
          issue =>
            `${issue.code}:${issue.message}`
        ),
      ].join('|')
    )
  }

  return mission
}
