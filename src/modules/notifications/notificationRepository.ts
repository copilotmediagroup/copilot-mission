import { supabase } from '../../lib/supabase'

export type NotificationSeverity='standard'|'priority'|'emergency'|'success'|'warning'
export type NotificationItem={recipient_id:string;state:'unread'|'read';delivered_at:string|null;read_at:string|null;id:string;category:string;severity:NotificationSeverity;title:string;body:string;action_kind:string|null;action_target:string|null;job_id:string|null;payload:Record<string,unknown>;created_at:string}
export type NotificationWorkspace={unreadCount:number;items:NotificationItem[]}

function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getMyNotifications(limit=40):Promise<NotificationWorkspace>{
  const {data,error}=await db().rpc('get_my_notifications_rc31',{p_limit:limit})
  if(error)throw new Error(error.message)
  const value=(data??{}) as {unread_count?:number;items?:NotificationItem[]}
  return {unreadCount:Number(value.unread_count??0),items:Array.isArray(value.items)?value.items:[]}
}
export async function markNotificationDelivered(id:string){const {error}=await db().rpc('mark_notification_delivered_rc31',{p_recipient_id:id});if(error)throw new Error(error.message)}
export async function markNotificationRead(id:string){const {error}=await db().rpc('mark_notification_read_rc31',{p_recipient_id:id});if(error)throw new Error(error.message)}
export async function markAllNotificationsRead(){const {error}=await db().rpc('mark_all_notifications_read_rc31');if(error)throw new Error(error.message)}
export function subscribeToMyNotifications(userId:string,onChange:()=>void){
  if(!supabase)return()=>undefined
  const database=supabase
  const channel=database.channel(`notifications-${userId}-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'notification_recipients',filter:`user_id=eq.${userId}`},onChange).subscribe()
  return()=>{void database.removeChannel(channel)}
}
