# RC2.1B — Mission Authority Consolidation

Apply this changeset over the current repository. Do not delete the repository.

Run:

`supabase/migrations/202607260004_rc21b_mission_authority_consolidation.sql`

Then reload Bolt.

## Test

1. Open Developer Mode and confirm it starts in **Live Test**.
2. Confirm Preview is visibly labeled **SIMULATED DATA**.
3. Sign in as the real Guard and verify Jobs Today reflects completed missions for the local day.
4. Verify On Duty grows from Guard presence history.
5. Verify Check-ins matches today's completed checkpoints.
6. Open a new assignment and confirm the Client-uploaded property image appears on assignment and arrival screens.

Cross-role mission testing must use separate authenticated accounts in Live Test mode. Role switching in Preview is simulation only.
