-- Payout readiness is processor-neutral. Client collection uses Maverick/NMI;
-- agency disbursement remains an explicit payout operation until a payout rail is connected.
alter table public.agencies add column if not exists payout_provider text not null default 'manual';
update public.agencies set payout_provider=case when payout_method is null or payout_method='' then 'manual' else payout_method end where payout_provider='manual';

create or replace function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid; v_report public.mission_reports; v_payout_method text; v_hold_reason text;
begin
 select agency_id into v_agency from public.resolve_my_agency_workspace();
 if v_agency is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
 select * into v_report from public.mission_reports where id=p_report_id for update;
 if v_report.id is null or v_report.agency_id<>v_agency then raise exception 'REPORT_NOT_FOUND' using errcode='40400'; end if;
 if p_action='publish' then
  select coalesce(nullif(payout_method,''),'manual') into v_payout_method from public.agencies where id=v_agency;
  v_hold_reason:=case when v_payout_method='manual' then 'manual_payout_required' else 'payout_processing_required' end;
  update public.mission_reports set status='published',agency_review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
  update public.job_financials set payout_status='ready_for_payout',hold_reason=v_hold_reason,updated_at=now() where job_id=v_report.job_id;
  update public.marketplace_jobs set payout_status='ready_for_payout',payout_hold_reason=v_hold_reason,updated_at=now() where id=v_report.job_id;
  perform public.notify_role('platform_admin',v_report.job_id,'report_published_payout_ready','Report published','Agency report published. Payout is ready for processing.', 'normal');
 elsif p_action='clarification' then
  update public.mission_reports set status='clarification_requested',clarification_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
  update public.job_financials set payout_status='held_until_report',hold_reason='report_clarification_requested',updated_at=now() where job_id=v_report.job_id;
  update public.marketplace_jobs set payout_status='held_until_report',payout_hold_reason='report_clarification_requested',updated_at=now() where id=v_report.job_id;
 else raise exception 'Unsupported report action.' using errcode='22023'; end if;
 return v_report;
end $$;
revoke all on function public.review_mission_report(uuid,text,text) from public,anon;
grant execute on function public.review_mission_report(uuid,text,text) to authenticated,service_role;
