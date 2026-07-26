-- Live Location Engine v1.0
-- One authority for guard GPS writes, route history, freshness and role-scoped reads.

create table if not exists public.guard_location_events (
  id bigint generated always as identity primary key,
  guard_id uuid not null references public.guards(id) on delete cascade,
  job_id uuid references public.marketplace_jobs(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  heading_degrees double precision,
  speed_mps double precision,
  source text not null default 'browser' check (source in ('browser','native','manual_test')),
  recorded_at timestamptz not null default now()
);

create index if not exists guard_location_events_guard_time_idx on public.guard_location_events(guard_id, recorded_at desc);
create index if not exists guard_location_events_job_time_idx on public.guard_location_events(job_id, recorded_at desc) where job_id is not null;

alter table public.guard_location_events enable row level security;

drop policy if exists guard_location_events_guard_read_own on public.guard_location_events;
create policy guard_location_events_guard_read_own on public.guard_location_events for select to authenticated using (
  exists(select 1 from public.guards g where g.id=guard_id and g.user_id=auth.uid())
);

drop policy if exists guard_location_events_agency_read on public.guard_location_events;
create policy guard_location_events_agency_read on public.guard_location_events for select to authenticated using (
  exists(select 1 from public.guards g join public.agency_members am on am.agency_id=g.agency_id and am.user_id=auth.uid() and am.is_active=true where g.id=guard_id)
);

drop policy if exists guard_location_events_client_read_active on public.guard_location_events;
create policy guard_location_events_client_read_active on public.guard_location_events for select to authenticated using (
  job_id is not null and exists(
    select 1 from public.marketplace_jobs j join public.clients c on c.id=j.client_id
    where j.id=job_id and c.user_id=auth.uid() and j.status in ('accepted','assigned','active')
  )
);

drop policy if exists guard_location_events_platform_read on public.guard_location_events;
create policy guard_location_events_platform_read on public.guard_location_events for select to authenticated using (public.current_role()='platform_admin');

create or replace function public.update_guard_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_heading_degrees double precision default null,
  p_speed_mps double precision default null,
  p_source text default 'browser'
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_guard public.guards%rowtype;
  v_job_id uuid;
  v_event_id bigint;
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
  select * into v_guard from public.guards where user_id=auth.uid() for update;
  if not found then raise exception 'GUARD_PROFILE_REQUIRED'; end if;
  if v_guard.availability='offline' then raise exception 'GUARD_OFFLINE_LOCATION_REJECTED'; end if;

  select ja.job_id into v_job_id
  from public.job_assignments ja
  join public.mission_engine_state me on me.job_id=ja.job_id
  where ja.guard_id=v_guard.id and me.state in ('accepted','en_route','active','checkpoint','review')
  order by ja.assigned_at desc limit 1;

  update public.guards set current_latitude=p_latitude,current_longitude=p_longitude,last_location_at=now() where id=v_guard.id;

  insert into public.guard_location_events(guard_id,job_id,latitude,longitude,accuracy_meters,heading_degrees,speed_mps,source)
  values(v_guard.id,v_job_id,p_latitude,p_longitude,p_accuracy_meters,p_heading_degrees,p_speed_mps,coalesce(p_source,'browser')) returning id into v_event_id;

  return jsonb_build_object('event_id',v_event_id,'guard_id',v_guard.id,'job_id',v_job_id,'recorded_at',now());
end;
$$;

grant execute on function public.update_guard_location(double precision,double precision,double precision,double precision,double precision,text) to authenticated;

create or replace function public.get_guard_location_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_guard public.guards%rowtype; begin
 select * into v_guard from public.guards where user_id=auth.uid(); if not found then raise exception 'GUARD_PROFILE_REQUIRED'; end if;
 return jsonb_build_object('guard_id',v_guard.id,'availability',v_guard.availability,'latitude',v_guard.current_latitude,'longitude',v_guard.current_longitude,'last_location_at',v_guard.last_location_at,
 'freshness',case when v_guard.last_location_at is null then 'none' when v_guard.last_location_at>=now()-interval '2 minutes' then 'live' when v_guard.last_location_at>=now()-interval '10 minutes' then 'stale' else 'expired' end);
end $$;
grant execute on function public.get_guard_location_state() to authenticated;

create or replace function public.get_agency_live_locations() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_agency uuid; begin
 select am.agency_id into v_agency from public.agency_members am where am.user_id=auth.uid() and am.is_active=true limit 1;
 if v_agency is null then raise exception 'AGENCY_MEMBERSHIP_REQUIRED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('guard_id',g.id,'name',coalesce(p.full_name,'Guard'),'availability',g.availability,'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at,'freshness',case when g.last_location_at is null then 'none' when g.last_location_at>=now()-interval '2 minutes' then 'live' when g.last_location_at>=now()-interval '10 minutes' then 'stale' else 'expired' end,'job_id',ja.job_id,'mission_state',me.state) order by p.full_name) from public.guards g join public.profiles p on p.id=g.user_id left join public.job_assignments ja on ja.guard_id=g.id and ja.status not in ('completed','cancelled') left join public.mission_engine_state me on me.job_id=ja.job_id where g.agency_id=v_agency),'[]'::jsonb);
end $$;
grant execute on function public.get_agency_live_locations() to authenticated;

create or replace function public.get_client_live_location() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 return coalesce((select jsonb_build_object('job_id',j.id,'title',j.title,'property_name',pr.name,'property_address',pr.address,'property_latitude',pr.latitude,'property_longitude',pr.longitude,'guard_id',g.id,'guard_name',coalesce(p.full_name,'Guard'),'availability',g.availability,'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at,'freshness',case when g.last_location_at is null then 'none' when g.last_location_at>=now()-interval '2 minutes' then 'live' when g.last_location_at>=now()-interval '10 minutes' then 'stale' else 'expired' end,'mission_state',me.state) from public.clients c join public.marketplace_jobs j on j.client_id=c.id join public.properties pr on pr.id=j.property_id join public.job_assignments ja on ja.job_id=j.id join public.guards g on g.id=ja.guard_id join public.profiles p on p.id=g.user_id left join public.mission_engine_state me on me.job_id=j.id where c.user_id=auth.uid() and j.status in ('accepted','assigned','active') order by j.updated_at desc limit 1),'null'::jsonb);
end $$;
grant execute on function public.get_client_live_location() to authenticated;

-- Extend platform observability health without changing domain ownership.
create or replace function public.get_live_location_health() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if public.current_role()<>'platform_admin' then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 return jsonb_build_object('receiving_now',(select count(*) from public.guards where last_location_at>=now()-interval '2 minutes'),'stale',(select count(*) from public.guards where last_location_at<now()-interval '2 minutes' and last_location_at>=now()-interval '10 minutes'),'expired',(select count(*) from public.guards where last_location_at<now()-interval '10 minutes'),'route_points_24h',(select count(*) from public.guard_location_events where recorded_at>=now()-interval '24 hours'));
end $$;
grant execute on function public.get_live_location_health() to authenticated;
