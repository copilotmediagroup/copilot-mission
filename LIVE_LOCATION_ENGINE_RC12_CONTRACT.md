# RC1.2 Live Location Engine Contract

## Responsibility
Persist Guard GPS coordinates and expose authorized live-location projections.

## Owns
- Latitude and longitude
- Accuracy, heading, and speed
- Latest location timestamp
- Location freshness
- Mission route history
- Realtime location delivery through `guards` updates

## Does not own
- Guard online/offline transitions
- Mission state
- Dispatch state
- Timeline events
- Reports or notifications

## Database authority
- `guard_location_history`
- `publish_guard_location_rc12(...)`
- `get_agency_live_locations_rc12()`
- `get_platform_live_locations_rc12()`
- `get_mission_route_history_rc12(uuid)`

## Repository exports
- `publishGuardLocation`
- `getAgencyLiveLocations`
- `getPlatformLiveLocations`
- `getMissionRouteHistory`
- `subscribeToGuardLocations`

## Authorization
- Guard publishes only their own GPS and only while online.
- Agency receives only its Guard locations.
- Platform Admin may retrieve all Guard locations.
- Route history is limited to Platform Admin, owning Agency, or assigned Guard.
