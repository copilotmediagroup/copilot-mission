-- Co Pilot Security Marketplace OS
-- Live Location Engine v1.0
-- One authority for guard GPS writes, freshness, route history and scoped reads.

create table if not exists public.guard_location_points (
  id bigint generated always as identity primary key,
  guard_id uuid not null references public.guards(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid references public.marketplace_jobs(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists guard_location_points_guard_time_idx
  on public.guard_location_points(guard_id, captured_at desc);
create index if not exists guard_location_points_job_time_idx
  on public.guard_location_points(job_id, captured_at desc)
  where job_id is not null;
create index if not exists guard_location_points_agency_time_idx
  on public.guard_location_points(agency_id, captured_at desc);

alter table public.guard_location_points enable row level security;

create or replace function public.publish_guard_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_heading_degrees double precision default null,
  p_speed_mps double precision default null,
  p_captured_at timestamptz default now(),
  p_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guard public.guards%rowtype;
  v_assignment_guard uuid;
  v_assignment_status text;
  v_captured_at timestamptz := coalesce(p_captured_at, now());
begin
  if public.current_role() <> 'guard' then
    raise exception 'GUARD_ROLE_REQUIRED';
  end if;

  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  if v_captured_at > now() + interval '2 minutes'
     or v_captured_at < now() - interval '30 minutes' then
    raise exception 'INVALID_CAPTURE_TIME';
  end if;

  select * into v_guard
  from public.guards
  where user_id = auth.uid();

  if v_guard.id is null then
    raise exception 'GUARD_RECORD_NOT_FOUND';
  end if;

  if v_guard.availability = 'offline' then
    raise exception 'GUARD_OFFLINE';
  end if;

  if p_job_id is not null then
    select ja.guard_id, ja.status
      into v_assignment_guard, v_assignment_status
    from public.job_assignments ja
    where ja.job_id = p_job_id;

    if v_assignment_guard is distinct from v_guard.id then
      raise exception 'MISSION_NOT_ASSIGNED_TO_GUARD';
    end if;

    if v_assignment_status not in ('offered','accepted','en_route','arrived','active') then
      raise exception 'MISSION_NOT_TRACKABLE';
    end if;
  end if;

  update public.guards
  set current_latitude = p_latitude,
      current_longitude = p_longitude,
      last_location_at = v_captured_at
  where id = v_guard.id;

  insert into public.guard_location_points(
    guard_id, agency_id, job_id, latitude, longitude,
    accuracy_meters, heading_degrees, speed_mps, captured_at
  ) values (
    v_guard.id, v_guard.agency_id, p_job_id, p_latitude, p_longitude,
    p_accuracy_meters, p_heading_degrees, p_speed_mps, v_captured_at
  );

  return jsonb_build_object(
    'guard_id', v_guard.id,
    'agency_id', v_guard.agency_id,
    'job_id', p_job_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'accuracy_meters', p_accuracy_meters,
    'captured_at', v_captured_at,
    'freshness', 'live'
  );
end;
$$;

create or replace function public.get_guard_location_state()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_guard public.guards%rowtype;
begin
  if public.current_role() <> 'guard' then
    raise exception 'GUARD_ROLE_REQUIRED';
  end if;

  select * into v_guard from public.guards where user_id = auth.uid();
  if v_guard.id is null then raise exception 'GUARD_RECORD_NOT_FOUND'; end if;

  return jsonb_build_object(
    'guard_id', v_guard.id,
    'agency_id', v_guard.agency_id,
    'availability', v_guard.availability,
    'latitude', v_guard.current_latitude,
    'longitude', v_guard.current_longitude,
    'last_location_at', v_guard.last_location_at,
    'freshness', case
      when v_guard.last_location_at is null then 'none'
      when v_guard.last_location_at >= now() - interval '2 minutes' then 'live'
      when v_guard.last_location_at >= now() - interval '10 minutes' then 'stale'
      else 'expired'
    end
  );
end;
$$;

create or replace function public.get_agency_live_locations()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_agency_id uuid;
begin
  if public.current_role() <> 'agency_admin' then
    raise exception 'AGENCY_ADMIN_ROLE_REQUIRED';
  end if;

  select am.agency_id into v_agency_id
  from public.agency_members am
  join public.agencies a on a.id = am.agency_id
  where am.user_id = auth.uid()
    and am.role = 'agency_admin'
    and am.is_active = true
    and a.status = 'approved'
  order by am.created_at
  limit 1;

  if v_agency_id is null then raise exception 'APPROVED_AGENCY_REQUIRED'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'guard_id', g.id,
      'user_id', g.user_id,
      'name', coalesce(p.full_name, 'Guard'),
      'availability', g.availability,
      'latitude', g.current_latitude,
      'longitude', g.current_longitude,
      'last_location_at', g.last_location_at,
      'freshness', case
        when g.last_location_at is null then 'none'
        when g.last_location_at >= now() - interval '2 minutes' then 'live'
        when g.last_location_at >= now() - interval '10 minutes' then 'stale'
        else 'expired'
      end
    ) order by coalesce(p.full_name, 'Guard'))
    from public.guards g
    join public.profiles p on p.id = g.user_id
    where g.agency_id = v_agency_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_platform_live_locations()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.current_role() <> 'platform_admin' then
    raise exception 'PLATFORM_ADMIN_ROLE_REQUIRED';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'guard_id', g.id,
      'agency_id', g.agency_id,
      'agency_name', a.name,
      'name', coalesce(p.full_name, 'Guard'),
      'availability', g.availability,
      'latitude', g.current_latitude,
      'longitude', g.current_longitude,
      'last_location_at', g.last_location_at,
      'freshness', case
        when g.last_location_at is null then 'none'
        when g.last_location_at >= now() - interval '2 minutes' then 'live'
        when g.last_location_at >= now() - interval '10 minutes' then 'stale'
        else 'expired'
      end
    ) order by a.name, coalesce(p.full_name, 'Guard'))
    from public.guards g
    join public.agencies a on a.id = g.agency_id
    join public.profiles p on p.id = g.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_mission_route_history(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role public.app_role;
  v_allowed boolean := false;
begin
  v_role := public.current_role();

  if v_role = 'platform_admin' then
    v_allowed := true;
  elsif v_role = 'agency_admin' then
    select exists(
      select 1 from public.job_assignments ja
      join public.agency_members am on am.agency_id = ja.agency_id
      where ja.job_id = p_job_id and am.user_id = auth.uid()
        and am.role = 'agency_admin' and am.is_active = true
    ) into v_allowed;
  elsif v_role = 'guard' then
    select exists(
      select 1 from public.job_assignments ja
      join public.guards g on g.id = ja.guard_id
      where ja.job_id = p_job_id and g.user_id = auth.uid()
    ) into v_allowed;
  elsif v_role = 'client' then
    select exists(
      select 1 from public.marketplace_jobs mj
      join public.clients c on c.id = mj.client_id
      where mj.id = p_job_id and c.user_id = auth.uid()
        and mj.status in ('accepted','assigned','active')
    ) into v_allowed;
  end if;

  if not v_allowed then raise exception 'ROUTE_ACCESS_DENIED'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'latitude', glp.latitude,
      'longitude', glp.longitude,
      'accuracy_meters', glp.accuracy_meters,
      'heading_degrees', glp.heading_degrees,
      'speed_mps', glp.speed_mps,
      'captured_at', glp.captured_at
    ) order by glp.captured_at)
    from public.guard_location_points glp
    where glp.job_id = p_job_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.publish_guard_location(double precision,double precision,double precision,double precision,double precision,timestamptz,uuid) to authenticated;
grant execute on function public.get_guard_location_state() to authenticated;
grant execute on function public.get_agency_live_locations() to authenticated;
grant execute on function public.get_platform_live_locations() to authenticated;
grant execute on function public.get_mission_route_history(uuid) to authenticated;
