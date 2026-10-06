create or replace function public.transition_guard_slot_mission_rc1(p_job_id uuid,p_action text,p_expected_version bigint default null,p_checkpoint integer default null,p_evidence jsonb default null,p_incidents jsonb default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_slot public.job_guard_slots; v_state public.guard_slot_mission_state; v_now timestamptz:=now(); v_next text; v_event text; v_record jsonb; v_photos integer:=0; v_drafts integer:=0; v_required integer; v_done integer;
begin
 select * into v_guard from public.guards where user_id=auth.uid() for update; if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select * into v_slot from public.job_guard_slots where job_id=p_job_id and guard_id=v_guard.id for update; if v_slot.id is null then raise exception 'STAFFING_SLOT_NOT_OWNED_BY_GUARD' using errcode='42501'; end if;
 if p_action in('accept','decline') then return public.respond_to_guard_slot_rc1(p_job_id,p_action); end if;
 select * into v_state from public.guard_slot_mission_state where slot_id=v_slot.id for update; if v_state.slot_id is null then raise exception 'GUARD_SLOT_RUNTIME_NOT_STARTED' using errcode='22023'; end if;
 if p_expected_version is not null and v_state.version<>p_expected_version then raise exception 'MISSION_STATE_CONFLICT' using errcode='40001'; end if;
 if p_action='start_route' then
  if v_state.state<>'accepted' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if; v_next:='en_route';v_event:='guard_slot_route_started';
  update public.job_guard_slots set status='en_route',route_started_at=v_now,updated_at=v_now where id=v_slot.id;
  update public.guard_slot_mission_state set state=v_next,route_started_at=v_now,version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
 elsif p_action='mark_arrived' then
  if v_state.state<>'en_route' then raise exception 'ILLEGAL_MISSION_TRANSITION' using errcode='22023'; end if; v_next:='active';v_event:='guard_slot_arrived';
  update public.job_guard_slots set status='active',arrived_at=v_now,updated_at=v_now where id=v_slot.id;
  update public.guard_slot_mission_state set state=v_next,arrived_at=v_now,checkpoint_index=0,version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
 elsif p_action='save_payload' then
  if v_state.state not in('active','checkpoint','review') then raise exception 'MISSION_NOT_ACCEPTING_EXECUTION_UPDATES' using errcode='22023'; end if;
  if p_evidence is not null and jsonb_typeof(p_evidence)<>'array' then raise exception 'INVALID_EVIDENCE_PAYLOAD' using errcode='22023'; end if; if p_incidents is not null and jsonb_typeof(p_incidents)<>'array' then raise exception 'INVALID_INCIDENT_PAYLOAD' using errcode='22023'; end if; v_event:='guard_slot_payload_saved';
  update public.guard_slot_mission_state set evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
 elsif p_action='complete_checkpoint' then
  if v_state.state not in('active','checkpoint') or p_checkpoint is null or p_checkpoint<>v_state.checkpoint_index or p_checkpoint<0 or p_checkpoint>5 then raise exception 'CHECKPOINT_STATE_CONFLICT' using errcode='40001'; end if;
  if p_evidence is not null then v_state.evidence:=p_evidence; end if; if p_incidents is not null then v_state.incidents:=p_incidents; end if;
  select item into v_record from jsonb_array_elements(coalesce(v_state.evidence,'[]')) item where (item->>'checkpoint')::integer=p_checkpoint limit 1; v_photos:=coalesce((v_record->>'photos')::integer,0); if p_checkpoint in(2,4) and v_photos<1 then raise exception 'REQUIRED_PHOTO_MISSING' using errcode='22023'; end if;
  select count(*) into v_drafts from jsonb_array_elements(coalesce(v_state.incidents,'[]')) item where coalesce((item->>'checkpoint')::integer,-1)=p_checkpoint and item->>'status'='draft'; if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;
  v_next:=case when p_checkpoint=5 then 'review' else 'checkpoint' end;v_event:='guard_slot_checkpoint_completed';
  update public.guard_slot_mission_state set state=v_next,checkpoint_index=p_checkpoint+1,evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
 elsif p_action='submit' then
  if v_state.state<>'review' or v_state.checkpoint_index<>6 then raise exception 'MISSION_NOT_READY_FOR_SUBMISSION' using errcode='22023'; end if;
  select count(*) into v_drafts from jsonb_array_elements(coalesce(p_incidents,v_state.incidents,'[]')) item where item->>'status'='draft'; if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if; v_event:='guard_slot_completed';
  update public.guard_slot_mission_state set state='completed',evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),completed_at=v_now,version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
  update public.job_guard_slots set status='completed',completed_at=v_now,updated_at=v_now where id=v_slot.id;
  select greatest(1,coalesce(required_guards,1)) into v_required from public.marketplace_jobs where id=p_job_id; select count(*) into v_done from public.job_guard_slots where job_id=p_job_id and status='completed';
  if v_done>=v_required then update public.marketplace_jobs set status='completed',updated_at=v_now where id=p_job_id; end if;
 else raise exception 'UNKNOWN_MISSION_ACTION' using errcode='22023'; end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),v_event,jsonb_build_object('slot_number',v_slot.slot_number,'guard_id',v_guard.id,'state',v_state.state,'checkpoint_index',v_state.checkpoint_index,'version',v_state.version)); return to_jsonb(v_state);
end $$;
revoke all on function public.transition_guard_slot_mission_rc1(uuid,text,bigint,integer,jsonb,jsonb) from public,anon;grant execute on function public.transition_guard_slot_mission_rc1(uuid,text,bigint,integer,jsonb,jsonb) to authenticated,service_role;

create or replace function public.get_my_guard_slot_runtime_rc1(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$ declare v_guard uuid;v_slot uuid;begin select id into v_guard from public.guards where user_id=auth.uid();select id into v_slot from public.job_guard_slots where job_id=p_job_id and guard_id=v_guard;if v_slot is null then raise exception 'STAFFING_SLOT_NOT_OWNED_BY_GUARD' using errcode='42501';end if;return (select to_jsonb(s) from public.guard_slot_mission_state s where s.slot_id=v_slot);end $$;
revoke all on function public.get_my_guard_slot_runtime_rc1(uuid) from public,anon;grant execute on function public.get_my_guard_slot_runtime_rc1(uuid) to authenticated,service_role;
