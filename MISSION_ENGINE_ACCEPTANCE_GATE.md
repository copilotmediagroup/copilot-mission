# Mission Engine Acceptance Gate

Do not mark the Mission Engine complete until every check passes in one mission without manual Supabase edits.

## Clean lifecycle

1. Client creates a mission.
2. Mission appears in Marketplace.
3. Approved Agency claims it.
4. Mission disappears from competing Agencies.
5. Agency assigns an available Guard.
6. Guard receives the offer in Realtime.
7. Refresh Guard portal: offer remains.
8. Guard accepts: mission locks and Guard becomes On Mission.
9. Refresh: accepted mission resumes.
10. Start Route.
11. Refresh: route state remains.
12. Mark Arrived.
13. Refresh: checkpoint 1 remains.
14. Save optional evidence or notes and refresh: records remain.
15. Complete checkpoint 1 and refresh: checkpoint 2 remains.
16. Complete checkpoints 2–6 in order, satisfying required-photo rules.
17. Refresh after any checkpoint: exact next checkpoint returns.
18. Review opens only after checkpoint 6.
19. Refresh Review: Review returns without an update rejection.
20. Submit Patrol.
21. Mission becomes Completed.
22. Guard becomes Available.
23. Agency counts update consistently.
24. Client and Mission Control show Completed.
25. Timeline contains one ordered event per accepted transition.

## Decline path

1. Create and claim another mission.
2. Assign the Guard.
3. Guard declines.
4. Guard becomes Available.
5. Mission returns to the same Agency's awaiting-Guard queue.
6. Mission does not return to competing Agencies.
7. Agency can assign another available Guard.

## Recovery matrix

At each marked stage, test browser refresh, sign out/sign in, and new deployment hydration:

- Offered
- Accepted
- En Route
- Active checkpoint
- Mid-checkpoint sequence
- Review

## Release decision

- Any failed step: **NOT VERIFIED — remain on Mission Engine.**
- All steps pass: **MISSION ENGINE VERIFIED.**
