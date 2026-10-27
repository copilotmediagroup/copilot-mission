create or replace function public.set_guard_presence_rc13(p_online boolean)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards;v_previous text;v_next text;v_has_active_assignment boolean:=false;v_has_completed_mission boolean:=false;begin
 select * into v_guard from public.guards where user_id=auth.uid() for update;if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501';end if;v_previous:=v_guard.availability;
 select exists(select 1 from public.job_assignments ja join public.marketplace_jobs j on j.id=ja.job_id where ja.guard_id=v_guard.id and ja.status in('offered','accepted','en_route','arrived','active') and j.status in('accepted','assigned','active') union all select 1 from public.job_guard_slots s join public.marketplace_jobs j on j.id=s.job_id where s.guard_id=v_guard.id and s.status in('offered','accepted','en_route','arrived','active') and j.status in('accepted','assigned','active')) into v_has_active_assignment;
 select exists(
   select 1 from public.job_assignments ja join public.mission_engine_state me on me.job_id=ja.job_id and me.guard_id=v_guard.id where ja.guard_id=v_guard.id and ja.status='completed' and me.state='completed' and me.completed_at is not null
   union all
   select 1 from public.job_guard_slots s join public.guard_slot_mission_state gs on gs.slot_id=s.id and gs.guard_id=v_guard.id where s.guard_id=v_guard.id and s.status='completed' and gs.state='completed' and gs.completed_at is not null
 ) into v_has_completed_mission;
 if p_online then if v_previous='offline' then v_next:='available';elsif v_previous in('on_mission','reserved') and v_has_completed_mission and not v_has_active_assignment then v_next:='available';else v_next:=v_previous;end if;else if v_has_active_assignment or v_previous in('reserved','on_mission') then raise exception 'GUARD_CANNOT_GO_OFFLINE_WHILE_%',upper(v_previous) using errcode='22023';end if;v_next:='offline';end if;
 update public.guards set availability=v_next,online_intent=p_online where id=v_guard.id;
 if v_next is distinct from v_previous then insert into public.guard_presence_events(guard_id,agency_id,actor_user_id,previous_availability,next_availability) values(v_guard.id,v_guard.agency_id,auth.uid(),v_previous,v_next);end if;
 return jsonb_build_object('success',true,'guard_id',v_guard.id,'agency_id',v_guard.agency_id,'availability',v_next,'online',p_online,'changed',v_next is distinct from v_previous);
end $$;
revoke all on function public.set_guard_presence_rc13(boolean) from public,anon;
grant execute on function public.set_guard_presence_rc13(boolean) to authenticated;
