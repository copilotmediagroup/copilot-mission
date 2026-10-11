import fs from 'node:fs'
const migrations=['20261010141000_mobile_push_token_registry.sql','20261010142000_mobile_push_delivery_outbox.sql','20261010143000_mobile_push_outbox_claims.sql','20261010144000_mobile_push_outbox_retry_limits.sql','20261010145000_mobile_push_outbox_backoff.sql','20261011002000_mobile_push_outbox_leases.sql']
let failed=false
for(const name of migrations){const p=`supabase/migrations/${name}`;if(!fs.existsSync(p)){console.error(`BLOCK missing ${p}`);failed=true}else console.log(`READY ${name}`)}
for(const fn of ['mobile-push-dispatch','mobile-push-worker']){const p=`supabase/functions/${fn}/index.ts`;if(!fs.existsSync(p)){console.error(`BLOCK missing ${p}`);failed=true}else console.log(`READY ${fn}`)}
console.log('\nSource backend package only. This does not claim migrations, functions, provider secrets, scheduler, or live canary are active in production.')
if(failed)process.exit(1)
