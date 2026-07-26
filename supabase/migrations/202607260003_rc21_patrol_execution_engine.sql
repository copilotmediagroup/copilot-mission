-- Co Pilot Security Marketplace OS — RC2.1 Patrol Execution Engine
-- Adds auditable checkpoint completion without replacing Mission Engine authority.
begin;

create table if not exists public.patrol_checkpoint_completions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  checkpoint_index integer not null check (checkpoint_index between 0 and 5),
  checkpoint_name text not null,
  evidence jsonb not null default '{}'::jsonb,
  incidents jsonb not null default '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  completed_at timestamptz not null default now(),
  unique(job_id, checkpoint_index)
);

create index if not exists patrol_checkpoint_completions_job_idx
  on public.patrol_checkpoint_completions(job_id, checkpoint_index);
create index if not exists patrol_checkpoint_completions_agency_idx
  on public.patrol_checkpoint_completions(agency_id, completed_at desc);

alter table public.patrol_checkpoint_completions enable row level security;
revoke all on public.patrol_checkpoint_completions from anon, authenticated;

create or replace function public.complete_patrol_checkpoint_rc21(
  p_job_id uuid,
  p_expected_version bigint,
  p_checkpoint integer,
  p_checkpoint_name text,
  p_evidence jsonb,
  p_incidents jsonb,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_state public.mission_engine_state;
  v_record jsonb;
  v_photo_count integer := 0;
  v_video_count integer := 0;
  v_note text := '';
  v_drafts integer := 0;
  v_next_state text;
  v_now timestamptz := now();
begin
  select * into v_guard from public.guards where user_id=auth.uid() for update;
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;

  select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
  if v_assignment.guard_id is distinct from v_guard.id then raise exception 'ASSIGNMENT_NOT_OWNED_BY_GUARD' using errcode='42501'; end if;

  perform public.ensure_mission_engine_state(p_job_id);
  select * into v_state from public.mission_engine_state where job_id=p_job_id for update;

  if p_expected_version is not null and v_state.version<>p_expected_version then
    raise exception 'MISSION_STATE_CONFLICT' using errcode='40001';
  end if;
  if v_state.state not in ('active','checkpoint') then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if;
  if p_checkpoint is null or p_checkpoint<>v_state.checkpoint_index or p_checkpoint<0 or p_checkpoint>5 then
    raise exception 'CHECKPOINT_STATE_CONFLICT' using errcode='40001';
  end if;
  if jsonb_typeof(coalesce(p_evidence,'[]'::jsonb))<>'array' then raise exception 'INVALID_EVIDENCE_PAYLOAD' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_incidents,'[]'::jsonb))<>'array' then raise exception 'INVALID_INCIDENT_PAYLOAD' using errcode='22023'; end if;

  select item into v_record
  from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb)) item
  where (item->>'checkpoint')::integer=p_checkpoint
  limit 1;

  v_photo_count := coalesce((v_record->>'photos')::integer,0);
  v_video_count := coalesce((v_record->>'videos')::integer,0);
  v_note := coalesce(v_record->>'note','');

  -- Existing product contract: Main Entrance and Rear Loading Dock require photo proof.
  if p_checkpoint in (2,4) and v_photo_count<1 then
    raise exception 'REQUIRED_PHOTO_MISSING' using errcode='22023';
  end if;

  select count(*) into v_drafts
  from jsonb_array_elements(coalesce(p_incidents,'[]'::jsonb)) item
  where coalesce((item->>'checkpoint')::integer,-1)=p_checkpoint
    and item->>'status'='draft';
  if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;

  v_next_state := case when p_checkpoint=5 then 'review' else 'checkpoint' end;

  insert into public.patrol_checkpoint_completions(
    job_id,assignment_id,agency_id,guard_id,checkpoint_index,checkpoint_name,
    evidence,incidents,latitude,longitude,accuracy_meters,completed_at
  ) values (
    p_job_id,v_assignment.id,v_assignment.agency_id,v_guard.id,p_checkpoint,
    coalesce(nullif(trim(p_checkpoint_name),''),'Checkpoint '||(p_checkpoint+1)),
    jsonb_build_object('photos',v_photo_count,'videos',v_video_count,'note',v_note),
    coalesce(p_incidents,'[]'::jsonb),p_latitude,p_longitude,p_accuracy_meters,v_now
  )
  on conflict(job_id,checkpoint_index) do update set
    checkpoint_name=excluded.checkpoint_name,
    evidence=excluded.evidence,
    incidents=excluded.incidents,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    accuracy_meters=excluded.accuracy_meters,
    completed_at=excluded.completed_at;

  update public.mission_engine_state
  set state=v_next_state,
      checkpoint_index=p_checkpoint+1,
      evidence=coalesce(p_evidence,evidence),
      incidents=coalesce(p_incidents,incidents),
      version=version+1,
      updated_at=v_now
  where job_id=p_job_id
  returning * into v_state;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'checkpoint_completed',jsonb_build_object(
    'checkpoint_index',p_checkpoint,
    'checkpoint_name',coalesce(nullif(trim(p_checkpoint_name),''),'Checkpoint '||(p_checkpoint+1)),
    'next_checkpoint',p_checkpoint+1,
    'state',v_state.state,
    'version',v_state.version,
    'gps_verified',p_latitude is not null and p_longitude is not null,
    'accuracy_meters',p_accuracy_meters,
    'photos',v_photo_count,
    'videos',v_video_count,
    'note_present',length(v_note)>0
  ));

  if p_checkpoint=5 then
    insert into public.mission_events(job_id,actor_user_id,event_type,payload)
    values(p_job_id,auth.uid(),'mission_proof_ready',jsonb_build_object('checkpoints_completed',6));
  end if;

  return to_jsonb(v_state);
end;
$$;

create or replace function public.get_guard_patrol_audit_rc21(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_rows jsonb;
begin
  select * into v_guard from public.guards where user_id=auth.uid();
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
  select * into v_assignment from public.job_assignments where job_id=p_job_id and guard_id=v_guard.id;
  if v_assignment.id is null then raise exception 'ASSIGNMENT_NOT_OWNED_BY_GUARD' using errcode='42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.checkpoint_index),'[]'::jsonb)
  into v_rows
  from public.patrol_checkpoint_completions c
  where c.job_id=p_job_id;
  return v_rows;
end;
$$;

revoke all on function public.complete_patrol_checkpoint_rc21(uuid,bigint,integer,text,jsonb,jsonb,double precision,double precision,double precision) from public;
revoke all on function public.get_guard_patrol_audit_rc21(uuid) from public;
grant execute on function public.complete_patrol_checkpoint_rc21(uuid,bigint,integer,text,jsonb,jsonb,double precision,double precision,double precision) to authenticated;
grant execute on function public.get_guard_patrol_audit_rc21(uuid) to authenticated;

commit;
