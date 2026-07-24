export type VerifiedAddress = {
  formattedAddress: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  provider: 'photon'
  providerId: string
}

export type AddressBias = { latitude: number; longitude: number }

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | number | undefined>
}

type PhotonResponse = { features?: PhotonFeature[] }

const endpoint = import.meta.env.VITE_ADDRESS_SEARCH_URL || 'https://photon.komoot.io/api/'
const defaultBias: AddressBias = {
  latitude: Number(import.meta.env.VITE_ADDRESS_BIAS_LAT || 27.8661),
  longitude: Number(import.meta.env.VITE_ADDRESS_BIAS_LON || -82.3265),
}

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
  const countryCode = text(p.countrycode).toLowerCase()
  const formattedAddress = [street, city, state, postalCode, country].filter(Boolean).join(', ')
  if (!formattedAddress) return null
  return {
    formattedAddress,
    street,
    city,
    state,
    postalCode,
    country,
    countryCode,
    latitude,
    longitude,
    provider: 'photon',
    providerId: `${text(p.osm_type)}:${String(p.osm_id ?? index)}`,
  }
}

function distanceMiles(a: AddressBias, b: AddressBias) {
  const toRad = (value:number) => value * Math.PI / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
}

function rank(item: VerifiedAddress, query: string, bias: AddressBias) {
  const q = query.toLowerCase()
  let score = 0
  if (item.countryCode === 'us' || /united states/i.test(item.country)) score += 500
  if (/florida/i.test(item.state)) score += 120
  if (/riverview/i.test(item.city)) score += 180
  if (/^\d+\s/.test(item.street)) score += 220
  if (item.postalCode) score += 35
  if (item.street && q.split(/\s+/).some(part => part.length > 3 && item.street.toLowerCase().includes(part))) score += 80
  score -= Math.min(distanceMiles(bias, item), 1000) * 0.45
  return score
}

export async function searchVerifiedAddresses(query: string, signal?: AbortSignal, bias: AddressBias = defaultBias): Promise<VerifiedAddress[]> {
  const cleaned = query.trim()
  if (cleaned.length < 4) return []
  const url = new URL(endpoint)
  url.searchParams.set('q', cleaned)
  url.searchParams.set('limit', '20')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('lat', String(bias.latitude))
  url.searchParams.set('lon', String(bias.longitude))
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Address search is temporarily unavailable.')
  const payload = await response.json() as PhotonResponse
  const seen = new Set<string>()
  return (payload.features ?? [])
    .map(mapFeature)
    .filter((item): item is VerifiedAddress => Boolean(item))
    .filter(item => item.countryCode === 'us' || /united states/i.test(item.country))
    .sort((a,b) => rank(b, cleaned, bias) - rank(a, cleaned, bias))
    .filter(item => {
      const key = `${item.formattedAddress}|${item.latitude.toFixed(5)}|${item.longitude.toFixed(5)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}
