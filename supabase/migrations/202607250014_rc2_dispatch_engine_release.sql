-- Co Pilot Security Marketplace OS RC2 — Dispatch Engine final release authority
-- Requires the verified Guard Presence Engine (202607250013).
begin;

create index if not exists job_assignments_agency_status_idx
  on public.job_assignments(agency_id,status,assigned_at desc);
create index if not exists mission_events_job_created_idx
  on public.mission_events(job_id,created_at desc);

-- Agency may offer a claimed mission only while it is explicitly awaiting a Guard.
-- An outstanding offer cannot be silently moved to another Guard.
create or replace function public.assign_guard_rc2(p_job_id uuid,p_guard_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_agency_id uuid;
  v_agency_status public.agency_status;
  v_job public.marketplace_jobs;
  v_guard public.guards;
  v_assignment public.job_assignments;
begin
  select agency_id,agency_status into v_agency_id,v_agency_status
  from public.resolve_my_agency_workspace();

  if v_agency_id is null or v_agency_status<>'approved' then
    raise exception 'AGENCY_NOT_APPROVED' using errcode='42501';
  end if;

  select * into v_job from public.marketplace_jobs where id=p_job_id for update;
  if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='22023'; end if;
  if v_job.accepted_agency_id is distinct from v_agency_id then
    raise exception 'MISSION_NOT_OWNED_BY_AGENCY' using errcode='42501';
  end if;
  if v_job.status<>'accepted' then
    raise exception 'MISSION_NOT_AWAITING_GUARD' using errcode='22023';
  end if;

  select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
  if v_assignment.id is null or v_assignment.agency_id is distinct from v_agency_id then
    raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023';
  end if;
  if v_assignment.status<>'awaiting_guard' or v_assignment.guard_id is not null then
    raise exception 'ASSIGNMENT_ALREADY_OFFERED_OR_LOCKED' using errcode='22023';
  end if;

  select * into v_guard from public.guards
  where id=p_guard_id and agency_id=v_agency_id for update;
  if v_guard.id is null then raise exception 'GUARD_NOT_IN_AGENCY' using errcode='42501'; end if;
  if v_guard.availability<>'available' then
    raise exception 'GUARD_NOT_AVAILABLE' using errcode='22023';
  end if;

  update public.job_assignments
  set guard_id=p_guard_id,
      status='offered',
      assigned_at=now(),
      offered_at=now(),
      accepted_at=null,
      declined_at=null,
      locked_at=null,
      response_deadline=now()+interval '15 minutes',
      assignment_version=assignment_version+1
  where id=v_assignment.id;

  update public.guards set availability='reserved' where id=p_guard_id;
  update public.marketplace_jobs set status='assigned',updated_at=now() where id=p_job_id;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'guard_assignment_offered',jsonb_build_object(
    'agency_id',v_agency_id,
    'guard_id',p_guard_id,
    'response_deadline',now()+interval '15 minutes',
    'assignment_version',v_assignment.assignment_version+1
  ));

  return jsonb_build_object('success',true,'job_id',p_job_id,'guard_id',p_guard_id,'status','offered');
end;$$;

-- Guard response is legal exactly once and only for the authenticated Guard.
create or replace function public.respond_to_assignment_rc2(p_job_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_now timestamptz := now();
begin
  if p_response not in ('accept','decline') then
    raise exception 'INVALID_RESPONSE' using errcode='22023';
  end if;

  select * into v_guard from public.guards where user_id=auth.uid() for update;
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;

  select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
  if v_assignment.guard_id is distinct from v_guard.id or v_assignment.status<>'offered' then
    raise exception 'ASSIGNMENT_NOT_OFFERED_TO_GUARD' using errcode='42501';
  end if;

  if p_response='accept' then
    update public.job_assignments
    set status='accepted',accepted_at=v_now,locked_at=v_now,response_deadline=null
    where id=v_assignment.id;
    update public.guards set availability='on_mission' where id=v_guard.id;
    update public.marketplace_jobs set status='active',updated_at=v_now where id=p_job_id;
    insert into public.mission_events(job_id,actor_user_id,event_type,payload)
    values(p_job_id,auth.uid(),'dispatch_timeline_started',jsonb_build_object(
      'guard_id',v_guard.id,
      'agency_id',v_assignment.agency_id,
      'mission_locked',true,
      'timeline_started_at',v_now,
      'assignment_version',v_assignment.assignment_version
    ));
    return jsonb_build_object('success',true,'job_id',p_job_id,'status','accepted','locked_at',v_now);
  end if;

  update public.job_assignments
  set guard_id=null,
      status='awaiting_guard',
      declined_at=v_now,
      offered_at=null,
      response_deadline=null,
      assignment_version=assignment_version+1
  where id=v_assignment.id;
  update public.guards set availability='available' where id=v_guard.id;
  update public.marketplace_jobs set status='accepted',updated_at=v_now where id=p_job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'guard_assignment_declined',jsonb_build_object(
    'guard_id',v_guard.id,
    'agency_id',v_assignment.agency_id,
    'returned_to_marketplace',false,
    'next_state','awaiting_guard',
    'assignment_version',v_assignment.assignment_version+1
  ));
  return jsonb_build_object('success',true,'job_id',p_job_id,'status','awaiting_guard');
end;$$;

revoke all on function public.assign_guard_rc2(uuid,uuid) from public;
revoke all on function public.respond_to_assignment_rc2(uuid,text) from public;
grant execute on function public.assign_guard_rc2(uuid,uuid) to authenticated;
grant execute on function public.respond_to_assignment_rc2(uuid,text) to authenticated;

commit;
