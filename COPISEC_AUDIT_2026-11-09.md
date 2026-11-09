# COPISEC — current audit and repair status, November 9, 2026

## Production preflight result: FAILED — original migration not applied

The approved `20261109115144_harden_developer_guard_identity_view.sql` would remove Guard names from the Agency's identity-view reads. `guards_select_rc1` permits the Agency's Guard rows, but `profiles_select_rc1` permits only self or Platform Admin profiles. Client, Guard and Platform Admin checks ran in read-only role-scoped transactions; Agency retained one row and zero names under invoker-equivalent access.

No production DDL or customer-data DML was issued. A second read confirmed the original production view definition, options and ACL unchanged. Anonymous SELECT therefore remains exposed until a corrected change is separately approved. Definition, exact permissions, policies, role results and rollback SQL are saved in [the preflight evidence folder](docs/security/20261109-guard-view/README.md).

The replacement proposal `20261109121945_scoped_guard_identity_view_access.sql` uses explicit approved-user ownership/Agency/Admin checks and returns only the same six identity columns. Isolated tests preserve Agency Guard names and deny anonymous/unrelated/suspended access without broadening profiles RLS. It is not approved or deployed. Do not run all pending migrations indiscriminately.

## Work implemented and verified locally

| Area | Repair state | Verification | Production state |
|---|---|---|---|
| Developer Mode | Production preview writes blocked; explicit reviewed-read RPC list replaces unsafe get-prefix exemption | Policy tests include a getter that actually writes Agency membership | Not deployed |
| Client identity/property photos | Owner-identity fallback removed; selected owner's authorized storage path used | Repository tests and build | Not deployed |
| Agency/Guard identity | Selected Agency logo/radius and Guard photo fallback; stable mobile hook order | Build; first-batch isolated Guard UI tests | Not deployed |
| Profile photos | Broken image becomes readable initials; configured Guard image independently returned HTTP 200 PNG | First-batch browser checks at 390/1440px | New fallback not deployed |
| Maps | Guard-only pulse, duplicate ID removal, stale async render protection | Build/code checks; real GPS test pending | Not deployed |
| Patrol Complete | White information rows, readable text, desktop header clearance | Four first-batch responsive screens and DOM/screenshot checks | Not deployed |
| Capture/void/refund | Service-only atomic reservation/finalization updates job and ledger together; actor authorization and proof enforced in SQL | 20 isolated PostgreSQL integration groups | Not deployed |
| Automatic capture | Durable completion outbox, service worker, disabled-by-default controls | Completed server job captured with stub processor; browser cannot invoke worker | Not deployed or scheduled |
| Crash/reconciliation | Expired reservations become uncertain; unreserved worker can requeue; existing admin reconciliation updates operation/ledger/job atomically | Injected database failures, lease recovery, verified retry and uncertain cancellation tests | Not deployed |
| Cancellation/refund | Owning approved Client only for void; active assignments block it; full refund only before payout | Ownership, partial amount, uncertain void and payout guards passed | Production lifecycle still v2 |
| Initial authorization | Prior scheduling/uncertainty fixes retained | Stubbed authorization regression tests | Not deployed; atomic authorization migration still pending |
| Guard identity view | Original migration blocked; replacement proposal prepared | Production preflight + isolated role tests | Production unchanged |
| Frontend delivery | Latest build deployed as draft only; assets match byte for byte | Draft and production login at mobile/desktop widths | Production deploy unchanged |

Latest frontend draft: https://6af1bd0d284594753a6e4cc0--securityuber.netlify.app

## Environment

- Mac project: `/Users/admin/Desktop/copilot-mission`; repository `copilotmediagroup/copilot-mission`.
- Work branch: `audit/development-production-20261109`; original baseline `3a7971e94c7b6ffc3da568cbe3db92d8f8d31d93`.
- Netlify `securityuber`, site `8f615f94-0a34-41a9-93a6-14087a17bc3b`; production remains deploy `6ae1b81381679042b28ed0c9` at `copisec.com`.
- Supabase `Usecurity`, project `eznhyemkuxectndxtymc`; source/production payment-function drift was confirmed in the first batch. No function deployments occurred in this follow-up.
- Existing unrelated untracked `supabase/.temp/` and `supabase/functions/ai-ops-signup-sensor-read/` preserved.

## Tests and limits

`npm run test:audit`, `npm run test:payments`, `npm run test:guard-view` and `npm run build` pass. The PostgreSQL engine dependency is pinned and recorded in package-lock. The build retains its existing bundle-size warning.

[Payment integration details and deployment constraints](docs/payments/ISOLATED_INTEGRATION_20261109.md) distinguish the actual PostgreSQL/Edge logic tests from missing full hosted Supabase and processor sandbox tests. The gateway was stubbed; zero real authorizations, captures, voids, refunds, payouts or customer notifications were initiated. No scheduler was activated.

A hosted Supabase branch request expired at service confirmation; a follow-up list confirmed no branch exists. The local integration environment is reproducible and contains synthetic records only. Hosted Auth/Storage/Realtime, production-equivalent triggers and independent database connections, provider sandbox/webhook exchanges, complete signed-in Client/Agency/Guard journeys, atomic initial authorization and payout integration remain pending. Production UI verification here covers anonymous login, not authenticated journeys.

Production security and payment changes still require explicit approval. Payment code must not be deployed until the coordinated schema/handler release passes the remaining integration gates. The failed original view migration must not be applied merely because it is present in the migration directory.
