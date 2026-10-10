import {supabase} from '../lib/supabase'
import type {MobileTarget} from './mobileTarget'
import type {NativePushRegistration} from './nativePlatform'

export async function persistNativePushToken(registration:NativePushRegistration,target:MobileTarget){
  if(!target||!supabase)return
  if(registration.platform!=='ios'&&registration.platform!=='android')return
  const {error}=await supabase.rpc('register_mobile_push_token',{p_token:registration.token,p_platform:registration.platform,p_app_target:target})
  if(error)throw error
}

export async function removeNativePushToken(token:string){
  if(!supabase)return
  const {error}=await supabase.rpc('unregister_mobile_push_token',{p_token:token})
  if(error)throw error
}
