# RC2.1 — Guard Mission State Recovery

## Defect corrected
An accepted assignment remained authoritative in Supabase after a refresh or new deployment, but the Guard portal restarted from its local `offline/waiting` reducer state. The Agency correctly showed the Guard as `on_mission`, while the Guard portal incorrectly showed "online and available."

## Architecture correction
The Dispatch Engine now hydrates the Guard mission state from `get_guard_dispatch_workspace_rc2()` on login, refresh, Realtime change, and deployment replacement.

Database status mapping:

- `offered` → Guard assignment screen
- `accepted` / `en_route` → En Route screen
- `arrived` → Arrived screen
- `active` → Patrol screen
- no active assignment + offline presence → Offline screen
- no active assignment + online presence → Waiting screen

The UI is no longer allowed to infer an active mission solely from local React history.

## Release gate
1. Accept a mission as Guard.
2. Confirm Agency shows `On Mission`.
3. Refresh the Guard browser.
4. Confirm Guard returns to the active mission, not the waiting screen.
5. Sign out and sign back in.
6. Confirm Guard returns to the active mission.
7. Replace/redeploy the frontend ZIP.
8. Confirm Guard returns to the active mission.
9. Confirm an offered-but-unanswered assignment reopens the assignment screen.
10. Confirm an offline Guard with no assignment opens offline.
11. Confirm an available Guard with no assignment opens waiting.

## Database changes
None. This release corrects frontend hydration against the existing Dispatch database authority.

## Known limitation
Mission execution transitions after acceptance are still primarily frontend state transitions. Their database authority belongs to the next Mission Execution Engine and is not claimed complete by this release.
