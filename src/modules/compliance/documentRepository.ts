import { supabase } from '../../lib/supabase'

export type DocumentStatus = 'pending'|'approved'|'rejected'|'needs_info'|'expired'
export type AgencyDocumentRecord = {
  id:string; agency_id:string; document_type:string; operating_state:string; service_category:string;
  file_path:string; file_name:string; mime_type:string|null; file_size:number|null; expires_on:string|null;
  status:DocumentStatus; submitted_note?:string|null; review_note?:string|null; reviewed_at?:string|null; created_at:string; updated_at?:string|null;
}
export type AgencyDocumentCenter = { agency:{id:string;name:string;status:string}; compliance:{status:string;missing:string[];expiring_soon:number}; documents:AgencyDocumentRecord[] }
export type OwnerDocumentRecord = AgencyDocumentRecord & { agency_name:string; agency_status:string; owner_name:string }
export type OwnerDocumentCenter = { documents:OwnerDocumentRecord[]; agencies:{agency_id:string;agency_name:string;agency_status:string;compliance:{status:string;missing:string[];expiring_soon:number}}[] }

const bucket='agency-documents'
function db(){ if(!supabase) throw new Error('Supabase is not configured.'); return supabase }
function normalizeRows<T>(data:any, key:string):T[]{ return data && Array.isArray(data[key]) ? data[key] : [] }
export async function getMyAgencyDocuments():Promise<AgencyDocumentCenter>{
  const {data,error}=await db().rpc('get_my_agency_documents')
  if(error) throw new Error(error.message)
  return { agency:data?.agency, compliance:data?.compliance ?? {status:'incomplete',missing:[],expiring_soon:0}, documents:normalizeRows<AgencyDocumentRecord>(data,'documents') }
}
export async function uploadAgencyDocument(input:{file:File;documentType:string;operatingState:string;serviceCategory:string;expiresOn?:string;note?:string}){
  const client=db(); const center=await getMyAgencyDocuments(); const agencyId=center.agency.id
  const safe=input.file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-96)
  const path=`${agencyId}/${crypto.randomUUID()}-${safe}`
  const upload=await client.storage.from(bucket).upload(path,input.file,{contentType:input.file.type || undefined,upsert:false})
  if(upload.error) throw new Error(upload.error.message)
  const {data,error}=await client.rpc('submit_agency_document',{p_document_type:input.documentType,p_operating_state:input.operatingState,p_service_category:input.serviceCategory,p_file_path:path,p_file_name:input.file.name,p_mime_type:input.file.type || null,p_file_size:input.file.size,p_expires_on:input.expiresOn || null,p_note:input.note || null})
  if(error) throw new Error(error.message)
  return data as AgencyDocumentRecord
}
export async function getOwnerDocumentReviewCenter():Promise<OwnerDocumentCenter>{
  const {data,error}=await db().rpc('get_owner_document_review_center')
  if(error) throw new Error(error.message)
  return {documents:normalizeRows<OwnerDocumentRecord>(data,'documents'),agencies:normalizeRows(data,'agencies')}
}
export async function reviewAgencyDocument(documentId:string, decision:Exclude<DocumentStatus,'pending'|'expired'>, note?:string){
  const {data,error}=await db().rpc('review_agency_document',{p_document_id:documentId,p_decision:decision,p_note:note || null})
  if(error) throw new Error(error.message)
  return data
}
export async function getAgencyDocumentSignedUrl(path:string){
  const {data,error}=await db().storage.from(bucket).createSignedUrl(path,600)
  if(error) throw new Error(error.message)
  return data.signedUrl
}
export function subscribeToDocuments(onChange:()=>void){
  if(!supabase)return()=>undefined
  const ch=supabase.channel(`agency-documents-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'agency_documents'},onChange).on('postgres_changes',{event:'INSERT',schema:'public',table:'document_reviews'},onChange).subscribe()
  return()=>{void supabase?.removeChannel(ch)}
}
