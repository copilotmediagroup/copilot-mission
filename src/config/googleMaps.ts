/**
 * Browser Google Maps key used by the free Bolt workflow.
 *
 * This key is intentionally loaded client-side because Google Maps JavaScript
 * keys are public in browser apps. Protect it in Google Cloud using Website
 * restrictions and API restrictions.
 */
export const GOOGLE_MAPS_API_KEY = 'AIzaSyDCDmX55mme_EMd6rXnjcwZeSyGwsn8Hzc'

export const DEFAULT_ADDRESS_BIAS = {
  latitude: 27.8661,
  longitude: -82.3265,
} as const
