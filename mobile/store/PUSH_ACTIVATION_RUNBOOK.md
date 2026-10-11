# Native Push Production Activation Runbook

Do not activate this pipeline by partially applying it. The web/mission lifecycle remains authoritative and must not be changed for push activation.

## 1. Backend migrations
Apply the reviewed mobile migrations in timestamp order through `20261011002000_mobile_push_outbox_leases.sql`. Confirm migration success before deploying functions. Do not rerun older equivalent production migrations blindly.

## 2. Private secrets
Configure these only in Supabase secret storage / private operator environment:
- `MOBILE_PUSH_WORKER_SECRET` — high-entropy private value shared only by worker and dispatcher.
- APNs: team/key IDs plus private signing key and correct Client/Guard bundle IDs.
- FCM: project ID, client email, private key.
- Supabase service-role key is runtime-provided/private and must never be committed.

## 3. Deploy order
Deploy `mobile-push-dispatch` first, then `mobile-push-worker`. Both are private operational functions; never expose worker execution as a public client action.

## 4. Single-device canary
Register exactly one controlled physical device, generate one targetable notification, invoke the worker once, and confirm delivery plus deep-link behavior. Do not enable a recurring scheduler until this canary passes.

## 5. Queue health
Run `npm run mobile:push:health` from a private operator environment. Pending rows should drain; abandoned rows require review. A queue with increasing pending age is not healthy even if some deliveries succeed.

## 6. Scheduler
Only after the canary passes, schedule authenticated worker invocation using private service credentials plus `MOBILE_PUSH_WORKER_SECRET`. Never place either secret in SQL source, browser code, repository configuration, or a public scheduler URL.

## 7. Rollback
Disable the scheduler first. Leave notification creation and mission lifecycle untouched. Investigate queue/provider errors, correct configuration, then manually invoke a canary before re-enabling recurring execution.
