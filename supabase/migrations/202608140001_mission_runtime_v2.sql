-- ============================================================
-- Co Pilot Security Marketplace
-- Mission Runtime V2
--
-- Canonical server-side read authority for one mission.
--
-- Identity:
--   marketplace_jobs.id === canonical mission job_id
--
-- This RPC does NOT transition mission state.
-- Existing Mission Engine remains authoritative for writes.
-- ============================================================

begin;


create or replace function public.get_mission_runtime_v2(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();

  v_role public.app_role;

  v_job public.marketplace_jobs;
  v_assignment public.job_assignments;
  v_engine public.mission_engine_state;

  v_client public.clients;
  v_property public.properties;
  v_agency public.agencies;
  v_guard public.guards;
  v_guard_profile public.profiles;

  v_latest_location public.guard_location_events;

  v_state text;
  v_version bigint := 0;

  v_authorized boolean := false;

  v_timeline jsonb := '[]'::jsonb;

  v_location_freshness text := 'none';

  v_assigned_at timestamptz;
  v_accepted_at timestamptz;
  v_route_started_at timestamptz;
  v_arrived_at timestamptz;
  v_completed_at timestamptz;

begin

  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED'
      using errcode = '42501';
  end if;


  -- ----------------------------------------------------------
  -- 1. Canonical job
  -- ----------------------------------------------------------

  select *
  into v_job
  from public.marketplace_jobs
  where id = p_job_id;

  if v_job.id is null then
    raise exception 'MISSION_NOT_FOUND'
      using errcode = '22023';
  end if;


  -- ----------------------------------------------------------
  -- 2. Viewer role
  -- ----------------------------------------------------------

  select role
  into v_role
  from public.profiles
  where id = v_user_id;

  if v_role is null then
    raise exception 'PROFILE_NOT_FOUND'
      using errcode = '42501';
  end if;


  -- ----------------------------------------------------------
  -- 3. Mission relationships
  -- ----------------------------------------------------------

  select *
  into v_client
  from public.clients
  where id = v_job.client_id;


  select *
  into v_property
  from public.properties
  where id = v_job.property_id;


  select *
  into v_assignment
  from public.job_assignments
  where job_id = v_job.id;


  if v_assignment.id is not null then

    select *
    into v_agency
    from public.agencies
    where id = v_assignment.agency_id;


    if v_assignment.guard_id is not null then

      select *
      into v_guard
      from public.guards
      where id = v_assignment.guard_id;


      if v_guard.id is not null then
        select *
        into v_guard_profile
        from public.profiles
        where id = v_guard.user_id;
      end if;

    end if;

  elsif v_job.accepted_agency_id is not null then

    select *
    into v_agency
    from public.agencies
    where id = v_job.accepted_agency_id;

  end if;


  -- ----------------------------------------------------------
  -- 4. Authorization
  --
  -- Platform:
  --   any mission
  --
  -- Client:
  --   own mission
  --
  -- Agency admin:
  --   mission accepted/assigned to own agency
  --
  -- Guard:
  --   mission assigned to that guard
  -- ----------------------------------------------------------

  if v_role = 'platform_admin' then

    v_authorized := true;


  elsif v_role = 'client' then

    v_authorized :=
      v_client.user_id = v_user_id;


  elsif v_role = 'agency_admin' then

    v_authorized := exists (
      select 1
      from public.agency_members am
      where am.user_id = v_user_id
        and am.is_active = true
        and am.role = 'agency_admin'
        and am.agency_id = coalesce(
          v_assignment.agency_id,
          v_job.accepted_agency_id
        )
    );


  elsif v_role = 'guard' then

    v_authorized :=
      v_guard.user_id = v_user_id;

  end if;


  if not v_authorized then
    raise exception 'MISSION_RUNTIME_ACCESS_DENIED'
      using errcode = '42501';
  end if;


  -- ----------------------------------------------------------
  -- 5. Mission Engine authority
  --
  -- Do not create engine state here.
  -- This is a READ RPC.
  -- ----------------------------------------------------------

  select *
  into v_engine
  from public.mission_engine_state
  where job_id = v_job.id;


  -- Runtime state preference:
  --
  -- mission_engine_state
  --        ↓
  -- job_assignments
  --        ↓
  -- marketplace job lifecycle
  --
  -- Marketplace "accepted" without a guard means
  -- awaiting_guard at runtime.
  -- ----------------------------------------------------------

  if v_engine.job_id is not null then

    v_state := v_engine.state;
    v_version := v_engine.version;

  elsif v_assignment.id is not null then

    v_state :=
      case
        when v_assignment.status = 'arrived'
          then 'active'
        else v_assignment.status
      end;

  else

    v_state :=
      case v_job.status
        when 'open' then 'awaiting_guard'
        when 'accepted' then 'awaiting_guard'
        when 'assigned' then 'offered'
        when 'active' then 'active'
        when 'completed' then 'completed'
        when 'cancelled' then 'cancelled'
        else 'awaiting_guard'
      end;

  end if;


  -- ----------------------------------------------------------
  -- 6. Runtime timestamps
  -- ----------------------------------------------------------

  v_assigned_at :=
    case
      when v_assignment.id is null
        then null
      else v_assignment.assigned_at
    end;


  v_accepted_at :=
    case
      when v_assignment.id is null
        then null
      else v_assignment.accepted_at
    end;


  v_route_started_at :=
    case
      when v_engine.job_id is null
        then null
      else v_engine.route_started_at
    end;


  v_arrived_at :=
    case
      when v_engine.job_id is null
        then null
      else v_engine.arrived_at
    end;


  v_completed_at :=
    coalesce(
      case
        when v_engine.job_id is null
          then null
        else v_engine.completed_at
      end,

      case
        when v_assignment.id is null
          then null
        else v_assignment.completed_at
      end
    );


  -- ----------------------------------------------------------
  -- 7. Latest mission-aware guard GPS
  --
  -- Prefer location explicitly published against this job.
  -- Fall back to latest event for the assigned guard so
  -- accepted missions can establish route origin.
  -- ----------------------------------------------------------

  if v_guard.id is not null then

    select gle.*
    into v_latest_location
    from public.guard_location_events gle
    where gle.guard_id = v_guard.id
      and (
        gle.job_id = v_job.id
        or gle.job_id is null
      )
    order by
      case when gle.job_id = v_job.id then 0 else 1 end,
      gle.recorded_at desc
    limit 1;


    if v_latest_location.id is not null then

      v_location_freshness :=
        case
          when v_latest_location.recorded_at >= now() - interval '2 minutes'
            then 'live'

          when v_latest_location.recorded_at >= now() - interval '10 minutes'
            then 'stale'

          else 'expired'
        end;

    end if;

  end if;


  -- ----------------------------------------------------------
  -- 8. Complete mission timeline
  -- ----------------------------------------------------------

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', me.id,
        'jobId', me.job_id,
        'type', me.event_type,
        'createdAt', me.created_at,
        'payload', me.payload
      )
      order by me.created_at asc, me.id asc
    ),
    '[]'::jsonb
  )
  into v_timeline
  from public.mission_events me
  where me.job_id = v_job.id;


  -- ----------------------------------------------------------
  -- 9. Canonical MissionRuntime JSON
  -- ----------------------------------------------------------

  return jsonb_build_object(

    'jobId',
    v_job.id,

    'assignmentId',
    case
      when v_assignment.id is null then null
      else v_assignment.id
    end,

    'state',
    v_state,

    'version',
    v_version,

    'priority',
    v_job.priority,

    'title',
    v_job.title,

    'instructions',
    v_job.instructions,


    'client',
    jsonb_build_object(
      'id',
      v_client.id,

      'name',
      v_client.display_name
    ),


    'agency',
    case
      when v_agency.id is null then null

      else jsonb_build_object(
        'id',
        v_agency.id,

        'name',
        v_agency.name
      )
    end,


    'guard',
    case
      when v_guard.id is null then null

      else jsonb_build_object(
        'id',
        v_guard.id,

        'name',
        coalesce(
          v_guard_profile.full_name,
          'Guard'
        ),

        'badgeNumber',
        v_guard.badge_number,

        'availability',
        v_guard.availability
      )
    end,


    'property',
    jsonb_build_object(
      'id',
      v_property.id,

      'name',
      v_property.name,

      'address',
      coalesce(
        to_jsonb(v_property)->>'formatted_address',
        v_property.address
      ),

      'latitude',
      v_property.latitude,

      'longitude',
      v_property.longitude,

      'photoUrl',
      to_jsonb(v_property)->>'photo_url'
    ),


    'guardLocation',
    case
      when v_latest_location.id is null then null

      else jsonb_build_object(
        'latitude',
        v_latest_location.latitude,

        'longitude',
        v_latest_location.longitude,

        'heading',
        v_latest_location.heading_degrees,

        'accuracy',
        v_latest_location.accuracy_meters,

        'updatedAt',
        v_latest_location.recorded_at,

        'freshness',
        v_location_freshness
      )
    end,


    'timestamps',
    jsonb_build_object(

      'createdAt',
      v_job.created_at,

      'assignedAt',
      v_assigned_at,

      'acceptedAt',
      v_accepted_at,

      'routeStartedAt',
      v_route_started_at,

      'arrivedAt',
      v_arrived_at,

      'completedAt',
      v_completed_at,

      'updatedAt',
      coalesce(
        case
          when v_engine.job_id is null
            then null
          else v_engine.updated_at
        end,
        v_job.updated_at
      )
    ),


    'checkpointIndex',
    case
      when v_engine.job_id is null then 0
      else coalesce(v_engine.checkpoint_index, 0)
    end,

    'evidence',
    case
      when v_engine.job_id is null then '[]'::jsonb
      else coalesce(v_engine.evidence, '[]'::jsonb)
    end,

    'incidents',
    case
      when v_engine.job_id is null then '[]'::jsonb
      else coalesce(v_engine.incidents, '[]'::jsonb)
    end,

    'missionStartedAt',
    case
      when v_engine.job_id is null then null
      else v_engine.mission_started_at
    end,

    'timeline',
    v_timeline
  );

end;
$$;


revoke all
on function public.get_mission_runtime_v2(uuid)
from public;


grant execute
on function public.get_mission_runtime_v2(uuid)
to authenticated;


comment on function public.get_mission_runtime_v2(uuid)
is
'Mission Runtime V2 canonical read authority. Returns one normalized mission graph keyed by marketplace_jobs.id.';


commit;
