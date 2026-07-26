# Live Operations Engine v1.0 — Acceptance Build

Implemented one read-only Platform Admin observability engine with realtime subscriptions, global counters, mission pipeline, event feed, guard location freshness, and engine-health indicators.

## Known limitations
- GPS coordinates are map-ready, but route drawing belongs to the future Live Location Engine.
- Storage and Notification health show `not_configured` until those engines exist.
- This is an acceptance build and is not verified until the acceptance gate passes.
