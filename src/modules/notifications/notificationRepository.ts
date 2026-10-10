import { supabase } from '../../lib/supabase'

export type PlatformNotification={id:string;job_id:string|null;type:string;title:string;body:string;priority:string;read_at:string|null;created_at:string}
export async function getMyNotifications(limit=30){if(!supabase)return[];const{data,error}=await supabase.from('platform_notifications').select('id,job_id,type,title,body,priority,read_at,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return(data??[]) as PlatformNotification[]}
export function subscribeToMyNotifications(onChange:()=>void){if(!supabase)return()=>undefined;const ch=supabase.channel(`my-notifications-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'platform_notifications'},onChange).subscribe();return()=>{void supabase?.removeChannel(ch)}}
