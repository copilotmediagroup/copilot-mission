# RC1.3 — Guard Presence Engine

## Responsibility
Own the authenticated Guard's online/offline state and publish the resulting database truth to Agency and Dispatch surfaces.

## Database authority
- `set_guard_presence_rc13(boolean)` is the only Guard-facing presence command.
- `get_guard_presence_rc13()` hydrates Guard UI state from the database.
- `guards.availability` remains the authoritative current state.
- `guard_presence_events` provides an immutable transition audit.

## State machine
- `offline → available` when the Guard goes online.
- `available → offline` when the Guard goes offline.
- `reserved` and `on_mission` cannot transition offline from the presence control.
- Dispatch continues to own `available → reserved → on_mission`.

## Frontend changes
- Guard buttons now execute the database command before changing React state.
- Failed database commands leave the Guard UI unchanged and show the error.
- Guard portal hydrates online/offline state from Supabase after login or refresh.
- Agency counts, roster, and Dispatch selector already subscribe to `guards` changes.

## Verification checklist
1. Run migration `202607250013_guard_presence_engine.sql`.
2. Log in as Agency and confirm Total Guards = 1, Online = 0, Available = 0.
3. Log in as that Guard in an incognito window.
4. Press Go Online.
5. Confirm Guard UI enters online state only after the command succeeds.
6. Confirm the Guard row changes to `available` in Supabase.
7. Confirm Agency Online Guards becomes 1 without a manual data edit.
8. Confirm Agency Available becomes 1.
9. Confirm Operations says `1 guard available`.
10. Confirm the Assign dropdown contains the Guard.
11. Assign the Guard and confirm availability becomes `reserved`.
12. Confirm Guard receives the assignment in Realtime.
13. Attempt to go offline while reserved; confirm the database rejects it.
14. Decline; confirm availability returns to `available` and mission remains with Agency.
15. Press Go Offline; confirm Agency Online and Available both return to 0.
16. Refresh the Guard portal; confirm it hydrates as offline.
17. Go online, refresh the Guard portal; confirm it hydrates as online.

## Release gate
RC1.3 passes only when steps 1–17 pass without manual Supabase edits or page-state simulation.

## Known limitations
- Browser close/disconnection does not automatically mark a Guard offline. Heartbeat and stale-presence expiry belong to a later Presence Reliability release.
- Presence records current operational state, not GPS location.
