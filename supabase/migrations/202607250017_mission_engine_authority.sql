-- Co Pilot Security Marketplace OS — Mission Engine Authority
-- One lifecycle owner for dispatch, route, patrol, review, completion, recovery, and timeline.
begin;

create table if not exists public.mission_engine_state (
  job_id uuid primary key references public.marketplace_jobs(id) on delete cascade,
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid references public.guards(id) on delete set null,
  state text not null check (state in (
    'awaiting_guard','offered','accepted','en_route','active','checkpoint','review','completed','cancelled'
  )),
  checkpoint_index integer not null default 0 check (checkpoint_index between 0 and 6),
  evidence jsonb not null default '[]'::jsonb,
  incidents jsonb not null default '[]'::jsonb,
  mission_started_at timestamptz,
  route_started_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists mission_engine_guard_state_idx on public.mission_engine_state(guard_id,state,updated_at desc);
create index if not exists mission_engine_agency_state_idx on public.mission_engine_state(agency_id,state,updated_at desc);

alter table public.mission_engine_state enable row level security;
revoke all on public.mission_engine_state from anon, authenticated;

-- Backfill and repair from existing authoritative records.
insert into public.mission_engine_state(
  job_id,assignment_id,agency_id,guard_id,state,checkpoint_index,evidence,incidents,
  mission_started_at,completed_at,updated_at
)
select
  a.job_id,a.id,a.agency_id,a.guard_id,
  case
    when coalesce(e.phase,'')='completed' or a.status='completed' then 'completed'
    when coalesce(e.phase,'')='proof' then 'review'
    when coalesce(e.phase,'')='patrol' and coalesce(e.checkpoint_index,0)>0 then 'checkpoint'
    when a.status='active' then 'active'
    when a.status='en_route' then 'en_route'
    when a.status='accepted' then 'accepted'
    when a.status='offered' then 'offered'
    when a.status='cancelled' then 'cancelled'
    else 'awaiting_guard'
  end,
  coalesce(e.checkpoint_index,0),coalesce(e.evidence,'[]'::jsonb),coalesce(e.incidents,'[]'::jsonb),
  coalesce(e.started_at,a.accepted_at),e.completed_at,coalesce(e.updated_at,a.assigned_at,now())
from public.job_assignments a
left join public.mission_execution_state e on e.job_id=a.job_id
on conflict(job_id) do update set
  assignment_id=excluded.assignment_id,
  agency_id=excluded.agency_id,
  guard_id=excluded.guard_id,
  state=excluded.state,
  checkpoint_index=excluded.checkpoint_index,
  evidence=excluded.evidence,
  incidents=excluded.incidents,
  mission_started_at=excluded.mission_started_at,
  completed_at=excluded.completed_at,
  updated_at=now(),
  version=public.mission_engine_state.version+1;


create or replace function public.sync_assignment_to_mission_engine()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_engine_state text;
begin
  v_engine_state := case
    when new.status='offered' then 'offered'
    when new.status='accepted' then 'accepted'
    when new.status='en_route' then 'en_route'
    when new.status='active' then 'active'
    when new.status='completed' then 'completed'
    when new.status='cancelled' then 'cancelled'
    else 'awaiting_guard'
  end;

  insert into public.mission_engine_state(job_id,assignment_id,agency_id,guard_id,state,mission_started_at,completed_at,updated_at)
  values(new.job_id,new.id,new.agency_id,new.guard_id,v_engine_state,new.accepted_at,case when new.status='completed' then now() else null end,now())
  on conflict(job_id) do update set
    assignment_id=excluded.assignment_id,
    agency_id=excluded.agency_id,
    guard_id=excluded.guard_id,
    state=case
      when excluded.state='active' and public.mission_engine_state.state in ('checkpoint','review') then public.mission_engine_state.state
      else excluded.state
    end,
    mission_started_at=coalesce(public.mission_engine_state.mission_started_at,excluded.mission_started_at),
    completed_at=case when excluded.state='completed' then coalesce(public.mission_engine_state.completed_at,now()) else public.mission_engine_state.completed_at end,
    version=public.mission_engine_state.version+1,
    updated_at=now();
  return new;
end;$$;

drop trigger if exists job_assignments_mission_engine_sync on public.job_assignments;
create trigger job_assignments_mission_engine_sync
after insert or update of status,guard_id,accepted_at on public.job_assignments
for each row execute function public.sync_assignment_to_mission_engine();

create or replace function public.ensure_mission_engine_state(p_job_id uuid)
returns public.mission_engine_state
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_assignment public.job_assignments;
  v_execution public.mission_execution_state;
  v_state public.mission_engine_state;
begin
  select * into v_assignment from public.job_assignments where job_id=p_job_id;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
  select * into v_execution from public.mission_execution_state where job_id=p_job_id;

  insert into public.mission_engine_state(
    job_id,assignment_id,agency_id,guard_id,state,checkpoint_index,evidence,incidents,mission_started_at,completed_at
  ) values (
    p_job_id,v_assignment.id,v_assignment.agency_id,v_assignment.guard_id,
    case
      when coalesce(v_execution.phase,'')='completed' or v_assignment.status='completed' then 'completed'
      when coalesce(v_execution.phase,'')='proof' then 'review'
      when coalesce(v_execution.phase,'')='patrol' and coalesce(v_execution.checkpoint_index,0)>0 then 'checkpoint'
      when v_assignment.status='active' then 'active'
      when v_assignment.status='en_route' then 'en_route'
      when v_assignment.status='accepted' then 'accepted'
      when v_assignment.status='offered' then 'offered'
      when v_assignment.status='cancelled' then 'cancelled'
      else 'awaiting_guard'
    end,
    coalesce(v_execution.checkpoint_index,0),coalesce(v_execution.evidence,'[]'::jsonb),
    coalesce(v_execution.incidents,'[]'::jsonb),coalesce(v_execution.started_at,v_assignment.accepted_at),v_execution.completed_at
  ) on conflict(job_id) do nothing;

  select * into v_state from public.mission_engine_state where job_id=p_job_id;
  return v_state;
end;$$;

create or replace function public.get_guard_mission_snapshot(p_job_id uuid default null)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_state public.mission_engine_state;
  v_job public.marketplace_jobs;
begin
  select * into v_guard from public.guards where user_id=auth.uid();
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;

  if p_job_id is null then
    select * into v_assignment from public.job_assignments
    where guard_id=v_guard.id and status in ('offered','accepted','en_route','arrived','active')
    order by assigned_at desc limit 1;
  else
    select * into v_assignment from public.job_assignments where job_id=p_job_id and guard_id=v_guard.id;
  end if;

  if v_assignment.id is null then
    return jsonb_build_object('guard',to_jsonb(v_guard),'mission',null);
  end if;

  v_state := public.ensure_mission_engine_state(v_assignment.job_id);
  select * into v_job from public.marketplace_jobs where id=v_assignment.job_id;

  return jsonb_build_object(
    'guard',to_jsonb(v_guard),
    'mission',jsonb_build_object(
      'job_id',v_state.job_id,'assignment_id',v_state.assignment_id,'agency_id',v_state.agency_id,
      'guard_id',v_state.guard_id,'state',v_state.state,'checkpoint_index',v_state.checkpoint_index,
      'evidence',v_state.evidence,'incidents',v_state.incidents,'mission_started_at',v_state.mission_started_at,
      'route_started_at',v_state.route_started_at,'arrived_at',v_state.arrived_at,
      'completed_at',v_state.completed_at,'version',v_state.version,'updated_at',v_state.updated_at,
      'assignment',to_jsonb(v_assignment),'job',to_jsonb(v_job)
    )
  );
end;$$;

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
    update public.guards set availability='available' where id=v_guard.id;

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

-- Existing public APIs now delegate to the single Mission Engine.
create or replace function public.respond_to_assignment_rc2(p_job_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if p_response='accept' then return public.transition_guard_mission(p_job_id,'accept'); end if;
  if p_response='decline' then return public.transition_guard_mission(p_job_id,'decline'); end if;
  raise exception 'INVALID_RESPONSE' using errcode='22023';
end;$$;

create or replace function public.advance_guard_mission_rc22(p_job_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if p_action='start_route' then return public.transition_guard_mission(p_job_id,'start_route'); end if;
  if p_action='mark_arrived' then return public.transition_guard_mission(p_job_id,'mark_arrived'); end if;
  raise exception 'INVALID_MISSION_ACTION' using errcode='22023';
end;$$;

create or replace function public.get_guard_execution_state_rc23(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_state public.mission_engine_state;
begin
  v_state:=public.ensure_mission_engine_state(p_job_id);
  return jsonb_build_object(
    'job_id',v_state.job_id,'assignment_id',v_state.assignment_id,'agency_id',v_state.agency_id,'guard_id',v_state.guard_id,
    'phase',case when v_state.state='completed' then 'completed' when v_state.state='review' then 'proof' else 'patrol' end,
    'checkpoint_index',v_state.checkpoint_index,'evidence',v_state.evidence,'incidents',v_state.incidents,
    'started_at',v_state.mission_started_at,'completed_at',v_state.completed_at,'updated_at',v_state.updated_at
  );
end;$$;

create or replace function public.save_guard_execution_payload_rc23(p_job_id uuid,p_evidence jsonb,p_incidents jsonb)
returns jsonb language sql security definer set search_path=public set row_security=off as $$
  select public.transition_guard_mission(p_job_id,'save_payload',null,null,p_evidence,p_incidents);
$$;

create or replace function public.complete_guard_checkpoint_rc23(p_job_id uuid,p_expected_checkpoint integer)
returns jsonb language sql security definer set search_path=public set row_security=off as $$
  select public.transition_guard_mission(p_job_id,'complete_checkpoint',null,p_expected_checkpoint,null,null);
$$;

create or replace function public.submit_guard_mission_rc23(p_job_id uuid)
returns jsonb language sql security definer set search_path=public set row_security=off as $$
  select public.transition_guard_mission(p_job_id,'submit');
$$;

revoke all on function public.ensure_mission_engine_state(uuid) from public;
revoke all on function public.get_guard_mission_snapshot(uuid) from public;
revoke all on function public.transition_guard_mission(uuid,text,bigint,integer,jsonb,jsonb) from public;
grant execute on function public.ensure_mission_engine_state(uuid) to authenticated;
grant execute on function public.get_guard_mission_snapshot(uuid) to authenticated;
grant execute on function public.transition_guard_mission(uuid,text,bigint,integer,jsonb,jsonb) to authenticated;

commit;
