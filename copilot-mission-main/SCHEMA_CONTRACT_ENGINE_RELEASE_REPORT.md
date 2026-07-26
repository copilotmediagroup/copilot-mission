# Schema Contract Engine v1.0 — Acceptance Build

## Root cause
Reporting functions referenced `agency_members.status`, but the canonical Agency membership schema uses `agency_members.is_active boolean`.

## Changes
- Repaired `get_agency_reports()` and `review_mission_report()`.
- Corrected the original Reporting migration for clean installations.
- Added migration `202607250021_schema_contract_engine.sql` for existing installations.
- Added build-time SQL contract validation.
- Added Platform Admin runtime contract report.
- Added the schema validator to the production build command.

## Known limitation
The build-time validator currently protects explicit contracts encoded in the repository. It is not a full SQL parser and does not connect to the live Supabase database during an offline build. The runtime report validates critical live columns after migration.
