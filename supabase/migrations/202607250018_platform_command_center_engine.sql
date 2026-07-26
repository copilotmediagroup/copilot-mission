-- Platform Admin Command Center Engine
-- Read-only observability authority over existing operational engines.

create or replace function public.get_platform_command_center()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'platform_admin'::public.app_role then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'summary', jsonb_build_object(
      'agencies_total', (select count(*) from public.agencies),
      'agencies_pending', (select count(*) from public.agencies where status = 'pending'),
      'clients_total', (select count(*) from public.clients c join public.profiles cp on cp.id=c.user_id where cp.role='client'::public.app_role),
      'properties_total', (select count(*) from public.properties),
      'guards_total', (select count(*) from public.guards),
      'guards_online', (select count(*) from public.guards where availability <> 'offline'),
      'guards_available', (select count(*) from public.guards where availability = 'available'),
      'missions_open', (select count(*) from public.marketplace_jobs where status = 'open'),
      'missions_live', (select count(*) from public.marketplace_jobs where status in ('accepted','assigned','active')),
      'missions_completed', (select count(*) from public.marketplace_jobs where status = 'completed'),
      'emergencies_live', (select count(*) from public.marketplace_jobs where priority = 'emergency' and status not in ('completed','cancelled'))
    ),
    'agencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'status', a.status,
        'license_number', a.license_number,
        'service_radius_miles', a.service_radius_miles,
        'created_at', a.created_at,
        'owner_name', p.full_name,
        'owner_status', p.account_status,
        'guard_count', (select count(*) from public.guards g where g.agency_id = a.id),
        'online_guard_count', (select count(*) from public.guards g where g.agency_id = a.id and g.availability <> 'offline'),
        'live_mission_count', (select count(*) from public.marketplace_jobs j where j.accepted_agency_id = a.id and j.status in ('accepted','assigned','active')),
        'completed_mission_count', (select count(*) from public.marketplace_jobs j where j.accepted_agency_id = a.id and j.status = 'completed')
      ) order by a.created_at desc)
      from public.agencies a
      left join public.profiles p on p.id = a.owner_user_id
    ), '[]'::jsonb),
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'address', pr.address,
        'latitude', pr.latitude,
        'longitude', pr.longitude,
        'photo_url', to_jsonb(pr)->>'photo_url',
        'created_at', pr.created_at,
        'client_id', c.id,
        'client_name', c.display_name
      ) order by pr.created_at desc)
      from public.properties pr
      join public.clients c on c.id = pr.client_id
    ), '[]'::jsonb),
    'guards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', coalesce(p.full_name, 'Guard'),
        'badge_number', g.badge_number,
        'availability', g.availability,
        'agency_id', a.id,
        'agency_name', a.name,
        'latitude', g.current_latitude,
        'longitude', g.current_longitude,
        'last_location_at', g.last_location_at,
        'created_at', g.created_at
      ) order by g.created_at desc)
      from public.guards g
      join public.agencies a on a.id = g.agency_id
      join public.profiles p on p.id = g.user_id
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'status', j.status,
        'priority', j.priority,
        'scheduled_for', j.scheduled_for,
        'created_at', j.created_at,
        'updated_at', j.updated_at,
        'property_name', pr.name,
        'property_address', pr.address,
        'client_name', c.display_name,
        'agency_id', a.id,
        'agency_name', a.name,
        'guard_id', g.id,
        'guard_name', gp.full_name,
        'assignment_status', ja.status,
        'engine_state', me.state,
        'checkpoint_index', me.checkpoint_index,
        'engine_version', me.version
      ) order by j.created_at desc)
      from public.marketplace_jobs j
      join public.properties pr on pr.id = j.property_id
      join public.clients c on c.id = j.client_id
      left join public.agencies a on a.id = j.accepted_agency_id
      left join public.job_assignments ja on ja.job_id = j.id
      left join public.guards g on g.id = ja.guard_id
      left join public.profiles gp on gp.id = g.user_id
      left join public.mission_engine_state me on me.job_id = j.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'job_id', e.job_id,
        'event_type', e.event_type,
        'payload', e.payload,
        'created_at', e.created_at,
        'mission_title', j.title,
        'actor_name', p.full_name
      ) order by e.created_at desc)
      from (select * from public.mission_events order by created_at desc limit 100) e
      join public.marketplace_jobs j on j.id = e.job_id
      left join public.profiles p on p.id = e.actor_user_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_platform_command_center() to authenticated;
