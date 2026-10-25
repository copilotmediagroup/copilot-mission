import fs from 'node:fs'
const read=f=>fs.readFileSync(f,'utf8')
const checks=[
 ['runtime developer-test exemption','supabase/migrations/20261024222500_developer_runtime_credential_exemption_rc67.sql',/if v_developer_test then[\s\S]*?return;/],
 ['runtime production base credential gate','supabase/migrations/20261024222500_developer_runtime_credential_exemption_rc67.sql',/GUARD_SECURITY_CREDENTIAL_NOT_VERIFIED/],
 ['runtime production armed credential gate','supabase/migrations/20261024222500_developer_runtime_credential_exemption_rc67.sql',/GUARD_ARMED_CREDENTIAL_NOT_VERIFIED/],
 ['assignment developer-test exemption','supabase/migrations/20261024223000_developer_test_guard_assignment_credential_bypass_rc67.sql',/developer_test/],
 ['assignment production base credential gate','supabase/migrations/20261024223000_developer_test_guard_assignment_credential_bypass_rc67.sql',/security_officer/],
 ['assignment production armed credential gate','supabase/migrations/20261024223000_developer_test_guard_assignment_credential_bypass_rc67.sql',/armed_qualification/],
 ['live idle assignment realtime subscription','src/modules/dispatch/dispatchRepository.ts',/table:'job_assignments'/],
 ['live idle assignment fallback polling','src/App.tsx',/setInterval\(\(\) => void loadDispatch\(\), 3000\)/],
 ['developer idle assignment fallback polling','src/App.tsx',/getDeveloperGuardWorkspace\(developerGuardId\)[\s\S]*?setInterval\(sync,3000\)/],
 ['developer accept uses developer mission RPC','src/App.tsx',/transitionDeveloperGuardMission\(\{guardId:developerGuardId,jobId:dispatchMission\.job_id[\s\S]*?action:'accept'/],
 ['developer accept omits stale expected version','src/App.tsx',/action:'accept'\}\)/],
 ['payment lifecycle owning client void only','supabase/functions/maverick-payment-lifecycle/index.ts',/if\(action==='void'&&!isPlatformAdmin\)[\s\S]*?isOwningClient=client\?\.user_id===userResult\.user\.id/],
 ['payment lifecycle capture remains platform admin','supabase/functions/maverick-payment-lifecycle/index.ts',/if\(!isPlatformAdmin&&!isOwningClient\)return respond\(403,[\s\S]*?'platform admin required'/],
 ['payment lifecycle blocks developer processor mutation','supabase/functions/maverick-payment-lifecycle/index.ts',/developerTest\(job\)\)return respond\(409,\{error:'developer test processor mutation forbidden'/],
 ['payment capture requires completed authorized mission','supabase/functions/maverick-payment-lifecycle/index.ts',/job\.status!=='completed'\|\|job\.payment_status!=='authorized'/],
 ['payment capture requires completed staffing','supabase/functions/maverick-payment-lifecycle/index.ts',/mission staffing incomplete[\s\S]*?guard mission incomplete/],
 ['payment capture requires ready mission report','supabase/functions/maverick-payment-lifecycle/index.ts',/mission report not ready/],
 ['payment capture requires checkpoint proof','supabase/functions/maverick-payment-lifecycle/index.ts',/for\(const cp of \[2,4\]\)[\s\S]*?required checkpoint/],
 ['payment transport uncertainty enters reconciliation hold','supabase/functions/maverick-payment-lifecycle/index.ts',/payment_reconciliation_required[\s\S]*?Processor result is uncertain/],
 ['lifecycle reconciliation queue quarantines unknown states','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/payment_status in \('capture_unknown','void_unknown','refund_unknown'\)[\s\S]*?payment_reconciliation_required/],
 ['capture reconciliation only permits captured or authorized','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/capture_unknown[\s\S]*?v_outcome not in \('captured','authorized'\)/],
 ['void reconciliation only permits voided or authorized','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/void_unknown[\s\S]*?v_outcome not in \('voided','authorized'\)/],
 ['refund reconciliation only permits refunded or captured','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/refund_unknown[\s\S]*?v_outcome not in \('refunded','captured'\)/],
 ['report publication requires captured payment','supabase/migrations/20261018000100_report_publication_capture_gate_rc62.sql',/developer_test[\s\S]*?payment_status<>'captured'[\s\S]*?PAYMENT_CAPTURE_REQUIRED/],
 ['payout queue requires captured payment','supabase/migrations/20261018000200_captured_payment_payout_gate_rc63.sql',/ready_for_payout' and j\.payment_status='captured'/],
 ['payout reconciliation requires captured payment','supabase/migrations/20261018000200_captured_payment_payout_gate_rc63.sql',/j\.status<>'completed' or j\.payment_status<>'captured' or j\.payout_status<>'ready_for_payout'/],
 ['payment lifecycle void is pre-completion only','supabase/functions/maverick-payment-lifecycle/index.ts',/job\.payment_status!=='authorized'\|\|job\.status==='completed'/],
 ['payment decline restores job hold reason','supabase/functions/maverick-payment-lifecycle/index.ts',/payout_hold_reason:job\.payout_hold_reason/],
 ['payment decline restores financial hold reason','supabase/functions/maverick-payment-lifecycle/index.ts',/hold_reason:financial\.hold_reason/],
 ['scheduled authorization timing gate','supabase/functions/maverick-payments/index.ts',/authorizationOpensAt/],
 ['vacation long-lived authorization blocked','supabase/functions/maverick-payments/index.ts',/Vacation Watch requires service-window authorization/],
 ['client deferred authorization UX','src/ClientPortal.tsx',/Schedule security request/],
 ['client vacation authorization UX','src/ClientPortal.tsx',/Schedule Vacation Watch/],
]
let failed=0
for(const [name,file,pattern] of checks){const ok=pattern.test(read(file));console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Mission-critical regression audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Mission-critical regression audit passed: ${checks.length}/${checks.length}`)
