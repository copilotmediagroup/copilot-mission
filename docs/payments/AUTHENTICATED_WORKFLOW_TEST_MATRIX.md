# Isolated authenticated workflow preparation

The production identity-view preflight is blocked. This plan does not authorize a production migration, payment function deployment, worker activation, branch merge or production publication.

`node scripts/integration-target.mjs` validates configuration only and makes zero network requests. It requires a specifically selected nonproduction Supabase project, matching base URL, synthetic-fixture-only mode and a stub processor. Production references/URLs, embedded credentials, mismatched targets, absent keys and non-stub processors are rejected. `node scripts/test-integration-target.mjs` checks these boundaries without real keys or network calls.

Required environment names: `COPISEC_TEST_PROJECT_REF`, `COPISEC_TEST_SUPABASE_URL`, `COPISEC_TEST_SUPABASE_ANON_KEY`, `COPISEC_TEST_SUPABASE_SERVICE_KEY`, `COPISEC_TEST_FIXTURES_ONLY=true`, `COPISEC_TEST_PROCESSOR_MODE=stub`. Never copy production service/provider credentials into these variables. No hosted project or keys are configured by this work.

| Journey | Synthetic fixture / expected assertion | Current coverage |
|---|---|---|
| Client registration/login | Dedicated test user; no external confirmation email; session belongs to Client fixture | Hosted Auth pending |
| Client request | Own property only; cross-Client property/booking access denied; no real authorization | Complete Supabase journey pending |
| Agency roster | Names preserved for owned Agency; unrelated roster denied; Client/Guard memberships cannot elevate role | Production-helper preflight catches two failing identity-view cases |
| Agency claim/assignment | Only synthetic job and permitted Guard; no real dispatch or notifications | Hosted integration pending |
| Guard acceptance/patrol | Own assignment only; cross-Guard state/evidence denied; secured proof required | Database payment/proof checks pass; complete UI journey pending |
| Server completion capture | Durable outbox; disabled by default; browser cannot invoke worker; actual processor replaced by stub | Isolated PostgreSQL/handler integration passes |
| Client cancellation | Correct role and ownership; no active assignment; unknown result cannot auto-retry | Isolated PostgreSQL/handler integration passes |
| Ledger/event failure | Processor may have acted; all final ledger/event writes roll back atomically; no duplicate gateway request | New event-write failure test passes |
| Suspended account | Suspended Guard/Admin cannot escalate identity access or initiate capture | Isolated identity/payment checks pass |
| Verified reconciliation | Approved Platform Admin and verification note; operation, job, ledger and outbox update together | Isolated PostgreSQL integration passes |
| Authenticated browser UI | Correct selected identity, photo, history and reports at mobile/desktop sizes | Full hosted signed-in journeys pending |
| Provider sandbox/webhooks | Separate approved provider test configuration; signature/replay/reconciliation cases | Not activated or executed |

Payment suite now contains 22 passing integration groups. Database preflight suite contains 13 passing checks and two blocking cross-role identity failures. The suites use synthetic users/records and do not establish end-to-end hosted Auth, Storage or provider compatibility.
