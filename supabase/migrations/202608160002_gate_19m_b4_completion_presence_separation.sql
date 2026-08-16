-- ============================================================
-- Co Pilot Security Marketplace
-- Gate 19M-B4 — Completion / Presence Separation Engine
--
-- Mission completion and Guard availability are separate.
-- ============================================================

begin;

create or replace function public.set_guard_presence_rc13(
  p_online boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_previous text;
  v_next text;
  v_has_active_assignment boolean := false;
  v_has_completed_mission boolean := false;
begin

  select *
  into v_guard
  from public.guards
  where user_id=auth.uid()
  for update;

  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND'
      using errcode='42501';
  end if;

  v_previous := v_guard.availability;

  select exists (
    select 1
    from public.job_assignments ja
    where ja.guard_id=v_guard.id
      and ja.status in ('offered','accepted','en_route','arrived','active')
  )
  into v_has_active_assignment;

  select exists (
    select 1
    from public.job_assignments ja
    join public.mission_engine_state me
      on me.job_id=ja.job_id
     and me.guard_id=v_guard.id
    where ja.guard_id=v_guard.id
      and ja.status='completed'
      and me.state='completed'
      and me.completed_at is not null
  )
  into v_has_completed_mission;

  if p_online then

    if v_previous='offline' then
      v_next := 'available';

    elsif v_previous='on_mission'
      and v_has_completed_mission
      and not v_has_active_assignment
    then
      v_next := 'available';

    else
      v_next := v_previous;
    end if;

  else

    if v_previous='available' then
      v_next := 'offline';

    elsif v_previous='offline' then
      v_next := 'offline';

    else
      raise exception
        'GUARD_CANNOT_GO_OFFLINE_WHILE_%',
        upper(v_previous)
        using errcode='22023';
    end if;

  end if;

  if v_next is distinct from v_previous then

    update public.guards
    set availability=v_next
    where id=v_guard.id;

    insert into public.guard_presence_events(
      guard_id,
      agency_id,
      actor_user_id,
      previous_availability,
      next_availability
    )
    values(
      v_guard.id,
      v_guard.agency_id,
      auth.uid(),
      v_previous,
      v_next
    );

  end if;

  return jsonb_build_object(
    'success',true,
    'guard_id',v_guard.id,
    'agency_id',v_guard.agency_id,
    'availability',v_next,
    'online',v_next<>'offline',
    'changed',v_next is distinct from v_previous
  );

end;
$$;

revoke all on function public.set_guard_presence_rc13(boolean) from public;
grant execute on function public.set_guard_presence_rc13(boolean) to authenticated;


create or replace function public.get_guard_dispatch_workspace_rc2()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_events jsonb;
begin

  select *
  into v_guard
  from public.guards
  where user_id=auth.uid();

  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND'
      using errcode='42501';
  end if;

  select *
  into v_assignment
  from public.job_assignments
  where guard_id=v_guard.id
    and (
      status in ('offered','accepted','en_route','arrived','active')
      or (
        v_guard.availability='on_mission'
        and status='completed'
      )
    )
  order by assigned_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',me.id,
        'job_id',me.job_id,
        'event_type',me.event_type,
        'payload',me.payload,
        'created_at',me.created_at
      )
      order by me.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.mission_events me
  where v_assignment.job_id is not null
    and me.job_id=v_assignment.job_id;

  return jsonb_build_object(
    'guard',
    jsonb_build_object(
      'id',v_guard.id,
      'user_id',v_guard.user_id,
      'name',
        coalesce(
          (select full_name
           from public.profiles
           where id=v_guard.user_id),
          'Guard'
        ),
      'badge_number',v_guard.badge_number,
      'availability',v_guard.availability
    ),
    'assignment',
      case
        when v_assignment.id is null then null
        else public.dispatch_mission_json_rc2(v_assignment.job_id)
      end,
    'events',v_events
  );

end;
$$;

revoke all on function public.get_guard_dispatch_workspace_rc2() from public;
grant execute on function public.get_guard_dispatch_workspace_rc2() to authenticated;

create or replace function public.transition_guard_mission(
  p_job_id uuid,
  p_action text,
  p_expected_version bigint default null,
  p_checkpoint integer default null,
  p_evidence jsonb default null,
  p_incidents jsonb default null
)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_state public.mission_engine_state;
  v_now timestamptz := now();
  v_next_state text;
  v_event text;
  v_drafts integer := 0;
  v_record jsonb;
  v_photo_count integer := 0;
begin
  select * into v_guard from public.guards where user_id=auth.uid() for update;
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
  select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
  if v_assignment.guard_id is distinct from v_guard.id then raise exception 'ASSIGNMENT_NOT_OWNED_BY_GUARD' using errcode='42501'; end if;

  v_state := public.ensure_mission_engine_state(p_job_id);
  select * into v_state from public.mission_engine_state where job_id=p_job_id for update;
  if p_expected_version is not null and v_state.version<>p_expected_version then
    raise exception 'MISSION_STATE_CONFLICT' using errcode='40001';
  end if;

  if p_action='accept' then
    if v_state.state<>'offered' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
    v_next_state:='accepted'; v_event:='dispatch_timeline_started';
    update public.job_assignments set status='accepted',accepted_at=v_now,locked_at=v_now,response_deadline=null where id=v_assignment.id;
    update public.marketplace_jobs set status='active',updated_at=v_now where id=p_job_id;
    update public.guards set availability='on_mission' where id=v_guard.id;
    update public.mission_engine_state set state=v_next_state,mission_started_at=coalesce(mission_started_at,v_now),version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='decline' then
    if v_state.state<>'offered' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
    v_next_state:='awaiting_guard'; v_event:='guard_assignment_declined';
    update public.job_assignments set guard_id=null,status='awaiting_guard',declined_at=v_now,offered_at=null,response_deadline=null,assignment_version=assignment_version+1 where id=v_assignment.id;
    update public.marketplace_jobs set status='accepted',updated_at=v_now where id=p_job_id;
    update public.guards set availability='available' where id=v_guard.id;
    update public.mission_engine_state set guard_id=null,state=v_next_state,version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='start_route' then
    if v_state.state<>'accepted' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
    v_next_state:='en_route'; v_event:='route_started';
    update public.job_assignments set status='en_route' where id=v_assignment.id;
    update public.mission_engine_state set state=v_next_state,route_started_at=v_now,version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='mark_arrived' then
    if v_state.state<>'en_route' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
    v_next_state:='active'; v_event:='guard_arrived';
    update public.job_assignments set status='active' where id=v_assignment.id;
    update public.marketplace_jobs set status='active',updated_at=v_now where id=p_job_id;
    update public.mission_engine_state set state=v_next_state,arrived_at=v_now,checkpoint_index=0,version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='save_payload' then
    if v_state.state not in ('active','checkpoint','review') then raise exception 'MISSION_NOT_ACCEPTING_EXECUTION_UPDATES' using errcode='22023'; end if;
    if p_evidence is not null and jsonb_typeof(p_evidence)<>'array' then raise exception 'INVALID_EVIDENCE_PAYLOAD' using errcode='22023'; end if;
    if p_incidents is not null and jsonb_typeof(p_incidents)<>'array' then raise exception 'INVALID_INCIDENT_PAYLOAD' using errcode='22023'; end if;
    v_next_state:=v_state.state; v_event:='mission_execution_payload_saved';
    update public.mission_engine_state set evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='complete_checkpoint' then
    if v_state.state not in ('active','checkpoint') then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
    if p_checkpoint is null or p_checkpoint<>v_state.checkpoint_index or p_checkpoint<0 or p_checkpoint>5 then raise exception 'CHECKPOINT_STATE_CONFLICT' using errcode='40001'; end if;
    if p_evidence is not null then v_state.evidence:=p_evidence; end if;
    if p_incidents is not null then v_state.incidents:=p_incidents; end if;
    select item into v_record from jsonb_array_elements(coalesce(v_state.evidence,'[]'::jsonb)) item where (item->>'checkpoint')::integer=p_checkpoint limit 1;
    v_photo_count:=coalesce((v_record->>'photos')::integer,0);
    if p_checkpoint in (2,4) and v_photo_count<1 then raise exception 'REQUIRED_PHOTO_MISSING' using errcode='22023'; end if;
    select count(*) into v_drafts from jsonb_array_elements(coalesce(v_state.incidents,'[]'::jsonb)) item where coalesce((item->>'checkpoint')::integer,-1)=p_checkpoint and item->>'status'='draft';
    if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;
    v_next_state:=case when p_checkpoint=5 then 'review' else 'checkpoint' end;
    v_event:='checkpoint_completed';
    update public.mission_engine_state set state=v_next_state,checkpoint_index=p_checkpoint+1,evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;

  elsif p_action='submit' then
    if v_state.state<>'review' or v_state.checkpoint_index<>6 then raise exception 'MISSION_NOT_READY_FOR_SUBMISSION' using errcode='22023'; end if;
    if p_evidence is not null then v_state.evidence:=p_evidence; end if;
    if p_incidents is not null then v_state.incidents:=p_incidents; end if;
    select count(*) into v_drafts from jsonb_array_elements(coalesce(v_state.incidents,'[]'::jsonb)) item where item->>'status'='draft';
    if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;
    v_next_state:='completed'; v_event:='mission_completed';
    update public.mission_engine_state set state='completed',evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),completed_at=v_now,version=version+1,updated_at=v_now where job_id=p_job_id returning * into v_state;
    update public.job_assignments set status='completed' where id=v_assignment.id;
    update public.marketplace_jobs set status='completed',updated_at=v_now where id=p_job_id;
    -- Gate 19M-B4:
    -- completion does not release Guard availability.
    -- Guard remains on_mission until explicit RETURN ONLINE.

  else
    raise exception 'UNKNOWN_MISSION_ACTION' using errcode='22023';
  end if;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),v_event,jsonb_build_object(
    'from_state',case when p_action='save_payload' then v_next_state else null end,
    'state',v_state.state,'checkpoint_index',v_state.checkpoint_index,'version',v_state.version,
    'returned_to_marketplace',case when p_action='decline' then false else null end
  ));

  return to_jsonb(v_state);
end;$$;

revoke all on function public.transition_guard_mission(
  uuid,text,bigint,integer,jsonb,jsonb
) from public;

grant execute on function public.transition_guard_mission(
  uuid,text,bigint,integer,jsonb,jsonb
) to authenticated;

commit;
