# Co Pilot Security Marketplace OS — RC1-A Release Report

## Objective
Recover the live Agency marketplace path without changing unrelated portals.

## Root cause addressed
The Agency portal used two separate RPC calls: one to resolve Agency context and another to load marketplace jobs. Existing Agency owner records could be valid while membership/profile state drift caused the first call to fail before jobs were queried.

## Architecture change
RC1-A introduces one authenticated workspace contract:

- `resolve_my_agency_workspace()` resolves ownership or active Agency Admin membership.
- `get_agency_workspace_rc1a()` repairs the owner-membership invariant, synchronizes an approved owner profile, validates approval, and returns Agency context plus visible jobs in one response.
- `claim_marketplace_job_rc1a(job_id)` derives the Agency from the authenticated user. The frontend no longer supplies an Agency ID for authorization.

## Frontend changes
- Agency startup now makes one workspace request.
- Realtime refresh uses the same authoritative request.
- Claiming uses only the mission ID.
- Live errors remain precise instead of collapsing into a generic marketplace error.
- Preview data remains isolated from Live Test.

## Database migration
Apply:

`supabase/migrations/202607250007_rc1a_agency_marketplace_recovery.sql`

Apply the migration before deploying this matching frontend.

## Verification gate
1. Sign in as the approved Agency Admin.
2. Enter Live Test.
3. Confirm the three existing open missions appear.
4. Claim one mission.
5. Confirm it leaves Open Opportunities and appears in the Agency claimed/operations state.
6. Confirm competing approved agencies no longer see it as open.
7. Confirm Mission Control shows the accepted Agency.

## Build status
The source changes were completed and package integrity was checked. A production build could not be completed in this environment because dependency installation timed out and left empty npm package directories. No successful production-build claim is made for this package.
