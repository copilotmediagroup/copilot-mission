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
  provider: 'google'
  providerId: string
}

export type AddressSuggestion = {
  providerId: string
  primaryText: string
  secondaryText: string
  description: string
}

export type AddressBias = { latitude: number; longitude: number }

declare global {
  interface Window {
    google?: any
    __coPilotGoogleMapsPromise?: Promise<any>
  }
}

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const defaultBias: AddressBias = {
  latitude: Number(import.meta.env.VITE_ADDRESS_BIAS_LAT || 27.8661),
  longitude: Number(import.meta.env.VITE_ADDRESS_BIAS_LON || -82.3265),
}

let autocompleteService: any
let placesService: any
let sessionToken: any

function mapsError() {
  return new Error('Google address search is not configured. Check the Maps API key and enable Places API and Maps JavaScript API.')
}

function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (!apiKey) return Promise.reject(mapsError())
  if (window.__coPilotGoogleMapsPromise) return window.__coPilotGoogleMapsPromise

  window.__coPilotGoogleMapsPromise = new Promise((resolve, reject) => {
    const callback = `__coPilotMapsReady_${Date.now()}`
    const timeout = window.setTimeout(() => {
      delete (window as any)[callback]
      reject(new Error('Google Maps took too long to load.'))
    }, 15000)

    ;(window as any)[callback] = () => {
      window.clearTimeout(timeout)
      delete (window as any)[callback]
      if (window.google?.maps?.places) resolve(window.google)
      else reject(mapsError())
    }

    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&callback=${callback}`
    script.onerror = () => {
      window.clearTimeout(timeout)
      delete (window as any)[callback]
      reject(new Error('Unable to load Google Maps. Verify the API key restrictions and enabled APIs.'))
    }
    document.head.appendChild(script)
  })

  return window.__coPilotGoogleMapsPromise
}

async function services() {
  const google = await loadGoogleMaps()
  autocompleteService ||= new google.maps.places.AutocompleteService()
  if (!placesService) {
    const host = document.createElement('div')
    placesService = new google.maps.places.PlacesService(host)
  }
  sessionToken ||= new google.maps.places.AutocompleteSessionToken()
  return { google, autocompleteService, placesService }
}

export async function searchAddressSuggestions(
  query: string,
  _signal?: AbortSignal,
  bias: AddressBias = defaultBias,
): Promise<AddressSuggestion[]> {
  const cleaned = query.trim()
  if (cleaned.length < 4) return []
  const { google, autocompleteService } = await services()

  return new Promise((resolve, reject) => {
    autocompleteService.getPlacePredictions({
      input: cleaned,
      componentRestrictions: { country: 'us' },
      types: ['address'],
      location: new google.maps.LatLng(bias.latitude, bias.longitude),
      radius: 80000,
      sessionToken,
    }, (predictions: any[] | null, status: string) => {
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) return resolve([])
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        return reject(new Error('Google could not search addresses right now.'))
      }
      resolve(predictions.slice(0, 6).map(prediction => ({
        providerId: prediction.place_id,
        primaryText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || '',
        description: prediction.description,
      })))
    })
  })
}

function component(components: any[], type: string, short = false) {
  const match = components.find(item => item.types?.includes(type))
  return match ? (short ? match.short_name : match.long_name) : ''
}

export async function resolveAddressSuggestion(suggestion: AddressSuggestion): Promise<VerifiedAddress> {
  const { google, placesService } = await services()
  return new Promise((resolve, reject) => {
    placesService.getDetails({
      placeId: suggestion.providerId,
      fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
      sessionToken,
    }, (place: any, status: string) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
        return reject(new Error('Google could not verify that address. Please select it again.'))
      }
      const parts = place.address_components || []
      const number = component(parts, 'street_number')
      const route = component(parts, 'route')
      const street = [number, route].filter(Boolean).join(' ')
      const city = component(parts, 'locality') || component(parts, 'postal_town') || component(parts, 'sublocality')
      const state = component(parts, 'administrative_area_level_1', true)
      const postalCode = component(parts, 'postal_code')
      const country = component(parts, 'country')
      const countryCode = component(parts, 'country', true).toLowerCase()
      const latitude = place.geometry.location.lat()
      const longitude = place.geometry.location.lng()
      sessionToken = new google.maps.places.AutocompleteSessionToken()
      resolve({
        formattedAddress: place.formatted_address || suggestion.description,
        street,
        city,
        state,
        postalCode,
        country,
        countryCode,
        latitude,
        longitude,
        provider: 'google',
        providerId: place.place_id || suggestion.providerId,
      })
    })
  })
}
