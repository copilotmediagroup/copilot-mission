import fs from 'node:fs'
import {execFileSync} from 'node:child_process'

const root=process.cwd()
const required=['MOBILE_ARCHITECTURE.md','MOBILE_RELEASE_CHECKLIST.md','src/mobile/nativePlatform.ts','src/mobile/mobileTarget.ts','supabase/functions/mobile-push-dispatch/index.ts','mobile/store/STORE_METADATA.md','mobile/store/PRIVACY_DISCLOSURES.md','mobile/store/DEVICE_CERTIFICATION.md','mobile/store/RELEASE_INPUTS.template.env']
const failures=[]
const pass=[]
const check=(name,value,detail='')=>{(value?pass:failures).push({name,detail})}
for(const file of required)check(`Required source: ${file}`,fs.existsSync(file))
check('Client bundle identifier declared',fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('com.copilotsecurity.client'))
check('Guard bundle identifier declared',fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('com.copilotsecurity.guard'))
check('Production native bundle is local assets',!fs.readFileSync('scripts/write-mobile-config.mjs','utf8').includes('server: { url:'))
const releaseInputs=fs.readFileSync('mobile/store/RELEASE_INPUTS.template.env','utf8')
check('Release URL/contact inputs supplied',/CLIENT_SUPPORT_URL=https?:\/\/.+/.test(releaseInputs)&&/GUARD_SUPPORT_URL=https?:\/\/.+/.test(releaseInputs)&&/PRIVACY_POLICY_URL=https?:\/\/.+/.test(releaseInputs)&&/LEGAL_CONTACT_EMAIL=.+@.+/.test(releaseInputs),'Fill private/approved release URLs and legal contact before submission.')
check('iOS native project exists',fs.existsSync('ios'),'Create on a supported current macOS/Xcode build machine.')
check('Android native project exists',fs.existsSync('android'),'Create on a supported Android build machine.')
let doctor=''
try{doctor=execFileSync('npx',['cap','doctor'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});check('Capacitor doctor',true)}catch(e){doctor=`${e.stdout||''}${e.stderr||''}`;check('Capacitor doctor',false,'Native platform projects/toolchains are not ready on this machine.')}
console.log('CO PILOT MOBILE RELEASE PREFLIGHT\n')
for(const x of pass)console.log(`PASS  ${x.name}`)
for(const x of failures)console.log(`BLOCK ${x.name}${x.detail?` — ${x.detail}`:''}`)
if(doctor.trim())console.log(`\nCapacitor doctor:\n${doctor.trim()}`)
console.log(`\n${pass.length} passed; ${failures.length} release blocker${failures.length===1?'':'s'}.`)
if(failures.length)process.exitCode=2
