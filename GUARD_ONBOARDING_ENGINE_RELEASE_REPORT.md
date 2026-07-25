# Co Pilot Security Marketplace OS — Guard Onboarding Engine

## Release scope
Agency Engine extension required before RC2 Dispatch verification. Public registration remains restricted to Client and Agency.

## Architecture changes
- Agency-controlled Guard invitation workflow.
- Guard activation is entered only through a single-use invitation URL.
- The UI is a control surface; invitation validity, Agency ownership, account role, membership, and Guard creation are database-owned.
- Guard activation atomically creates the profile, Agency membership, and Guard roster record.

## Database authority
Migration: `supabase/migrations/202607250010_guard_onboarding_engine.sql`

State machine:
- `pending → activated`
- `pending → revoked`
- `pending → expired`

Rules:
- Only an approved Agency Admin can issue or revoke an invitation.
- Invitation tokens expire after seven days.
- Only a hash of the token is stored.
- Activation email must exactly match the invited email.
- An invitation belongs to one Agency and cannot attach the Guard elsewhere.
- A Guard cannot be publicly self-created by selecting a Guard role.
- Activation fails when the Agency is no longer approved.

## Frontend changes
- Added Agency **Guards** workspace.
- Added Guard invitation form: name, email, phone, badge/employee ID.
- Added activated roster and invitation history.
- Added invitation revocation.
- Added secure Guard activation experience reached through the invitation URL.
- Existing public signup remains Client/Agency only.

## Verification checklist
1. Apply migration `202607250010_guard_onboarding_engine.sql`.
2. Confirm public signup displays only Client and Agency.
3. Sign in as an approved Agency Admin.
4. Open Agency → Guards.
5. Create an invitation with a new email.
6. Confirm a pending invitation appears in the same Agency.
7. Open the generated activation link in a signed-out/private browser.
8. Confirm the email is fixed to the invited address.
9. Attempt activation using a modified email and confirm rejection.
10. Activate using the invited email and a valid password.
11. Confirm `profiles.role = guard` and `account_status = approved`.
12. Confirm one active `agency_members` Guard membership exists for the inviting Agency.
13. Confirm one `guards` row exists with `availability = offline`.
14. Confirm invitation state becomes `activated`.
15. Sign in as the Guard and confirm Guard portal routing.
16. Return to Agency → Guards and confirm the Guard appears in the roster.
17. Confirm the Guard appears in RC2 assignment selection when available.
18. Create another invitation, revoke it, and confirm activation fails.
19. Confirm an expired invitation cannot activate.
20. Run `npm run build` successfully.

## Release gate
Do not continue RC2 Dispatch certification until all 20 checks pass.

## Known limitations
- The platform generates and copies a secure activation link; automated transactional email delivery is not included because no server-side email provider or Supabase Edge Function configuration exists in this repository.
- Supabase email confirmation behavior depends on the project Auth settings. When confirmation is enabled, the Guard must confirm the email before the first authenticated session.
- Production build could not be certified in the current container because package installation was unavailable. Build verification remains a release-gate requirement.
