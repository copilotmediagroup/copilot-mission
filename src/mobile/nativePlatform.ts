import {Capacitor} from '@capacitor/core'
import {Camera,CameraResultType,CameraSource} from '@capacitor/camera'
import {Geolocation} from '@capacitor/geolocation'
import {PushNotifications,type Token,type ActionPerformed} from '@capacitor/push-notifications'
import type {MobileTarget} from './mobileTarget'

export const isNativeMobile=()=>Capacitor.isNativePlatform()
export const nativePlatform=()=>Capacitor.getPlatform()

export async function requestForegroundLocation(){
  if(!isNativeMobile())return null
  const permission=await Geolocation.requestPermissions({permissions:['location']})
  if(permission.location!=='granted'&&permission.coarseLocation!=='granted')throw new Error('Location permission is required for live mission tracking.')
  return Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:5000})
}

export async function captureMissionPhoto(){
  if(!isNativeMobile())return null
  return Camera.getPhoto({quality:88,resultType:CameraResultType.Uri,source:CameraSource.Camera,correctOrientation:true,saveToGallery:false})
}

export type NativePushRegistration={token:string;platform:string}
export type NativePushAction={jobId:string|null;type:string|null;target:MobileTarget}

export function nativePushAction(action:ActionPerformed,target:MobileTarget):NativePushAction{
  const data=(action.notification?.data??{}) as Record<string,unknown>
  const rawJob=data.job_id??data.jobId
  return {
    jobId:typeof rawJob==='string'&&rawJob.trim()?rawJob:null,
    type:typeof data.type==='string'?data.type:null,
    target,
  }
}

export function storeNativePushAction(action:ActionPerformed,target:MobileTarget){
  if(!target)return
  const parsed=nativePushAction(action,target)
  sessionStorage.setItem('co-pilot-native-push-action',JSON.stringify(parsed))
  window.dispatchEvent(new CustomEvent('co-pilot-native-push-action',{detail:parsed}))
}

export async function registerNativePush(onToken?:(registration:NativePushRegistration)=>void,onAction?:(action:ActionPerformed)=>void){
  if(!isNativeMobile())return null
  const current=await PushNotifications.checkPermissions()
  const permission=current.receive==='prompt'?await PushNotifications.requestPermissions():current
  if(permission.receive!=='granted')return null
  const registration=await PushNotifications.addListener('registration',(token:Token)=>onToken?.({token:token.value,platform:nativePlatform()}))
  const error=await PushNotifications.addListener('registrationError',err=>console.warn('Native push registration failed',err))
  const action=onAction?await PushNotifications.addListener('pushNotificationActionPerformed',onAction):null
  await PushNotifications.register()
  return async()=>{await registration.remove();await error.remove();if(action)await action.remove()}
}

export async function nativePhotoFile(){
  const photo=await captureMissionPhoto()
  if(!photo?.webPath)return null
  const response=await fetch(photo.webPath)
  const blob=await response.blob()
  const type=blob.type||photo.format&&('image/'+photo.format)||'image/jpeg'
  const ext=photo.format||'jpg'
  return new File([blob],`mission-${Date.now()}.${ext}`,{type})
}

export async function currentNativeCoordinates(){
  const position=await requestForegroundLocation()
  return position?{latitude:position.coords.latitude,longitude:position.coords.longitude}:null
}
