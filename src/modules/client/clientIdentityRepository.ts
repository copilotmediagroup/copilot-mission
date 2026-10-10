import {supabase} from '../../lib/supabase'
export type VisibleClientIdentity={client_id:string;user_id:string;display_name:string;avatar_url:string|null}
export async function getVisibleClientIdentities(){if(!supabase)return[];const{data,error}=await supabase.rpc('get_visible_client_identities');if(error)throw error;return(data??[]) as VisibleClientIdentity[]}
export function clientIdentityByName(rows:VisibleClientIdentity[]){return new Map(rows.map(x=>[x.display_name.trim().toLowerCase(),x]))}
