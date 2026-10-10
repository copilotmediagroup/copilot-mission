import {Capacitor} from '@capacitor/core'
import {Camera,CameraResultType,CameraSource} from '@capacitor/camera'
import {Geolocation} from '@capacitor/geolocation'
import {PushNotifications} from '@capacitor/push-notifications'

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

export async function registerNativePush(){
  if(!isNativeMobile())return null
  const current=await PushNotifications.checkPermissions()
  const permission=current.receive==='prompt'?await PushNotifications.requestPermissions():current
  if(permission.receive!=='granted')return null
  await PushNotifications.register()
  return permission.receive
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
