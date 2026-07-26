import { useEffect, useRef, useState } from 'react'
import { Building2, LocateFixed, MapPin } from 'lucide-react'
import { loadGoogleMaps } from './modules/maps/googleMapsLoader'
import type { ClientTrackingExperience, TrackingFreshness } from './modules/client/clientLiveTrackingRepository'

type Props = {
  experience: NonNullable<ClientTrackingExperience>
  completed: boolean
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#091722' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#091722' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8297aa' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a9bdcf' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#183043' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0c1d2a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7890a3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#21445e' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06101a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#47687f' }] },
]

function svgIcon(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const PROPERTY_ICON = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#ef4444" fill-opacity=".22"/><circle cx="26" cy="26" r="16" fill="#ef4444"/><path d="M19 24.5 26 19l7 5.5V34H19z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M23 34v-6h6v6" fill="none" stroke="white" stroke-width="2"/></svg>')
const GUARD_ICON = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#1684ff" fill-opacity=".22"/><circle cx="26" cy="26" r="16" fill="#1684ff"/><path d="M26 17.5 33 20v5.5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V20z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>')

export default function ClientMissionMap({ experience, completed }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const guardMarkerRef = useRef<any>(null)
  const propertyMarkerRef = useRef<any>(null)
  const directionsRendererRef = useRef<any>(null)
  const directionsServiceRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(0)
  const property = experience.property
  const guard = experience.guard
  const propertyPoint = validPoint(property.latitude, property.longitude)
  const guardPoint = validPoint(guard?.latitude, guard?.longitude)

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      if (!hostRef.current || !propertyPoint) return
      try {
        const google = await loadGoogleMaps()
        if (cancelled || !hostRef.current) return
        const map = new google.maps.Map(hostRef.current, {
          center: propertyPoint,
          zoom: 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
          styles: DARK_MAP_STYLE,
          backgroundColor: '#091722',
        })
        mapRef.current = map
        propertyMarkerRef.current = new google.maps.Marker({
          map,
          position: propertyPoint,
          title: property.name,
          icon: { url: PROPERTY_ICON, scaledSize: new google.maps.Size(52, 52), anchor: new google.maps.Point(26, 26) },
          zIndex: 3,
        })
        directionsServiceRef.current = new google.maps.DirectionsService()
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: { strokeColor: '#2d92ff', strokeOpacity: 0.9, strokeWeight: 5 },
        })
        setError(null)
        setMapReady(value => value + 1)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load the live map.')
      }
    }
    void initialize()
    return () => {
      cancelled = true
      guardMarkerRef.current?.setMap(null)
      propertyMarkerRef.current?.setMap(null)
      directionsRendererRef.current?.setMap(null)
      mapRef.current = null
    }
  }, [property.id, property.latitude, property.longitude])

  useEffect(() => {
    const map = mapRef.current
    const google = window.google
    if (!map || !google?.maps || !propertyPoint) return

    if (!guardPoint || completed) {
      guardMarkerRef.current?.setMap(null)
      guardMarkerRef.current = null
      directionsRendererRef.current?.setDirections({ routes: [] })
      map.panTo(propertyPoint)
      map.setZoom(16)
      return
    }

    if (!guardMarkerRef.current) {
      guardMarkerRef.current = new google.maps.Marker({
        map,
        position: guardPoint,
        title: guard?.name || 'Assigned guard',
        icon: { url: GUARD_ICON, scaledSize: new google.maps.Size(52, 52), anchor: new google.maps.Point(26, 26) },
        zIndex: 4,
      })
    } else {
      animateMarker(guardMarkerRef.current, guardPoint)
    }

    directionsServiceRef.current?.route({
      origin: guardPoint,
      destination: propertyPoint,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    }, (result: any, status: string) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        directionsRendererRef.current?.setDirections(result)
      } else {
        const bounds = new google.maps.LatLngBounds()
        bounds.extend(guardPoint)
        bounds.extend(propertyPoint)
        map.fitBounds(bounds, 70)
      }
    })
  }, [guard?.latitude, guard?.longitude, property.latitude, property.longitude, completed, mapReady])

  return <div className="tracking-map-grid real-map" aria-label="Live Google mission map">
    {propertyPoint ? <div ref={hostRef} className="tracking-google-map" /> : <div className="tracking-map-unavailable"><Building2/><strong>Property map unavailable</strong><span>This property needs verified coordinates.</span></div>}
    {error ? <div className="tracking-map-error">{error}</div> : null}
    <div className="tracking-map-address"><MapPin/><span><small>SECURITY LOCATION</small><b>{property.name}</b><em>{property.address}</em></span></div>
    <span className={`tracking-freshness ${guard?.freshness || 'none'}`}><LocateFixed/>{freshnessLabel(guard?.freshness)}</span>
  </div>
}

function validPoint(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { lat: latitude, lng: longitude }
}

function freshnessLabel(value?: TrackingFreshness) {
  return value === 'live' ? 'LIVE GPS' : value === 'stale' ? 'GPS DELAYED' : value === 'expired' ? 'GPS UNAVAILABLE' : 'WAITING FOR GPS'
}

function animateMarker(marker: any, destination: { lat: number; lng: number }) {
  const start = marker.getPosition()
  if (!start) return marker.setPosition(destination)
  const from = { lat: start.lat(), lng: start.lng() }
  const startedAt = performance.now()
  const duration = 700
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    marker.setPosition({
      lat: from.lat + (destination.lat - from.lat) * eased,
      lng: from.lng + (destination.lng - from.lng) * eased,
    })
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
