# RC2.0 Unified Map Engine Contract

One Google Maps rendering authority serves Client and Guard mission views.

## Inputs
- Verified property coordinates
- Assigned Guard live coordinates or Guard device geolocation
- Mission completion state

## Outputs
- Real road map
- Property and Guard markers
- Google driving route
- Live ETA and distance
- Explicit GPS/configuration fallbacks

## Boundaries
This engine does not own mission state, dispatch, presence, authorization, or location persistence.
