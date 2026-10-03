begin;

-- ============================================================
-- Co Pilot Security Marketplace
-- Gate 19M-B6 — Guard Operational Metrics
--
-- Database authority for:
--   * Agency operational timezone
--   * Jobs Today
--   * On Duty Today
--
-- Patrol Readiness is intentionally NOT invented here.
-- ============================================================

-- ------------------------------------------------------------
-- Agency operational timezone authority
--
-- Existing agencies are Florida-based today, therefore the
-- initial operational default is America/New_York.
--
-- The value is stored as an IANA timezone name so future
-- agencies may own their correct operating timezone without
-- changing this metrics engine.
-- ------------------------------------------------------------

alter table public.agencies
  add column if not exists operational_timezone text;

update public.agencies
set operational_timezone='America/New_York'
where operational_timezone is null
   or btrim(operational_timezone)='';

alter table public.agencies
  alter column operational_timezone
  set default 'America/New_York';

alter table public.agencies
  alter column operational_timezone
  set not null;


-- ------------------------------------------------------------
-- Guard operational metrics authority
-- ------------------------------------------------------------

create or replace function public.get_guard_operational_metrics_rc1()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_timezone text;
  v_local_day timestamp without time zone;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_jobs_today integer := 0;
  v_on_duty_seconds bigint := 0;
  v_cursor timestamptz;
  v_online_since timestamptz := null;
  v_event record;
begin

  -- Authenticated guard owns the metric request.
  select *
  into v_guard
  from public.guards
  where user_id=auth.uid();

  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND'
      using errcode='42501';
  end if;


  -- ----------------------------------------------------------
  -- Agency owns operational calendar time.
  -- ----------------------------------------------------------

  select a.operational_timezone
  into v_timezone
  from public.agencies a
  where a.id=v_guard.agency_id;

  if v_timezone is null or btrim(v_timezone)='' then
    raise exception 'AGENCY_TIMEZONE_NOT_CONFIGURED'
      using errcode='22023';
  end if;

  -- Validate against PostgreSQL's IANA timezone catalog.
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names tz
    where tz.name=v_timezone
  ) then
    raise exception 'AGENCY_TIMEZONE_INVALID: %',v_timezone
      using errcode='22023';
  end if;


  -- ----------------------------------------------------------
  -- Resolve the agency-local calendar day into absolute
  -- timestamptz boundaries.
  --
  -- Example:
  -- America/New_York midnight -> its correct UTC instant.
  -- PostgreSQL timezone rules also own DST transitions.
  -- ----------------------------------------------------------

  v_local_day :=
    date_trunc(
      'day',
      now() at time zone v_timezone
    );

  v_day_start :=
    v_local_day at time zone v_timezone;

  v_day_end :=
    (v_local_day + interval '1 day')
      at time zone v_timezone;


  -- ----------------------------------------------------------
  -- Jobs Today
  --
  -- Count completed assignments owned by this guard whose
  -- authoritative completion timestamp belongs to the
  -- agency-local operational day.
  -- ----------------------------------------------------------

  select count(*)::integer
  into v_jobs_today
  from public.job_assignments ja
  where ja.guard_id=v_guard.id
    and ja.status='completed'
    and ja.completed_at is not null
    and ja.completed_at >= v_day_start
    and ja.completed_at < v_day_end;


  -- ----------------------------------------------------------
  -- On Duty Today
  --
  -- Presence event history is authoritative.
  --
  -- Determine whether the guard crossed today's agency-local
  -- midnight already online.
  -- ----------------------------------------------------------

  select e.next_availability
  into v_event
  from public.guard_presence_events e
  where e.guard_id=v_guard.id
    and e.created_at < v_day_start
  order by e.created_at desc
  limit 1;

  if found and v_event.next_availability <> 'offline' then
    v_online_since := v_day_start;
  end if;


  -- Replay today's authoritative presence transitions.
  --
  -- offline -> non-offline opens a duty interval.
  -- transition to offline closes it.
  -- available/reserved/on_mission are all duty states.

  for v_event in
    select
      e.previous_availability,
      e.next_availability,
      e.created_at
    from public.guard_presence_events e
    where e.guard_id=v_guard.id
      and e.created_at >= v_day_start
      and e.created_at < v_day_end
    order by e.created_at asc
  loop

    if v_event.previous_availability='offline'
       and v_event.next_availability<>'offline'
    then

      if v_online_since is null then
        v_online_since :=
          greatest(v_event.created_at,v_day_start);
      end if;


    elsif v_event.next_availability='offline' then

      if v_online_since is not null then
        v_cursor :=
          least(v_event.created_at,now(),v_day_end);

        if v_cursor > v_online_since then
          v_on_duty_seconds :=
            v_on_duty_seconds +
            extract(
              epoch from (v_cursor-v_online_since)
            )::bigint;
        end if;

        v_online_since := null;
      end if;

    end if;

  end loop;


  -- Guard is still online: close the open interval at now().
  if v_online_since is not null then

    v_cursor :=
      least(now(),v_day_end);

    if v_cursor > v_online_since then
      v_on_duty_seconds :=
        v_on_duty_seconds +
        extract(
          epoch from (v_cursor-v_online_since)
        )::bigint;
    end if;

  end if;


  return jsonb_build_object(
    'guard_id',v_guard.id,
    'jobs_today',v_jobs_today,
    'on_duty_seconds',greatest(v_on_duty_seconds,0),
    'operational_timezone',v_timezone,
    'day_started_at',v_day_start,
    'day_ends_at',v_day_end,
    'generated_at',now()
  );

end;
$$;


revoke all
on function public.get_guard_operational_metrics_rc1()
from public;

grant execute
on function public.get_guard_operational_metrics_rc1()
to authenticated;

commit;
