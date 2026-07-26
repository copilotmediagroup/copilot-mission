# Foundation Lock RC1 Change Set

This package is an additive engine change set for the verified `copilot-mission-main(3).zip` baseline.

It is not a replacement repository and must not be applied to the abandoned under-100-file or Boot Recovery branches.

Changed existing files:
- `src/App.tsx`
- `src/AgencyMarketplace.tsx`

Added files:
- `src/modules/location/liveLocationRepository.ts`
- `src/modules/location/useAgencyLiveLocations.ts`
- `supabase/migrations/202607250023_live_location_engine.sql`
- Live Location contract, acceptance gate, and release report
