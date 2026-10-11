import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const short=sha.slice(0,7),stamp=new Date().toISOString().replace(/[:.]/g,'-')
const dir=`mobile/release-evidence/${stamp}-${short}`
fs.mkdirSync(dir,{recursive:true})
const run=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){return `${e.stdout||''}${e.stderr||''}\nEXIT_CODE=${e.status??1}\n`}}
fs.writeFileSync(`${dir}/SOURCE_COMMIT.txt`,`${sha}\n`)
fs.writeFileSync(`${dir}/mobile-audit.txt`,run('npm',['run','mobile:audit']))
fs.writeFileSync(`${dir}/release-status.txt`,run('npm',['run','mobile:status']))
fs.copyFileSync('mobile/store/DEVICE_CERTIFICATION.md',`${dir}/DEVICE_CERTIFICATION.md`)
fs.copyFileSync('mobile/store/STORE_SUBMISSION_MATRIX.md',`${dir}/STORE_SUBMISSION_MATRIX.md`)
fs.writeFileSync(`${dir}/README.md`,`# Mobile release evidence\n\nSource commit: \`${sha}\`\n\nGenerated: ${new Date().toISOString()}\n\nThis folder is local release evidence and is intentionally ignored by Git. Fill the copied device certification only against signed binaries built from this exact commit.\n`)
console.log(dir)
