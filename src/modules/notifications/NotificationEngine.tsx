import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode } from 'react'
import { AlertTriangle,Bell,Check,CheckCheck,ChevronRight,Siren,X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getMyNotifications,markAllNotificationsRead,markNotificationDelivered,markNotificationRead,subscribeToMyNotifications,type NotificationItem } from './notificationRepository'

type ContextValue={unreadCount:number;openCenter:()=>void;refresh:()=>Promise<void>}
const NotificationContext=createContext<ContextValue>({unreadCount:0,openCenter:()=>undefined,refresh:async()=>undefined})
export const useNotifications=()=>useContext(NotificationContext)

export function NotificationEngine({children}:{children:ReactNode}){
 const auth=useAuth();const [items,setItems]=useState<NotificationItem[]>([]);const [unreadCount,setUnreadCount]=useState(0);const [centerOpen,setCenterOpen]=useState(false);const [toast,setToast]=useState<NotificationItem|null>(null);const known=useRef(new Set<string>());const booted=useRef(false)
 const live=auth.mode==='supabase'&&auth.phase==='ready'&&Boolean(auth.user?.id)
 const refresh=useCallback(async()=>{if(!live)return;const data=await getMyNotifications();setItems(data.items);setUnreadCount(data.unreadCount);const newest=data.items.find(n=>n.state==='unread'&&!known.current.has(n.recipient_id));data.items.forEach(n=>known.current.add(n.recipient_id));if(booted.current&&newest){setToast(newest);void markNotificationDelivered(newest.recipient_id)}booted.current=true},[live])
 useEffect(()=>{known.current.clear();booted.current=false;setItems([]);setUnreadCount(0);setToast(null);if(live)void refresh()},[live,auth.user?.id,refresh])
 useEffect(()=>live&&auth.user?.id?subscribeToMyNotifications(auth.user.id,()=>void refresh()):undefined,[live,auth.user?.id,refresh])
 useEffect(()=>{if(!toast)return;const t=window.setTimeout(()=>setToast(null),toast.severity==='emergency'?9000:6000);return()=>window.clearTimeout(t)},[toast])
 const act=async(item:NotificationItem)=>{if(item.state==='unread'){await markNotificationRead(item.recipient_id);await refresh()}setToast(null);setCenterOpen(false);window.dispatchEvent(new CustomEvent('copilot:notification-action',{detail:{kind:item.action_kind,target:item.action_target,jobId:item.job_id}}))}
 const readAll=async()=>{await markAllNotificationsRead();await refresh()}
 const value=useMemo(()=>({unreadCount,openCenter:()=>setCenterOpen(true),refresh}),[unreadCount,refresh])
 return <NotificationContext.Provider value={value}>{children}{live&&<>
   <button className="notification-bell" onClick={()=>setCenterOpen(v=>!v)} aria-label="Notifications"><Bell/>{unreadCount>0&&<b>{unreadCount>99?'99+':unreadCount}</b>}</button>
   {toast&&<div className={`realtime-toast severity-${toast.severity}`} role="status"><div className="toast-symbol">{toast.severity==='emergency'?<Siren/>:toast.severity==='priority'?<AlertTriangle/>:<Bell/>}</div><button className="toast-main" onClick={()=>void act(toast)}><span>{toast.severity==='emergency'?'EMERGENCY':toast.severity==='priority'?'PRIORITY':'LIVE'}</span><strong>{toast.title}</strong><small>{toast.body}</small></button><button className="toast-close" onClick={()=>setToast(null)}><X/></button></div>}
   {centerOpen&&<><button className="notification-scrim" onClick={()=>setCenterOpen(false)} aria-label="Close notifications"/><aside className="notification-center"><header><div><span>RC3.1 ENGINE</span><h2>Notifications</h2><p>Persistent operational events</p></div><button onClick={()=>setCenterOpen(false)}><X/></button></header><div className="notification-center-tools"><span>{unreadCount} unread</span>{unreadCount>0&&<button onClick={()=>void readAll()}><CheckCheck/>Mark all read</button>}</div><section>{items.length===0?<div className="notification-empty"><Check/><strong>You're caught up</strong><span>New operational events will appear here.</span></div>:items.map(item=><button key={item.recipient_id} className={`notification-row ${item.state} severity-${item.severity}`} onClick={()=>void act(item)}><i/ ><div><span>{item.category.replace('_',' ')}</span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></div><ChevronRight/></button>)}</section></aside></>}
 </>}</NotificationContext.Provider>
}
