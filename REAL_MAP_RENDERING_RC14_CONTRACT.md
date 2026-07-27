# RC1.4 Real Map Rendering Engine Contract

## Responsibility
Render the authorized Client mission on Google Maps using existing RC1.2 live-location and RC1.3 client-tracking truth.

## Inputs
- Verified property latitude/longitude
- Assigned Guard latitude/longitude and freshness
- Mission completion state

## Behavior
- Property marker is always limited to the Client's authorized mission.
- Guard marker appears only when an assigned Guard has an authorized location.
- Google Directions draws the real driving route between Guard and property.
- Marker movement is visually interpolated between realtime updates.
- On completion, Guard and route are removed and the property becomes the focus.
- No new mission, presence, location, dispatch, or report authority is introduced.

## Failure states
- Missing property coordinates: show a clear coordinate-required state.
- Maps load failure: show an inline configuration error without breaking tracking.
- Directions failure: retain both markers and fit the map to their bounds.
