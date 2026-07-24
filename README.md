# Co Pilot Security Marketplace v1.4.0

## Multi-Portal Developer Mode

This release restores a safe visual developer mode for switching between Client, Agency, Guard, Platform Admin, and the Guard Mission State Lab without changing the authenticated Supabase account.

Open `/developer` or use the discreet Developer Mode control inside any authenticated portal. Exit Developer Mode to return to the actual signed-in role.

No Supabase migration is required.

# Co Pilot Security Marketplace v1.3.3.3

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

Restrict the browser API key to those APIs and to the Bolt preview domain plus the production domain. For the free Bolt workflow, the browser key is stored directly in `src/config/googleMaps.ts`. Browser Maps keys are public by design, so protect it through Google Cloud Website restrictions and API restrictions.

## Installation
Upload the package to GitHub and synchronize Bolt. No new Supabase migration is required.

## Test
Type `8624 Holly Grove`. Select `8624 Holly Grove Ct, Riverview, FL 33578`, verify the pin, and save the property.

## v1.3.3.3 — Free Bolt Key Configuration Hotfix

- Removes the dependency on Bolt paid environment variables.
- Loads the Google Maps browser key from `src/config/googleMaps.ts`.
- Keeps the Riverview, Florida address bias.
- No Supabase migration is required.

After upload, restart the app with `npm run dev`. Restrict the key in Google Cloud to the Bolt preview domain and your production domain, and allow only Maps JavaScript API, Places API, Places API (New), and Geocoding API.


## v1.3.3.3 Production Compile Hotfix
- Corrected Agency Marketplace activity literal typing.
- Corrected nullable Supabase realtime cleanup typing.
- Corrected React timeline subscription cleanup return type.
- Replaced the blocked OpenStreetMap confirmation iframe with a Google Maps coordinate preview.
- Verified production TypeScript and Vite build.


## v1.3.3.3
- Fixed strict TypeScript Activity union inference in AgencyMarketplace production builds.
- Netlify/Vite production compile hotfix.
