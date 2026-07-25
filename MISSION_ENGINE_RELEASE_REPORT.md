# Mission Engine — Acceptance Build

## Architecture changes

- Added one mission lifecycle record: `mission_engine_state`.
- Added one Guard snapshot RPC: `get_guard_mission_snapshot`.
- Added one Guard transition RPC: `transition_guard_mission`.
- Added assignment synchronization so Agency assignment creates/updates the same mission authority.
- Redirected legacy dispatch, route, and execution RPCs into the Mission Engine.

## Frontend changes

- Guard portal hydrates from the Mission Engine snapshot.
- Offer, accept, decline, route, arrival, payload save, checkpoint completion, and submission use the same transition command.
- Review submission no longer attempts an illegal checkpoint payload save before completion.
- Realtime subscribes to the Mission Engine table.

## Database changes

Run:

`supabase/migrations/202607250017_mission_engine_authority.sql`

The migration backfills current assignment/execution records, including an existing mission already at Review.

## Verification status

Package integrity: passed.

Static production compile: not certified in this container because dependency installation did not complete and required TypeScript definition packages were unavailable.

End-to-end engine verification: pending the attached acceptance gate in Bolt/Supabase.
