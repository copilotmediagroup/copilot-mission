import fs from 'node:fs'
const target=process.argv[2]
const apps={client:{appId:'com.copilotsecurity.client',appName:'CO PILOT SECURITY'},guard:{appId:'com.copilotsecurity.guard',appName:'CO PILOT GUARD'}}
if(!apps[target]){console.error('Use client or guard');process.exit(1)}
const a=apps[target]
const source=`import type { CapacitorConfig } from '@capacitor/cli'\n\nconst config: CapacitorConfig = {\n  appId: '${a.appId}',\n  appName: '${a.appName}',\n  webDir: 'dist',\n  server: { androidScheme: 'https' },\n  plugins: { PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] } },\n}\n\nexport default config\n`
fs.writeFileSync('capacitor.config.ts',source)
console.log(`Configured ${a.appName} (${a.appId})`)
