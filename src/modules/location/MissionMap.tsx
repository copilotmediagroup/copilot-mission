import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from './addressSearch'

export type MissionMapMarker = {
  id: string
  latitude: number
  longitude: number
  label: string
  type: 'job' | 'priority' | 'emergency' | 'guard' | 'property'
}

type MissionMapProps = {
  markers: MissionMapMarker[]
  center?: {
    latitude: number
    longitude: number
  }
  zoom?: number
}

const DEFAULT_CENTER = {
  latitude: 27.8661,
  longitude: -82.3265,
}

function markerColor(type: MissionMapMarker['type']) {
  switch (type) {
    case 'emergency':
      return '#ff4056'
    case 'priority':
      return '#ff8a2a'
    case 'guard':
      return '#21d987'
    case 'property':
      return '#1687ff'
    default:
      return '#ffc82f'
  }
}

export default function MissionMap({
  markers,
  center = DEFAULT_CENTER,
  zoom = 12,
}: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        const google = await loadGoogleMaps()

        if (!active || !containerRef.current) return

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: {
              lat: center.latitude,
              lng: center.longitude,
            },
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: 'greedy',
          })
        }

        setError(null)
      } catch (err) {
        if (!active) return
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Google Maps.',
        )
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function synchronizeMarkers() {
      try {
        const google = await loadGoogleMaps()

        if (!active || !mapRef.current) return

        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current = []

        const validMarkers = markers.filter(
          marker =>
            Number.isFinite(marker.latitude) &&
            Number.isFinite(marker.longitude),
        )

        validMarkers.forEach(marker => {
          const mapMarker = new google.maps.Marker({
            map: mapRef.current,
            position: {
              lat: marker.latitude,
              lng: marker.longitude,
            },
            title: marker.label,
            label: {
              text: marker.type === 'guard' ? 'G' : '●',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '800',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: marker.type === 'guard' ? 13 : 11,
              fillColor: markerColor(marker.type),
              fillOpacity: 1,
              strokeColor: '#07111d',
              strokeWeight: 3,
            },
          })

          markersRef.current.push(mapMarker)
        })

        if (validMarkers.length > 1) {
          const bounds = new google.maps.LatLngBounds()

          validMarkers.forEach(marker => {
            bounds.extend({
              lat: marker.latitude,
              lng: marker.longitude,
            })
          })

          mapRef.current.fitBounds(bounds, 70)
        } else if (validMarkers.length === 1) {
          mapRef.current.setCenter({
            lat: validMarkers[0].latitude,
            lng: validMarkers[0].longitude,
          })
          mapRef.current.setZoom(15)
        }
      } catch (err) {
        if (!active) return
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to synchronize map locations.',
        )
      }
    }

    void synchronizeMarkers()

    return () => {
      active = false
    }
  }, [markers])

  return (
    <div className="mission-map-shell">
      <div ref={containerRef} className="mission-google-map" />

      {error && (
        <div className="mission-map-error">
          <strong>MAP ENGINE OFFLINE</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="mission-map-engine-badge">
        <span />
        GOOGLE MAP ENGINE
      </div>
    </div>
  )
}
