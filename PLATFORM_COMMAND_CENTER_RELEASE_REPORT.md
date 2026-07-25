# Platform Admin Command Center Engine — Acceptance Build

## Architecture changes
- Added a dedicated Platform Command Center read model.
- Platform Admin observes existing engine authority instead of recreating business logic in React.
- Added one shared Realtime subscription covering all operational tables.

## Database changes
- Added `get_platform_command_center()`.
- Restricted execution to authenticated Platform Admin profiles.
- Snapshot includes platform totals, agencies, properties, guards, missions, Mission Engine state and the latest 100 timeline events.

## Frontend changes
- Replaced the narrow Mission Control page with Command, Missions, Guards, Properties and Agencies workspaces.
- All Platform metrics and tables are sourced from the same database snapshot.
- Preserved Agency approval, suspension and reactivation controls.
- Added responsive desktop and mobile Command Center layouts.

## Release gate
See `PLATFORM_COMMAND_CENTER_ACCEPTANCE_GATE.md`.

## Known limitations
- Live GPS route drawing is intentionally excluded until the Live Location Engine owns location updates, freshness and visibility rules.
- This is an acceptance build and is not labeled verified until the full gate is tested in the connected Supabase environment.
- Local dependency installation timed out, leaving incomplete type packages; Bolt must pass `npm install` and `npm run build`.
