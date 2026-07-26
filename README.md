# Co Pilot Security Marketplace RC1 — Foundation Lock

This package is the matched RC1 frontend and database correction. It is designed for the database where `202607250005_rc1_foundation_lock.sql` has already been applied.

## Required corrective migration

Run this file once in Supabase SQL Editor before testing the package:

`supabase/migrations/202607250006_rc1_matched_release.sql`

Do not rerun older migrations.

## RC1 behavior

- Preview is simulation-only and never writes to Supabase.
- Live Test is hard-bound to the authenticated account role.
- Changing Preview/Live remounts the portal and clears the previous environment state.
- Agency Live Test loads marketplace missions through the authenticated Agency workspace RPC only.
- Client Live Test creates missions through the authenticated Client workspace RPC only.
- Platform Mission Control loads through a Platform Admin-only RPC.
- Live Test has no mock marketplace fallback.

## Test order

1. Run the corrective migration.
2. Replace the GitHub repository contents with this package.
3. In Bolt run `npm install` and `npm run dev`.
4. Open Developer Mode → Live Test.
5. Confirm the portal matches the authenticated account role.
6. As Client, create a mission for an active property.
7. As an approved Agency Admin, confirm that exact mission appears and can be claimed.
8. Confirm Platform Admin Mission Control loads the same mission state.

## Build

Run:

```bash
npm install
npm run build
```

The source passed TypeScript/TSX syntax transpilation and package integrity checks before packaging. Full dependency installation could not be completed in the packaging environment because the npm registry timed out; run the production build in Bolt after dependencies install.

## RC1-A — Agency Marketplace Recovery

This release replaces the split Agency context and marketplace calls with one database-authoritative workspace contract.

1. Apply `supabase/migrations/202607250007_rc1a_agency_marketplace_recovery.sql` in Supabase.
2. Deploy this matching frontend package.
3. Sign in as the approved Agency Admin and use **Live Test**.

The migration repairs a missing owner membership, synchronizes an approved agency owner profile, returns precise workspace errors, and claims missions using the authenticated Agency workspace rather than a frontend-supplied agency ID.

## Identity Engine RC1.1
Run `supabase/migrations/202607250019_identity_role_integrity.sql` after the Platform Command Center migration. Then execute the acceptance gate in `IDENTITY_ENGINE_RC11_ACCEPTANCE_GATE.md`.

## Layout Safety Engine v1.0
Authenticated workspaces now share a global bottom safe-area contract so fixed session/developer controls cannot cover report actions, Guard invitations, or the final content on any portal page.
