export type MissionRoutePoint = {
  latitude: number
  longitude: number
}

export type MissionRouteGuard = MissionRoutePoint & {
  guardId: string
  name?: string | null
  heading?: number | null
  accuracy?: number | null
  updatedAt?: string | null
}

export type MissionRouteDestination =
  MissionRoutePoint & {
    propertyId?: string | null
    name?: string | null
    address?: string | null
  }

export type ActiveMissionRoute = {
  missionId: string
  status: string

  assignedGuard: MissionRouteGuard
  destination: MissionRouteDestination
}

export type MissionRouteResult = {
  distanceMeters: number
  durationSeconds: number
  distanceText: string
  durationText: string
}

export function isValidRoutePoint(
  point?: MissionRoutePoint | null
): point is MissionRoutePoint {
  if (!point) return false

  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  )
}
