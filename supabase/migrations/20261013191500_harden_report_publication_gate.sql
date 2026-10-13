-- Report publication is a delivery gate: only completed missions can reach clients.
create or replace function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid; v_report public.mission_reports; v_job public.marketplace_jobs; v_payout_method text; v_hold_reason text;
begin
 select agency_id into v_agency from public.resolve_my_agency_workspace();
 if v_agency is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
 select * into v_report from public.mission_reports where id=p_report_id for update;
 if v_report.id is null or v_report.agency_id<>v_agency then raise exception 'REPORT_NOT_FOUND' using errcode='40400'; end if;
 select * into v_job from public.marketplace_jobs where id=v_report.job_id for update;
 if p_action='publish' then
  if v_report.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE'; end if;
  if v_job.id is null or v_job.status<>'completed' then raise exception 'MISSION_NOT_COMPLETED'; end if;
  if coalesce(v_job.required_guards,1)>1 and (select count(*) from public.job_guard_slots where job_id=v_job.id and status='completed')<v_job.required_guards then raise exception 'MISSION_STAFFING_INCOMPLETE'; end if;
  select coalesce(nullif(payout_method,''),'manual') into v_payout_method from public.agencies where id=v_agency;
  v_hold_reason:=case when v_payout_method='manual' then 'manual_payout_required' else 'payout_processing_required' end;
  update public.mission_reports set status='published',agency_review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
  update public.job_financials set payout_status='ready_for_payout',hold_reason=v_hold_reason,updated_at=now() where job_id=v_report.job_id;
  update public.marketplace_jobs set payout_status='ready_for_payout',payout_hold_reason=v_hold_reason,updated_at=now() where id=v_report.job_id;
  perform public.notify_role('platform_admin',v_report.job_id,'report_published_payout_ready','Report published','Agency report published. Payout is ready for processing.','normal');
 elsif p_action='clarification' then
  if v_report.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_REVIEWABLE'; end if;
  if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'CLARIFICATION_NOTE_REQUIRED'; end if;
  update public.mission_reports set status='clarification_requested',clarification_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
  update public.job_financials set payout_status='held_until_report',hold_reason='report_clarification_requested',updated_at=now() where job_id=v_report.job_id;
  update public.marketplace_jobs set payout_status='held_until_report',payout_hold_reason='report_clarification_requested',updated_at=now() where id=v_report.job_id;
 else raise exception 'Unsupported report action.' using errcode='22023'; end if;
 return v_report;
end $$;
revoke all on function public.review_mission_report(uuid,text,text) from public,anon;
grant execute on function public.review_mission_report(uuid,text,text) to authenticated,service_role;

create or replace function public.review_developer_mission_report_rc1(p_agency_id uuid,p_report_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare r public.mission_reports; j public.marketplace_jobs;
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into r from public.mission_reports where id=p_report_id and agency_id=p_agency_id for update;
 if r.id is null then raise exception 'REPORT_NOT_FOUND'; end if;
 select * into j from public.marketplace_jobs where id=r.job_id for update;
 if coalesce(j.pricing_snapshot->>'developer_test','false')<>'true' then raise exception 'DEVELOPER_TEST_REPORT_REQUIRED'; end if;
 if p_action='publish' then
  if r.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE'; end if;
  if j.status<>'completed' then raise exception 'MISSION_NOT_COMPLETED'; end if;
  if coalesce(j.required_guards,1)>1 and (select count(*) from public.job_guard_slots where job_id=j.id and status='completed')<j.required_guards then raise exception 'MISSION_STAFFING_INCOMPLETE'; end if;
  update public.mission_reports set status='published',agency_review_note=nullif(btrim(coalesce(p_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=r.id returning * into r;
 elsif p_action='clarification' then
  if r.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_REVIEWABLE'; end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'CLARIFICATION_NOTE_REQUIRED'; end if;
  update public.mission_reports set status='clarification_requested',clarification_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=r.id returning * into r;
 else raise exception 'UNKNOWN_REPORT_ACTION'; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.review_developer_mission_report_rc1(uuid,uuid,text,text) from public,anon;
grant execute on function public.review_developer_mission_report_rc1(uuid,uuid,text,text) to authenticated,service_role;
