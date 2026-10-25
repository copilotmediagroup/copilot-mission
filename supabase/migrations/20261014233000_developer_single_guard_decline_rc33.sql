-- RC33: complete the single-guard Developer Live Account Test offer lifecycle.
-- A selected real Guard can decline a real developer-test assignment without
-- executing the action as the authenticated Platform Admin identity.
create or replace function public.decline_developer_guard_assignment_rc1(p_guard_id uuid,p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare a public.job_assignments;s public.mission_engine_state;j public.marketplace_jobs;n timestamptz:=now();begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND';end if;
 if coalesce(j.pricing_snapshot->>'developer_test','false')<>'true' then raise exception 'DEVELOPER_TEST_JOB_REQUIRED';end if;
 if greatest(1,coalesce(j.required_guards,1))<>1 then raise exception 'USE_GUARD_SLOT_DECLINE';end if;
 select * into a from public.job_assignments where job_id=p_job_id for update;
 if a.id is null or a.guard_id is distinct from p_guard_id then raise exception 'ASSIGNMENT_NOT_OWNED_BY_SELECTED_GUARD';end if;
 if a.status not in('offered','assigned') then raise exception 'ASSIGNMENT_NOT_DECLINEABLE';end if;
 update public.job_assignments set guard_id=null,status='awaiting_guard',declined_at=n,offered_at=null,response_deadline=null,locked_at=null,accepted_at=null,assignment_version=coalesce(assignment_version,0)+1 where id=a.id;
 update public.marketplace_jobs set status='accepted',updated_at=n where id=p_job_id;
 update public.guards set availability=case when coalesce(online_intent,false) then 'available' else 'offline' end where id=p_guard_id;
 s:=public.ensure_mission_engine_state(p_job_id);
 update public.mission_engine_state set guard_id=null,state='awaiting_guard',version=version+1,updated_at=n where job_id=p_job_id returning * into s;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_assignment_declined',jsonb_build_object('state',s.state,'version',s.version,'developer_test',true,'selected_guard_id',p_guard_id,'source','developer_live_account_test'));
 return jsonb_build_object('declined',true,'job_id',p_job_id,'guard_id',p_guard_id,'state',s.state,'version',s.version);
end $$;
revoke all on function public.decline_developer_guard_assignment_rc1(uuid,uuid) from public,anon;
grant execute on function public.decline_developer_guard_assignment_rc1(uuid,uuid) to authenticated,service_role;
