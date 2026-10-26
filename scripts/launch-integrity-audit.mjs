import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const shell=fs.readFileSync('src/ui.tsx','utf8')
const checks=[
 ['prototype Guardian control is not mounted in launch Guard UI',!/<GuardianButton\b/.test(app)],
 ['launch Guard UI cannot expose simulated emergency acknowledgement',!(/<GuardianButton\b/.test(app)&&/SIMULATE AGENCY ACKNOWLEDGEMENT/.test(fs.readFileSync('src/modules/guardian/GuardianButton.tsx','utf8')))],
 ['launch Guard UI cannot expose simulated backup dispatch',!(/<GuardianButton\b/.test(app)&&/SIMULATE BACKUP DISPATCH/.test(fs.readFileSync('src/modules/guardian/GuardianButton.tsx','utf8')))],
 ['launch Guard UI cannot claim prototype safety delivery',!(/<GuardianButton\b/.test(app)&&/Prototype foundation\. Agency delivery/.test(fs.readFileSync('src/modules/guardian/GuardianButton.tsx','utf8')))],
 ['launch Guard UI cannot claim unverified Guardian device telemetry',!(/<GuardianButton\b/.test(app)&&/Live location connected|Secure agency channel|Device level normal/.test(fs.readFileSync('src/modules/guardian/GuardianProvider.tsx','utf8')))],
 ['no hardcoded Guard identity in active app shell',!/GUARD PORTAL<\/span><b>David Martinez/.test(shell)||!app.includes('DesktopShell')],
]
let failed=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
if(failed){console.error(`Launch integrity audit failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`Launch integrity audit passed: ${checks.length}/${checks.length}`)
