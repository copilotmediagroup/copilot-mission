# Co Pilot Security Marketplace v1.5.0

## Real Marketplace Claim Engine

This release turns the client-to-agency marketplace into a real Supabase lifecycle.

### Lifecycle connected
- Client creates a mission with status `open`
- Approved agencies receive it through Supabase Realtime
- One agency claims through an atomic first-writer-wins database function
- The mission disappears from competing agencies
- The winning agency receives it in Operations
- Platform Admin Mission Control observes missions and timeline events live
- Developer Mode remains active for cross-role testing

### Required database step
Run `supabase/migrations/202607240003_marketplace_claim_engine.sql` in the Supabase SQL Editor after the earlier migrations.

### Verification sequence
1. Enter Developer Mode as Client and create a mission.
2. Switch to Agency Admin and confirm it appears without refreshing.
3. Claim the mission.
4. Confirm it leaves Open Opportunities and enters Operations.
5. Switch to Platform Admin and confirm the mission and `agency_claimed` timeline event are visible.

The claim function is atomic: only the first approved agency can win an open mission.
