import fs from 'node:fs'
const target=process.argv[2],isolated=process.argv.includes('--isolated')
const apps={client:{appId:'com.copilotsecurity.client',appName:'CO PILOT SECURITY'},guard:{appId:'com.copilotsecurity.guard',appName:'CO PILOT GUARD'}}
if(!apps[target]){console.error('Use client or guard');process.exit(1)}
const a=apps[target],webDir=isolated?'../../dist':'dist',androidPath=isolated?`native/${target}/android`:undefined,iosPath=isolated?`native/${target}/ios`:undefined
const source=`import type { CapacitorConfig } from '@capacitor/cli'\n\nconst config: CapacitorConfig = {\n  appId: '${a.appId}',\n  appName: '${a.appName}',\n  webDir: '${webDir}',\n  server: { androidScheme: 'https' },\n  android: { useLegacyBridge: ${target==='guard'?'true':'false'}${androidPath?`, path: '${androidPath}'`:''} },\n  ios: {${iosPath?` path: '${iosPath}'`:''} },\n  plugins: {\n    CapacitorHttp: { enabled: ${target==='guard'?'true':'false'} },\n    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },\n  },\n}\n\nexport default config\n`
fs.writeFileSync('capacitor.config.ts',source);fs.writeFileSync('.env.mobile',`VITE_MOBILE_TARGET=${target}\n`);console.log(`Configured ${a.appName} (${a.appId})${isolated?' with isolated native paths':''}`)
