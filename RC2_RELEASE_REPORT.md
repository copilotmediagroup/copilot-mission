# RC2 — Dispatch Engine Release Report

## Engine responsibility
RC2 owns the operational handoff from an Agency that has claimed a marketplace mission to the Guard who must accept or decline it.

## Database authority
The database is the sole authority for assignment and response transitions. The UI cannot directly mutate mission ownership, lock state, guard availability, or timeline events.

### State machine
- `awaiting_guard` → `offered` when the owning Agency assigns an available Guard.
- `offered` → `accepted` when that Guard accepts.
- `offered` → `awaiting_guard` when that Guard declines.
- A declined mission remains owned by the Agency and never returns to `open` Marketplace status.
- Acceptance atomically locks the mission, marks the Guard `on_mission`, changes the marketplace mission to `active`, and writes the timeline-start event.

## Architecture changes
- Added `src/modules/dispatch/dispatchRepository.ts` as the only frontend gateway to RC2 database commands and projections.
- Agency Operations now consumes the Agency dispatch projection and assigns only available Guards.
- Guard runtime now consumes the Guard dispatch projection and responds through database commands.
- Realtime subscriptions refresh Agency and Guard projections after assignment, mission, event, or guard availability changes.

## Database changes
Migration: `supabase/migrations/202607250009_rc2_dispatch_engine.sql`

Added assignment metadata:
- `offered_at`
- `declined_at`
- `locked_at`
- `response_deadline`
- `assignment_version`

Added database-owned commands and projections:
- `get_agency_dispatch_workspace_rc2()`
- `assign_guard_rc2(job_id, guard_id)`
- `get_guard_dispatch_workspace_rc2()`
- `respond_to_assignment_rc2(job_id, response)`
- `dispatch_mission_json_rc2(job_id)` internal projection helper

## Frontend changes
- Agency Operations displays claimed missions by authoritative dispatch status.
- Agency can assign an available Guard to an `awaiting_guard` mission.
- Guard receives the assigned mission through Supabase Realtime.
- Guard assignment screen renders live mission, property, priority, address, and photo data.
- Guard Accept and Decline execute database transitions before local UI advancement.
- Build badges identify RC2 Dispatch Engine.

## Verification checklist
Run in Live Test mode with separate Client, Agency, Guard, and Platform Admin sessions.

1. Client creates a mission.
2. Approved Agency claims it.
3. Confirm competing Agency no longer sees it.
4. Owning Agency opens Operations and sees `AWAITING GUARD`.
5. Confirm only available Guards are assignable.
6. Assign Guard A.
7. Confirm Agency status changes to `OFFERED` and Guard A becomes `reserved`.
8. Confirm Guard A receives the assignment without refresh.
9. Decline as Guard A.
10. Confirm mission remains owned by the same Agency, returns to `AWAITING GUARD`, Guard A becomes `available`, and no competing Agency sees it.
11. Assign Guard B.
12. Accept as Guard B.
13. Confirm assignment becomes `accepted`, `locked_at` is populated, Guard B becomes `on_mission`, and marketplace mission becomes `active`.
14. Confirm `guard_accepted` event contains `mission_locked: true` and `timeline_started_at`.
15. Confirm Agency, Guard, Client mission data, and Mission Control refresh through Realtime.
16. Attempt duplicate assignment or response and confirm the database rejects the illegal transition.

## Release gate
RC2 passes only when all 16 checks succeed against the target Supabase project with no manual table edits.

## Known limitations
- RC2 ends at accepted/locked dispatch. En-route, arrival, patrol, proof, and completion database commands remain owned by later engines.
- Assignment timeout metadata is stored, but automated expiration/reassignment is intentionally not enabled in RC2.
- Guard creation/onboarding must already have produced a valid `guards` row and active Agency membership.
- Client and Platform Mission Control already refresh from marketplace and mission events; dedicated dispatch-specific presentation can be expanded later without changing RC2 authority.
