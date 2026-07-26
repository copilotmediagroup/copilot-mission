import { supabase } from '../../lib/supabase'
export type GuardRosterRow={id:string;user_id:string;name:string;phone:string|null;email:string;badge_number:string|null;availability:'offline'|'available'|'reserved'|'on_mission';created_at:string}
export type GuardInvitationRow={id:string;email:string;full_name:string;phone:string|null;badge_number:string|null;status:'pending'|'activated'|'revoked'|'expired';expires_at:string;created_at:string}
export type GuardRoster={guards:GuardRosterRow[];invitations:GuardInvitationRow[]}
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export async function getGuardRoster():Promise<GuardRoster>{const{data,error}=await db().rpc('get_guard_roster');if(error)throw new Error(error.message);const p=(data??{}) as Partial<GuardRoster>;return{guards:Array.isArray(p.guards)?p.guards:[],invitations:Array.isArray(p.invitations)?p.invitations:[]}}
export async function createGuardInvitation(input:{fullName:string;email:string;phone?:string;badgeNumber?:string}){const{data,error}=await db().rpc('create_guard_invitation',{p_full_name:input.fullName,p_email:input.email,p_phone:input.phone??null,p_badge_number:input.badgeNumber??null});if(error)throw new Error(error.message);return data as {id:string;email:string;full_name:string;expires_at:string;token:string}}
export async function revokeGuardInvitation(id:string){const{error}=await db().rpc('revoke_guard_invitation',{p_invitation_id:id});if(error)throw new Error(error.message)}
export function guardActivationUrl(token:string,email:string){const url=new URL(window.location.origin);url.searchParams.set('guard-invite',token);url.searchParams.set('email',email);return url.toString()}
