import fs from 'node:fs'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
const capture=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8'}).trim()
const sha=capture('git',['rev-parse','HEAD']),dirty=capture('git',['status','--porcelain'])
if(dirty){console.error('Refusing release evidence from a dirty working tree. Commit or revert changes first.');process.exit(2)}
const short=sha.slice(0,7),stamp=new Date().toISOString().replace(/[:.]/g,'-'),dir=`mobile/release-evidence/${stamp}-${short}`
fs.mkdirSync(dir,{recursive:true})
const run=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){return `${e.stdout||''}${e.stderr||''}\nEXIT_CODE=${e.status??1}\n`}}
fs.writeFileSync(`${dir}/SOURCE_COMMIT.txt`,`${sha}\n`)
fs.writeFileSync(`${dir}/git-status.txt`,'CLEAN\n')
fs.writeFileSync(`${dir}/environment.txt`,`node=${process.version}\nnpm=${capture('npm',['--version'])}\nos=${os.type()} ${os.release()} ${os.arch()}\n`)
fs.writeFileSync(`${dir}/mobile-audit.txt`,run('npm',['run','mobile:audit']))
fs.writeFileSync(`${dir}/release-status.txt`,run('npm',['run','mobile:status']))
fs.writeFileSync(`${dir}/release-preflight.txt`,run('npm',['run','mobile:preflight']))
fs.writeFileSync(`${dir}/backend-readiness.txt`,run('npm',['run','mobile:backend:ready']))
fs.copyFileSync('mobile/store/DEVICE_CERTIFICATION.md',`${dir}/DEVICE_CERTIFICATION.md`)
fs.copyFileSync('mobile/store/STORE_SUBMISSION_MATRIX.md',`${dir}/STORE_SUBMISSION_MATRIX.md`)
fs.writeFileSync(`${dir}/README.md`,`# Mobile release evidence\n\nSource commit: \`${sha}\`\n\nGenerated: ${new Date().toISOString()}\n\nSource tree was clean. This local/private packet records audit, status, preflight, backend readiness and build environment. Fill device certification only against signed binaries built from this exact commit.\n`)
console.log(dir)
