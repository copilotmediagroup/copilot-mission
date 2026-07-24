# Co Pilot Security Marketplace v1.5.1

Developer Mode Stabilization built on v1.5.0.1.

## Included
- Preview and Live Test modes in Developer Mode
- Preview mode blocks database writes when viewing another role
- Clear authenticated-role vs viewed-portal banner
- Developer Diagnostics drawer
- Marketplace, agency, auth and realtime health
- Mission Inspector
- Underlying Supabase errors visible only in Developer Mode

## Database
No new SQL migration is required for v1.5.1. Existing v1.5 migrations remain included for clean installs.

## Verification
Run `npm install` and `npm run build`, then test Preview mode while signed in as Client and Live Test while signed in as an approved Agency account.
