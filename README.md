# Co Pilot Security Marketplace — v1.2.0

## Supabase Marketplace Foundation

This build introduces the backend-ready foundation while preserving the current prototype in mock mode until project credentials are supplied.

### Included
- Supabase browser client with environment-variable configuration
- Automatic Mock Mode / Supabase Connected detection
- Role-aware authentication context for Platform Admin, Agency Admin, Guard, and Client
- Core marketplace schema migration
- Profiles, agencies, agency members, clients, properties, guards, jobs, assignments, and mission events
- Initial Row Level Security policies
- Realtime publication for jobs, assignments, and mission events
- Atomic `accept_marketplace_job` RPC to prevent two agencies from winning the same job
- Mock-data fallback so the existing marketplace remains functional before connection

### Connect Supabase
1. Create a new Supabase project for this marketplace app.
2. Run `supabase/migrations/202607240001_marketplace_foundation.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env` in Bolt or configure environment variables there.
4. Set `VITE_SUPABASE_URL` to the base project URL only.
5. Set `VITE_SUPABASE_ANON_KEY` to the project's publishable/anon key.
6. Restart the Vite development server.

Without both variables, the interface intentionally runs in Mock Mode.
