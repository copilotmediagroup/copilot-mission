# Co Pilot Security Marketplace v1.5.4

## Marketplace Lifecycle Stabilization

This build preserves the stable v1.5.1 application and adds server-authoritative Platform Owner access.

### Owner account

- Mission Control owner: `afinch2678@gmail.com`
- Role source of truth: `public.profiles.role`
- Required role: `platform_admin`
- Required account status: `approved`
- Approved platform administrators are routed directly into Mission Control after login.

Platform Admin is intentionally not exposed through public signup. Client and Agency signup remain unchanged.

## Required one-time Supabase migration

Run the migrations in filename order. For an existing v1.5.1 database, run only:

`supabase/migrations/202607240004_platform_owner_access.sql`

The owner must already exist in Supabase Authentication before this migration is run. The migration resolves the account from `auth.users`, writes the authoritative Platform Admin role into `public.profiles`, approves the account, and leaves authorization enforcement to the existing Supabase RLS policies.

No frontend email bypass or email-only authorization is used.

## Developer Mode

Developer Mode Preview and Live Test behavior from v1.5.1 is preserved:

- Preview mode uses simulated portal data and blocks real writes where implemented.
- Live Test uses the authenticated account and its real Supabase permissions.
- Exiting Developer Mode returns to the authenticated account's actual role portal.

## Build

```bash
npm install
npm run build
npm run dev
```


## v1.5.4 Mission Control Session Access

Adds a visible authenticated Sign Out control to Mission Control while preserving Supabase-backed role authorization, Developer Mode Preview, and Live Test behavior.


## v1.5.4 Portal Access Stability

- Shared authenticated session dock exposes Developer Mode and Sign Out from every portal.
- Developer Mode retains Preview and Live Test and now includes Sign Out in its control rail.
- Agency live marketplace no longer paints simulated opportunities before the Supabase query resolves.
- Live empty results remain stable and display a deliberate empty state while realtime remains subscribed.

## v1.5.7.1 one-time migration

Run `supabase/migrations/202607250001_property_photos_claim_reliability.sql` once on an existing database. It adds property photo fields, creates the `property-photos` Storage bucket and client-scoped Storage policies, and updates the atomic claim function to return accurate claim failure reasons.


## v1.5.7.1 migration
Run `supabase/migrations/202607250002_complete_property_management.sql` once after the v1.5.5 migration. It adds safe property editing, archiving, and permanent deletion rules.


## v1.5.7.1 Marketplace Lifecycle Stabilization

- Preview is a sealed simulation and never writes to Supabase.
- Live Test is locked to the authenticated account role; role previewing is disabled.
- Switching environments clears the previous environment state before loading the next source.
- Agency Live Test never falls back to demo opportunities.
- Client mission submission uses the database-authoritative `create_marketplace_job` RPC.
- Agency RLS can read linked client/property presentation data only for missions already visible through marketplace job RLS.
- Realtime subscriptions reload open and claimed missions after inserts, updates, claims, and mission events.

### Required one-time migration

Run `supabase/migrations/202607250003_marketplace_lifecycle_stabilization.sql` after the earlier migrations.


## v1.5.7.1 compile hotfix

- Renamed the property image preview state to `photoPreview` so it no longer collides with the `preview` environment prop in `ClientPortal.tsx`.
- No database migration is required for this hotfix.
