import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process'
const path=process.argv[2];if(!path||!fs.existsSync(path)){console.error('Usage: node scripts/verify-mobile-release-manifest.mjs <manifest.json>');process.exit(2)}
const m=JSON.parse(fs.readFileSync(path,'utf8')),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const normalizedPath=path.replace(/^\.\//,'');
const dirty=status.filter(line=>line.slice(3)!==normalizedPath).join('\n');let failed=false
if(dirty){console.error('FAIL working tree is dirty');failed=true}else console.log('PASS working tree clean')
if(m.git_commit!==head){console.error(`FAIL commit mismatch manifest=${m.git_commit} head=${head}`);failed=true}else console.log(`PASS commit ${head}`)
for(const [file,expected] of Object.entries(m.files||{})){if(!fs.existsSync(file)){console.error(`FAIL missing ${file}`);failed=true;continue}const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(actual!==expected){console.error(`FAIL hash ${file}`);failed=true}else console.log(`PASS hash ${file}`)}
if(failed)process.exit(1);console.log('Release manifest verified.')
