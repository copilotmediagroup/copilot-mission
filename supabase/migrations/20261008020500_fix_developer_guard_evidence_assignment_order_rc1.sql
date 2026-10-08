-- Developer Live Account Test evidence functions must use the real job_assignments timestamp contract.
-- job_assignments has assigned_at, not created_at. Production guard evidence already uses assigned_at.
create or replace function public.get_developer_guard_evidence_upload_rc1(p_guard_id uuid, p_job_id uuid, p_checkpoint integer, p_filename text, p_mime_type text, p_file_size bigint)
returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off'
as $function$ declare a public.job_assignments; s public.mission_engine_state; ext text; path text; token uuid:=gen_random_uuid(); begin
if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
if coalesce((select pricing_snapshot->>'developer_test' from public.marketplace_jobs where id=p_job_id),'false')<>'true' then raise exception 'DEVELOPER_TEST_JOB_REQUIRED'; end if;
select * into a from public.job_assignments where job_id=p_job_id and guard_id=p_guard_id order by assigned_at desc limit 1;
if a.id is null then raise exception 'ASSIGNMENT_NOT_OWNED_BY_SELECTED_GUARD'; end if;
select * into s from public.mission_engine_state where job_id=p_job_id;
if s.job_id is null or s.state not in('active','checkpoint') then raise exception 'MISSION_NOT_ACCEPTING_EVIDENCE'; end if;
if p_checkpoint<>s.checkpoint_index then raise exception 'CHECKPOINT_STATE_CONFLICT'; end if;
if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then raise exception 'INVALID_EVIDENCE_TYPE'; end if;
if p_file_size<=0 or p_file_size>12582912 then raise exception 'INVALID_EVIDENCE_SIZE'; end if;
ext:=case p_mime_type when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/heic' then 'heic' when 'image/heif' then 'heif' else 'jpg' end;
path:=p_job_id::text||'/'||p_guard_id::text||'/'||p_checkpoint::text||'/'||token::text||'.'||ext;
return jsonb_build_object('bucket','mission-evidence','path',path); end $function$;

create or replace function public.register_developer_guard_evidence_rc1(p_guard_id uuid, p_job_id uuid, p_checkpoint integer, p_storage_path text, p_mime_type text, p_file_size bigint, p_latitude double precision default null, p_longitude double precision default null)
returns public.mission_evidence_media language plpgsql security definer set search_path to 'public' set row_security to 'off'
as $function$ declare a public.job_assignments; s public.mission_engine_state; m public.mission_evidence_media; begin
if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
if coalesce((select pricing_snapshot->>'developer_test' from public.marketplace_jobs where id=p_job_id),'false')<>'true' then raise exception 'DEVELOPER_TEST_JOB_REQUIRED'; end if;
select * into a from public.job_assignments where job_id=p_job_id and guard_id=p_guard_id order by assigned_at desc limit 1;
if a.id is null then raise exception 'ASSIGNMENT_NOT_OWNED_BY_SELECTED_GUARD'; end if;
select * into s from public.mission_engine_state where job_id=p_job_id;
if s.job_id is null or s.state not in('active','checkpoint') then raise exception 'MISSION_NOT_ACCEPTING_EVIDENCE'; end if;
if p_checkpoint<>s.checkpoint_index or p_checkpoint<0 or p_checkpoint>5 then raise exception 'CHECKPOINT_STATE_CONFLICT'; end if;
if p_storage_path !~ ('^'||p_job_id::text||'/'||p_guard_id::text||'/'||p_checkpoint::text||'/[A-Za-z0-9._-]+$') then raise exception 'INVALID_EVIDENCE_PATH'; end if;
if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then raise exception 'INVALID_EVIDENCE_TYPE'; end if;
if p_file_size<=0 or p_file_size>12582912 then raise exception 'INVALID_EVIDENCE_SIZE'; end if;
insert into public.mission_evidence_media(job_id,guard_id,checkpoint_index,storage_path,mime_type,file_size,latitude,longitude) values(p_job_id,p_guard_id,p_checkpoint,p_storage_path,p_mime_type,p_file_size,p_latitude,p_longitude) returning * into m;
return m; end $function$;
