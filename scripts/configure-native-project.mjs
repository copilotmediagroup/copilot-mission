import fs from 'node:fs'
const target=process.argv[2],platform=process.argv[3]
if(!['client','guard'].includes(target)||!['ios','android'].includes(platform)){console.error('Usage: node scripts/configure-native-project.mjs <client|guard> <ios|android>');process.exit(1)}
const need=(p)=>{if(!fs.existsSync(p)){console.error(`Native project missing: ${p}`);process.exit(2)}}
if(platform==='ios'){
  const p='ios/App/App/Info.plist';need(p);let s=fs.readFileSync(p,'utf8')
  const entries=[]
  if(!s.includes('<key>NSCameraUsageDescription</key>'))entries.push(`<key>NSCameraUsageDescription</key>\n\t<string>Capture mission proof photos securely.</string>`)
  if(!s.includes('<key>NSLocationWhenInUseUsageDescription</key>'))entries.push(`<key>NSLocationWhenInUseUsageDescription</key>\n\t<string>Use your location for live mission tracking and arrival verification.</string>`)
  if(target==='guard'&&!s.includes('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>'))entries.push(`<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>\n\t<string>Keep your active mission location updated while CO PILOT GUARD is in the background.</string>`)
  if(target==='guard'&&!s.includes('<key>UIBackgroundModes</key>'))entries.push(`<key>UIBackgroundModes</key>\n\t<array><string>location</string><string>remote-notification</string></array>`)
  if(entries.length)s=s.replace('</dict>',`\t${entries.join('\n\t')}\n</dict>`)
  fs.writeFileSync(p,s)
}else{
  const p='android/app/src/main/AndroidManifest.xml';need(p);let s=fs.readFileSync(p,'utf8')
  const perms=['android.permission.CAMERA','android.permission.ACCESS_FINE_LOCATION']
  if(target==='guard')perms.push('android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_BACKGROUND_LOCATION','android.permission.POST_NOTIFICATIONS','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_LOCATION')
  const missing=perms.filter(x=>!s.includes(`android:name="${x}"`)).map(x=>`    <uses-permission android:name="${x}" />`).join('\n')
  if(missing)s=s.replace('<application',`${missing}\n\n    <application`)
  fs.writeFileSync(p,s)
}
console.log(`Configured ${target} ${platform} native permissions`)
