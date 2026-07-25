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
