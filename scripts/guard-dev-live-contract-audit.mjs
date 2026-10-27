import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const dispatch=fs.readFileSync('src/modules/dispatch/dispatchRepository.ts','utf8')
const dev=fs.readFileSync('src/modules/developer/developerLiveRepository.ts','utf8')
const evidence=fs.readFileSync('src/modules/mission/missionEvidenceRepository.ts','utf8')
const checks=[
 ['same GuardDashboard renderer',/activeRole === 'guard' \? <GuardApp/.test(app)&&/<GuardDashboard/.test(app)],
 ['live and dev authoritative workspace',app.includes('getGuardDispatchWorkspace()')&&app.includes('getDeveloperGuardWorkspace(developerGuardId)')],
 ['live and dev authoritative metrics',app.includes('getGuardOperationalMetrics()')&&app.includes('getDeveloperGuardOperationalMetrics(developerGuardId)')],
 ['online/offline persisted in both modes',app.includes('setGuardPresence(true)')&&app.includes('setDeveloperGuardPresence(developerGuardId,true)')&&app.includes('setGuardPresence(false)')&&app.includes('setDeveloperGuardPresence(developerGuardId,false)')],
 ['accept persisted in both modes',app.includes("action:'accept'")&&app.includes("action:'accept',expectedVersion")],
 ['decline persisted in both modes',app.includes("action:'decline'")&&app.includes("action:'decline',expectedVersion")],
 ['route persisted in both modes',app.includes("action:'start_route'")&&app.includes("action:'start_route',expectedVersion")],
 ['arrival persisted in both modes',app.includes("action:'mark_arrived'")&&app.includes("action:'mark_arrived',expectedVersion")],
 ['payload persisted in both modes',app.includes("action:'save_payload'")&&dispatch.includes("p_action:args.action")],
 ['checkpoint persisted in both modes',app.includes("action:'complete_checkpoint'")&&dispatch.includes("transition_guard_slot_mission_rc1")],
 ['submission persisted in both modes',app.includes("action:'submit'")&&dispatch.includes("transition_guard_mission")],
 ['same secured evidence bucket',evidence.includes("const BUCKET='mission-evidence'")],
 ['dev evidence cannot use live upload identity accidentally',evidence.includes("input.developerTest?'get_developer_guard_evidence_upload_rc1':'get_guard_evidence_upload_rc1'")],
 ['reports split only by selected identity',app.includes('publishGuardMissionReport(dispatchMission.job_id, developerGuardId)')&&app.includes('publishMyMissionReport(dispatchMission.job_id)')],
 ['developer mutation restricted to selected guard',dev.includes('p_guard_id:input.guardId')&&dev.includes('p_guard_id:guardId')],
 ['live mutation derives guard from auth',dispatch.includes("rpc('transition_guard_mission'")&&dispatch.includes("rpc('set_guard_presence_rc13'")],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Guard dev/live contract audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Guard dev/live contract audit passed: ${checks.length}/${checks.length}`)
