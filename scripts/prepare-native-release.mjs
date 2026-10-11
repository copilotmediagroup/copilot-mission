import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const target=process.argv[2],platform=process.argv[3]
if(!['client','guard'].includes(target)||!['ios','android'].includes(platform)){console.error('Usage: node scripts/prepare-native-release.mjs <client|guard> <ios|android>');process.exit(1)}
const dir=platform
if(fs.existsSync(dir)){console.error(`${dir}/ already exists. Refusing to overwrite a native project; use the target sync command instead.`);process.exit(2)}
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'})
run('node',['scripts/write-mobile-config.mjs',target]);run('npm',['run','build:mobile']);run('npx',['cap','add',platform]);run('node',['scripts/configure-native-project.mjs',target,platform]);run('npx',['cap','sync',platform])
console.log(`Prepared ${target} ${platform} native project. Physical-device certification is still required.`)
