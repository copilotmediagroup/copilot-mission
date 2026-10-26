import fs from 'node:fs'
import path from 'node:path'
for(const target of ['client','guard']){
  const root=path.join('native',target,'android')
  const vars=path.join(root,'variables.gradle')
  const build=path.join(root,'build.gradle')
  if(!fs.existsSync(vars)||!fs.existsSync(build))throw new Error(`Missing ${target} Android project`)
  let v=fs.readFileSync(vars,'utf8').replace(/compileSdkVersion\s*=\s*\d+/,'compileSdkVersion = 36').replace(/targetSdkVersion\s*=\s*\d+/,'targetSdkVersion = 36')
  fs.writeFileSync(vars,v)
  let b=fs.readFileSync(build,'utf8').replace(/com\.android\.tools\.build:gradle:[^']+/,'com.android.tools.build:gradle:8.9.1')
  fs.writeFileSync(build,b)
  console.log(`READY ${target} Android source: compileSdk 36 / targetSdk 36 / AGP 8.9.1`)
}
