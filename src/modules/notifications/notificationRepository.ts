import { supabase } from '../../lib/supabase'
export type PlatformNotification={id:string;job_id:string|null;type:string;title:string;body:string;priority:string;read_at:string|null;created_at:string}
export async function getMyNotifications(limit=30){if(!supabase)return[];const{data,error}=await supabase.from('platform_notifications').select('id,job_id,type,title,body,priority,read_at,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return(data??[]) as PlatformNotification[]}
export async function markNotificationRead(id:string){if(!supabase)return;const{error}=await supabase.rpc('mark_platform_notification_read',{p_notification_id:id});if(error)throw error}
export async function markAllNotificationsRead(){if(!supabase)return 0;const{data,error}=await supabase.rpc('mark_all_platform_notifications_read');if(error)throw error;return Number(data??0)}
export function subscribeToMyNotifications(onChange:()=>void){if(!supabase)return()=>undefined;const ch=supabase.channel(`my-notifications-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'platform_notifications'},onChange).subscribe();return()=>{void supabase?.removeChannel(ch)}}

export async function getMyNotificationUnreadCount(){if(!supabase)return 0;const{count,error}=await supabase.from('platform_notifications').select('id',{count:'exact',head:true}).is('read_at',null);if(error)throw error;return count??0}
