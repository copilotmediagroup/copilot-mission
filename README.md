# Co Pilot Security Marketplace v1.3.3

## Google Places Address Verification

This release replaces the open-source address search with Google Places so residential properties can be found accurately.

### Included
- Google Places address autocomplete
- United States-only results
- Browser-location bias with Riverview, Florida fallback
- Google Place Details verification
- Structured street, city, state and ZIP extraction
- Exact latitude and longitude storage
- Existing map-pin confirmation before save

## Google Cloud requirements
Enable billing and enable both:
- Maps JavaScript API
- Places API

Restrict the browser API key to those APIs and to the Bolt preview domain plus the production domain. The key is intentionally stored as `VITE_GOOGLE_MAPS_API_KEY` because browser Maps keys are public by design and must be protected through Google Cloud restrictions.

## Installation
Upload the package to GitHub and synchronize Bolt. No new Supabase migration is required.

## Test
Type `8624 Holly Grove`. Select `8624 Holly Grove Ct, Riverview, FL 33578`, verify the pin, and save the property.
