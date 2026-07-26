-- Co Pilot Security Marketplace OS — RC2.1B Mission Authority Consolidation
-- One authoritative Guard daily summary sourced from mission, checkpoint, and presence engines.
begin;

create or replace function public.get_guard_daily_summary_rc21b(p_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_timezone text := coalesce(nullif(trim(p_timezone),''),'UTC');
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_jobs integer := 0;
  v_checkins integer := 0;
  v_duty_seconds bigint := 0;
begin
  select * into v_guard from public.guards where user_id=auth.uid();
  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501';
  end if;

  begin
    perform now() at time zone v_timezone;
  exception when others then
    v_timezone := 'UTC';
  end;

  v_day_start := date_trunc('day', now() at time zone v_timezone) at time zone v_timezone;
  v_day_end := v_day_start + interval '1 day';

  select count(*)::integer into v_jobs
  from public.mission_engine_state
  where guard_id=v_guard.id
    and state='completed'
    and completed_at>=v_day_start
    and completed_at<v_day_end;

  select count(*)::integer into v_checkins
  from public.patrol_checkpoint_completions
  where guard_id=v_guard.id
    and completed_at>=v_day_start
    and completed_at<v_day_end;

  with seed as (
    select coalesce((
      select next_availability
      from public.guard_presence_events
      where guard_id=v_guard.id and created_at<v_day_start
      order by created_at desc limit 1
    ), 'offline') as next_availability,
    v_day_start as created_at
  ), changes as (
    select next_availability, created_at
    from public.guard_presence_events
    where guard_id=v_guard.id and created_at>=v_day_start and created_at<v_day_end
    union all
    select next_availability, created_at from seed
  ), spans as (
    select next_availability, created_at,
      lead(created_at,1,least(now(),v_day_end)) over(order by created_at) as ended_at
    from changes
  )
  select coalesce(sum(extract(epoch from (ended_at-created_at))),0)::bigint into v_duty_seconds
  from spans where next_availability<>'offline';

  return jsonb_build_object(
    'guard_id',v_guard.id,
    'jobs_today',v_jobs,
    'check_ins_today',v_checkins,
    'on_duty_seconds',greatest(v_duty_seconds,0),
    'timezone',v_timezone,
    'day_started_at',v_day_start,
    'generated_at',now()
  );
end;
$$;

revoke all on function public.get_guard_daily_summary_rc21b(text) from public;
grant execute on function public.get_guard_daily_summary_rc21b(text) to authenticated;

-- Checkpoint changes must be available to the Guard summary subscription.
do $$
begin
  alter publication supabase_realtime add table public.patrol_checkpoint_completions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
