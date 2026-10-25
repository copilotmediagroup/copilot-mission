import {Capacitor,registerPlugin} from '@capacitor/core'
import {LocalNotifications} from '@capacitor/local-notifications'
import type {BackgroundGeolocationPlugin,Location,CallbackError} from '@capacitor-community/background-geolocation'

const BackgroundGeolocation=registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
import {publishGuardLocation} from '../modules/location/liveLocationRepository'

export type NativeBackgroundLocationOptions={
  enabled:boolean
  jobId?:string|null
  onPublished?:()=>void
  onError?:(message:string)=>void
}

function asGeolocationPosition(location:any):GeolocationPosition{
  const timestamp=Number(location?.time??location?.timestamp??Date.now())
  return {
    coords:{
      latitude:Number(location.latitude),
      longitude:Number(location.longitude),
      accuracy:Number(location.accuracy??0),
      altitude:location.altitude==null?null:Number(location.altitude),
      altitudeAccuracy:location.altitudeAccuracy==null?null:Number(location.altitudeAccuracy),
      heading:location.bearing==null?null:Number(location.bearing),
      speed:location.speed==null?null:Number(location.speed),
    },
    timestamp:Number.isFinite(timestamp)?timestamp:Date.now(),
  } as GeolocationPosition
}

async function ensureAndroidBackgroundNotificationPermission(){
  if(Capacitor.getPlatform()!=='android')return
  const current=await LocalNotifications.checkPermissions()
  const permission=current.display==='prompt'||current.display==='prompt-with-rationale'
    ?await LocalNotifications.requestPermissions()
    :current
  if(permission.display!=='granted')throw new Error('Notification permission is required so Android can show active mission location tracking.')
}

export async function startNativeGuardBackgroundLocation(input:NativeBackgroundLocationOptions){
  if(!input.enabled||!Capacitor.isNativePlatform()||Capacitor.getPlatform()==='web')return()=>undefined
  await ensureAndroidBackgroundNotificationPermission()

  let publishing=false
  let stopped=false
  let pending:Location|null=null
  const publishLatest=async(location:Location)=>{
    if(stopped)return
    if(publishing){pending=location;return}
    publishing=true
    try{await publishGuardLocation(asGeolocationPosition(location),input.jobId??null);input.onPublished?.()}
    catch(error){input.onError?.(error instanceof Error?error.message:'Unable to publish background location')}
    finally{publishing=false;const next=pending;pending=null;if(next&&!stopped)void publishLatest(next)}
  }
  const watcherId=await BackgroundGeolocation.addWatcher({
    backgroundMessage:'CO PILOT GUARD is sharing your location for an active security mission.',
    backgroundTitle:'Active mission location',
    requestPermissions:true,
    stale:false,
    distanceFilter:5,
  },async(location?:Location,error?:CallbackError)=>{
    if(stopped)return
    if(error){input.onError?.(error.message||'Unable to receive background location');return}
    if(!location)return
    void publishLatest(location)
  })

  return()=>{stopped=true;pending=null;void BackgroundGeolocation.removeWatcher({id:watcherId}).catch(error=>input.onError?.(error instanceof Error?error.message:'Unable to stop background location watcher'))}
}
