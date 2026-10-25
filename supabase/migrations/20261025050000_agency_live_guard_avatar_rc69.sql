-- RC69: Agency map guard identity. Preserve agency-only visibility while returning the guard profile photo.
create or replace function public.get_agency_live_locations() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_agency uuid; begin
 select am.agency_id into v_agency from public.agency_members am where am.user_id=auth.uid() and am.is_active=true limit 1;
 if v_agency is null then raise exception 'AGENCY_MEMBERSHIP_REQUIRED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'guard_id',g.id,'name',coalesce(p.full_name,'Guard'),'availability',g.availability,
   'avatar_url',coalesce(g.avatar_url,p.avatar_url),
   'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at,
   'freshness',case when g.last_location_at is null then 'none' when g.last_location_at>=now()-interval '2 minutes' then 'live' when g.last_location_at>=now()-interval '10 minutes' then 'stale' else 'expired' end,
   'job_id',ja.job_id,'mission_state',me.state
 ) order by p.full_name)
 from public.guards g join public.profiles p on p.id=g.user_id
 left join public.job_assignments ja on ja.guard_id=g.id and ja.status not in ('completed','cancelled')
 left join public.mission_engine_state me on me.job_id=ja.job_id
 where g.agency_id=v_agency),'[]'::jsonb);
end $$;
grant execute on function public.get_agency_live_locations() to authenticated;
