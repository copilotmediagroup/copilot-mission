# Reporting Engine v1.0 — Acceptance Build

## Architecture
- Added `mission_reports` reporting authority.
- Added automatic report creation trigger when Mission Engine reaches `completed`.
- Added immutable report snapshots containing mission, property, client, Agency, Guard, evidence, incidents, and timeline.
- Added Agency review/publish commands.
- Added Client published-report archive.
- Added Platform reporting summary RPC.

## Database
Migration: `supabase/migrations/202607250020_reporting_engine.sql`

## Frontend
- Agency Reports now loads real reports and no longer displays a placeholder.
- Agency can review, request clarification, publish, and print.
- Client portal now includes Reports and reads only published reports.
- Realtime report subscriptions refresh Agency and Client surfaces.

## Release status
Implementation candidate only. It becomes verified only after the included acceptance gate passes end to end.

## Known limitations
- Print / Save PDF currently uses the browser print engine; server-generated PDF storage is not yet implemented.
- Clarification status is persisted, but a dedicated Guard clarification workflow is not yet implemented.
- Evidence metadata is included; actual Storage object rendering depends on evidence records containing accessible URLs.
