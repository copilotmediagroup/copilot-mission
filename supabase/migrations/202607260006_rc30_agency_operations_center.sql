-- Co Pilot Security Marketplace OS RC3.0 — Agency Operations Center
-- One database-owned projection for agency guards, missions, incidents, events, and operational KPIs.
begin;

create or replace function public.get_agency_operations_center_rc30()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_agency_id uuid;
  v_name text;
  v_status public.agency_status;
  v_guards jsonb;
  v_missions jsonb;
  v_events jsonb;
  v_kpis jsonb;
begin
  select agency_id,agency_name,agency_status
    into v_agency_id,v_name,v_status
  from public.resolve_my_agency_workspace();

  if v_agency_id is null or v_status <> 'approved' then
    raise exception 'AGENCY_NOT_APPROVED: Approved Agency required.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,
    'user_id',g.user_id,
    'name',coalesce(p.full_name,'Guard'),
    'badge_number',g.badge_number,
    'availability',g.availability,
    'latitude',g.current_latitude,
    'longitude',g.current_longitude,
    'last_location_at',g.last_location_at,
    'freshness',case
      when g.availability='offline' then 'offline'
      when g.last_location_at is null then 'waiting'
      when g.last_location_at > now()-interval '90 seconds' then 'live'
      when g.last_location_at > now()-interval '10 minutes' then 'stale'
      else 'expired'
    end,
    'active_job_id',active_assignment.job_id,
    'active_mission_state',active_state.state
  ) order by p.full_name),'[]'::jsonb)
  into v_guards
  from public.guards g
  join public.profiles p on p.id=g.user_id
  left join lateral (
    select ja.job_id from public.job_assignments ja
    where ja.guard_id=g.id and ja.status in ('offered','accepted','en_route','arrived','active')
    order by ja.assigned_at desc limit 1
  ) active_assignment on true
  left join public.mission_engine_state active_state on active_state.job_id=active_assignment.job_id
  where g.agency_id=v_agency_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'job_id',j.id,
    'assignment_id',ja.id,
    'title',j.title,
    'priority',j.priority,
    'marketplace_status',j.status,
    'state',coalesce(ms.state,case
      when ja.status='arrived' then 'active'
      else ja.status
    end),
    'checkpoint_index',coalesce(ms.checkpoint_index,0),
    'required_checkpoints',6,
    'instructions',j.instructions,
    'scheduled_for',j.scheduled_for,
    'duration_minutes',j.duration_minutes,
    'assigned_at',ja.assigned_at,
    'route_started_at',ms.route_started_at,
    'arrived_at',ms.arrived_at,
    'mission_started_at',ms.mission_started_at,
    'completed_at',coalesce(ms.completed_at,ja.completed_at),
    'updated_at',coalesce(ms.updated_at,j.updated_at),
    'property',jsonb_build_object(
      'name',pr.name,'address',coalesce(pr.formatted_address,pr.address),
      'latitude',pr.latitude,'longitude',pr.longitude,'photo_url',pr.photo_url
    ),
    'client',jsonb_build_object('display_name',c.display_name),
    'guard',case when g.id is null then null else jsonb_build_object(
      'id',g.id,'name',coalesce(gp.full_name,'Guard'),'availability',g.availability,
      'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at
    ) end,
    'incident_count',jsonb_array_length(coalesce(ms.incidents,'[]'::jsonb)),
    'evidence_count',jsonb_array_length(coalesce(ms.evidence,'[]'::jsonb))
  ) order by
    case j.priority when 'emergency' then 0 when 'priority' then 1 else 2 end,
    coalesce(ms.updated_at,j.updated_at) desc),'[]'::jsonb)
  into v_missions
  from public.job_assignments ja
  join public.marketplace_jobs j on j.id=ja.job_id
  join public.properties pr on pr.id=j.property_id
  join public.clients c on c.id=j.client_id
  left join public.mission_engine_state ms on ms.job_id=j.id
  left join public.guards g on g.id=ja.guard_id
  left join public.profiles gp on gp.id=g.user_id
  where ja.agency_id=v_agency_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',me.id,'job_id',me.job_id,'event_type',me.event_type,
    'payload',me.payload,'created_at',me.created_at,
    'title',j.title,'priority',j.priority,
    'property_name',pr.name,'property_address',coalesce(pr.formatted_address,pr.address)
  ) order by me.created_at desc),'[]'::jsonb)
  into v_events
  from public.mission_events me
  join public.job_assignments ja on ja.job_id=me.job_id and ja.agency_id=v_agency_id
  join public.marketplace_jobs j on j.id=me.job_id
  join public.properties pr on pr.id=j.property_id
  where me.created_at > now()-interval '14 days';

  select jsonb_build_object(
    'total_guards',(select count(*) from public.guards where agency_id=v_agency_id),
    'online_guards',(select count(*) from public.guards where agency_id=v_agency_id and availability<>'offline'),
    'available_guards',(select count(*) from public.guards where agency_id=v_agency_id and availability='available'),
    'active_missions',(select count(*) from public.mission_engine_state where agency_id=v_agency_id and state in ('offered','accepted','en_route','active','checkpoint','review')),
    'awaiting_guard',(select count(*) from public.mission_engine_state where agency_id=v_agency_id and state='awaiting_guard'),
    'emergencies',(select count(*) from public.mission_engine_state ms join public.marketplace_jobs j on j.id=ms.job_id where ms.agency_id=v_agency_id and j.priority='emergency' and ms.state not in ('completed','cancelled')),
    'incidents',(select coalesce(sum(jsonb_array_length(coalesce(incidents,'[]'::jsonb))),0) from public.mission_engine_state where agency_id=v_agency_id and state not in ('completed','cancelled'))
  ) into v_kpis;

  return jsonb_build_object(
    'agency',jsonb_build_object('id',v_agency_id,'name',v_name),
    'generated_at',now(),
    'kpis',v_kpis,
    'guards',v_guards,
    'missions',v_missions,
    'events',v_events
  );
end;
$$;

revoke all on function public.get_agency_operations_center_rc30() from public;
grant execute on function public.get_agency_operations_center_rc30() to authenticated;

commit;
