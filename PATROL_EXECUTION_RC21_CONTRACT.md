# RC2.1 Patrol Execution Engine — Contract

## Responsibility
Guide and audit a Guard's on-site patrol from confirmed arrival through ordered checkpoint completion and handoff to review.

## Authority
- Mission Engine remains the lifecycle authority.
- RC2.1 owns checkpoint completion audit records.
- Evidence and incidents remain stored in the Mission Engine payload.
- Realtime consumers read mission events; RC2.1 does not create a second timeline.

## Guard workflow
1. Start route.
2. Confirm arrival and intentionally start patrol.
3. Complete checkpoints in order.
4. Satisfy required evidence rules.
5. Resolve incident drafts.
6. Record completion timestamp and best-effort GPS proof.
7. Move to review only after checkpoint 6.

## Privacy
Only the assigned Guard may write or read checkpoint audit records through authenticated RPCs.
