import fs from 'node:fs'
const exists=p=>fs.existsSync(p),inputs=process.env.COPILOT_MOBILE_RELEASE_INPUTS?.trim();const b=[]
if(!(inputs&&exists(inputs)))b.push('OWNER: private release inputs')
for(const [t,p] of [['client','android'],['guard','android'],['client','ios'],['guard','ios']])if(!exists(`native/${t}/${p}`))b.push(`BUILD: ${t} ${p} isolated native project`)
b.push('OWNER/BUILD: final store artwork and screenshots');b.push('DEVICE: signed physical-device certification');b.push('PROVIDER: APNs/FCM production credentials and single-device canary');b.push('PRODUCTION: reviewed mobile migrations/functions activation')
console.log('CO PILOT MOBILE EXTERNAL BLOCKERS\n');b.forEach((x,i)=>console.log(`${i+1}. ${x}`));console.log(`\n${b.length} external release blockers remain; source completion does not mark these done.`)
