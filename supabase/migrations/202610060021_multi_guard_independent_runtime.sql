-- Independent field runtime per guard slot. Never shares the legacy job-level mission engine.
alter table public.job_guard_slots add column if not exists offered_at timestamptz, add column if not exists accepted_at timestamptz, add column if not exists declined_at timestamptz, add column if not exists route_started_at timestamptz, add column if not exists arrived_at timestamptz, add column if not exists completed_at timestamptz;
create table if not exists public.guard_slot_mission_state (
 slot_id uuid primary key references public.job_guard_slots(id) on delete cascade,
 job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
 agency_id uuid not null references public.agencies(id), guard_id uuid not null references public.guards(id),
 state text not null default 'offered' check(state in ('offered','accepted','en_route','active','checkpoint','review','completed','cancelled')),
 checkpoint_index integer not null default 0 check(checkpoint_index between 0 and 6), evidence jsonb not null default '[]', incidents jsonb not null default '[]',
 mission_started_at timestamptz, route_started_at timestamptz, arrived_at timestamptz, completed_at timestamptz,
 version bigint not null default 1, updated_at timestamptz not null default now()
);
create index if not exists guard_slot_mission_state_guard_idx on public.guard_slot_mission_state(guard_id,state);
alter table public.guard_slot_mission_state enable row level security;
create policy guard_slot_runtime_scoped_read on public.guard_slot_mission_state for select to authenticated using (guard_id in(select id from public.guards where user_id=auth.uid()) or agency_id in(select public.user_agency_ids()) or public.current_role()='platform_admin' or job_id in(select j.id from public.marketplace_jobs j join public.clients c on c.id=j.client_id where c.user_id=auth.uid()));
revoke all on table public.guard_slot_mission_state from anon,authenticated; grant select on table public.guard_slot_mission_state to authenticated; grant all on table public.guard_slot_mission_state to service_role;

create or replace function public.respond_to_guard_slot_rc1(p_job_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_slot public.job_guard_slots; v_now timestamptz:=now(); v_required integer; v_accepted integer;
begin
 if p_response not in('accept','decline') then raise exception 'INVALID_RESPONSE' using errcode='22023'; end if;
 select * into v_guard from public.guards where user_id=auth.uid() for update; if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select * into v_slot from public.job_guard_slots where job_id=p_job_id and guard_id=v_guard.id for update; if v_slot.id is null or v_slot.status<>'offered' then raise exception 'STAFFING_SLOT_NOT_OFFERED_TO_GUARD' using errcode='42501'; end if;
 if p_response='decline' then
  update public.job_guard_slots set guard_id=null,status='awaiting_guard',declined_at=v_now,offered_at=null,updated_at=v_now where id=v_slot.id;
  delete from public.guard_slot_mission_state where slot_id=v_slot.id;
  update public.guards set availability='available' where id=v_guard.id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_staffing_slot_declined',jsonb_build_object('guard_id',v_guard.id,'slot_number',v_slot.slot_number));
  return jsonb_build_object('success',true,'job_id',p_job_id,'slot_number',v_slot.slot_number,'status','awaiting_guard');
 end if;
 update public.job_guard_slots set status='accepted',accepted_at=v_now,updated_at=v_now where id=v_slot.id;
 insert into public.guard_slot_mission_state(slot_id,job_id,agency_id,guard_id,state,mission_started_at) values(v_slot.id,p_job_id,v_slot.agency_id,v_guard.id,'accepted',v_now) on conflict(slot_id) do update set state='accepted',mission_started_at=coalesce(guard_slot_mission_state.mission_started_at,v_now),version=guard_slot_mission_state.version+1,updated_at=v_now;
 update public.guards set availability='on_mission' where id=v_guard.id;
 select greatest(1,coalesce(required_guards,1)) into v_required from public.marketplace_jobs where id=p_job_id;
 select count(*) into v_accepted from public.job_guard_slots where job_id=p_job_id and status in('accepted','en_route','arrived','active','completed');
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_staffing_slot_accepted',jsonb_build_object('guard_id',v_guard.id,'slot_number',v_slot.slot_number,'accepted_slots',v_accepted,'required_guards',v_required,'fully_staffed',v_accepted>=v_required));
 return jsonb_build_object('success',true,'job_id',p_job_id,'slot_number',v_slot.slot_number,'status','accepted','accepted_slots',v_accepted,'required_guards',v_required,'fully_staffed',v_accepted>=v_required);
end $$;
revoke all on function public.respond_to_guard_slot_rc1(uuid,text) from public,anon; grant execute on function public.respond_to_guard_slot_rc1(uuid,text) to authenticated,service_role;

create or replace function public.get_my_guard_slot_offer_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_slot public.job_guard_slots; v_job public.marketplace_jobs; v_property public.properties; v_client public.clients;
begin
 select * into v_guard from public.guards where user_id=auth.uid(); if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select * into v_slot from public.job_guard_slots where guard_id=v_guard.id and status in('offered','accepted','en_route','arrived','active') order by updated_at desc limit 1;
 if v_slot.id is null then return null; end if;
 select * into v_job from public.marketplace_jobs where id=v_slot.job_id; select * into v_property from public.properties where id=v_job.property_id; select * into v_client from public.clients where id=v_job.client_id;
 return jsonb_build_object('assignment_id',v_slot.id,'slot_number',v_slot.slot_number,'required_guards',v_job.required_guards,'job_id',v_job.id,'agency_id',v_slot.agency_id,'guard_id',v_guard.id,'status',v_slot.status,'assigned_at',v_slot.created_at,'offered_at',v_slot.offered_at,'accepted_at',v_slot.accepted_at,'declined_at',v_slot.declined_at,'title',v_job.title,'instructions',v_job.instructions,'priority',v_job.priority,'scheduled_for',v_job.scheduled_for,'duration_minutes',v_job.duration_minutes,'property',jsonb_build_object('name',v_property.name,'address',coalesce(v_property.formatted_address,v_property.address),'latitude',v_property.latitude,'longitude',v_property.longitude,'photo_url',v_property.photo_url),'client',jsonb_build_object('display_name',v_client.display_name),'guard',jsonb_build_object('id',v_guard.id,'user_id',v_guard.user_id,'name',coalesce((select full_name from public.profiles where id=v_guard.user_id),'Guard'),'badge_number',v_guard.badge_number,'availability',v_guard.availability),'multi_guard_slot',true);
end $$;
revoke all on function public.get_my_guard_slot_offer_rc1() from public,anon; grant execute on function public.get_my_guard_slot_offer_rc1() to authenticated,service_role;
