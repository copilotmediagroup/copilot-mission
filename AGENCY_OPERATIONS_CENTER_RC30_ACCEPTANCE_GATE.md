# RC3.0 Agency Operations Center — Acceptance Gate

1. Apply `202607260006_rc30_agency_operations_center.sql`.
2. Sign in as an approved Agency administrator in Live Test mode.
3. Open **Operations**.
4. Confirm the Google map shows online Agency Guards with verified coordinates and Agency-owned active mission properties.
5. Confirm **Live Board**, **Dispatch Queue**, **In Motion**, **Emergency**, and **Completed** show distinct Mission Engine projections.
6. Claim a marketplace mission. Confirm it appears in Dispatch Queue without refreshing.
7. Assign an available Guard from the mission inspector.
8. Confirm the Guard becomes Reserved and the mission becomes Offered across the Operations Center.
9. Accept the assignment as the Guard. Confirm Agency state changes to Accepted/In Motion.
10. Start route, arrive, complete checkpoints, add evidence or incident, and submit.
11. Confirm progress, incident/evidence counts, Operations Feed, map, and KPIs update from realtime authority.
12. Confirm Completed missions leave active views and remain in Completed.
13. Confirm an emergency mission appears only in the Emergency queue and is prioritized in the full board.
14. Refresh the browser during each lifecycle phase. State must remain unchanged and correct.

RC3.0 passes only when all views agree on the same mission and Guard states throughout the full lifecycle.
