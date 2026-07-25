# Guard Onboarding Engine RC1.1

## Engine responsibility
Agency-controlled Guard identity entry and permanent Agency membership. Public signup remains Client and Agency only.

## Architecture
- **Identity Engine:** Supabase Auth creates and authenticates the Guard account.
- **Agency Engine:** owns invitations, Agency membership, roster ownership, expiration, and revocation.
- **UI:** creates an invitation and renders the environment-aware activation link using `window.location.origin`.
- **Database authority:** validates the one-time token, invited email, invitation status, expiration, and Agency approval before atomically creating the Guard profile, membership, and roster record.

## RC1.1 correction
The previous migration used `gen_random_bytes()` and `digest()`, which were unavailable in the connected database schema. RC1.1 uses platform-supported `gen_random_uuid()` plus PostgreSQL's built-in `md5()` function. No pgcrypto byte-generation or digest function is required.

## Development-mode testing
The activation URL is created from the active preview origin. In Bolt it uses the current Bolt preview address; locally it uses `http://localhost:5173`; after deployment it automatically uses the Netlify, Vercel, or production domain.

1. Apply migration `202607250011_guard_onboarding_rc11.sql`.
2. Log in as an approved Agency Admin.
3. Open **Guards** and create an invitation.
4. Confirm an activation link appears and the invitation is listed as `pending`.
5. Copy the link.
6. Open a private/incognito window so the Agency session is not reused.
7. Paste the link.
8. Confirm **Activate Guard account** appears and the invited email is locked.
9. Create a password of at least eight characters.
10. When email confirmation is disabled, confirm the Guard enters the Guard portal immediately.
11. When email confirmation is enabled, confirm the Guard receives the Supabase confirmation email, confirms it, then signs in.
12. Return to the Agency account and confirm the Guard appears in the roster as `offline`.
13. Confirm the invitation changed to `activated`.
14. Confirm the same activation link cannot create a second Guard.
15. Confirm a different email cannot consume the invitation.
16. Confirm a revoked or expired invitation cannot activate.
17. Confirm an unapproved Agency cannot create invitations.
18. Confirm an Agency cannot see or assign another Agency's Guards.

## Release gate
PASS only when:

`Agency creates invitation → Guard activates → Guard logs in → Guard appears in the same Agency roster → Guard is available to RC2 Dispatch`

## Known limitation
The system generates and copies the secure activation link but does not automatically deliver it by email. Automated delivery requires a trusted server environment such as a Supabase Edge Function with an email provider. This limitation does not block complete Dev Mode testing.
