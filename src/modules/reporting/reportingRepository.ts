import { supabase } from '../../lib/supabase'
function db(){if(!supabase)throw new Error('Supabase is not configured.');return supabase}
export type ReportStatus='pending_review'|'clarification_requested'|'published'|'archived'
export type MissionReportRecord={id:string;job_id:string;agency_id:string;client_id:string;guard_id:string|null;status:ReportStatus;version:number;snapshot:any;agency_review_note:string|null;clarification_note:string|null;reviewed_at:string|null;published_at:string|null;created_at:string;updated_at:string}
export async function getAgencyReports(){const{data,error}=await db().rpc('get_agency_reports');if(error)throw new Error(error.message);return(data??[]) as MissionReportRecord[]}
export async function reviewMissionReport(id:string,action:'publish'|'clarification',note:string){const{data,error}=await db().rpc('review_mission_report',{p_report_id:id,p_action:action,p_note:note||null});if(error)throw new Error(error.message);return data as MissionReportRecord}
export async function getClientReports(){const{data,error}=await db().rpc('get_client_reports');if(error)throw new Error(error.message);return(data??[]) as MissionReportRecord[]}
export function subscribeToReports(onChange:()=>void){const channel=db().channel(`reports-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'mission_reports'},onChange).subscribe();return()=>{void db().removeChannel(channel)}}
