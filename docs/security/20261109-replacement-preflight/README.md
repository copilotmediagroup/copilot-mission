# Read-only replacement preflight — BLOCKED

Requested migration: `20261109121945_scoped_guard_identity_view_access.sql`.
Production project: COPISEC / Usecurity, `eznhyemkuxectndxtymc`.

The user approved a read-only preflight only, with final production application subject to a later approval. No application, branch merge, frontend publication, payment deployment or worker activation occurred.

## Exact failure

The replacement's condition is:

```sql
AND (g.user_id=auth.uid()
 OR public.is_platform_admin()
 OR public.has_agency_access(g.agency_id,false))
```

The actual production `has_agency_access` function checks approved account status and Agency ownership/active membership. It does not require the account's application role to be Agency Admin. Using the exact exported production helper definitions and RLS policies in isolated PostgreSQL:

- A Client with a synthetic erroneous active Agency membership received three Guard identities; expected zero.
- A Guard with synthetic Agency staff membership received three identities; expected only their own.

These are isolated adversarial fixtures, not evidence that either configuration currently exists or was exploited in production. They expose an insufficient role boundary in the candidate and fail the requested unauthorized-access checks. The named migration was NOT edited to hide or bypass the failure and was NOT applied.

## Checks that passed

13 of 15 isolated checks passed: owned Agency names; unrelated Agency isolation; Guard self and approved Platform Admin; anonymous denial for view/direct function; ordinary Client and suspended Guard/Admin denial; forged JWT/user-metadata roles; temporary table name resolution; inactive membership; six-column-only data without private profile values; service database-role access; unchanged profiles RLS; exact rollback; and inability of the authenticated database role to become service_role.

Production metadata confirms anon/authenticated have no superuser, bypass-RLS, CREATE ROLE, public-schema CREATE, or service_role membership. The proposed schema does not exist. The view has no dependent database views, no function-body references, and no source references in the application's src tree. Its current postgres ownership/ACL and the exact helper/policy definitions are captured in `production-before.json`.

The candidate helper uses SECURITY DEFINER, a fixed pg_catalog/public search path, schema-qualified tables/functions and no dynamic SQL or caller-supplied identifier. It returns six existing identity fields, not phone/private profile fields. These properties pass review; the cross-role membership branch remains blocking.

## Snapshot and rollback

`rollback.sql` was executed ONLY in isolated PostgreSQL after applying the replacement there. Tests confirmed exact restoration of the original view definition, raw ACL and options; deletion of only the introduced helper/schema; and unchanged fixture records. The fresh production snapshot records the original schema as absent. The rollback restores the original anonymous exposure and is emergency material, not a forward security fix.

A final read-only check confirmed production view definition/ACL/options unchanged, the helper schema still absent, and matching full-row fingerprints for guards, profiles, agencies and agency_members. These checks returned hashes, not private profile data.

## Execution gate

**No SQL application plan is released for approval because preflight failed.** No `apply_migration`, `db push`, original failed migration, replacement migration or payment migration was run on production. A revised candidate needs explicit application-role checks on each non-service branch, another preflight, and final owner approval before any production application. Do not bulk-run the pending migration directory.

## Limits

The permissions/procedure tests use real PostgreSQL with synthetic users and exact production helper/policy definitions. They do not establish hosted Auth token-signature validation, browser sign-in journeys, provider sandbox behavior or the absence of unknown external consumers. Full Client/Agency/Guard user journeys remain pending in an isolated Supabase environment. No blanket claim of production functionality compatibility is made.
