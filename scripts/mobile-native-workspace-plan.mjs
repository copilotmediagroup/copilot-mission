import fs from 'node:fs'
const targets=['client','guard'],platforms=['android','ios'];console.log('CO PILOT NATIVE WORKSPACE PLAN')
for(const t of targets)for(const p of platforms){const path=`native/${t}/${p}`;console.log(`${fs.existsSync(path)?'READY':'PLAN '} ${t.padEnd(6)} ${p.padEnd(7)} ${path}`)}
console.log('\nIsolation rule: Client and Guard native projects must never overwrite each other. Root android/ios directories are legacy/transient only until isolated workspace generation is certified.')
