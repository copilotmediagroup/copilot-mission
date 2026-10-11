import {supabase} from '../lib/supabase'
import type {MobileTarget} from './mobileTarget'
import type {NativePushRegistration} from './nativePlatform'

export async function persistNativePushToken(registration:NativePushRegistration,target:MobileTarget){
  if(!target||!supabase)return
  if(registration.platform!=='ios'&&registration.platform!=='android')return
  const token=registration.token.trim()
  if(!token||token.length>4096)return
  const {error}=await supabase.rpc('register_mobile_push_token',{p_token:token,p_platform:registration.platform,p_app_target:target})
  if(error)throw error
}

export async function removeNativePushToken(token:string){
  if(!supabase)return
  const clean=token.trim()
  if(!clean)return
  const {error}=await supabase.rpc('unregister_mobile_push_token',{p_token:clean})
  if(error)throw error
}

export async function removeAllNativePushTokens(target:MobileTarget){
  if(!target||!supabase)return 0
  const {data,error}=await supabase.rpc('unregister_all_mobile_push_tokens',{p_app_target:target})
  if(error)throw error
  return Number(data??0)
}
