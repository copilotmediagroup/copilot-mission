-- Co Pilot Security Marketplace v3.6 — Guard Operational State Engine
-- One authoritative guard state and route-eligibility contract for every agency surface.
begin;

create or replace function public.guard_location_freshness_rc36(
  p_availability text,
  p_last_location_at timestamptz
) returns text
language sql
stable
as $$
  select case
    when p_availability = 'offline' then 'offline'
    when p_last_location_at is null then 'waiting'
    when p_last_location_at >= now() - interval '2 minutes' then 'live'
    when p_last_location_at >= now() - interval '10 minutes' then 'stale'
    else 'expired'
  end
$$;

create or replace function public.guard_operational_state_rc36(
  p_availability text,
  p_last_location_at timestamptz,
  p_latitude double precision,
  p_longitude double precision
) returns text
language sql
stable
as $$
  select case
    when p_availability = 'offline' then 'offline'
    when p_availability = 'on_mission' then 'on_mission'
    when p_availability = 'reserved' then 'reserved'
    when p_latitude is null or p_longitude is null or p_last_location_at is null then 'online_unavailable'
    when p_last_location_at < now() - interval '10 minutes' then 'gps_stale'
    else 'available'
  end
$$;

create or replace function public.guard_route_eligibility_reason_rc36(
  p_availability text,
  p_last_location_at timestamptz,
  p_latitude double precision,
  p_longitude double precision
) returns text
language sql
stable
as $$
  select case
    when p_availability = 'offline' then 'GUARD_OFFLINE'
    when p_availability = 'reserved' then 'GUARD_RESERVED'
    when p_availability = 'on_mission' then 'GUARD_ON_MISSION'
    when p_latitude is null or p_longitude is null then 'GPS_COORDINATES_MISSING'
    when p_last_location_at is null then 'GPS_WAITING'
    when p_last_location_at < now() - interval '10 minutes' then 'GPS_EXPIRED'
    else null
  end
$$;

create or replace function public.get_agency_guard_state()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_agency_id uuid;
  v_status public.agency_status;
  v_guards jsonb;
begin
  select agency_id,agency_status into v_agency_id,v_status
  from public.resolve_my_agency_workspace();

  if v_agency_id is null or v_status <> 'approved' then
    raise exception 'AGENCY_NOT_APPROVED' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,
    'user_id',g.user_id,
    'name',coalesce(p.full_name,'Guard'),
    'phone',p.phone,
    'email',u.email,
    'badge_number',g.badge_number,
    'availability',g.availability,
    'operational_state',public.guard_operational_state_rc36(g.availability,g.last_location_at,g.current_latitude,g.current_longitude),
    'route_eligible',(
      g.availability='available'
      and g.current_latitude is not null
      and g.current_longitude is not null
      and g.last_location_at is not null
      and g.last_location_at >= now()-interval '10 minutes'
    ),
    'route_ineligibility_reason',public.guard_route_eligibility_reason_rc36(g.availability,g.last_location_at,g.current_latitude,g.current_longitude),
    'latitude',g.current_latitude,
    'longitude',g.current_longitude,
    'last_location_at',g.last_location_at,
    'freshness',public.guard_location_freshness_rc36(g.availability,g.last_location_at),
    'created_at',g.created_at
  ) order by p.full_name),'[]'::jsonb)
  into v_guards
  from public.guards g
  join public.profiles p on p.id=g.user_id
  join auth.users u on u.id=g.user_id
  where g.agency_id=v_agency_id;

  return jsonb_build_object(
    'guards',v_guards,
    'summary',jsonb_build_object(
      'total',(select count(*) from public.guards where agency_id=v_agency_id),
      'online',(select count(*) from public.guards where agency_id=v_agency_id and availability<>'offline'),
      'offline',(select count(*) from public.guards where agency_id=v_agency_id and availability='offline'),
      'available',(select count(*) from public.guards where agency_id=v_agency_id and public.guard_operational_state_rc36(availability,last_location_at,current_latitude,current_longitude)='available'),
      'reserved',(select count(*) from public.guards where agency_id=v_agency_id and availability='reserved'),
      'on_mission',(select count(*) from public.guards where agency_id=v_agency_id and availability='on_mission'),
      'route_eligible',(select count(*) from public.guards where agency_id=v_agency_id and availability='available' and current_latitude is not null and current_longitude is not null and last_location_at>=now()-interval '10 minutes'),
      'gps_stale',(select count(*) from public.guards where agency_id=v_agency_id and public.guard_operational_state_rc36(availability,last_location_at,current_latitude,current_longitude)='gps_stale'),
      'online_unavailable',(select count(*) from public.guards where agency_id=v_agency_id and public.guard_operational_state_rc36(availability,last_location_at,current_latitude,current_longitude)='online_unavailable')
    )
  );
end;
$$;

revoke all on function public.guard_location_freshness_rc36(text,timestamptz) from public;
revoke all on function public.guard_operational_state_rc36(text,timestamptz,double precision,double precision) from public;
revoke all on function public.guard_route_eligibility_reason_rc36(text,timestamptz,double precision,double precision) from public;
revoke all on function public.get_agency_guard_state() from public;
grant execute on function public.get_agency_guard_state() to authenticated;

commit;
