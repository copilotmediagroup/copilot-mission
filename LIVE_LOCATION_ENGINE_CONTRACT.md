# Live Location Engine v1.0 Contract

## Responsibility
Own authenticated Guard GPS writes, freshness classification, route history, and role-scoped reads.

## Database authority
- `guards.current_latitude`
- `guards.current_longitude`
- `guards.last_location_at`
- `guard_location_points`

## Public repository contract
- `publishGuardLocation`
- `getGuardLocationState`
- `getAgencyLiveLocations`
- `getPlatformLiveLocations`
- `getMissionRouteHistory`
- `subscribeToLocationChanges`

## Boundaries
The engine never changes Guard presence, assignment ownership, or mission state. Those remain owned by Presence, Dispatch, and Mission engines.
