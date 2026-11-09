# Payment repair candidate — isolated integration results

No payment function, database migration, scheduler, authorization, capture, refund, void or payout was deployed/run against production during this follow-up.

## Implemented locally

- `20261109120919_payment_operations_atomic_capture_outbox.sql`: service-only reservation/finalization functions, private operation records, atomic job/financial-ledger writes, unresolved-operation uniqueness, completion outbox, default-disabled activation, crash-lease recovery and operation-aware compatibility with the existing Platform Admin reconciliation API.
- `_shared/atomicPayment.ts`: common processor engine for capture, void and refund. A successful repeated request returns the recorded result; uncertain responses and failed finalization prohibit an automatic second processor request.
- `maverick-payment-lifecycle/index.ts`: retains its public endpoint and response structure, authenticates the session and obtains the actor from Supabase Auth; client-supplied actor IDs are ignored. Requires the new migration and must not be deployed alone.
- `maverick-capture-worker/index.ts`: POST/service-authenticated worker, paused unless `MAVERICK_CAPTURE_WORKER_ENABLED=true`. Database automatic capture control also defaults false. No schedule was created.
- Completion capture checks happen in a locked database transaction: completed job, full staffing, report readiness, per-Guard required photos and corresponding secured storage objects. Developer-test jobs cannot reach the processor.
- Client void is limited to the owning approved account and requires operational assignments to be cancelled first. Refunds require the full amount and cannot proceed after payout.
- Expired reservations become uncertain and require verification. Only unreserved crashed workers can requeue. Admin reconciliation requires an approved Platform Admin and a processor verification note; it updates job, ledger, operation and outbox together.

## Reproducible tests

`npm ci --ignore-scripts` installs pinned development dependency `@electric-sql/pglite@0.3.14`.

- `npm run test:payments`: 20 isolated PostgreSQL integration groups passed, with real candidate SQL and synthetic records. The gateway is stubbed and any accidental real network request fails the test.
- `npm run test:guard-view`: original view regression reproduced; replacement role-isolation proposal passed.
- `npm run test:audit`: preview-write protections, selected-client photo ownership and authorization uncertainty tests passed.
- `npm run build`: schema contract, mission-critical invariants, parity, launch integrity, TypeScript and Vite passed; pre-existing bundle-size warning remains.

Payment groups cover service-only ACLs; disabled worker; successful and repeated capture; overlapping requests; distinct decline hold restoration; transport/HTTP/malformed/error quarantine; developer/proof/report/actor rejection; multi-Guard proof; injected reservation and post-processor ledger failures; owning/unrelated Client cancellation; active-assignment rejection; full refund/payout protection; server completion capture; expired reservation recovery; crash before reservation; manual uncertain-void resolution; HTTP actor spoof protection; worker authentication/default pause; Guard-role rejection despite an erroneously attached Client record.

## What this does not certify

This environment runs PostgreSQL in PGlite and the actual Edge handler logic under an isolated runtime. It is not a full hosted Supabase Auth/Storage/Realtime stack, and it is not a real NMI/Maverick sandbox exchange. A request to create hosted branch `copisec-integration-20261109` did not create a branch: the service confirmation expired. No payment deployment approval is being requested yet.

Full schema/trigger compatibility, independent concurrent database connections, hosted authentication/storage, provider sandbox responses, signed webhook replay/recovery, and complete Client/Agency/Guard UI journeys remain required before production activation. Initial payment authorization still uses the existing authorization function and has not been migrated to the new atomic operation schema. No automated payout integration or provider webhook endpoint was added.

## Deployment constraints

Do not run every pending migration. The earlier Guard identity migration failed preflight, and both newer proposals are unapproved. The payment migration and lifecycle/worker code are a coordinated release candidate. Production approval and hosted/provider integration are still required. Deploying this frontend never deploys these Supabase functions.
