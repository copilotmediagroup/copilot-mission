# COPISEC audit — November 9, 2026

This is a verified first repair batch, not certification that all eight requested phases are complete.

## Environment and deployment evidence

- Existing project: `/Users/admin/Desktop/copilot-mission` on the owner's Mac.
- Repository: `https://github.com/copilotmediagroup/copilot-mission`.
- Baseline local main, GitHub main and Netlify production commit: `3a7971e94c7b6ffc3da568cbe3db92d8f8d31d93`.
- Netlify site: `securityuber`, ID `8f615f94-0a34-41a9-93a6-14087a17bc3b`, custom domain `https://copisec.com`.
- Production baseline deploy: `6ae1b81381679042b28ed0c9`, published October 28.
- Supabase project: `Usecurity`, `eznhyemkuxectndxtymc`.
- No project-local environment files, Supabase config, or Netlify state file were present. The frontend uses existing publishable configuration fallbacks. No secret values were printed.
- Supabase payment functions: authorization v15 differs functionally (production lacks local scheduling restrictions); lifecycle v2 differs functionally (production lacks owning-client void access and has crossed rollback hold reasons); configuration v9 differs in formatting/property ordering; billing v5 exactly matches local source.
- Existing untracked `supabase/.temp/` and `supabase/functions/ai-ops-signup-sensor-read/` were preserved and excluded from this change.

## Fixes implemented

| Area | Verified problem | Implemented change | Evidence | Live status |
|---|---|---|---|---|
| Developer Mode | Preview writes reach real Guard/customer records; missing selected accounts can fall back to owner reads | Production preview transport blocks write RPCs, table/storage writes, payment functions and account changes; selected-account loading/error boundary | Request-policy tests; build | Not deployed |
| Client accounts | Missing selected-client name/photo falls back to owner identity | Owner fallback disabled in preview | Code review/build; full account integration pending | Not deployed |
| Agency accounts | Preview never loads selected Agency logo or service radius | Load existing selected-Agency settings RPC | Build; full Agency integration pending | Not deployed |
| Guard accounts | Developer settings lack profile-photo fallback; mobile wrong-role early return changes hook count | Authorized profile fallback and stable hook order | Build; isolated UI tests | Not deployed |
| Profile photos | Header has no broken-image recovery | Readable initials on image error | Loaded-image and broken-image browser checks at 390 and 1440px; actual configured Guard image independently returns HTTP 200 image/png | New fallback not deployed |
| Card/property images | Developer property upload expects a client identity absent from workspace response | Resolve owner from existing authorized selected-client account RPC | Repository test validates selected owner storage path | Not deployed |
| Map pulses | Device/viewer gets Guard pulse; duplicate IDs and overlapping async Earth renders can duplicate markers | Guard-only pulse node, marker ID deduplication, stale async-render guard | Build and code inspection; real Google Maps/GPS scenario pending | Not deployed |
| Patrol Complete UI | Desktop header overlaps headings; completed status strip remains dark | White information rows/black text; desktop content clears header | Four rendered review/completion screens at 390 and 1440px; DOM color/overlap assertions and screenshot review | Not deployed |
| Payments | HTTP/malformed gateway results treated as declines; missing completed-Guard proof query can fail open; financial reservation errors ignored | Unknown outcome handling with timeout; require recognized response and authorization transaction ID; deny developer authorization; require completed Guard identities; stop before processor if financial reservation fails | 20 isolated payment scenarios using stubbed processor; no real charges | Not deployed |
| Cancellations | Production lifecycle is admin-only and restores crossed hold reasons | Existing local owning-client void and distinct rollback reasons verified with tests | Owner/unrelated-client and decline tests | Production still v2 |
| Supabase functions/security | Public developer Guard identity view bypasses underlying RLS and grants anonymous SELECT | Prepared additive migration enabling security_invoker and revoking anonymous/non-read access | Isolated PostgreSQL reproduction, RLS enforcement, authorized reads, preservation and repeated-application tests | Approval required; not applied |
| Netlify production | Frontend baseline matches local/GitHub; backend does not | Built repair candidate and prepared draft frontend deployment | Build, asset verification and anonymous production smoke | Production baseline retained |

## Validation commands

- `npm run build`: schema contract, mission-critical regression audit, production parity audit (25/25), launch integrity audit (6/6), TypeScript and Vite passed. Existing bundle-size warning remains.
- `npm run test:audit`: production-preview write policy, selected-client photo ownership and 20 stubbed payment scenarios passed.
- `PGLITE_MODULE=/tmp/copisec-audit-pg/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-guard-identity-migration.mjs`: passed against isolated PostgreSQL engine. PGlite 0.3.14 was installed only in temporary tooling, not project dependencies.
- Start Vite on 127.0.0.1:5191, then `PLAYWRIGHT_MODULE=/Users/admin/Desktop/debt-desk/node_modules/playwright-core node scripts/test-guard-ui.cjs`: four responsive review/completion screens, image loading/failure fallback, information-row colors, header clearance and zero page errors passed. The script creates and removes its own local fixture harness; backend fixtures are test-only.
- Actual configured Guard photo: HTTP 200, PNG, 1,857,992 bytes. This proves asset availability, not authenticated production rendering.
- Anonymous production page: HTTP 200 and login UI loads. Authenticated Client/Agency/Guard production journeys were not executed.

## Remaining blockers and incomplete scope

1. There is no dedicated COPISEC test Supabase project configured. Developer Mode currently shares production records. The repair deliberately makes production live-account previews read-only; this is an application safeguard, not a replacement for backend authorization or full isolation. Existing deployed administrator RPCs can still mutate records if called outside this application. Full booking, assignment, notifications, history ownership and test-processor integration require an isolated backend with test accounts and processor sandbox credentials.
2. Automatic completion-to-capture worker/outbox is still absent. No new capture worker, scheduler, webhook integration or payout automation was implemented or claimed tested. Never enable capture based on browser completion alone.
3. Job and financial-ledger processor updates are still separate database operations. Added pre-processor checks reduce failures but do not make finalization atomic. A transactional reservation/finalization migration, crash recovery and processor reconciliation need isolated integration tests before payment deployment.
4. No real payment authorizations, captures, refunds, payouts, customer notifications, new assignments, or production database changes were performed.
5. RLS is enabled on all public tables, but that alone does not prove policies correct. Security advisors reported one identity-view error (migration prepared), 12 RLS/no-policy informational notices, three mutable search-path warnings, 227 executable security-definer function warnings and disabled leaked-password protection. Those broader findings have not all been audited/remediated.
6. Production migration and payment-function deployments require owner approval. The identity-view migration is independently tested; payment changes are unit-tested but are not certified ready for production without isolated integration and ledger consistency work.
7. The installed project Supabase CLI 2.114.0 cannot start on this Mac (dyld load-command incompatibility). Existing cached CLI 2.30.4 works and generated the pending migration. Do not blindly upgrade the CLI on this OS.

## Deployment separation

Frontend: Netlify draft from built `dist`; no Supabase functions are deployed by that operation.

Database: `supabase/migrations/20261109115144_harden_developer_guard_identity_view.sql`, held for explicit approval.

Payment functions: changed `maverick-payments` and `maverick-payment-lifecycle`; held pending further integration work and explicit approval. `maverick-billing` and payment configuration were not changed.

Verified frontend draft: https://6af1b5a2efeae852d8655e6b--securityuber.netlify.app — JavaScript and CSS bytes match the final local build; production deploy remains 6ae1b81381679042b28ed0c9.
