# RC2.2 — Route State Authority

## Defect corrected
The Guard portal advanced locally after **Start Route**, then Realtime hydration read the unchanged `accepted` assignment from Supabase and pulled the portal back to En Route.

## Database authority
`advance_guard_mission_rc22(job_id, action)` owns the legal transitions:

- `accepted -> en_route` through `start_route`
- `en_route -> active` through `mark_arrived`

The function verifies the authenticated Guard owns the assignment and rejects stale, repeated, or out-of-order actions.

## Frontend behavior
Live Guard actions no longer advance local state first. They:

1. Execute the database command.
2. Wait for success.
3. Reload the authoritative dispatch workspace.
4. Render the state returned by Supabase.

Hydration mapping:

- `accepted` -> En Route / Start Route
- `en_route` -> Arrival / Mark Arrived
- `active` -> Patrol

## Verification gate
1. Accepted mission opens on En Route.
2. Press Start Route once.
3. Portal remains on the arrival screen and does not snap backward.
4. Refresh; arrival screen is restored.
5. Press Mark Arrived once.
6. Portal enters Patrol.
7. Refresh; Patrol is restored.
8. Repeated or out-of-order commands are rejected.
9. Timeline receives one `route_started` and one `guard_arrived` database event.

## Known limitation
Checkpoint, evidence, incident, proof, and completion transitions remain local until the Mission Execution Engine makes them database-authoritative.
