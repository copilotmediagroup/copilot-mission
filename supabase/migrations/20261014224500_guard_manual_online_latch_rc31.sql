-- Guard online/offline is an explicit operator choice. Mission state may change availability,
-- but nothing except the Online/Offline control should clear the manual online latch.
alter table public.guards add column if not exists online_intent boolean not null default false;
update public.guards set online_intent=(availability<>'offline') where online_intent is distinct from (availability<>'offline');

create or replace function public.set_developer_guard_presence_rc1(p_guard_id uuid,p_online boolean,p_latitude double precision default null,p_longitude double precision default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards;v_has_active_assignment boolean;begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 select exists(select 1 from public.job_assignments a join public.marketplace_jobs j on j.id=a.job_id where a.guard_id=p_guard_id and a.status not in('completed','cancelled','declined') and j.status in('accepted','assigned','active') union all select 1 from public.job_guard_slots s join public.marketplace_jobs j on j.id=s.job_id where s.guard_id=p_guard_id and s.status in('offered','accepted','en_route','arrived','active') and j.status in('accepted','assigned','active')) into v_has_active_assignment;
 update public.guards set online_intent=p_online,availability=case when not p_online then 'offline' when v_has_active_assignment then 'on_mission' else 'available' end,current_latitude=case when p_online and p_latitude is not null then p_latitude else current_latitude end,current_longitude=case when p_online and p_longitude is not null then p_longitude else current_longitude end,last_location_at=case when p_online and coalesce(p_latitude,current_latitude) is not null and coalesce(p_longitude,current_longitude) is not null then now() else last_location_at end where id=p_guard_id returning * into v_guard;
 if v_guard.id is null then raise exception 'GUARD_NOT_FOUND' using errcode='22023';end if;
 return jsonb_build_object('guard_id',v_guard.id,'agency_id',v_guard.agency_id,'availability',v_guard.availability,'online',v_guard.online_intent,'latitude',v_guard.current_latitude,'longitude',v_guard.current_longitude,'last_location_at',v_guard.last_location_at);
end $$;

create or replace function public.set_guard_presence_rc13(p_online boolean)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards;v_previous text;v_next text;v_has_active_assignment boolean:=false;v_has_completed_mission boolean:=false;begin
 select * into v_guard from public.guards where user_id=auth.uid() for update;if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501';end if;v_previous:=v_guard.availability;
 select exists(select 1 from public.job_assignments ja where ja.guard_id=v_guard.id and ja.status in('offered','accepted','en_route','arrived','active') union all select 1 from public.job_guard_slots s where s.guard_id=v_guard.id and s.status in('offered','accepted','en_route','arrived','active')) into v_has_active_assignment;
 select exists(select 1 from public.job_assignments ja join public.mission_engine_state me on me.job_id=ja.job_id and me.guard_id=v_guard.id where ja.guard_id=v_guard.id and ja.status='completed' and me.state='completed' and me.completed_at is not null) into v_has_completed_mission;
 if p_online then if v_previous='offline' then v_next:='available';elsif v_previous='on_mission' and v_has_completed_mission and not v_has_active_assignment then v_next:='available';else v_next:=v_previous;end if;else if v_has_active_assignment or v_previous in('reserved','on_mission') then raise exception 'GUARD_CANNOT_GO_OFFLINE_WHILE_%',upper(v_previous) using errcode='22023';end if;v_next:='offline';end if;
 update public.guards set availability=v_next,online_intent=p_online where id=v_guard.id;
 if v_next is distinct from v_previous then insert into public.guard_presence_events(guard_id,agency_id,actor_user_id,previous_availability,next_availability) values(v_guard.id,v_guard.agency_id,auth.uid(),v_previous,v_next);end if;
 return jsonb_build_object('success',true,'guard_id',v_guard.id,'agency_id',v_guard.agency_id,'availability',v_next,'online',p_online,'changed',v_next is distinct from v_previous);
end $$;

create or replace function public.developer_guard_is_assignable_rc1(p_guard_id uuid,p_agency_id uuid,p_armed boolean)
returns boolean language sql security definer set search_path=public set row_security=off as $$ select exists(select 1 from public.guards g where g.id=p_guard_id and g.agency_id=p_agency_id and g.online_intent and g.agency_approved and (not p_armed or g.armed_qualified)) $$;
