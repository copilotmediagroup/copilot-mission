-- Co Pilot Security Marketplace OS RC2.3 — Mission Execution Engine
-- Database authority for patrol checkpoint progress, evidence, incidents, review, completion, and recovery.
begin;

create table if not exists public.mission_execution_state (
  job_id uuid primary key references public.marketplace_jobs(id) on delete cascade,
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  phase text not null default 'patrol' check (phase in ('patrol','proof','completed')),
  checkpoint_index integer not null default 0 check (checkpoint_index between 0 and 6),
  evidence jsonb not null default '[]'::jsonb,
  incidents jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists mission_execution_guard_idx on public.mission_execution_state(guard_id,updated_at desc);
create index if not exists mission_execution_agency_idx on public.mission_execution_state(agency_id,updated_at desc);

alter table public.mission_execution_state enable row level security;

-- RPC-only authority. Direct table access is intentionally denied.
revoke all on public.mission_execution_state from anon, authenticated;

create or replace function public.ensure_guard_execution_state_rc23(p_job_id uuid)
returns public.mission_execution_state
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_state public.mission_execution_state;
begin
  select * into v_guard from public.guards where user_id=auth.uid();
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;

  select * into v_assignment from public.job_assignments where job_id=p_job_id;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
  if v_assignment.guard_id is distinct from v_guard.id then raise exception 'ASSIGNMENT_NOT_OWNED_BY_GUARD' using errcode='42501'; end if;
  if v_assignment.status not in ('active','completed') then raise exception 'MISSION_NOT_IN_EXECUTION' using errcode='22023'; end if;

  insert into public.mission_execution_state(job_id,assignment_id,agency_id,guard_id,phase,checkpoint_index,started_at)
  values(p_job_id,v_assignment.id,v_assignment.agency_id,v_guard.id,
    case when v_assignment.status='completed' then 'completed' else 'patrol' end,
    case when v_assignment.status='completed' then 6 else 0 end,
    coalesce(v_assignment.accepted_at,now()))
  on conflict(job_id) do nothing;

  select * into v_state from public.mission_execution_state where job_id=p_job_id;
  return v_state;
end;$$;

create or replace function public.get_guard_execution_state_rc23(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare v_state public.mission_execution_state;
begin
  v_state := public.ensure_guard_execution_state_rc23(p_job_id);
  return to_jsonb(v_state);
end;$$;

create or replace function public.save_guard_execution_payload_rc23(
  p_job_id uuid,
  p_evidence jsonb,
  p_incidents jsonb
)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_state public.mission_execution_state;
  v_drafts integer;
begin
  v_state := public.ensure_guard_execution_state_rc23(p_job_id);
  if v_state.phase <> 'patrol' then raise exception 'MISSION_NOT_ACCEPTING_CHECKPOINT_UPDATES' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_evidence,'[]'::jsonb)) <> 'array' then raise exception 'INVALID_EVIDENCE_PAYLOAD' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_incidents,'[]'::jsonb)) <> 'array' then raise exception 'INVALID_INCIDENT_PAYLOAD' using errcode='22023'; end if;

  update public.mission_execution_state
  set evidence=coalesce(p_evidence,'[]'::jsonb), incidents=coalesce(p_incidents,'[]'::jsonb), updated_at=now()
  where job_id=p_job_id
  returning * into v_state;

  select count(*) into v_drafts from jsonb_array_elements(v_state.incidents) item where item->>'status'='draft';

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'mission_execution_payload_saved',jsonb_build_object(
    'checkpoint_index',v_state.checkpoint_index,
    'evidence_records',jsonb_array_length(v_state.evidence),
    'incident_records',jsonb_array_length(v_state.incidents),
    'incident_drafts',v_drafts
  ));

  return to_jsonb(v_state);
end;$$;

create or replace function public.complete_guard_checkpoint_rc23(p_job_id uuid,p_expected_checkpoint integer)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_state public.mission_execution_state;
  v_record jsonb;
  v_photo_count integer := 0;
  v_drafts integer := 0;
  v_next integer;
  v_phase text;
begin
  v_state := public.ensure_guard_execution_state_rc23(p_job_id);
  if v_state.phase <> 'patrol' then raise exception 'MISSION_NOT_IN_PATROL' using errcode='22023'; end if;
  if v_state.checkpoint_index <> p_expected_checkpoint then raise exception 'CHECKPOINT_STATE_CONFLICT' using errcode='40001'; end if;
  if p_expected_checkpoint < 0 or p_expected_checkpoint > 5 then raise exception 'INVALID_CHECKPOINT' using errcode='22023'; end if;

  select item into v_record
  from jsonb_array_elements(v_state.evidence) item
  where (item->>'checkpoint')::integer=p_expected_checkpoint
  limit 1;
  v_photo_count := coalesce((v_record->>'photos')::integer,0);

  -- Main Entrance (2) and Rear Loading Dock (4) require a photo.
  if p_expected_checkpoint in (2,4) and v_photo_count < 1 then
    raise exception 'REQUIRED_PHOTO_MISSING' using errcode='22023';
  end if;

  select count(*) into v_drafts
  from jsonb_array_elements(v_state.incidents) item
  where coalesce((item->>'checkpoint')::integer,-1)=p_expected_checkpoint
    and item->>'status'='draft';
  if v_drafts > 0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;

  v_next := p_expected_checkpoint + 1;
  v_phase := case when v_next >= 6 then 'proof' else 'patrol' end;

  update public.mission_execution_state
  set checkpoint_index=v_next, phase=v_phase, updated_at=now()
  where job_id=p_job_id
  returning * into v_state;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'checkpoint_completed',jsonb_build_object(
    'checkpoint_index',p_expected_checkpoint,
    'next_checkpoint',v_next,
    'next_phase',v_phase
  ));

  if v_phase='proof' then
    insert into public.mission_events(job_id,actor_user_id,event_type,payload)
    values(p_job_id,auth.uid(),'mission_proof_ready',jsonb_build_object('checkpoints_completed',6));
  end if;

  return to_jsonb(v_state);
end;$$;

create or replace function public.submit_guard_mission_rc23(p_job_id uuid)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_state public.mission_execution_state;
  v_guard public.guards;
  v_now timestamptz := now();
  v_drafts integer;
begin
  v_state := public.ensure_guard_execution_state_rc23(p_job_id);
  if v_state.phase <> 'proof' or v_state.checkpoint_index <> 6 then raise exception 'MISSION_NOT_READY_FOR_SUBMISSION' using errcode='22023'; end if;

  select count(*) into v_drafts from jsonb_array_elements(v_state.incidents) item where item->>'status'='draft';
  if v_drafts > 0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;

  select * into v_guard from public.guards where id=v_state.guard_id for update;

  update public.mission_execution_state set phase='completed',completed_at=v_now,updated_at=v_now where job_id=p_job_id returning * into v_state;
  update public.job_assignments set status='completed' where job_id=p_job_id;
  update public.marketplace_jobs set status='completed',updated_at=v_now where id=p_job_id;
  update public.guards set availability='available' where id=v_guard.id;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'mission_completed',jsonb_build_object(
    'completed_at',v_now,
    'checkpoints_completed',6,
    'evidence_records',jsonb_array_length(v_state.evidence),
    'incident_records',jsonb_array_length(v_state.incidents)
  ));

  return to_jsonb(v_state);
end;$$;

revoke all on function public.ensure_guard_execution_state_rc23(uuid) from public;
revoke all on function public.get_guard_execution_state_rc23(uuid) from public;
revoke all on function public.save_guard_execution_payload_rc23(uuid,jsonb,jsonb) from public;
revoke all on function public.complete_guard_checkpoint_rc23(uuid,integer) from public;
revoke all on function public.submit_guard_mission_rc23(uuid) from public;
grant execute on function public.ensure_guard_execution_state_rc23(uuid) to authenticated;
grant execute on function public.get_guard_execution_state_rc23(uuid) to authenticated;
grant execute on function public.save_guard_execution_payload_rc23(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.complete_guard_checkpoint_rc23(uuid,integer) to authenticated;
grant execute on function public.submit_guard_mission_rc23(uuid) to authenticated;

commit;
