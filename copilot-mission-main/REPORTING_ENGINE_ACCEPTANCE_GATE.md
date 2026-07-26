# Reporting Engine v1.0 — Acceptance Gate

Do not mark verified unless every step passes.

1. Complete a mission through the Mission Engine.
2. Confirm one `mission_reports` row is created automatically.
3. Open Agency → Reports and confirm the report appears as Pending Review.
4. Open the report and verify property, client, Agency, Guard, checkpoint, evidence, incident, and timeline data.
5. Refresh and confirm the same report and state return.
6. Attempt Return for Clarification without a note and confirm it is blocked.
7. Publish the report.
8. Confirm Agency status changes to Published and version increments.
9. Log in as the owning Client and confirm the report appears under Reports.
10. Confirm another Client cannot read it.
11. Refresh Client Reports and confirm it remains available.
12. Confirm Platform Admin can query reporting status through `get_platform_report_summary()`.
13. Confirm the original Mission Engine snapshot facts cannot be edited through Agency or Client UI.
14. Print / Save PDF from the published report.
