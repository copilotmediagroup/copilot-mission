import fs from 'node:fs'
const read=f=>fs.readFileSync(f,'utf8')
const migration='supabase/migrations/20261026193000_guard_live_parity_hardening.sql'
const app=read('src/App.tsx')
const evidence=read('src/modules/mission/missionEvidenceRepository.ts')
const sql=read(migration)
const presenceSql=read('supabase/migrations/20261027003000_guard_completed_presence_parity.sql')
const profileSql=read('supabase/migrations/20261027011500_guard_live_profile_parity.sql')
const styles=read('src/styles.css')
const checks=[
 ['real slot offers exclude terminal parent jobs',sql,/get_my_guard_slot_offer_rc1[\s\S]*?j\.status in\('accepted','assigned','active'\)/],
 ['real slot offers require multi-guard parent',sql,/get_my_guard_slot_offer_rc1[\s\S]*?greatest\(1,coalesce\(j\.required_guards,1\)\)>1/],
 ['live GPS accepts single assignments',sql,/publish_guard_location[\s\S]*?from public\.job_assignments/],
 ['live GPS accepts multi-guard slots',sql,/publish_guard_location[\s\S]*?from public\.job_guard_slots/],
 ['live GPS rejects stale terminal slot parents',sql,/publish_guard_location[\s\S]*?j\.status in\('accepted','assigned','active'\)/],
 ['real slot checkpoints require secured photo media',sql,/transition_guard_slot_mission_rc1[\s\S]*?guard_slot_required_photo_ok_rc1[\s\S]*?REQUIRED_REAL_PHOTO_MISSING/],
 ['developer and production evidence use same storage bucket',evidence,/const BUCKET='mission-evidence'/],
 ['developer evidence uses guarded upload authorization',evidence,/get_developer_guard_evidence_upload_rc1/],
 ['production evidence uses guarded upload authorization',evidence,/get_guard_evidence_upload_rc1/],
 ['real Guard decline executes authoritative transition',app,/liveTransition\(\{jobId:dispatchMission\.job_id,action:'decline'/],
 ['developer Guard decline executes database transition',app,/transitionDeveloperGuardMission\(\{guardId:developerGuardId,jobId:dispatchMission\.job_id[\s\S]*?action:'decline'/],
 ['live dispatch polling uses authoritative workspace',app,/getGuardDispatchWorkspace\(\)/],
 ['developer polling uses real selected-Guard workspace',app,/getDeveloperGuardWorkspace\(developerGuardId\)/],
 ['developer Guard report archive uses selected real Guard',read('src/GuardDashboard.tsx'),/getMyGuardReports\(developerGuardId\)/],
 ['developer Guard can publish from completion flow',app,/publishGuardMissionReport\(dispatchMission\.job_id, developerGuardId\)/],
 ['developer Guard publication is restricted to developer-test jobs',sql,/publish_developer_guard_mission_report_rc1[\s\S]*?DEVELOPER_TEST_JOB_REQUIRED/],
 ['developer Guard publication requires completed mission',sql,/publish_developer_guard_mission_report_rc1[\s\S]*?MISSION_NOT_COMPLETED/],
 ['developer Guard publication requires completed staffing',sql,/publish_developer_guard_mission_report_rc1[\s\S]*?MISSION_STAFFING_INCOMPLETE/],
 ['production Guard profile reads email from auth.users',profileSql,/select email into u_email from auth\.users where id=g\.user_id/],
 ['production Guard profile never reads nonexistent profiles.email',profileSql,/coalesce\(nullif\(trim\(p\.full_name\),''\),u_email,'Guard'\)/],
 ['production Guard profile carries avatar fallback',profileSql,/avatar_url',coalesce\(g\.avatar_url,p\.avatar_url\)/],
 ['return-online recognizes completed multi-guard slot missions',presenceSql,/guard_slot_mission_state[\s\S]*?s\.status='completed'[\s\S]*?gs\.state='completed'/],
 ['return-online rejects still-active parent jobs',presenceSql,/marketplace_jobs[\s\S]*?j\.status in\('accepted','assigned','active'\)/],
 ['Guard mission toast follows white-black launch theme',styles,/\.guard-app \.mission-toast\{background:#fff!important;color:#111!important/],
 ['active mission hides legacy five-item navigation',styles,/not\(\.state-offline\):not\(\.state-waiting\) \.bottom-nav\{display:none!important/],
]
let failed=0
for(const [name,text,pattern] of checks){const ok=pattern.test(text);console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Production parity audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Production parity audit passed: ${checks.length}/${checks.length}`)
