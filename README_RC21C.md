# RC2.1C — Client Mission Selection Authority

Apply this changeset over the current RC2.1B repository. Do not delete the repository.

Run:

`supabase/migrations/202607260005_rc21c_client_mission_selection_authority.sql`

## Corrected authority

The Client tracking projection no longer selects a mission by broad `updated_at` recency. It now uses one deterministic lifecycle order:

1. Mission currently being fulfilled
2. Newest open marketplace request
3. Most recently completed mission/report
4. Any remaining non-cancelled historical state

This prevents a recently published or recently updated completed report from replacing a newly created open request on the Active Requests screen.

## Acceptance

Create a new Client request while an older completed mission exists. The Active Requests count and main tracking experience must both show the new request in `Finding coverage`. The completed mission remains available through Reports.
