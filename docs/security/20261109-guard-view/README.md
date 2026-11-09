# Production preflight — original migration blocked

Project: COPISEC / Usecurity (`eznhyemkuxectndxtymc`).

The user approved ONLY `20261109115144_harden_developer_guard_identity_view.sql`, conditional on successful preflight. Preflight failed. No production migration was applied.

The view is owned by postgres with no security_invoker option. Anonymous and authenticated roles currently have SELECT among other grants. Underlying RLS permits Guard rows to Platform Admins, the Guard user, or the owning Agency. The profiles SELECT policy permits only the profile owner or Platform Admin. Consequently, the original migration preserves an Agency's Guard row but removes its name through the LEFT JOIN.

| Authenticated role | Current view rows | Invoker-equivalent rows | Invoker-equivalent names |
|---|---:|---:|---:|
| Client | 1 | 0 | 0 |
| Agency Admin | 1 | 1 | 0 |
| Guard | 1 | 1 | 1 |
| Platform Admin | 1 | 1 | 1 |

The application source, dependent database views, and database function bodies contain no reference to this view. Existing workflows use separate RPCs. Nonetheless the existing Agency identity-view read loses a required field, so it was not certified safe to apply.

`production-before.json` saves the view definition, owner, raw ACL, grants and underlying policies. `rollback.sql` restores the original view and grants; it is emergency material only, since the original anonymous exposure is unsafe. `preflight-result.json` records the failed gate. A second metadata read confirmed the production definition, ACL and options unchanged.

## Replacement proposal — NOT APPROVED OR DEPLOYED

`20261109121945_scoped_guard_identity_view_access.sql` supplies a six-column identity function in a private schema with explicit approved-user ownership/Agency/Admin checks, and makes the outer view security_invoker. It denies anonymous access, preserves the Agency's own Guard names, permits Guard self access and Platform Admin/service reads, and leaves the underlying profiles policy unchanged. It does not return additional profile columns.

`npm run test:guard-view` reproduces the failed original migration and verifies the replacement against isolated ownership policies and synthetic users, including unrelated Agencies and suspended accounts. This is not production verification. Applying the replacement requires new owner approval and a fresh production preflight/rollback snapshot.

Do not run an indiscriminate `supabase db push`: the earlier migration is blocked and the separate payment candidate is not approved. Production deployment must use a specifically reviewed migration, with pending migration-history reconciliation handled explicitly rather than running all local files.
