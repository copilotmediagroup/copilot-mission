import { supabase } from '../../lib/supabase'

export type ClientProperty = { id:string; client_id:string; name:string; address:string; street:string|null; city:string|null; state:string|null; postal_code:string|null; formatted_address:string|null; latitude:number|null; longitude:number|null; geocoding_provider:string|null; geocoding_place_id:string|null; photo_path:string|null; photo_url:string|null; created_at:string }
export type ClientJob = { id:string; client_id:string; property_id:string; title:string; instructions:string|null; priority:'standard'|'priority'|'emergency'; status:'open'|'accepted'|'assigned'|'active'|'completed'|'cancelled'; scheduled_for:string|null; duration_minutes:number; created_at:string; updated_at:string }

function requireSupabase() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase }

export async function getClientWorkspace(userId:string) {
  const db=requireSupabase()
  const {data:client,error:clientError}=await db.from('clients').select('id').eq('user_id',userId).single()
  if(clientError) throw clientError
  const [{data:properties,error:propertiesError},{data:jobs,error:jobsError}]=await Promise.all([
    db.from('properties').select('id,client_id,name,address,street,city,state,postal_code,formatted_address,latitude,longitude,geocoding_provider,geocoding_place_id,photo_path,photo_url,created_at').eq('client_id',client.id).order('created_at',{ascending:false}),
    db.from('marketplace_jobs').select('id,client_id,property_id,title,instructions,priority,status,scheduled_for,duration_minutes,created_at,updated_at').eq('client_id',client.id).order('created_at',{ascending:false})
  ])
  if(propertiesError) throw propertiesError
  if(jobsError) throw jobsError
  return {clientId:client.id as string,properties:(properties??[]) as ClientProperty[],jobs:(jobs??[]) as ClientJob[]}
}

export async function createClientProperty(input:{clientId:string;name:string;address:string;street:string;city:string;state:string;postalCode:string;latitude:number;longitude:number;provider:string;providerId:string;photo:File}) {
  const db=requireSupabase()
  const {data:{user}}=await db.auth.getUser()
  if(!user) throw new Error('Your session expired. Please sign in again.')
  const propertyId=crypto.randomUUID()
  const extension=(input.photo.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg'
  const photoPath=`${user.id}/${propertyId}.${extension}`
  const {error:uploadError}=await db.storage.from('property-photos').upload(photoPath,input.photo,{upsert:false,contentType:input.photo.type||'image/jpeg'})
  if(uploadError) throw uploadError
  const {data:publicPhoto}=db.storage.from('property-photos').getPublicUrl(photoPath)
  const payload={
    id:propertyId,
    client_id:input.clientId,
    name:input.name.trim(),
    address:input.address.trim(),
    formatted_address:input.address.trim(),
    street:input.street || null,
    city:input.city || null,
    state:input.state || null,
    postal_code:input.postalCode || null,
    latitude:input.latitude,
    longitude:input.longitude,
    geocoding_provider:input.provider,
    geocoding_place_id:input.providerId,
    photo_path:photoPath,
    photo_url:publicPhoto.publicUrl,
  }
  const {data,error}=await db.from('properties').insert(payload).select('id').single()
  if(error){ await db.storage.from('property-photos').remove([photoPath]); throw error }
  return data
}

export async function createClientJob(input:{clientId:string;propertyId:string;title:string;instructions:string;priority:'standard'|'priority'|'emergency';scheduledFor:string|null;durationMinutes:number}) {
  const db=requireSupabase()
  const payload={client_id:input.clientId,property_id:input.propertyId,title:input.title.trim(),instructions:input.instructions.trim()||null,priority:input.priority,scheduled_for:input.scheduledFor?new Date(input.scheduledFor).toISOString():null,duration_minutes:input.durationMinutes,status:'open'}
  const {data,error}=await db.from('marketplace_jobs').insert(payload).select('id').single()
  if(error) throw error
  return data
}

export function subscribeToClientWorkspace(clientId:string,onChange:()=>void) {
  const db=requireSupabase()
  const channel=db.channel(`client-workspace-${clientId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'properties',filter:`client_id=eq.${clientId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs',filter:`client_id=eq.${clientId}`},onChange)
    .subscribe()
  return ()=>{void db.removeChannel(channel)}
}
