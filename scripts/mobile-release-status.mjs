import fs from 'node:fs'
const exists=p=>fs.existsSync(p),inputs=process.env.COPILOT_MOBILE_RELEASE_INPUTS?.trim(),privateInputs=Boolean(inputs&&exists(inputs))
const native=(target,platform)=>exists(`native/${target}/${platform}`)
const gates=[
 ['Source certification',true,'Run npm run mobile:audit for detailed checks.'],
 ['Client Android native project',native('client','android'),'Create the Client Android native project.'],
 ['Guard Android native project',native('guard','android'),'Create the Guard Android native project.'],
 ['Client iOS native project',native('client','ios'),'Create on a supported current macOS/Xcode build machine.'],
 ['Guard iOS native project',native('guard','ios'),'Create on a supported current macOS/Xcode build machine.'],
 ['Private release inputs',privateInputs,'Set COPILOT_MOBILE_RELEASE_INPUTS to the private owner release file.'],
 ['Store artwork/screenshots',false,'Owner-approved final artwork and screenshots are external release assets.'],
 ['Physical-device certification',false,'Complete mobile/store/DEVICE_CERTIFICATION.md against signed release candidates.'],
 ['Provider production activation',false,'Apply reviewed migrations, deploy push functions, configure APNs/FCM secrets, then live-test.']]
console.log('CO PILOT MOBILE RELEASE STATUS\n');for(const [name,ok,detail] of gates)console.log(`${ok?'READY':'BLOCK'}  ${name}${ok?'':` — ${detail}`}`);console.log(`\n${gates.filter(x=>x[1]).length}/${gates.length} release gates currently satisfiable from this checkout.`)
