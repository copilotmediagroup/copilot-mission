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
]
let failed=0
for(const [name,file,pattern] of checks){const ok=pattern.test(read(file));console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Mission-critical regression audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Mission-critical regression audit passed: ${checks.length}/${checks.length}`)
