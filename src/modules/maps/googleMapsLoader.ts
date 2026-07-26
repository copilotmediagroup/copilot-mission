import { GOOGLE_MAPS_API_KEY } from '../../config/googleMaps'

declare global {
  interface Window {
    google?: any
    __coPilotGoogleMapsPromise?: Promise<any>
  }
}

const apiKey = GOOGLE_MAPS_API_KEY.trim()

export function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google)
  if (!apiKey) return Promise.reject(new Error('Google Maps is not configured.'))
  if (window.__coPilotGoogleMapsPromise) return window.__coPilotGoogleMapsPromise

  window.__coPilotGoogleMapsPromise = new Promise((resolve, reject) => {
    const callback = `__coPilotMissionMapsReady_${Date.now()}`
    const timeout = window.setTimeout(() => {
      delete (window as any)[callback]
      reject(new Error('Google Maps took too long to load.'))
    }, 15000)

    ;(window as any)[callback] = () => {
      window.clearTimeout(timeout)
      delete (window as any)[callback]
      if (window.google?.maps) resolve(window.google)
      else reject(new Error('Google Maps loaded without the required map services.'))
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
