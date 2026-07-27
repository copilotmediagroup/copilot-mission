export type RouteFailureCode =
  | 'MAPS_NOT_READY'
  | 'MISSING_ORIGIN'
  | 'MISSING_DESTINATION'
  | 'REQUEST_DENIED'
  | 'ZERO_RESULTS'
  | 'OVER_QUERY_LIMIT'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR'
  | 'NO_ROUTE_GEOMETRY'
  | 'ROUTE_RENDER_FAILED'
  | string

export type RoadRouteResult = {
  status: 'ok'
  path: any[]
  bounds: any | null
  distanceText: string
  durationText: string
  rawStatus: string
} | {
  status: 'error'
  code: RouteFailureCode
  message: string
  rawStatus: string
}

const failureMessage = (status: string) => {
  switch (status) {
    case 'REQUEST_DENIED':
      return 'Google denied the route request. Verify the browser key allows Maps JavaScript API and Directions API for this site.'
    case 'ZERO_RESULTS':
      return 'Google could not find a drivable road route between this guard and mission.'
    case 'OVER_QUERY_LIMIT':
      return 'Google route quota has been reached for this project.'
    case 'INVALID_REQUEST':
      return 'The route request was incomplete or contained invalid coordinates.'
    case 'UNKNOWN_ERROR':
      return 'Google returned a temporary route-service error. Retry the mission route.'
    default:
      return `Google route request failed with status: ${status || 'UNKNOWN_ERROR'}.`
  }
}

export function requestRoadRoute(
  google: any,
  service: any,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RoadRouteResult> {
  if (!google?.maps || !service) {
    return Promise.resolve({ status: 'error', code: 'MAPS_NOT_READY', message: 'Google Maps route service is not ready.', rawStatus: 'MAPS_NOT_READY' })
  }

  return new Promise(resolve => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel?.BEST_GUESS,
        },
        provideRouteAlternatives: false,
      },
      (result: any, status: string) => {
        const normalized = String(status || '').toUpperCase()
        const ok = normalized === 'OK' || status === google.maps.DirectionsStatus?.OK
        if (!ok || !result) {
          resolve({ status: 'error', code: normalized || 'UNKNOWN_ERROR', message: failureMessage(normalized), rawStatus: normalized || 'UNKNOWN_ERROR' })
          return
        }

        const firstRoute = result.routes?.[0]
        const firstLeg = firstRoute?.legs?.[0]
        let path = Array.isArray(firstRoute?.overview_path) ? firstRoute.overview_path : []

        if (!path.length && firstRoute?.overview_polyline?.points && google.maps.geometry?.encoding?.decodePath) {
          path = google.maps.geometry.encoding.decodePath(firstRoute.overview_polyline.points)
        }

        if (!path.length) {
          resolve({ status: 'error', code: 'NO_ROUTE_GEOMETRY', message: 'Google returned ETA data but no drawable road geometry.', rawStatus: normalized })
          return
        }

        resolve({
          status: 'ok',
          path,
          bounds: firstRoute?.bounds ?? null,
          distanceText: firstLeg?.distance?.text || '—',
          durationText: firstLeg?.duration_in_traffic?.text || firstLeg?.duration?.text || '—',
          rawStatus: normalized,
        })
      },
    )
  })
}
