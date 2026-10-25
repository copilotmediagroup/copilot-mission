-- RC38: Developer Live Account Test reports must never enter the real payout queue.
-- Publishing/clarification remains real report workflow, but financial state stays explicitly no-payout.
create or replace function public.review_developer_mission_report_rc1(p_agency_id uuid,p_report_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare r public.mission_reports;j public.marketplace_jobs;begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 select * into r from public.mission_reports where id=p_report_id and agency_id=p_agency_id for update;if r.id is null then raise exception 'REPORT_NOT_FOUND';end if;
 select * into j from public.marketplace_jobs where id=r.job_id for update;if coalesce(j.pricing_snapshot->>'developer_test','false')<>'true' then raise exception 'DEVELOPER_TEST_REPORT_REQUIRED';end if;
 if p_action='publish' then
  if r.status not in('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE';end if;
  if j.status<>'completed' then raise exception 'MISSION_NOT_COMPLETED';end if;
  if coalesce(j.required_guards,1)>1 and (select count(*) from public.job_guard_slots where job_id=j.id and status='completed')<j.required_guards then raise exception 'MISSION_STAFFING_INCOMPLETE';end if;
  update public.mission_reports set status='published',agency_review_note=nullif(btrim(coalesce(p_note,'')),''),clarification_note=null,reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=r.id returning * into r;
  update public.job_financials set payout_status='not_ready',hold_reason='developer_test_no_payout',updated_at=now() where job_id=r.job_id;
  update public.marketplace_jobs set payout_status='not_ready',payout_hold_reason='developer_test_no_payout',updated_at=now() where id=r.job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(r.job_id,auth.uid(),'report_published',jsonb_build_object('report_id',r.id,'version',r.version,'developer_test',true,'no_real_payout',true,'selected_agency_id',p_agency_id));
 elsif p_action='clarification' then
  if r.status not in('pending_review','clarification_requested') then raise exception 'REPORT_NOT_REVIEWABLE';end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'CLARIFICATION_NOTE_REQUIRED';end if;
  update public.mission_reports set status='clarification_requested',clarification_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=r.id returning * into r;
  update public.job_financials set payout_status='not_ready',hold_reason='developer_test_no_payout',updated_at=now() where job_id=r.job_id;
  update public.marketplace_jobs set payout_status='not_ready',payout_hold_reason='developer_test_no_payout',updated_at=now() where id=r.job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(r.job_id,auth.uid(),'report_clarification_requested',jsonb_build_object('report_id',r.id,'developer_test',true,'no_real_payout',true,'selected_agency_id',p_agency_id));
 else raise exception 'UNKNOWN_REPORT_ACTION';end if;
 return to_jsonb(r);
end $$;
revoke all on function public.review_developer_mission_report_rc1(uuid,uuid,text,text) from public,anon;
grant execute on function public.review_developer_mission_report_rc1(uuid,uuid,text,text) to authenticated,service_role;
