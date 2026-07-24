# Co Pilot Security Marketplace v1.3.1

## Verified Address Location

This release replaces free-form property addresses with one-field verified address search. Clients do not need commas. They type naturally, select the correct suggestion, and the application saves:

- formatted address
- street
- city
- state
- postal code
- latitude and longitude
- geocoding provider and place reference

The saved coordinates are the source of truth for future map markers, distance calculations, agency service radius, guard routing, and ETA.

## Database

Run only the new additive migration after uploading this release:

`supabase/migrations/202607240003_verified_property_locations.sql`

Do not rerun prior migrations.

## Address provider

The development default is the public Photon/OpenStreetMap endpoint. Production can point `VITE_ADDRESS_SEARCH_URL` to a managed Photon instance or compatible proxy without changing the UI.
