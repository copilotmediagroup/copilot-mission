# Co Pilot Security Marketplace OS — RC2.3 Mission Execution Engine

## Responsibility
RC2.3 makes active mission execution database-authoritative from arrival through checkpoint completion, evidence and incident capture, proof review, submission, and recovery.

## Architectural correction
RC2.2 persisted route transitions but checkpoint progress, evidence, incidents, and proof state still lived in the React reducer. Realtime hydration therefore restored the mission only to the generic patrol screen and could overwrite local progress.

RC2.3 removes React as the authority. Supabase owns one execution record per mission in `mission_execution_state`.

## State machine

`active/patrol checkpoint 0 → checkpoint 1 → checkpoint 2 → checkpoint 3 → checkpoint 4 → checkpoint 5 → proof → completed`

Every transition validates the authenticated Guard, assignment ownership, current phase, expected checkpoint, required evidence, and unresolved incident drafts.

## Database changes
Migration: `supabase/migrations/202607250016_rc23_mission_execution_engine.sql`

Adds:
- `mission_execution_state`
- `ensure_guard_execution_state_rc23`
- `get_guard_execution_state_rc23`
- `save_guard_execution_payload_rc23`
- `complete_guard_checkpoint_rc23`
- `submit_guard_mission_rc23`

Direct authenticated table access is denied. All changes pass through security-definer commands.

## Frontend changes
- Guard login and Realtime recovery hydrate phase, checkpoint index, evidence, incidents, start time, and completion time.
- Evidence and incidents are saved to Supabase instead of remaining local-only.
- Complete Checkpoint writes and validates the transition before the UI advances.
- Review and completed states are hydrated from the execution engine.
- Realtime watches `mission_execution_state`.

## Verification gate
1. Run migration 202607250016.
2. Log in as the Guard already on an active mission.
3. Confirm the current mission opens.
4. Complete checkpoint 1.
5. Confirm checkpoint 2 remains visible.
6. Refresh and confirm checkpoint 2 resumes.
7. Add evidence, refresh, and confirm it remains.
8. Add an incident draft and verify checkpoint completion is blocked.
9. Submit or remove the draft and complete the checkpoint.
10. Complete Main Entrance only after its required photo.
11. Complete Rear Loading Dock only after its required photo.
12. Complete all six checkpoints.
13. Confirm Review & Submit opens.
14. Refresh and confirm Review & Submit resumes.
15. Submit the patrol.
16. Confirm assignment and mission become completed and Guard returns to available.
17. Confirm Agency, Client, and Mission Control receive the completed state.
18. Sign out/in at checkpoints 2–5 and confirm exact recovery each time.

## Release gate
RC2.3 passes only when all 18 checks pass without manual database edits or local-state recovery.

## Known limitations
- Evidence records currently persist capture metadata/counts; binary photo/video upload to Supabase Storage remains a later Evidence Engine responsibility.
- Checkpoint definitions are currently the approved six-checkpoint mission template. Dynamic client-authored checkpoint templates require a later Mission Configuration Engine.
- GPS radius is represented in the UI but server-side geofence verification is not yet enforced.
