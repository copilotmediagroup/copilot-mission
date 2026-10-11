import fs from 'node:fs'
import {execFileSync} from 'node:child_process'

const root=process.cwd()
const required=['MOBILE_ARCHITECTURE.md','MOBILE_RELEASE_CHECKLIST.md','src/mobile/nativePlatform.ts','src/mobile/mobileTarget.ts','supabase/functions/mobile-push-dispatch/index.ts','mobile/store/STORE_METADATA.md','mobile/store/PRIVACY_DISCLOSURES.md','mobile/store/DEVICE_CERTIFICATION.md','mobile/store/RELEASE_INPUTS.template.env','mobile/store/STORE_SUBMISSION_MATRIX.md']
const failures=[]
const pass=[]
const check=(name,value,detail='')=>{(value?pass:failures).push({name,detail})}
for(const file of required)check(`Required source: ${file}`,fs.existsSync(file))
check('Client bundle identifier declared',fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('com.copilotsecurity.client'))
check('Guard bundle identifier declared',fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('com.copilotsecurity.guard'))
check('Production native bundle is local assets',!fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('server: { url:'))

const releaseInputPath=process.env.COPILOT_MOBILE_RELEASE_INPUTS?.trim()
const releaseInputs=releaseInputPath&&fs.existsSync(releaseInputPath)?fs.readFileSync(releaseInputPath,'utf8'):''
check('Private release input file supplied',Boolean(releaseInputs),'Set COPILOT_MOBILE_RELEASE_INPUTS to a private file outside source control. The committed template is never treated as release configuration.')
if(releaseInputs){
  check('Release URL/contact inputs supplied',/CLIENT_SUPPORT_URL=https?:\/\/.+/.test(releaseInputs)&&/GUARD_SUPPORT_URL=https?:\/\/.+/.test(releaseInputs)&&/PRIVACY_POLICY_URL=https?:\/\/.+/.test(releaseInputs)&&/LEGAL_CONTACT_EMAIL=.+@.+/.test(releaseInputs),'Fill approved release URLs and legal contact in the private release input file.')
  check('Apple release identifiers supplied',/APPLE_TEAM_ID=\S+/.test(releaseInputs)&&/APNS_KEY_ID=\S+/.test(releaseInputs),'Fill Apple team/key identifiers in the private release input file; keep the APNs private key in secret storage.')
  check('FCM release identifiers supplied',/FCM_PROJECT_ID=\S+/.test(releaseInputs)&&/FCM_CLIENT_EMAIL=\S+@\S+/.test(releaseInputs),'Fill Firebase project/client identity in the private release input file; keep the FCM private key in secret storage.')
}
for(const [target,platform] of [['client','android'],['guard','android'],['client','ios'],['guard','ios']]) check(`${target} ${platform} isolated native project`,fs.existsSync(`native/${target}/${platform}`),platform==='ios'?'Create on a supported current macOS/Xcode build machine.':'Create with the isolated native preparation command.')
let doctor=''
try{doctor=execFileSync('npx',['cap','doctor'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});check('Capacitor doctor',true)}catch(e){doctor=`${e.stdout||''}${e.stderr||''}`;check('Capacitor doctor',false,'Native platform projects/toolchains are not ready on this machine.')}
console.log('CO PILOT MOBILE RELEASE PREFLIGHT\n')
for(const x of pass)console.log(`PASS  ${x.name}`)
for(const x of failures)console.log(`BLOCK ${x.name}${x.detail?` — ${x.detail}`:''}`)
if(doctor.trim())console.log(`\nCapacitor doctor:\n${doctor.trim()}`)
console.log(`\n${pass.length} passed; ${failures.length} release blocker${failures.length===1?'':'s'}.`)
if(failures.length)process.exitCode=2
