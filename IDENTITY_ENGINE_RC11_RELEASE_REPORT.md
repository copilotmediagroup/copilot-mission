# Identity Engine RC1.1 — Role Integrity Release Report

## Architecture changes
- Declares `profiles.role` as the single identity authority.
- Adds database enforcement around all role-specific projections.
- Adds an Admin-only integrity report.

## Database changes
- Safely removes non-Client rows from `clients` when they have no dependent operational data.
- Repairs missing Client workspaces.
- Prevents future cross-role Client rows.
- Prevents mismatched Agency memberships and Guard roster entries.
- Blocks destructive role changes when Client properties or missions exist.
- Makes Platform Command Center client totals count only authoritative Client identities.

## Frontend changes
No new screen was added. Existing Command Center counts now reflect validated identities.

## Release gate
See `IDENTITY_ENGINE_RC11_ACCEPTANCE_GATE.md`.

## Known limitation
An invalid Client workspace with dependent properties or missions is not deleted automatically. It is retained and reported for deliberate transfer/archive to prevent data loss.
