import type {
  MissionRuntime,
  MissionRuntimeRouteInput,
  MissionRuntimeState,
} from './MissionRuntime'

/*
 * Old dispatch vocabulary may expose "arrived".
 *
 * Runtime V2 normalizes arrival into "active",
 * because the authoritative mission engine enters
 * active state after the guard marks arrival.
 */
export function normalizeMissionRuntimeState(
  state: string | null | undefined
): MissionRuntimeState {
  switch (state) {
    case 'awaiting_guard':
    case 'offered':
    case 'accepted':
    case 'en_route':
    case 'active':
    case 'checkpoint':
    case 'review':
    case 'completed':
    case 'cancelled':
      return state

    case 'arrived':
      return 'active'

    default:
      throw new Error(
        `UNKNOWN_MISSION_RUNTIME_STATE:${String(state)}`
      )
  }
}

export function isTerminalMissionState(
  state: MissionRuntimeState
) {
  return (
    state === 'completed' ||
    state === 'cancelled'
  )
}

export function isAssignedMissionState(
  state: MissionRuntimeState
) {
  return ![
    'awaiting_guard',
    'cancelled',
  ].includes(state)
}

export function isRouteEligibleMissionState(
  state: MissionRuntimeState
) {
  return (
    state === 'accepted' ||
    state === 'en_route'
  )
}

export function toMissionRuntimeRouteInput(
  mission: MissionRuntime
): MissionRuntimeRouteInput | null {
  if (!isRouteEligibleMissionState(mission.state)) {
    return null
  }

  const guard = mission.guard
  const location = mission.guardLocation
  const property = mission.property

  if (!guard || !location) {
    return null
  }

  if (
    location.latitude == null ||
    location.longitude == null ||
    property.latitude == null ||
    property.longitude == null
  ) {
    return null
  }

  return {
    jobId: mission.jobId,
    state: mission.state,

    guard: {
      id: guard.id,
      name: guard.name,
      latitude: location.latitude,
      longitude: location.longitude,
    },

    destination: {
      propertyId: property.id,
      name: property.name,
      address: property.address,
      latitude: property.latitude,
      longitude: property.longitude,
    },
  }
}
