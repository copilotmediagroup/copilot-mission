-- Guard production-parity hardening.
-- Developer Live Account Test and signed-in Guard flows must enforce the same mission semantics.

-- Never resurrect a slot from a terminal parent job in the real Guard workspace.
create or replace function public.get_my_guard_slot_offer_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards;v_slot public.job_guard_slots;v_job public.marketplace_jobs;v_property public.properties;v_client public.clients;
begin
 select * into v_guard from public.guards where user_id=auth.uid(); if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select s.* into v_slot from public.job_guard_slots s join public.marketplace_jobs j on j.id=s.job_id where s.guard_id=v_guard.id and s.status in('offered','accepted','en_route','arrived','active') and j.status in('accepted','assigned','active') and greatest(1,coalesce(j.required_guards,1))>1 order by s.updated_at desc limit 1;
 if v_slot.id is null then return null; end if;
 select * into v_job from public.marketplace_jobs where id=v_slot.job_id; select * into v_property from public.properties where id=v_job.property_id; select * into v_client from public.clients where id=v_job.client_id;
 return jsonb_build_object('assignment_id',v_slot.id,'slot_number',v_slot.slot_number,'required_guards',v_job.required_guards,'job_id',v_job.id,'agency_id',v_slot.agency_id,'guard_id',v_guard.id,'status',v_slot.status,'assigned_at',v_slot.created_at,'offered_at',v_slot.offered_at,'accepted_at',v_slot.accepted_at,'declined_at',v_slot.declined_at,'title',v_job.title,'instructions',v_job.instructions,'priority',v_job.priority,'scheduled_for',v_job.scheduled_for,'duration_minutes',v_job.duration_minutes,'property',jsonb_build_object('name',v_property.name,'address',coalesce(v_property.formatted_address,v_property.address),'latitude',v_property.latitude,'longitude',v_property.longitude,'photo_url',v_property.photo_url),'client',jsonb_build_object('display_name',v_client.display_name),'guard',jsonb_build_object('id',v_guard.id,'user_id',v_guard.user_id,'name',coalesce((select full_name from public.profiles where id=v_guard.user_id),'Guard'),'badge_number',v_guard.badge_number,'availability',v_guard.availability),'multi_guard_slot',true);
end $$;
revoke all on function public.get_my_guard_slot_offer_rc1() from public,anon; grant execute on function public.get_my_guard_slot_offer_rc1() to authenticated,service_role;

-- GPS ownership is valid through either a single-guard assignment or a multi-guard slot.
create or replace function public.publish_guard_location(p_latitude double precision,p_longitude double precision,p_accuracy_meters double precision default null,p_heading_degrees double precision default null,p_speed_mps double precision default null,p_captured_at timestamptz default now(),p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_guard public.guards%rowtype;v_assignment_status text;v_captured_at timestamptz:=coalesce(p_captured_at,now());v_applied boolean:=false;
begin
 if public.current_role()<>'guard' then raise exception 'GUARD_ROLE_REQUIRED'; end if;
 if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception 'INVALID_COORDINATES'; end if;
 if v_captured_at > now()+interval '2 minutes' or v_captured_at < now()-interval '30 minutes' then raise exception 'INVALID_CAPTURE_TIME'; end if;
 select * into v_guard from public.guards where user_id=auth.uid() for update; if v_guard.id is null then raise exception 'GUARD_RECORD_NOT_FOUND'; end if; if v_guard.availability='offline' then raise exception 'GUARD_OFFLINE'; end if;
 if p_job_id is not null then
  select x.status into v_assignment_status from (
   select ja.status::text status,ja.assigned_at sort_at from public.job_assignments ja where ja.job_id=p_job_id and ja.guard_id=v_guard.id and ja.status in('offered','accepted','en_route','arrived','active')
   union all
   select gs.status::text status,gs.updated_at sort_at from public.job_guard_slots gs join public.marketplace_jobs j on j.id=gs.job_id where gs.job_id=p_job_id and gs.guard_id=v_guard.id and gs.status in('offered','accepted','en_route','arrived','active') and j.status in('accepted','assigned','active')
  ) x order by x.sort_at desc limit 1;
  if v_assignment_status is null then raise exception 'MISSION_NOT_ASSIGNED_TO_GUARD'; end if;
 end if;
 if v_guard.last_location_at is null or v_captured_at>=v_guard.last_location_at then update public.guards set current_latitude=p_latitude,current_longitude=p_longitude,last_location_at=v_captured_at where id=v_guard.id;v_applied:=true;end if;
 insert into public.guard_location_points(guard_id,agency_id,job_id,latitude,longitude,accuracy_meters,heading_degrees,speed_mps,captured_at) values(v_guard.id,v_guard.agency_id,p_job_id,p_latitude,p_longitude,p_accuracy_meters,p_heading_degrees,p_speed_mps,v_captured_at);
 return jsonb_build_object('guard_id',v_guard.id,'agency_id',v_guard.agency_id,'job_id',p_job_id,'latitude',p_latitude,'longitude',p_longitude,'accuracy_meters',p_accuracy_meters,'captured_at',v_captured_at,'freshness','live','applied_to_live_position',v_applied);
end $$;
revoke all on function public.publish_guard_location(double precision,double precision,double precision,double precision,double precision,timestamptz,uuid) from public,anon;grant execute on function public.publish_guard_location(double precision,double precision,double precision,double precision,double precision,timestamptz,uuid) to authenticated,service_role;

-- Real Guard multi-guard checkpoint proof must match the Live Account Test proof gate.
create or replace function public.guard_slot_required_photo_ok_rc1(p_guard_id uuid,p_job_id uuid,p_checkpoint integer)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
 select case when p_checkpoint not in(2,4) then true else exists(select 1 from public.mission_evidence_media m where m.job_id=p_job_id and m.guard_id=p_guard_id and m.checkpoint_index=p_checkpoint and m.kind='photo') end
$$;
revoke all on function public.guard_slot_required_photo_ok_rc1(uuid,uuid,integer) from public,anon;grant execute on function public.guard_slot_required_photo_ok_rc1(uuid,uuid,integer) to authenticated,service_role;

-- Canonical real-Guard slot transition now enforces the same secured-media proof rule.
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
  select item into v_record from jsonb_array_elements(coalesce(v_state.evidence,'[]')) item where (item->>'checkpoint')::integer=p_checkpoint limit 1; v_photos:=coalesce((v_record->>'photos')::integer,0); if p_checkpoint in(2,4) and v_photos<1 then raise exception 'REQUIRED_PHOTO_MISSING' using errcode='22023'; end if; if not public.guard_slot_required_photo_ok_rc1(v_guard.id,p_job_id,p_checkpoint) then raise exception 'REQUIRED_REAL_PHOTO_MISSING' using errcode='22023'; end if;
  select count(*) into v_drafts from jsonb_array_elements(coalesce(v_state.incidents,'[]')) item where coalesce((item->>'checkpoint')::integer,-1)=p_checkpoint and item->>'status'='draft'; if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if;
  v_next:=case when p_checkpoint=5 then 'review' else 'checkpoint' end;v_event:='guard_slot_checkpoint_completed';
  update public.guard_slot_mission_state set state=v_next,checkpoint_index=p_checkpoint+1,evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
 elsif p_action='submit' then
  if v_state.state<>'review' or v_state.checkpoint_index<>6 then raise exception 'MISSION_NOT_READY_FOR_SUBMISSION' using errcode='22023'; end if;
  select count(*) into v_drafts from jsonb_array_elements(coalesce(p_incidents,v_state.incidents,'[]')) item where item->>'status'='draft'; if v_drafts>0 then raise exception 'INCIDENT_DRAFT_PENDING' using errcode='22023'; end if; v_event:='guard_slot_completed';
  update public.guard_slot_mission_state set state='completed',evidence=coalesce(p_evidence,evidence),incidents=coalesce(p_incidents,incidents),completed_at=v_now,version=version+1,updated_at=v_now where slot_id=v_slot.id returning * into v_state;
  update public.job_guard_slots set status='completed',completed_at=v_now,updated_at=v_now where id=v_slot.id;
  select greatest(1,coalesce(required_guards,1)) into v_required from public.marketplace_jobs where id=p_job_id; select count(*) into v_done from public.job_guard_slots where job_id=p_job_id and status='completed';
  if v_done>=v_required then update public.marketplace_jobs set status='completed',updated_at=v_now where id=p_job_id; perform public.ensure_multi_guard_mission_report_rc1(p_job_id); end if;
 else raise exception 'UNKNOWN_MISSION_ACTION' using errcode='22023'; end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),v_event,jsonb_build_object('slot_number',v_slot.slot_number,'guard_id',v_guard.id,'state',v_state.state,'checkpoint_index',v_state.checkpoint_index,'version',v_state.version)); return to_jsonb(v_state);
end $$;
revoke all on function public.transition_guard_slot_mission_rc1(uuid,text,bigint,integer,jsonb,jsonb) from public,anon;grant execute on function public.transition_guard_slot_mission_rc1(uuid,text,bigint,integer,jsonb,jsonb) to authenticated,service_role;


-- Platform Admin Live Account Test report history for the selected real Guard.
create or replace function public.get_developer_guard_reports_rc1(p_guard_id uuid)
returns setof public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.guards where id=p_guard_id) then raise exception 'GUARD_NOT_FOUND' using errcode='P0002'; end if;
 return query select r.* from public.mission_reports r where (r.guard_id=p_guard_id or exists(select 1 from public.job_guard_slots s where s.job_id=r.job_id and s.guard_id=p_guard_id)) and coalesce((select j.pricing_snapshot->>'developer_test' from public.marketplace_jobs j where j.id=r.job_id),'false')='true' order by coalesce(r.published_at,r.updated_at,r.created_at) desc;
end $$;
revoke all on function public.get_developer_guard_reports_rc1(uuid) from public,anon;grant execute on function public.get_developer_guard_reports_rc1(uuid) to authenticated,service_role;

-- Platform Admin Live Account Test publication mirrors the signed-in Guard publication gates.
create or replace function public.publish_developer_guard_mission_report_rc1(p_guard_id uuid,p_job_id uuid)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_report public.mission_reports;v_job public.marketplace_jobs;v_payout_method text;v_hold_reason text;
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.guards where id=p_guard_id) then raise exception 'GUARD_NOT_FOUND' using errcode='P0002';end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id for update;if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='P0002';end if;
 if coalesce(v_job.pricing_snapshot->>'developer_test','false')<>'true' then raise exception 'DEVELOPER_TEST_JOB_REQUIRED' using errcode='42501';end if;
 if not (exists(select 1 from public.job_assignments a where a.job_id=p_job_id and a.guard_id=p_guard_id) or exists(select 1 from public.job_guard_slots s where s.job_id=p_job_id and s.guard_id=p_guard_id)) then raise exception 'MISSION_NOT_ASSIGNED_TO_GUARD' using errcode='42501';end if;
 select * into v_report from public.mission_reports where job_id=p_job_id for update;if v_report.id is null then raise exception 'REPORT_NOT_READY' using errcode='55000';end if;if v_report.status='published' then return v_report;end if;if v_report.status not in('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE';end if;if v_job.status<>'completed' then raise exception 'MISSION_NOT_COMPLETED';end if;
 if coalesce(v_job.required_guards,1)>1 and (select count(*) from public.job_guard_slots where job_id=v_job.id and status='completed')<v_job.required_guards then raise exception 'MISSION_STAFFING_INCOMPLETE';end if;
 select coalesce(nullif(payout_method,''),'manual') into v_payout_method from public.agencies where id=v_report.agency_id;v_hold_reason:=case when v_payout_method='manual' then 'manual_payout_required' else 'payout_processing_required' end;
 update public.mission_reports set status='published',agency_review_note=null,clarification_note=null,reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=v_report.id returning * into v_report;
 update public.job_financials set payout_status='ready_for_payout',hold_reason=v_hold_reason,updated_at=now() where job_id=p_job_id;update public.marketplace_jobs set payout_status='ready_for_payout',payout_hold_reason=v_hold_reason,updated_at=now() where id=p_job_id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'report_published_to_client',jsonb_build_object('report_id',v_report.id,'publisher','guard','developer_test',true,'selected_guard_id',p_guard_id));
 perform public.notify_role('platform_admin',p_job_id,'report_published_payout_ready','Report published','Guard published the completed mission report to the client. Payout is ready for processing.','normal');return v_report;
end $$;
revoke all on function public.publish_developer_guard_mission_report_rc1(uuid,uuid) from public,anon;grant execute on function public.publish_developer_guard_mission_report_rc1(uuid,uuid) to authenticated,service_role;
