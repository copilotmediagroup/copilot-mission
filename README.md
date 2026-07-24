# Co Pilot Security Marketplace — v1.3.0

## Client Portal Foundation

This release replaces the authenticated Client Portal placeholder with a live Supabase-backed workspace.

### Included
- Responsive premium Client Portal shell
- Property directory and property creation
- Immediate, scheduled and vacation security request modes
- Standard, priority and emergency request levels
- Active request and mission history views
- Realtime refresh for client properties and marketplace jobs
- Client auto-approval for future signups
- Agencies remain pending until Platform Admin verification
- Existing Authentication Gateway and logout protection preserved

## Required database step
Run only this new additive migration in Supabase SQL Editor:

`supabase/migrations/202607240002_client_portal_foundation.sql`

Do not rerun the original foundation migration.
