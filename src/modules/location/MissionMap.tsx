import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, reverseGeocodeCoordinates } from './addressSearch'
import {
  type ActiveMissionRoute,
  type MissionRouteResult,
  isValidRoutePoint,
} from './missionRouting'

export type MissionMapMarker = {
  id: string
  latitude: number
  longitude: number

  label: string
  title?: string
  subtitle?: string

  type:
    | 'job'
    | 'priority'
    | 'emergency'
    | 'guard'
    | 'property'
    | 'viewer'

  photoUrl?: string | null
  initials?: string
  status?: string
  address?: string | null
  currentAddress?: string | null

  propertyType?: string
  distance?: number
  eta?: number
  duration?: number
  price?: number

  /*
   * When true, this becomes the authoritative mission destination.
   * Guard + Client will use this after assignment/acceptance.
   */
  active?: boolean
}

type MissionMapProps = {
  markers: MissionMapMarker[]

  center?: {
    latitude: number
    longitude: number
  }

  zoom?: number
  showViewerLocation?: boolean

  /*
   * Universal assigned-mission routing.
   *
   * This is authoritative across:
   * Guard / Client / Agency / Platform.
   */
  activeMissionRoute?: ActiveMissionRoute | null

  onRouteUpdate?: (
    result: MissionRouteResult | null
  ) => void
}

type LatLngPoint = {
  latitude: number
  longitude: number
}

type ThemeMode = 'dark' | 'light'

const DEFAULT_CENTER = {
  latitude: 27.8661,
  longitude: -82.3265,
}

const FOLLOW_ZOOM = 19

function radians(value: number) {
  return value * Math.PI / 180
}

function distanceMiles(a: LatLngPoint, b: LatLngPoint) {
  const earthMiles = 3958.8

  const dLat = radians(b.latitude - a.latitude)
  const dLng = radians(b.longitude - a.longitude)

  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2

  return (
    2 *
    earthMiles *
    Math.asin(Math.min(1, Math.sqrt(h)))
  )
}

function markerGlyph(marker: MissionMapMarker) {
  if (marker.type === 'viewer') return '▲'

  if (marker.type === 'guard') {
    return (
      marker.initials?.slice(0, 2).toUpperCase() ||
      'G'
    )
  }

  if (marker.type === 'emergency') return '!'
  if (marker.type === 'priority') return 'P'
  if (marker.type === 'property') return '◆'

  return '●'
}

function markerTypeLabel(type: MissionMapMarker['type']) {
  if (type === 'viewer') return 'YOUR LOCATION'
  if (type === 'guard') return 'LIVE GUARD'
  if (type === 'emergency') return 'EMERGENCY MISSION'
  if (type === 'priority') return 'PRIORITY MISSION'
  if (type === 'property') return 'PROPERTY'

  return 'OPEN MISSION'
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeImageUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value, window.location.origin)

    if (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    ) {
      return escapeHtml(url.href)
    }
  } catch {
    return null
  }

  return null
}


function buildCard(marker: MissionMapMarker) {
  const image = safeImageUrl(marker.photoUrl)

  const title = escapeHtml(
    marker.title || marker.label,
  )

  const subtitle = escapeHtml(
    marker.subtitle || ''
  )

  const rawAddress =
    marker.currentAddress ||
    marker.address ||
    (marker.subtitle && !/agency guard/i.test(marker.subtitle)
      ? marker.subtitle
      : '')

  const displayAddress = escapeHtml(rawAddress)

  const initials = escapeHtml(
    marker.initials ||
      marker.title
        ?.split(' ')
        .map(word => word[0])
        .join('')
        .slice(0,2)
        .toUpperCase() ||
      'CP',
  )

  const statusText = escapeHtml(
    (marker.status || (
      marker.type === 'guard'
        ? 'available'
        : marker.type === 'viewer'
          ? 'your location'
          : 'active'
    ))
    .replace(/_/g,' ')
  )

  const media = image
    ? `
      <div class="cp-card-media has-image">
        <img src="${image}" alt="" />
        <span class="cp-card-media-ring"></span>
      </div>
    `
    : marker.type === 'guard' || marker.type === 'viewer'
      ? `
        <div class="cp-card-media avatar-fallback">
          <span>${initials}</span>
          <span class="cp-card-media-ring"></span>
        </div>
      `
      : `
        <div class="cp-card-media property-fallback">
          <span>CO</span>
          <small>PILOT</small>
          <span class="cp-card-media-ring"></span>
        </div>
      `

  const metric = (
    label:string,
    value:string,
    className=''
  ) => `
    <div class="cp-card-metric ${className}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `

  const metrics:string[]=[]

  if(marker.propertyType){
    metrics.push(
      metric(
        'PROPERTY',
        String(marker.propertyType)
      )
    )
  }

  if(typeof marker.distance==='number'){
    metrics.push(
      metric(
        'DISTANCE',
        `${marker.distance} mi`
      )
    )
  }

  if(typeof marker.eta==='number'){
    metrics.push(
      metric(
        'ETA',
        `${marker.eta} min`
      )
    )
  }

  if(typeof marker.duration==='number'){
    metrics.push(
      metric(
        'DURATION',
        `${marker.duration} min`
      )
    )
  }

  if(
    typeof marker.price==='number' &&
    marker.price>0
  ){
    metrics.push(
      metric(
        'EST. PAY',
        `$${marker.price}`,
        'money'
      )
    )
  }

  if(marker.type==='guard' && rawAddress){
    metrics.push(
      metric('CURRENT ADDRESS', rawAddress)
    )
  }

  /*
   * Guard cards should never feel empty just because
   * marketplace profile metrics have not been added yet.
   */
  if(marker.type==='guard' && !metrics.length){
    metrics.push(
      metric('STATUS',statusText),
      metric(
        'GPS',
        'Live'
      )
    )
  }

  const typeClass=escapeHtml(marker.type)

  const eyebrow =
    marker.type==='viewer'
      ? 'YOUR LOCATION'
      : marker.type==='guard'
        ? 'AVAILABLE GUARD'
        : marker.type==='emergency'
          ? 'EMERGENCY MISSION'
          : marker.type==='priority'
            ? 'PRIORITY MISSION'
            : marker.type==='property'
              ? 'SECURITY LOCATION'
              : 'OPEN MISSION'

  const footer =
    marker.type==='viewer'
      ? 'Current device location'
      : marker.type==='guard'
        ? 'Live guard location'
        : 'Verified service location'

  return `
    <article class="cp-map-profile-card ${typeClass}">

      <button
        type="button"
        class="cp-map-profile-close"
        data-copilot-card-close="true"
        aria-label="Close"
      >
        ×
      </button>

      <header class="cp-map-profile-topbar">
        <div class="cp-map-profile-eyebrow">
          <span class="cp-map-profile-status-dot"></span>
          ${escapeHtml(eyebrow)}
        </div>

        <div class="cp-map-profile-state">
          ${statusText}
        </div>
      </header>

      <section class="cp-map-profile-main">

        ${media}

        <div class="cp-map-profile-identity">
          <h3>${title}</h3>

          ${subtitle
            ? `<p>${subtitle}</p>`
            : ''
          }

          ${displayAddress && displayAddress !== subtitle
            ? `<p class="cp-map-profile-address">${displayAddress}</p>`
            : ''
          }

          <div class="cp-map-profile-live">
            <i></i>
            ${statusText}
          </div>
        </div>

      </section>

      ${metrics.length
        ? `
          <section class="cp-map-profile-metrics">
            ${metrics.join('')}
          </section>
        `
        : ''
      }

      <footer class="cp-map-profile-footer">
        <div>
          <span class="cp-map-profile-radar"></span>
          ${escapeHtml(footer)}
        </div>

        <span class="cp-map-profile-brand">
          CO PILOT LIVE
        </span>
      </footer>

    </article>
  `
}

export default function MissionMap({
  markers,
  center = DEFAULT_CENTER,
  zoom = FOLLOW_ZOOM,
  showViewerLocation = true,
  activeMissionRoute = null,
  onRouteUpdate,
}: MissionMapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<any>(null)
  const googleRef = useRef<any>(null)

  /*
   * Reactive readiness signal.
   *
   * mapRef/googleRef intentionally remain refs, but ref assignment
   * does not trigger React effects. Increment this generation after
   * every successful map initialization so routing can begin only
   * after the map and Google API are actually ready.
   */
  const [mapReadyGeneration, setMapReadyGeneration] =
    useState(0)

  const markerObjectsRef = useRef<any[]>([])

  /*
   * Mission Routing Engine V1
   *
   * Google owns route calculation/rendering.
   * MissionMap owns route lifecycle.
   */
  const routeRendererRef = useRef<any>(null)
  const routeRequestIdRef = useRef(0)
  const manualCameraRef = useRef(false)
  const programmaticCameraRef = useRef(false)

  const [viewerLocation, setViewerLocation] =
    useState<LatLngPoint | null>(null)

  const [locationStatus, setLocationStatus] =
    useState<
      'requesting' |
      'live' |
      'unavailable'
    >('requesting')

  const [theme, setTheme] =
    useState<ThemeMode>(() =>
      document.documentElement.dataset.theme === 'light'
        ? 'light'
        : 'dark'
    )

  const [manualCamera, setManualCamera] =
    useState(false)

  const [selectedMarker, setSelectedMarker] =
    useState<MissionMapMarker | null>(null)

  const [resolvedAddresses, setResolvedAddresses] =
    useState<Record<string, string>>({})

  const [error, setError] =
    useState<string | null>(null)

  const activeDestination =
    markers.find(
      marker =>
        marker.active &&
        marker.type !== 'guard' &&
        marker.type !== 'viewer'
    ) ?? null

  const coordinateKey = useCallback((marker: MissionMapMarker) =>
    `${marker.latitude.toFixed(5)},${marker.longitude.toFixed(5)}`
  , [])

  const closeCard = useCallback(() => {
    setSelectedMarker(null)
  }, [])

  const startProgrammaticCamera = () => {
    programmaticCameraRef.current = true

    window.setTimeout(() => {
      programmaticCameraRef.current = false
    }, 600)
  }

  const applySmartCamera = useCallback(
    (force = false) => {
      const map = mapRef.current
      const google = googleRef.current

      if (!map || !google) return

      if (
        manualCameraRef.current &&
        !force
      ) {
        return
      }

      /*
       * CLIENT PROPERTY FOCUS
       * Client has no viewer marker.
       * Before a guard is assigned, center tightly on
       * the requested service address.
       */
      if (
        !showViewerLocation &&
        activeDestination &&
        markers.filter(marker =>
          Number.isFinite(marker.latitude) &&
          Number.isFinite(marker.longitude)
        ).length <= 1
      ) {
        startProgrammaticCamera()

        map.panTo({
          lat: activeDestination.latitude,
          lng: activeDestination.longitude,
        })

        map.setZoom(19)

        return
      }

      /*
       * ACTIVE MISSION
       * Always frame user + destination.
       * As the two points get physically closer,
       * fitBounds naturally zooms tighter.
       */
      if (
        viewerLocation &&
        activeDestination
      ) {
        startProgrammaticCamera()

        const bounds =
          new google.maps.LatLngBounds()

        bounds.extend({
          lat: viewerLocation.latitude,
          lng: viewerLocation.longitude,
        })

        bounds.extend({
          lat: activeDestination.latitude,
          lng: activeDestination.longitude,
        })

        const miles = distanceMiles(
          viewerLocation,
          activeDestination,
        )

        let padding = 95

        if (miles < 1) padding = 80
        if (miles < 0.35) padding = 65
        if (miles < 0.12) padding = 48

        map.fitBounds(bounds, padding)

        /*
         * Arrival behavior:
         * prevent the camera remaining unnecessarily wide
         * once the user is extremely close.
         */
        window.setTimeout(() => {
          if (!mapRef.current) return

          const currentZoom =
            mapRef.current.getZoom() ?? 16

          if (miles < 0.08 && currentZoom < 19) {
            mapRef.current.setZoom(19)
          } else if (
            miles < 0.2 &&
            currentZoom < 18
          ) {
            mapRef.current.setZoom(18)
          } else if (
            miles < 0.6 &&
            currentZoom < 16
          ) {
            mapRef.current.setZoom(16)
          }
        }, 250)

        return
      }

      /*
       * NO ACTIVE MISSION
       * Uber-like default:
       * center tightly on the current user.
       */
      if (viewerLocation) {
        startProgrammaticCamera()

        map.panTo({
          lat: viewerLocation.latitude,
          lng: viewerLocation.longitude,
        })

        map.setZoom(zoom)

        return
      }

      /*
       * GPS unavailable fallback.
       */
      const valid = markers.filter(
        marker =>
          Number.isFinite(marker.latitude) &&
          Number.isFinite(marker.longitude)
      )

      if (valid.length) {
        startProgrammaticCamera()

        const bounds =
          new google.maps.LatLngBounds()

        valid.forEach(marker => {
          bounds.extend({
            lat: marker.latitude,
            lng: marker.longitude,
          })
        })

        map.fitBounds(bounds, 80)

        return
      }

      startProgrammaticCamera()

      map.setCenter({
        lat: center.latitude,
        lng: center.longitude,
      })

      map.setZoom(zoom)
    },
    [
      viewerLocation,
      activeDestination,
      markers,
      center.latitude,
      center.longitude,
      zoom,
    ]
  )

  /*
   * Theme listener.
   * Google requires map color scheme at initialization,
   * so changing theme rebuilds only the map instance.
   */
  useEffect(() => {
    const handler = (event: Event) => {
      const custom =
        event as CustomEvent<{
          theme?: ThemeMode
        }>

      if (
        custom.detail?.theme === 'light' ||
        custom.detail?.theme === 'dark'
      ) {
        setTheme(custom.detail.theme)
      }
    }

    window.addEventListener(
      'copilot-theme-change',
      handler
    )

    return () => {
      window.removeEventListener(
        'copilot-theme-change',
        handler
      )
    }
  }, [])

  /*
   * Browser GPS = current user/viewer.
   */
  useEffect(() => {
    if (!showViewerLocation) {
      setViewerLocation(null)
      setLocationStatus('unavailable')
      return
    }

    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    const watchId =
      navigator.geolocation.watchPosition(
        position => {
          setViewerLocation({
            latitude:
              position.coords.latitude,
            longitude:
              position.coords.longitude,
          })

          setLocationStatus('live')
        },

        () => {
          setLocationStatus('unavailable')
        },

        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 15000,
        }
      )

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      )
    }
  }, [showViewerLocation])

  /*
   * Map initialization.
   */
  useEffect(() => {
    let active = true
    let mapClickListener: any = null
    let dragListener: any = null
    let zoomListener: any = null

    async function initialize() {
      try {
        const google =
          await loadGoogleMaps()

        if (
          !active ||
          !containerRef.current
        ) {
          return
        }

        googleRef.current = google

        /*
         * Clear old map DOM when switching theme.
         */
        containerRef.current.innerHTML = ''

        const map =
          new google.maps.Map(
            containerRef.current,
            {
              center: {
                lat: center.latitude,
                lng: center.longitude,
              },

              zoom,

              colorScheme:
                theme === 'dark'
                  ? 'DARK'
                  : 'LIGHT',

              mapId:
                (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim() || undefined,

              mapTypeId:
                google.maps.MapTypeId.ROADMAP,

              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: false,

              clickableIcons: false,
              gestureHandling: 'greedy',
            }
          )

        mapRef.current = map
        setMapReadyGeneration(
          generation => generation + 1
        )

        /*
         * Clicking empty map closes a card.
         */
        mapClickListener =
          map.addListener(
            'click',
            () => closeCard()
          )

        /*
         * Manual pan turns off auto-follow.
         */
        dragListener =
          map.addListener(
            'dragstart',
            () => {
              if (
                programmaticCameraRef.current
              ) {
                return
              }

              manualCameraRef.current = true
              setManualCamera(true)
            }
          )

        /*
         * Manual zoom also turns off auto-follow.
         */
        zoomListener =
          map.addListener(
            'zoom_changed',
            () => {
              if (
                programmaticCameraRef.current
              ) {
                return
              }

              manualCameraRef.current = true
              setManualCamera(true)
            }
          )

        setError(null)
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Google Maps.'
        )
      }
    }

    void initialize()

    return () => {
      active = false

      mapClickListener?.remove?.()
      dragListener?.remove?.()
      zoomListener?.remove?.()

      markerObjectsRef.current.forEach(
        marker => {
          marker.map = null
        }
      )

      markerObjectsRef.current = []
      mapRef.current = null
    }
  }, [
    theme,
    center.latitude,
    center.longitude,
    closeCard,
  ])

  /*
   * Escape closes the card.
   */
  useEffect(() => {
    const handler = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        closeCard()
      }
    }

    window.addEventListener(
      'keydown',
      handler
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handler
      )
    }
  }, [closeCard])


  /*
   * Reverse geocode selected live guard markers.
   * Property addresses come from the client request/property record.
   * Guard addresses come from their current GPS position.
   */
  useEffect(() => {
    if (!selectedMarker) return
    if (
      selectedMarker.type !== 'guard' &&
      selectedMarker.type !== 'viewer'
    ) return
    if (selectedMarker.address || selectedMarker.currentAddress) return

    const key = coordinateKey(selectedMarker)
    if (resolvedAddresses[key]) return

    let cancelled = false

    reverseGeocodeCoordinates(
      selectedMarker.latitude,
      selectedMarker.longitude,
    )
      .then(address => {
        if (cancelled) return
        setResolvedAddresses(current => ({
          ...current,
          [key]: address,
        }))
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    selectedMarker,
    coordinateKey,
    resolvedAddresses,
  ])

  /*
   * Markers.
   */
  useEffect(() => {
    let active = true

    async function synchronizeMarkers() {
      const google =
        googleRef.current

      const map =
        mapRef.current

      if (!google || !map) return

      try {
        const { AdvancedMarkerElement } =
          await google.maps.importLibrary(
            'marker'
          )

        if (!active) return

        markerObjectsRef.current.forEach(
          marker => {
            marker.map = null
          }
        )

        markerObjectsRef.current = []

        const viewerMarker:
          MissionMapMarker | null =
          showViewerLocation && viewerLocation
            ? {
                id: '__viewer__',

                latitude:
                  viewerLocation.latitude,

                longitude:
                  viewerLocation.longitude,

                label: 'Your location',
                title: 'You',
                subtitle:
                  'Current device location',

                type: 'viewer',

                initials: 'YOU',

                status:
                  locationStatus === 'live'
                    ? 'live'
                    : 'locating',
              }
            : null

        const combined =
          viewerMarker
            ? [viewerMarker, ...markers]
            : markers

        const validMarkers =
          combined.filter(
            marker =>
              Number.isFinite(
                marker.latitude
              ) &&
              Number.isFinite(
                marker.longitude
              )
          )

        validMarkers.forEach(marker => {
          const shell =
            document.createElement(
              'button'
            )

          shell.type = 'button'

          shell.className =
            `copilot-map-marker ${marker.type}`

          if (marker.active) {
            shell.classList.add(
              'active-destination'
            )
          }

          shell.setAttribute(
            'aria-label',
            marker.label
          )

          if (
            viewerLocation &&
            marker.type === 'guard' &&
            distanceMiles(
              viewerLocation,
              {
                latitude: marker.latitude,
                longitude: marker.longitude,
              },
            ) < 0.03
          ) {
            shell.classList.add('near-viewer')
          }

          const pulse =
            document.createElement(
              'span'
            )

          pulse.className =
            'copilot-marker-pulse'

          const core =
            document.createElement(
              'span'
            )

          core.className =
            'copilot-marker-core'

          const glyph =
            document.createElement(
              'span'
            )

          glyph.className =
            'copilot-map-marker-glyph'

          glyph.textContent =
            markerGlyph(marker)

          core.appendChild(glyph)
          shell.appendChild(pulse)
          shell.appendChild(core)

          /*
           * ADVANCED MARKER ENGINE V2
           *
           * AdvancedMarkerElement is itself an HTMLElement.
           * Do not pass our visual DOM through deprecated
           * AdvancedMarkerElementOptions.content.
           */
          const advancedMarker =
            new AdvancedMarkerElement({
              map,

              position: {
                lat: marker.latitude,
                lng: marker.longitude,
              },

              title: marker.label,

              gmpClickable: true,

              zIndex:
                marker.type === 'viewer'
                  ? 120
                  : marker.type === 'guard'
                    ? 110
                    : marker.active
                      ? 100
                      : 20,
            })

          /*
           * Current Advanced Marker DOM model:
           * marker owns its visual children.
           */
          advancedMarker.append(shell)

          /*
           * Single card-opening function.
           * Both Google interaction paths call this same function.
           */
          const openMarkerCard = () => {
            /*
             * Mission/property markers may adjust the camera
             * before presenting their information.
             *
             * Guard and viewer cards never move the camera.
             */
            if (
              viewerLocation &&
              marker.type !== 'viewer' &&
              marker.type !== 'guard'
            ) {
              startProgrammaticCamera()

              const bounds =
                new google.maps.LatLngBounds()

              bounds.extend({
                lat: viewerLocation.latitude,
                lng: viewerLocation.longitude,
              })

              bounds.extend({
                lat: marker.latitude,
                lng: marker.longitude,
              })

              map.fitBounds(
                bounds,
                85
              )
            }

            /*
             * V3 CARD ENGINE
             *
             * Google owns map geography.
             * React owns application UI.
             */
            setSelectedMarker(marker)
          }

          /*
           * CO PILOT DIRECT MARKER INTERACTION
           *
           * The visible beacon is a real HTML button.
           * Application interaction belongs to that button,
           * independent of Google wrapper hit-testing.
           */
          shell.style.pointerEvents = 'auto'
          shell.style.cursor = 'pointer'

          shell.addEventListener(
            'click',
            (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              openMarkerCard()
            }
          )

          /*
           * Modern Advanced Marker interaction.
           * Retained as a supported secondary path.
           */
          advancedMarker.addEventListener(
            'gmp-click',
            (event: Event) => {
              event.preventDefault()
              event.stopPropagation()
              openMarkerCard()
            }
          )

          /*
           * Maps MVC click compatibility.
           *
           * Google still documents AdvancedMarkerElement "click"
           * for addListener(). This gives us a second supported
           * interaction path without duplicating card logic.
           */
          const mvcClickListener =
            advancedMarker.addListener(
              'click',
              () => {
                openMarkerCard()
              }
            )

          ;(advancedMarker as any).__copilotClickListener =
            mvcClickListener

          markerObjectsRef.current.push(
            advancedMarker
          )
        })
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to synchronize map locations.'
        )
      }
    }

    void synchronizeMarkers()

    return () => {
      active = false
    }
  }, [
    markers,
    viewerLocation,
    locationStatus,
    theme,
  ])

  /*
   * Smart camera follows GPS updates
   * only while the user has not taken
   * manual control.
   */
  useEffect(() => {
    if (!mapRef.current) return

    applySmartCamera()
  }, [
    viewerLocation,
    activeDestination?.id,
    applySmartCamera,
    theme,
  ])

  /*
   * ==========================================================
   * MISSION ROUTING ENGINE V1
   * ==========================================================
   *
   * Route origin is NEVER the person viewing the portal.
   *
   * Origin:
   *   persisted live GPS of assigned guard
   *
   * Destination:
   *   requested service property
   *
   * Therefore Client, Guard, Agency and Platform all render
   * the same operational route.
   */
  useEffect(() => {
    const map = mapRef.current
    const google = googleRef.current

    if (!map || !google) return

    const requestId =
      ++routeRequestIdRef.current

    const clearRoute = () => {
      routeRendererRef.current?.setMap(null)
      routeRendererRef.current = null
      onRouteUpdate?.(null)
    }

    if (
      !activeMissionRoute ||
      !isValidRoutePoint(
        activeMissionRoute.assignedGuard
      ) ||
      !isValidRoutePoint(
        activeMissionRoute.destination
      )
    ) {
      clearRoute()
      return
    }

    let cancelled = false

    async function buildRoute() {
      try {
        /*
         * Routes are calculated against Google's road network.
         * No straight-line mission polyline.
         */
        const directionsService =
          new google.maps.DirectionsService()

        const result =
          await directionsService.route({
            origin: {
              lat:
                activeMissionRoute!.assignedGuard
                  .latitude,
              lng:
                activeMissionRoute!.assignedGuard
                  .longitude,
            },

            destination: {
              lat:
                activeMissionRoute!.destination
                  .latitude,
              lng:
                activeMissionRoute!.destination
                  .longitude,
            },

            travelMode:
              google.maps.TravelMode.DRIVING,

            provideRouteAlternatives: true,

            drivingOptions: {
              departureTime: new Date(),
              trafficModel:
                google.maps.TrafficModel
                  .BEST_GUESS,
            },
          })

        if (
          cancelled ||
          requestId !== routeRequestIdRef.current
        ) {
          return
        }

        const routes = result.routes || []

        if (!routes.length) {
          clearRoute()
          return
        }

        /*
         * Select the fastest viable route.
         * If traffic duration exists, use it.
         * Otherwise use normal duration.
         */
        let bestIndex = 0
        let bestSeconds =
          Number.POSITIVE_INFINITY

        routes.forEach(
          (route: any, index: number) => {
            const seconds =
              route.legs?.reduce(
                (
                  total: number,
                  leg: any
                ) =>
                  total +
                  (
                    leg.duration_in_traffic
                      ?.value ??
                    leg.duration?.value ??
                    Number.POSITIVE_INFINITY
                  ),
                0
              ) ??
              Number.POSITIVE_INFINITY

            if (seconds < bestSeconds) {
              bestSeconds = seconds
              bestIndex = index
            }
          }
        )

        routeRendererRef.current?.setMap(null)

        const renderer =
          new google.maps.DirectionsRenderer({
            map,

            directions: result,

            routeIndex: bestIndex,

            suppressMarkers: true,

            preserveViewport: true,

            polylineOptions: {
              strokeOpacity: 0.92,
              strokeWeight: 6,
              zIndex: 18,
            },
          })

        routeRendererRef.current = renderer

        const route =
          routes[bestIndex]

        const legs =
          route?.legs ?? []

        const distanceMeters =
          legs.reduce(
            (total: number, leg: any) =>
              total +
              (leg.distance?.value ?? 0),
            0
          )

        const durationSeconds =
          legs.reduce(
            (total: number, leg: any) =>
              total +
              (
                leg.duration_in_traffic?.value ??
                leg.duration?.value ??
                0
              ),
            0
          )

        const firstLeg = legs[0]

        onRouteUpdate?.({
          distanceMeters,
          durationSeconds,

          distanceText:
            firstLeg?.distance?.text ??
            '',

          durationText:
            firstLeg?.duration_in_traffic
              ?.text ??
            firstLeg?.duration?.text ??
            '',
        })

        /*
         * Uber camera:
         * frame ONLY assigned guard + destination.
         */
        if (!manualCameraRef.current) {
          startProgrammaticCamera()

          const bounds =
            new google.maps.LatLngBounds()

          bounds.extend({
            lat:
              activeMissionRoute!.assignedGuard
                .latitude,
            lng:
              activeMissionRoute!.assignedGuard
                .longitude,
          })

          bounds.extend({
            lat:
              activeMissionRoute!.destination
                .latitude,
            lng:
              activeMissionRoute!.destination
                .longitude,
          })

          map.fitBounds(bounds, 90)
        }
      } catch (error) {
        if (cancelled) return

        console.error(
          'Mission route calculation failed:',
          error
        )

        clearRoute()
      }
    }

    void buildRoute()

    return () => {
      cancelled = true
    }
  }, [
    activeMissionRoute?.missionId,
    activeMissionRoute?.status,

    activeMissionRoute?.assignedGuard
      .latitude,
    activeMissionRoute?.assignedGuard
      .longitude,

    activeMissionRoute?.destination
      .latitude,
    activeMissionRoute?.destination
      .longitude,

    mapReadyGeneration,
    onRouteUpdate,
  ])

  const zoomIn = () => {
    const map = mapRef.current

    if (!map) return

    manualCameraRef.current = true
    setManualCamera(true)

    map.setZoom(
      Math.min(
        21,
        (map.getZoom() ?? 15) + 1
      )
    )
  }

  const zoomOut = () => {
    const map = mapRef.current

    if (!map) return

    manualCameraRef.current = true
    setManualCamera(true)

    map.setZoom(
      Math.max(
        3,
        (map.getZoom() ?? 15) - 1
      )
    )
  }

  const recenter = () => {
    manualCameraRef.current = false
    setManualCamera(false)

    closeCard()
    applySmartCamera(true)
  }

  const selectedMarkerForCard = selectedMarker
    ? {
        ...selectedMarker,
        currentAddress:
          selectedMarker.currentAddress ||
          selectedMarker.address ||
          resolvedAddresses[coordinateKey(selectedMarker)] ||
          null,
      }
    : null

  return (
    <div className="mission-map-shell">

      <div
        ref={containerRef}
        className="mission-google-map"
      />

      {error && (
        <div className="mission-map-error">
          <strong>
            MAP ENGINE OFFLINE
          </strong>

          <span>{error}</span>
        </div>
      )}

      <div className="mission-map-engine-badge">
        <span />
        CO PILOT MAP ENGINE
      </div>

      {selectedMarkerForCard && (
        <div
          className="copilot-map-react-card-layer"
          aria-live="polite"
        >
          <div
            className="copilot-map-react-card"
            role="dialog"
            aria-modal="false"
            aria-label={
              selectedMarkerForCard.title ||
              selectedMarkerForCard.label
            }
            onClick={event => {
              const target = event.target

              if (
                target instanceof Element &&
                target.closest(
                  '[data-copilot-card-close="true"]'
                )
              ) {
                event.preventDefault()
                event.stopPropagation()
                closeCard()
              }
            }}
            dangerouslySetInnerHTML={{
              __html: buildCard(selectedMarkerForCard),
            }}
          />
        </div>
      )}

      <div className="copilot-map-controls">

        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>

        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>

        <button
          type="button"
          className={
            manualCamera
              ? 'recenter attention'
              : 'recenter'
          }
          onClick={recenter}
          aria-label="Return to live map view"
          title="Return to live map view"
        >
          ◎
        </button>

      </div>

      <div
        className="copilot-map-camera-status"
        style={
          manualCamera
            ? { display: 'none' }
            : undefined
        }
      >

        <i
          className={
            locationStatus === 'live'
              ? 'live'
              : ''
          }
        />

        <span>
          {!showViewerLocation && activeDestination && markers.length <= 1
            ? 'PROPERTY FOCUS'
            : activeDestination
              ? 'MISSION FOLLOW'
              : manualCamera
                ? 'FREE MAP'
                : viewerLocation
                  ? 'FOLLOWING YOU'
                  : 'LOCATING…'}
        </span>

      </div>

    </div>
  )
}
