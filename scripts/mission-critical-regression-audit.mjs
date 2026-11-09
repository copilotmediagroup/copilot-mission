import fs from 'node:fs'
const read=f=>fs.readFileSync(f,'utf8')
const paymentSql='supabase/migrations/20261109120919_payment_operations_atomic_capture_outbox.sql'
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
 ['payment lifecycle owning client void only',paymentSql,/p_action='void' AND actor_role='client' AND EXISTS\(SELECT 1 FROM public\.clients[\s\S]*?user_id=p_actor_user_id/],
 ['payment capture requires admin or claimed server worker',paymentSql,/SERVER_CAPTURE_CLAIM_REQUIRED[\s\S]*?actor_role<>'platform_admin'/],
 ['payment lifecycle blocks developer processor mutation',paymentSql,/DEVELOPER_TEST_PROCESSOR_FORBIDDEN/],
 ['payment capture requires completed authorized mission',paymentSql,/ELSE 'authorized' END[\s\S]*?COMPLETED_MISSION_REQUIRED/],
 ['payment capture requires completed staffing',paymentSql,/MISSION_STAFFING_INCOMPLETE/],
 ['payment capture requires ready mission report',paymentSql,/MISSION_REPORT_NOT_READY/],
 ['payment capture requires checkpoint proof',paymentSql,/FOREACH cp IN ARRAY ARRAY\[2,4\][\s\S]*?REQUIRED_SECURED_PHOTO_MISSING/],
 ['payment transport uncertainty enters reconciliation hold',paymentSql,/p_outcome='unknown' THEN 'payment_reconciliation_required'/],
 ['lifecycle reconciliation queue quarantines unknown states','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/payment_status in \('capture_unknown','void_unknown','refund_unknown'\)[\s\S]*?payment_reconciliation_required/],
 ['capture reconciliation only permits captured or authorized','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/capture_unknown[\s\S]*?v_outcome not in \('captured','authorized'\)/],
 ['void reconciliation only permits voided or authorized','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/void_unknown[\s\S]*?v_outcome not in \('voided','authorized'\)/],
 ['refund reconciliation only permits refunded or captured','supabase/migrations/20261018000300_payment_lifecycle_reconciliation_rc64.sql',/refund_unknown[\s\S]*?v_outcome not in \('refunded','captured'\)/],
 ['report publication requires captured payment','supabase/migrations/20261018000100_report_publication_capture_gate_rc62.sql',/developer_test[\s\S]*?payment_status<>'captured'[\s\S]*?PAYMENT_CAPTURE_REQUIRED/],
 ['payout queue requires captured payment','supabase/migrations/20261018000200_captured_payment_payout_gate_rc63.sql',/ready_for_payout' and j\.payment_status='captured'/],
 ['payout reconciliation requires captured payment','supabase/migrations/20261018000200_captured_payment_payout_gate_rc63.sql',/j\.status<>'completed' or j\.payment_status<>'captured' or j\.payout_status<>'ready_for_payout'/],
 ['payment lifecycle void is pre-completion only',paymentSql,/ELSIF p_action='void' THEN[\s\S]*?PRE_COMPLETION_REQUIRED/],
 ['payment decline restores job hold reason',paymentSql,/payout_hold_reason=CASE WHEN p_outcome='declined' THEN o.prior_job_hold/],
 ['payment decline restores financial hold reason',paymentSql,/hold_reason=CASE WHEN p_outcome='declined' THEN o.prior_financial_hold/],
 ['scheduled authorization timing gate','supabase/functions/maverick-payments/index.ts',/authorizationOpensAt/],
 ['vacation long-lived authorization blocked','supabase/functions/maverick-payments/index.ts',/Vacation Watch requires service-window authorization/],
 ['client deferred authorization UX','src/ClientPortal.tsx',/Schedule security request/],
 ['client vacation authorization UX','src/ClientPortal.tsx',/Schedule Vacation Watch/],
]
let failed=0
for(const [name,file,pattern] of checks){const ok=pattern.test(read(file));console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Mission-critical regression audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Mission-critical regression audit passed: ${checks.length}/${checks.length}`)
