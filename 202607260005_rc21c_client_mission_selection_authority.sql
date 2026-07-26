-- Co Pilot Security Marketplace OS — RC2.1C Client Mission Selection Authority
-- Replaces recency-based selection with a deterministic lifecycle priority.
begin;

create or replace function public.get_client_live_tracking_experience_rc13()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_client_id uuid;
  v_result jsonb;
begin
  select c.id into v_client_id
  from public.clients c
  where c.user_id=auth.uid()
  limit 1;

  if v_client_id is null then
    raise exception 'CLIENT_PROFILE_REQUIRED' using errcode='42501';
  end if;

  select jsonb_build_object(
    'job_id',j.id,
    'title',j.title,
    'priority',j.priority,
    'job_status',j.status,
    'created_at',j.created_at,
    'scheduled_for',j.scheduled_for,
    'property',jsonb_build_object(
      'id',pr.id,
      'name',pr.name,
      'address',pr.address,
      'photo_url',to_jsonb(pr)->>'photo_url',
      'latitude',pr.latitude,
      'longitude',pr.longitude
    ),
    'agency',case when a.id is null then null else jsonb_build_object(
      'id',a.id,
      'name',a.name
    ) end,
    'guard',case when g.id is null then null else jsonb_build_object(
      'id',g.id,
      'name',coalesce(gp.full_name,'Security professional'),
      'badge_number',g.badge_number,
      'latitude',g.current_latitude,
      'longitude',g.current_longitude,
      'last_location_at',g.last_location_at,
      'freshness',case
        when g.availability='offline' then 'expired'
        when g.last_location_at is null then 'none'
        when g.last_location_at>=now()-interval '2 minutes' then 'live'
        when g.last_location_at>=now()-interval '10 minutes' then 'stale'
        else 'expired'
      end
    ) end,
    'mission',jsonb_build_object(
      'state',coalesce(me.state,case
        when j.status='open' then 'marketplace'
        when j.status='assigned' then 'offered'
        when j.status='completed' then 'completed'
        else j.status::text
      end),
      'checkpoint_index',coalesce(me.checkpoint_index,0),
      'route_started_at',me.route_started_at,
      'arrived_at',me.arrived_at,
      'mission_started_at',me.mission_started_at,
      'completed_at',me.completed_at,
      'updated_at',coalesce(me.updated_at,j.updated_at)
    ),
    'distance_miles',case
      when g.current_latitude is null or g.current_longitude is null or pr.latitude is null or pr.longitude is null then null
      else round((3959 * 2 * asin(sqrt(
        power(sin(radians(pr.latitude-g.current_latitude)/2),2)
        + cos(radians(g.current_latitude))*cos(radians(pr.latitude))
        * power(sin(radians(pr.longitude-g.current_longitude)/2),2)
      )))::numeric,1)
    end,
    'eta_minutes',case
      when me.state='en_route' and g.current_latitude is not null and g.current_longitude is not null and pr.latitude is not null and pr.longitude is not null
      then greatest(1,ceil((3959 * 2 * asin(sqrt(
        power(sin(radians(pr.latitude-g.current_latitude)/2),2)
        + cos(radians(g.current_latitude))*cos(radians(pr.latitude))
        * power(sin(radians(pr.longitude-g.current_longitude)/2),2)
      ))) / 25 * 60)::integer)
      else null
    end,
    'report',case when mr.id is null then null else jsonb_build_object(
      'id',mr.id,
      'status',mr.status,
      'published_at',mr.published_at
    ) end,
    'timeline',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'event_type',e.event_type,
        'created_at',e.created_at,
        'payload',e.payload
      ) order by e.created_at)
      from public.mission_events e
      where e.job_id=j.id
    ),'[]'::jsonb)
  ) into v_result
  from public.marketplace_jobs j
  join public.properties pr on pr.id=j.property_id
  left join lateral (
    select x.* from public.job_assignments x
    where x.job_id=j.id
    order by x.assigned_at desc
    limit 1
  ) ja on true
  left join public.mission_engine_state me on me.job_id=j.id
  left join public.agencies a on a.id=coalesce(me.agency_id,ja.agency_id,j.accepted_agency_id)
  left join public.guards g on g.id=coalesce(me.guard_id,ja.guard_id)
  left join public.profiles gp on gp.id=g.user_id
  left join lateral (
    select r.* from public.mission_reports r
    where r.job_id=j.id
    order by r.published_at desc nulls last, r.created_at desc
    limit 1
  ) mr on true
  where j.client_id=v_client_id
    and j.status<>'cancelled'
  order by
    case
      -- A mission already being fulfilled is the client's primary live experience.
      when coalesce(me.state,'') in ('awaiting_guard','offered','accepted','en_route','active','checkpoint','review')
        or j.status in ('accepted','assigned','active') then 0
      -- A newly requested marketplace job outranks all historical records.
      when j.status='open' and coalesce(me.state,'marketplace') not in ('completed','cancelled') then 1
      -- Completed work is shown only when no live/open work exists.
      when j.status='completed' or me.state='completed' then 2
      else 3
    end,
    case when coalesce(me.state,'') in ('awaiting_guard','offered','accepted','en_route','active','checkpoint','review')
      or j.status in ('accepted','assigned','active') then coalesce(me.updated_at,j.updated_at) end desc nulls last,
    case when j.status='open' then j.created_at end desc nulls last,
    coalesce(me.completed_at,mr.published_at,j.updated_at) desc nulls last
  limit 1;

  return coalesce(v_result,'null'::jsonb);
end;
$$;

revoke all on function public.get_client_live_tracking_experience_rc13() from public;
grant execute on function public.get_client_live_tracking_experience_rc13() to authenticated;

commit;
