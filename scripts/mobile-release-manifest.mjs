import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process'
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();if(dirty){console.error('Refusing release manifest from a dirty working tree. Commit or revert changes first.');process.exit(2)}
const files=['package.json','package-lock.json','capacitor.config.ts','scripts/mobile-release-audit.mjs','mobile/store/DEVICE_CERTIFICATION.md','mobile/store/STORE_SUBMISSION_MATRIX.md','mobile/store/PUSH_ACTIVATION_RUNBOOK.md','supabase/functions/mobile-push-dispatch/index.ts','supabase/functions/mobile-push-worker/index.ts','supabase/migrations/20261011002000_mobile_push_outbox_leases.sql'].filter(fs.existsSync)
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const manifest={git_commit:sha,generated_at:new Date().toISOString(),files:Object.fromEntries(files.map(p=>[p,hash(p)]))}
const out=`mobile-release-manifest-${sha.slice(0,7)}.json`;fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');console.log(out)
