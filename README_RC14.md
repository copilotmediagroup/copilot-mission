# RC1.4 Real Map Rendering Engine — Installation

Upload this changeset over the current RC1.3.2 repository while preserving folders.

No Supabase migration is required.

Google Cloud must allow the Bolt preview and deployed domains and must have these APIs enabled:
- Maps JavaScript API
- Directions API
- Places API

Acceptance path:
1. Open Client Portal → Active Requests.
2. Confirm the visual mock map is replaced by Google roads.
3. Before Guard GPS, confirm the property marker and WAITING FOR GPS state.
4. Put the assigned Guard online and allow location.
5. Confirm the Guard marker and real road route appear.
6. Move/update the Guard location and confirm the marker and route update.
