# Co Pilot Security Marketplace OS — RC2 Dispatch Engine

## Engine responsibility
RC2 owns the mission handoff after Marketplace claim: Agency offer, Guard response, mission lock, timeline start, and realtime projections.

## Database authority
- `job_assignments` is the assignment state authority.
- `guards.availability` is the Guard capacity authority.
- `marketplace_jobs.status` is the cross-role mission projection.
- `mission_events` is the immutable operational timeline.

## State machine

`awaiting_guard → offered → accepted`

or

`awaiting_guard → offered → declined → awaiting_guard`

An accepted assignment is locked. A declined assignment remains owned by the claiming Agency and never returns to Marketplace.

## Architecture changes
- Agency dispatch workspace reads claimed missions and Agency-owned Guards.
- Agency assignment invokes one database command.
- Guard workspace receives only the authenticated Guard's current assignment.
- Guard response invokes one database command.
- Client, Agency, Guard, and Platform Admin subscribe to the authoritative tables through Supabase Realtime.

## Database changes
Apply:

`supabase/migrations/202607250014_rc2_dispatch_engine_release.sql`

This final release migration:
- Prevents replacing a Guard while an offer is outstanding.
- Allows assignment only from `awaiting_guard`.
- Reserves the Guard atomically with the offer.
- Locks the mission atomically with Guard acceptance.
- Returns a declined mission only to the claiming Agency queue.
- Writes timeline events for offer, acceptance, lock, timeline start, and decline.

## Verification checklist
1. Client creates a mission.
2. Mission appears in Marketplace and Mission Control.
3. Agency claims the mission.
4. Mission disappears from competing Agencies.
5. Claimed mission appears in Agency Operations as `awaiting_guard`.
6. Only Agency Guards in `available` state appear in Assign.
7. Agency assigns one Guard.
8. Mission becomes `assigned`; assignment becomes `offered`; Guard becomes `reserved`.
9. Guard receives the offer without refreshing.
10. A second assignment attempt is rejected while the offer is outstanding.
11. Guard declines.
12. Guard becomes `available`; mission returns to `awaiting_guard` for the same Agency.
13. Mission does not reappear in competing Agency Marketplace views.
14. Agency assigns again.
15. Guard accepts.
16. Assignment becomes `accepted`; mission becomes `active`; Guard becomes `on_mission`.
17. `locked_at` is populated.
18. `dispatch_timeline_started` appears in Mission Control.
19. Client mission status updates to `active` through Realtime.
20. Agency Operations shows the assigned Guard and locked mission.
21. Duplicate Guard response is rejected.
22. Refresh Client, Agency, Guard, and Platform views; all states remain consistent.

## Release gate
RC2 passes only when all 22 checks pass without manual Supabase edits, page-specific state corrections, or a mission returning to Marketplace after claim.

## Known limitations
- Automatic expiration and reassignment of unanswered 15-minute offers is not yet scheduled; the deadline is recorded for a later timeout worker.
- Route, arrival, checkpoint, proof, and completion transitions belong to RC3 Mission Execution Engine.
- Push notifications are not configured; assignment delivery currently depends on the active Realtime session.
