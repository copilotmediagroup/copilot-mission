export type VerifiedAddress = {
  formattedAddress: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  latitude: number
  longitude: number
  provider: 'photon'
  providerId: string
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | number | undefined>
}

type PhotonResponse = { features?: PhotonFeature[] }

const endpoint = import.meta.env.VITE_ADDRESS_SEARCH_URL || 'https://photon.komoot.io/api/'

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

function mapFeature(feature: PhotonFeature, index: number): VerifiedAddress | null {
  const coordinates = feature.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) return null
  const [longitude, latitude] = coordinates
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const p = feature.properties ?? {}
  const house = text(p.housenumber)
  const streetName = text(p.street) || text(p.name)
  const street = [house, streetName].filter(Boolean).join(' ')
  const city = text(p.city) || text(p.town) || text(p.village) || text(p.county)
  const state = text(p.state)
  const postalCode = text(p.postcode)
  const country = text(p.country)
  const formattedAddress = [street, city, state, postalCode, country].filter(Boolean).join(', ')
  if (!formattedAddress) return null
  return {
    formattedAddress,
    street,
    city,
    state,
    postalCode,
    country,
    latitude,
    longitude,
    provider: 'photon',
    providerId: `${text(p.osm_type)}:${String(p.osm_id ?? index)}`,
  }
}

export async function searchVerifiedAddresses(query: string, signal?: AbortSignal): Promise<VerifiedAddress[]> {
  const cleaned = query.trim()
  if (cleaned.length < 4) return []
  const url = new URL(endpoint)
  url.searchParams.set('q', cleaned)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Address search is temporarily unavailable.')
  const payload = await response.json() as PhotonResponse
  const seen = new Set<string>()
  return (payload.features ?? [])
    .map(mapFeature)
    .filter((item): item is VerifiedAddress => Boolean(item))
    .filter(item => {
      const key = `${item.formattedAddress}|${item.latitude.toFixed(5)}|${item.longitude.toFixed(5)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
