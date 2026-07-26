import { supabase } from '../../lib/supabase'

export type ClientProperty = { id:string; client_id:string; name:string; address:string; street:string|null; city:string|null; state:string|null; postal_code:string|null; formatted_address:string|null; latitude:number|null; longitude:number|null; geocoding_provider:string|null; geocoding_place_id:string|null; photo_path:string|null; photo_url:string|null; archived_at:string|null; created_at:string; updated_at:string }
export type ClientJob = { id:string; client_id:string; property_id:string; title:string; instructions:string|null; priority:'standard'|'priority'|'emergency'; status:'open'|'accepted'|'assigned'|'active'|'completed'|'cancelled'; scheduled_for:string|null; duration_minutes:number; created_at:string; updated_at:string }

function requireSupabase() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase }

type SupabaseFailure = { message?:string; details?:string; hint?:string; code?:string }
export function workspaceErrorMessage(cause:unknown, fallback='Unable to load your client workspace.') {
  if (cause instanceof Error && cause.message) return cause.message
  if (cause && typeof cause === 'object') {
    const failure=cause as SupabaseFailure
    const parts=[failure.message,failure.details,failure.hint].filter((value):value is string=>Boolean(value && value.trim()))
    if(parts.length) return parts.join(' · ')
    if(failure.code) return `${fallback} (Supabase ${failure.code})`
  }
  return fallback
}

export async function getClientWorkspace(userId:string) {
  const db=requireSupabase()
  const {data:resolvedClientId,error:workspaceError}=await db.rpc('ensure_client_workspace')
  if(workspaceError) throw workspaceError
  if(!resolvedClientId) throw new Error('Supabase did not return a Client workspace for this account.')
  const client={id:resolvedClientId as string}
  if(!userId) throw new Error('Your session expired. Please sign in again.')
  const [{data:properties,error:propertiesError},{data:jobs,error:jobsError}]=await Promise.all([
    db.from('properties').select('id,client_id,name,address,street,city,state,postal_code,formatted_address,latitude,longitude,geocoding_provider,geocoding_place_id,photo_path,photo_url,archived_at,created_at,updated_at').eq('client_id',client.id).is('archived_at',null).order('created_at',{ascending:false}),
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
  const {data,error}=await db.rpc('create_marketplace_job_rc1',{
    p_property_id:input.propertyId,
    p_title:input.title.trim(),
    p_instructions:input.instructions.trim()||null,
    p_priority:input.priority,
    p_scheduled_for:input.scheduledFor?new Date(input.scheduledFor).toISOString():null,
    p_duration_minutes:input.durationMinutes,
  })
  if(error) throw error
  return {id:data as string}
}

export function subscribeToClientWorkspace(clientId:string,onChange:()=>void) {
  const db=requireSupabase()
  const channel=db.channel(`client-workspace-${clientId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'properties',filter:`client_id=eq.${clientId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'marketplace_jobs',filter:`client_id=eq.${clientId}`},onChange)
    .subscribe()
  return ()=>{void db.removeChannel(channel)}
}


export type PropertyUpdateInput = {
  propertyId:string
  name:string
  address:string
  street:string
  city:string
  state:string
  postalCode:string
  latitude:number
  longitude:number
  provider:string
  providerId:string
  photo?:File|null
  removePhoto?:boolean
}

function validatePhoto(photo:File) {
  if(!photo.type.startsWith('image/')) throw new Error('Property photo must be an image file.')
  if(photo.size>8*1024*1024) throw new Error('Property photo must be 8 MB or smaller.')
}

export async function updateClientProperty(input:PropertyUpdateInput) {
  const db=requireSupabase()
  const {data:{user}}=await db.auth.getUser()
  if(!user) throw new Error('Your session expired. Please sign in again.')
  const {data:existing,error:readError}=await db.from('properties').select('id,photo_path').eq('id',input.propertyId).single()
  if(readError) throw readError
  let nextPath:string|null=existing.photo_path
  let nextUrl:string|null=null
  let uploadedPath:string|null=null
  if(input.photo){
    validatePhoto(input.photo)
    const extension=(input.photo.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg'
    uploadedPath=`${user.id}/${input.propertyId}-${Date.now()}.${extension}`
    const {error:uploadError}=await db.storage.from('property-photos').upload(uploadedPath,input.photo,{upsert:false,contentType:input.photo.type||'image/jpeg'})
    if(uploadError) throw uploadError
    nextPath=uploadedPath
    nextUrl=db.storage.from('property-photos').getPublicUrl(uploadedPath).data.publicUrl
  } else if(input.removePhoto){
    nextPath=null
    nextUrl=null
  } else if(existing.photo_path){
    nextUrl=db.storage.from('property-photos').getPublicUrl(existing.photo_path).data.publicUrl
  }
  const payload={
    name:input.name.trim(),address:input.address.trim(),formatted_address:input.address.trim(),street:input.street||null,city:input.city||null,state:input.state||null,postal_code:input.postalCode||null,latitude:input.latitude,longitude:input.longitude,geocoding_provider:input.provider,geocoding_place_id:input.providerId,photo_path:nextPath,photo_url:nextUrl,updated_at:new Date().toISOString()
  }
  const {error}=await db.from('properties').update(payload).eq('id',input.propertyId)
  if(error){if(uploadedPath) await db.storage.from('property-photos').remove([uploadedPath]);throw error}
  if(existing.photo_path && existing.photo_path!==nextPath) await db.storage.from('property-photos').remove([existing.photo_path])
}

export async function archiveClientProperty(propertyId:string) {
  const db=requireSupabase()
  const {data,error}=await db.rpc('archive_client_property',{p_property_id:propertyId})
  if(error) throw error
  const result=Array.isArray(data)?data[0]:data
  if(!result?.archived) throw new Error(result?.reason==='active_mission_exists'?'This property has an active security mission. Complete or cancel it before archiving.':'Unable to archive this property.')
}

export async function deleteClientProperty(propertyId:string) {
  const db=requireSupabase()
  const {data,error}=await db.rpc('delete_client_property',{p_property_id:propertyId})
  if(error) throw error
  const result=Array.isArray(data)?data[0]:data
  if(!result?.deleted) throw new Error(result?.reason==='mission_history_exists'?'This property has mission history and cannot be permanently deleted. Archive it instead.':'Unable to delete this property.')
}
