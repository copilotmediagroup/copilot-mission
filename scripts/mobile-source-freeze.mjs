import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process'
const cap=(c,a)=>execFileSync(c,a,{encoding:'utf8'}).trim(),sha=cap('git',['rev-parse','HEAD'])
if(cap('git',['status','--porcelain'])){console.error('Refusing source freeze from a dirty working tree.');process.exit(2)}
const files=['package.json','package-lock.json','capacitor.config.ts','src/mobile/nativePlatform.ts','src/mobile/mobileTarget.ts','scripts/mobile-release-audit.mjs','scripts/mobile-release-preflight.mjs','scripts/mobile-backend-readiness.mjs','supabase/functions/mobile-push-dispatch/index.ts','supabase/functions/mobile-push-worker/index.ts'];const hashes={}
for(const f of files){if(!fs.existsSync(f)){console.error(`Missing freeze input: ${f}`);process.exit(3)}hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}
const dir='mobile/release-evidence/freezes';fs.mkdirSync(dir,{recursive:true});const p=`${dir}/source-freeze-${sha.slice(0,7)}.json`;fs.writeFileSync(p,JSON.stringify({git_commit:sha,generated_at:new Date().toISOString(),critical_source_sha256:hashes},null,2)+'\n');console.log(p)
