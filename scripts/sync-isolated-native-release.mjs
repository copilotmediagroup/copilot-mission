import fs from 'node:fs';import {execFileSync} from 'node:child_process'
const target=process.argv[2],platform=process.argv[3];if(!['client','guard'].includes(target)||!['ios','android'].includes(platform)){console.error('Usage: node scripts/sync-isolated-native-release.mjs <client|guard> <ios|android>');process.exit(1)}
const dir=`native/${target}/${platform}`;if(!fs.existsSync(dir)){console.error(`${dir} does not exist; prepare it first.`);process.exit(2)}
const run=(c,a)=>execFileSync(c,a,{stdio:'inherit'});run('node',['scripts/write-mobile-config.mjs',target,'--isolated']);run('npm',['run','build:mobile']);run('node',['scripts/configure-native-project.mjs',target,platform,dir]);run('npx',['cap','sync',platform]);console.log(`Synced isolated ${target} ${platform}: ${dir}`)
