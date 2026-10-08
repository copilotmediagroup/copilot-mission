import { supabase } from '../../lib/supabase'
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}

const BUCKET='mission-evidence'
const allowed=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif'])

type UploadInput={jobId:string;guardId?:string;checkpoint:number;file:File;developerTest?:boolean;latitude?:number|null;longitude?:number|null}
export type MissionEvidenceMedia={id:string;checkpoint_index:number;kind:string;storage_path:string;mime_type:string;file_size:number;captured_at:string;latitude:number|null;longitude:number|null}

export async function uploadMissionPhoto(input:UploadInput){
 const type=input.file.type||'image/jpeg'
 if(!allowed.has(type)) throw new Error('Use a JPG, PNG, WebP, HEIC or HEIF photo.')
 if(input.file.size<=0||input.file.size>12*1024*1024) throw new Error('Photo must be 12 MB or smaller.')
 const rpc=input.developerTest?'get_developer_guard_evidence_upload_rc1':'get_guard_evidence_upload_rc1'
 if(input.developerTest&&!input.guardId) throw new Error('Selected guard is required for Live Account Test evidence.')
 const args=input.developerTest?{p_guard_id:input.guardId,p_job_id:input.jobId,p_checkpoint:input.checkpoint,p_filename:input.file.name,p_mime_type:type,p_file_size:input.file.size}:{p_job_id:input.jobId,p_checkpoint:input.checkpoint,p_mime_type:type,p_file_size:input.file.size}
 const {data:target,error:targetError}=await db().rpc(rpc,args as any);if(targetError)throw targetError
 const path=String((target as any)?.path||'');if(!path)throw new Error('Evidence upload path was not created.')
 const {error:uploadError}=await db().storage.from(BUCKET).upload(path,input.file,{contentType:type,upsert:false});if(uploadError)throw uploadError
 const registerRpc=input.developerTest?'register_developer_guard_evidence_rc1':'register_guard_evidence_rc1'
 const registerArgs=input.developerTest?{p_guard_id:input.guardId,p_job_id:input.jobId,p_checkpoint:input.checkpoint,p_storage_path:path,p_mime_type:type,p_file_size:input.file.size,p_latitude:input.latitude??null,p_longitude:input.longitude??null}:{p_job_id:input.jobId,p_checkpoint:input.checkpoint,p_storage_path:path,p_mime_type:type,p_file_size:input.file.size,p_latitude:input.latitude??null,p_longitude:input.longitude??null}
 const {data,error}=await db().rpc(registerRpc,registerArgs as any);if(error)throw error
 return data as MissionEvidenceMedia
}
export async function getMissionEvidence(jobId:string){const{data,error}=await db().rpc('get_mission_evidence_for_report_rc1',{p_job_id:jobId});if(error)throw error;return(data??[]) as MissionEvidenceMedia[]}
export async function getMissionEvidenceUrl(path:string){const{data,error}=await db().storage.from(BUCKET).createSignedUrl(path,600);if(error)throw error;return data.signedUrl}
export type MissionEvidenceMediaWithUrl=MissionEvidenceMedia&{url:string}
export async function getMissionEvidenceWithUrls(jobId:string){const rows=await getMissionEvidence(jobId);return Promise.all(rows.map(async row=>({...row,url:await getMissionEvidenceUrl(row.storage_path)}))) as Promise<MissionEvidenceMediaWithUrl[]>}
