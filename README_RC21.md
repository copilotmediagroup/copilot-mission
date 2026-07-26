# RC2.1 Patrol Execution Engine

Apply this changeset over the current RC2.0 repository. Do not delete the repository.

Run this migration in Supabase:

`supabase/migrations/202607260003_rc21_patrol_execution_engine.sql`

Then reload Bolt and test the Guard flow:

1. Accept assignment.
2. Start route.
3. Confirm arrival and tap **Start Patrol**.
4. Complete checkpoints in order.
5. Verify Main Entrance and Rear Loading Dock require a photo.
6. Verify a draft incident blocks checkpoint completion.
7. Refresh mid-patrol and confirm the current checkpoint returns.
8. Complete checkpoint 6 and confirm the mission moves to Review & Submit.

No changes were made to the Unified Map Engine, Client Tracking, Agency marketplace, or Reporting ownership.
