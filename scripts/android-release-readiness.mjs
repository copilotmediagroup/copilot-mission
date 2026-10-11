import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const apps=['client','guard']; let pass=0,block=0;
for(const app of apps){const base=`native/${app}/android`, apk=`${base}/app/build/outputs/apk/debug/app-debug.apk`; const checks=[[fs.existsSync(`${base}/gradlew`),'native project'],[fs.existsSync(apk),'debug APK'],[fs.existsSync(`${base}/app/src/main/AndroidManifest.xml`),'manifest']]; for(const [ok,n] of checks){console.log(ok?'PASS ':'BLOCK',app,n); ok?pass++:block++;}}
let devices=''; try{devices=execFileSync(process.env.HOME+'/Library/Android/sdk/platform-tools/adb',['devices'],{encoding:'utf8',timeout:3000})}catch{}
const attached=devices.split('\n').some(l=>/\tdevice$/.test(l)); console.log(attached?'PASS ':'BLOCK','physical Android device attached'); attached?pass++:block++;
const signing=Boolean(process.env.COPILOT_ANDROID_KEYSTORE&&process.env.COPILOT_ANDROID_KEY_ALIAS&&process.env.COPILOT_ANDROID_KEYSTORE_PASSWORD&&process.env.COPILOT_ANDROID_KEY_PASSWORD); console.log(signing?'PASS ':'BLOCK','private Android release signing inputs'); signing?pass++:block++;
console.log(`\n${pass} passed; ${block} Android release blockers.`); if(block) process.exit(1);
