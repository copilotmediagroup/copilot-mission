# RC3.7 — Road Route Rendering Proof

This release isolates the marketplace road line and removes DirectionsRenderer as a hidden failure point.

The route authority now:

- requests one Google driving route using the selected guard and mission coordinates;
- captures the exact Google Directions status;
- extracts the returned road geometry;
- renders that geometry through a dedicated Google Maps Polyline;
- keeps the marketplace camera authority separate from route rendering;
- shows the actual failure reason instead of the generic `ROUTE UNAVAILABLE` state;
- logs the route status, coordinates, and failure reason under `[Co Pilot Route]`.

No SQL migration is required.
