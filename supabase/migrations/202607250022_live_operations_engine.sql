-- Live Operations Engine v1.0
-- Platform observability authority. Existing domain engines remain business-rule owners.

create or replace function public.get_live_operations_center()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_now timestamptz := now();
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'platform_admin'::public.app_role then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  return jsonb_build_object(
    'generated_at', v_now,
    'summary', jsonb_build_object(
      'marketplace_open', (select count(*) from public.marketplace_jobs where status='open'),
      'missions_live', (select count(*) from public.marketplace_jobs where status in ('accepted','assigned','active')),
      'guards_online', (select count(*) from public.guards where availability <> 'offline'),
      'guards_available', (select count(*) from public.guards where availability='available'),
      'guards_driving', (select count(*) from public.mission_engine_state where state='en_route'),
      'completed_today', (select count(*) from public.marketplace_jobs where status='completed' and updated_at >= date_trunc('day',v_now)),
      'reports_pending', (select count(*) from public.mission_reports where status in ('pending_review','clarification_requested')),
      'reports_published', (select count(*) from public.mission_reports where status='published'),
      'emergencies_live', (select count(*) from public.marketplace_jobs where priority='emergency' and status not in ('completed','cancelled')),
      'priority_live', (select count(*) from public.marketplace_jobs where priority='priority' and status not in ('completed','cancelled'))
    ),
    'health', jsonb_build_object(
      'database', 'healthy',
      'realtime', 'connected',
      'mission_engine', case when to_regclass('public.mission_engine_state') is not null then 'healthy' else 'unavailable' end,
      'reporting_engine', case when to_regclass('public.mission_reports') is not null then 'healthy' else 'unavailable' end,
      'guard_presence', case when to_regclass('public.guard_presence_events') is not null then 'healthy' else 'unavailable' end,
      'storage', 'not_configured',
      'gps', case when exists(select 1 from public.guards where last_location_at is not null) then 'receiving' else 'awaiting_signal' end,
      'notifications', 'not_configured'
    ),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',j.id,'title',j.title,'status',j.status,'priority',j.priority,'updated_at',j.updated_at,
        'property_name',pr.name,'property_address',pr.address,'property_latitude',pr.latitude,'property_longitude',pr.longitude,
        'client_name',c.display_name,'agency_name',a.name,'guard_name',gp.full_name,
        'engine_state',me.state,'checkpoint_index',me.checkpoint_index,'assignment_status',ja.status,
        'report_status',mr.status
      ) order by j.updated_at desc)
      from public.marketplace_jobs j
      join public.properties pr on pr.id=j.property_id
      join public.clients c on c.id=j.client_id
      left join public.agencies a on a.id=j.accepted_agency_id
      left join public.job_assignments ja on ja.job_id=j.id
      left join public.guards g on g.id=ja.guard_id
      left join public.profiles gp on gp.id=g.user_id
      left join public.mission_engine_state me on me.job_id=j.id
      left join public.mission_reports mr on mr.job_id=j.id
    ),'[]'::jsonb),
    'guards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'name',coalesce(p.full_name,'Guard'),'agency_name',a.name,'availability',g.availability,
        'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at,
        'location_freshness',case when g.last_location_at is null then 'none' when g.last_location_at >= v_now-interval '2 minutes' then 'live' when g.last_location_at >= v_now-interval '10 minutes' then 'stale' else 'expired' end
      ) order by g.created_at desc)
      from public.guards g join public.profiles p on p.id=g.user_id join public.agencies a on a.id=g.agency_id
    ),'[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'job_id',x.job_id,'event_type',x.event_type,'payload',x.payload,'created_at',x.created_at,
        'mission_title',j.title,'actor_name',coalesce(p.full_name,'System')
      ) order by x.created_at desc)
      from (select * from public.mission_events order by created_at desc limit 150) x
      join public.marketplace_jobs j on j.id=x.job_id
      left join public.profiles p on p.id=x.actor_user_id
    ),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_live_operations_center() to authenticated;
