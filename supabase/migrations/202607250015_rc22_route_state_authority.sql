-- Co Pilot Security Marketplace OS RC2.2 — Route State Authority
-- Makes route start and arrival authoritative database transitions.
begin;

create or replace function public.advance_guard_mission_rc22(p_job_id uuid,p_action text)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_now timestamptz := now();
begin
  if p_action not in ('start_route','mark_arrived') then
    raise exception 'INVALID_MISSION_ACTION' using errcode='22023';
  end if;

  select * into v_guard
  from public.guards
  where user_id=auth.uid()
  for update;

  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501';
  end if;

  select * into v_assignment
  from public.job_assignments
  where job_id=p_job_id
  for update;

  if v_assignment.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023';
  end if;

  if v_assignment.guard_id is distinct from v_guard.id then
    raise exception 'ASSIGNMENT_NOT_OWNED_BY_GUARD' using errcode='42501';
  end if;

  if p_action='start_route' then
    if v_assignment.status <> 'accepted' then
      raise exception 'MISSION_NOT_READY_FOR_ROUTE' using errcode='22023';
    end if;

    update public.job_assignments
    set status='en_route'
    where id=v_assignment.id;

    insert into public.mission_events(job_id,actor_user_id,event_type,payload)
    values(p_job_id,auth.uid(),'route_started',jsonb_build_object(
      'guard_id',v_guard.id,
      'agency_id',v_assignment.agency_id,
      'started_at',v_now
    ));

    return jsonb_build_object('success',true,'job_id',p_job_id,'status','en_route');
  end if;

  if v_assignment.status <> 'en_route' then
    raise exception 'MISSION_NOT_EN_ROUTE' using errcode='22023';
  end if;

  update public.job_assignments
  set status='active'
  where id=v_assignment.id;

  update public.marketplace_jobs
  set status='active',updated_at=v_now
  where id=p_job_id;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'guard_arrived',jsonb_build_object(
    'guard_id',v_guard.id,
    'agency_id',v_assignment.agency_id,
    'arrived_at',v_now,
    'next_state','active'
  ));

  return jsonb_build_object('success',true,'job_id',p_job_id,'status','active');
end;
$$;

revoke all on function public.advance_guard_mission_rc22(uuid,text) from public;
grant execute on function public.advance_guard_mission_rc22(uuid,text) to authenticated;

commit;
