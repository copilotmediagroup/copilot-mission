-- Guard-owned report publication: completed mission reports go directly from the assigned guard to the client.
-- Agency report access remains intact, but agency publication is no longer the delivery gate.

create or replace function public.publish_my_mission_report(p_job_id uuid)
returns public.mission_reports
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_report public.mission_reports;
  v_job public.marketplace_jobs;
  v_payout_method text;
  v_hold_reason text;
begin
  select * into v_guard from public.guards where user_id=auth.uid() limit 1;
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;

  select * into v_job from public.marketplace_jobs where id=p_job_id for update;
  if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='P0002'; end if;

  if not (
    exists(select 1 from public.job_assignments a where a.job_id=p_job_id and a.guard_id=v_guard.id)
    or exists(select 1 from public.job_guard_slots s where s.job_id=p_job_id and s.guard_id=v_guard.id)
  ) then
    raise exception 'MISSION_NOT_ASSIGNED_TO_GUARD' using errcode='42501';
  end if;

  select * into v_report from public.mission_reports where job_id=p_job_id for update;
  if v_report.id is null then raise exception 'REPORT_NOT_READY' using errcode='55000'; end if;
  if v_report.status='published' then return v_report; end if;
  if v_report.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE'; end if;
  if v_job.status<>'completed' then raise exception 'MISSION_NOT_COMPLETED'; end if;
  if coalesce(v_job.required_guards,1)>1 and
     (select count(*) from public.job_guard_slots where job_id=v_job.id and status='completed')<v_job.required_guards then
    raise exception 'MISSION_STAFFING_INCOMPLETE';
  end if;
  if coalesce(v_job.pricing_snapshot->>'developer_test','false')<>'true' and v_job.payment_status<>'captured' then
    raise exception 'PAYMENT_CAPTURE_REQUIRED';
  end if;

  select coalesce(nullif(payout_method,''),'manual') into v_payout_method
  from public.agencies where id=v_report.agency_id;
  v_hold_reason:=case when v_payout_method='manual' then 'manual_payout_required' else 'payout_processing_required' end;

  update public.mission_reports
  set status='published',
      agency_review_note=null,
      clarification_note=null,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      published_at=now(),
      version=version+1,
      updated_at=now()
  where id=v_report.id
  returning * into v_report;

  update public.job_financials
  set payout_status='ready_for_payout',hold_reason=v_hold_reason,updated_at=now()
  where job_id=p_job_id;
  update public.marketplace_jobs
  set payout_status='ready_for_payout',payout_hold_reason=v_hold_reason,updated_at=now()
  where id=p_job_id;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'report_published_to_client',jsonb_build_object('report_id',v_report.id,'publisher','guard'));

  perform public.notify_role('platform_admin',p_job_id,'report_published_payout_ready','Report published','Guard published the completed mission report to the client. Payout is ready for processing.','normal');
  return v_report;
end $$;

revoke all on function public.publish_my_mission_report(uuid) from public,anon;
grant execute on function public.publish_my_mission_report(uuid) to authenticated,service_role;

create or replace function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns public.mission_reports
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare v_agency uuid; v_report public.mission_reports; v_job public.marketplace_jobs;
begin
 select agency_id into v_agency from public.resolve_my_agency_workspace();
 if v_agency is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
 select * into v_report from public.mission_reports where id=p_report_id for update;
 if v_report.id is null or v_report.agency_id<>v_agency then raise exception 'REPORT_NOT_FOUND' using errcode='P0002'; end if;
 select * into v_job from public.marketplace_jobs where id=v_report.job_id for update;
 if p_action='publish' then
  raise exception 'GUARD_PUBLISH_REQUIRED' using errcode='42501';
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
