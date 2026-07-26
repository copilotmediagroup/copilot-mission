# Live Location Engine v1.0 Acceptance Gate

1. Guard goes online and grants browser location permission.
2. Guard coordinates are written through `publish_guard_location`.
3. Refresh restores the latest coordinates from `guards`.
4. Agency sees only Guards in its approved Agency.
5. Platform Admin receives coordinates through the existing Live Operations projection.
6. A mission route stores ordered history points.
7. Location becomes stale after two minutes and expired after ten minutes.
8. Guard goes offline and location writes are rejected.
9. GPS writes never advance or change mission state.
10. Schema validation, import/export validation, TypeScript, and production build pass before release.
