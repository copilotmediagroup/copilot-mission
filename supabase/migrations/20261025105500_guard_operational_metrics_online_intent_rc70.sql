-- RC70: Guard duty metrics must follow durable online intent as well as presence history.
-- Developer Live Account Test and production guard metrics share this engine.
create or replace function public.get_guard_operational_metrics_for_guard_rc1(p_guard_id uuid)
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
  v_jobs_today integer:=0;
  v_on_duty_seconds bigint:=0;
  v_cursor timestamptz;
  v_online_since timestamptz:=null;
  v_event record;
begin
  select * into v_guard from public.guards where id=p_guard_id;
  if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND'; end if;

  select operational_timezone into v_timezone from public.agencies where id=v_guard.agency_id;
  if v_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then raise exception 'AGENCY_TIMEZONE_INVALID'; end if;

  v_local_day:=date_trunc('day',now() at time zone v_timezone);
  v_day_start:=v_local_day at time zone v_timezone;
  v_day_end:=(v_local_day+interval '1 day') at time zone v_timezone;

  select count(*)::integer into v_jobs_today
  from public.job_assignments
  where guard_id=p_guard_id and status='completed' and completed_at is not null
    and completed_at>=v_day_start and completed_at<v_day_end;

  select e.next_availability into v_event
  from public.guard_presence_events e
  where e.guard_id=p_guard_id and e.created_at<v_day_start
  order by e.created_at desc limit 1;
  if found and v_event.next_availability<>'offline' then v_online_since:=v_day_start; end if;

  for v_event in
    select previous_availability,next_availability,created_at
    from public.guard_presence_events
    where guard_id=p_guard_id and created_at>=v_day_start and created_at<v_day_end
    order by created_at asc
  loop
    if v_event.previous_availability='offline' and v_event.next_availability<>'offline' then
      if v_online_since is null then v_online_since:=greatest(v_event.created_at,v_day_start); end if;
    elsif v_event.next_availability='offline' then
      if v_online_since is not null then
        v_cursor:=least(v_event.created_at,now(),v_day_end);
        if v_cursor>v_online_since then v_on_duty_seconds:=v_on_duty_seconds+extract(epoch from (v_cursor-v_online_since))::bigint; end if;
        v_online_since:=null;
      end if;
    end if;
  end loop;

  -- RC68 made online_intent authoritative. If the guard is intentionally online but
  -- no current-day presence transition exists (for example after switching Developer
  -- roles/pages), count duty from today's best durable online anchor instead of 0.
  if v_guard.online_intent and v_guard.availability<>'offline' and v_online_since is null then
    select greatest(coalesce(max(e.created_at),v_day_start),v_day_start) into v_online_since
    from public.guard_presence_events e
    where e.guard_id=p_guard_id and e.next_availability<>'offline' and e.created_at<now();
    if v_online_since is null or v_online_since<v_day_start then v_online_since:=v_day_start; end if;
  end if;

  if v_online_since is not null then
    v_cursor:=least(now(),v_day_end);
    if v_cursor>v_online_since then v_on_duty_seconds:=v_on_duty_seconds+extract(epoch from (v_cursor-v_online_since))::bigint; end if;
  end if;

  return jsonb_build_object('guard_id',p_guard_id,'jobs_today',v_jobs_today,'on_duty_seconds',greatest(v_on_duty_seconds,0),'operational_timezone',v_timezone,'day_started_at',v_day_start,'day_ends_at',v_day_end,'generated_at',now());
end $$;

revoke all on function public.get_guard_operational_metrics_for_guard_rc1(uuid) from public;
grant execute on function public.get_guard_operational_metrics_for_guard_rc1(uuid) to authenticated;
