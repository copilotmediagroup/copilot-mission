# RC1.4 Recovered Working Foundation

Recovery identity: `Co-Pilot-Security-Marketplace-RC1.4-RECOVERED-FOUNDATION-v1.0`

This repository was rebuilt from the uploaded GitHub snapshot and preserves the real Google Maps implementation.

## Frozen map authority

- `src/modules/maps/googleMapsLoader.ts`
- `src/modules/maps/UnifiedMissionMap.tsx`
- `src/ClientMissionMap.tsx`
- `src/ClientLiveTracking.tsx`
- `src/modules/maps/AgencyOperationsMap.tsx`

## Confirmed source contract

The shared map component contains:

- Google Maps JavaScript loading
- real road tiles
- property marker
- guard marker
- `DirectionsService`
- `DirectionsRenderer`
- driving-mode routing
- blue road-route styling
- distance and duration callback support

## Foundation rule

Do not overwrite this package with an older RC1 Foundation Lock, Client Live Tracking full repository, or an unmatched changes-only package.

Create a rollback copy immediately after browser acceptance.
