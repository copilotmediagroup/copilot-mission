# Client Live Tracking Engine v1.0 — Acceptance Gate

1. Client creates a request: the experience shows Finding coverage.
2. Agency claims: agency identity appears without exposing unrelated agencies.
3. Guard is assigned and accepts: Guard identity and confirmation state appear.
4. Guard starts route: En route appears with live GPS freshness, approximate distance, and estimated arrival.
5. Location changes: the authorized Client view refreshes through Realtime without page refresh.
6. GPS stops for two minutes: the view says GPS delayed rather than pretending the location is live.
7. Guard arrives and patrol begins: the map experience becomes Patrol active and timeline advances.
8. Checkpoint events: mission timeline receives events without client writes.
9. Mission completes: live tracking changes to the completed mission record.
10. Agency publishes: View verified report appears and opens Client Reports.
11. Unrelated Client: cannot retrieve this mission or Guard.
12. Refresh/re-login: the same authoritative state is restored.
