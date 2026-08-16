begin;

-- Gate 19M-B5
-- Preserve the Guard Portal timeline after RETURN ONLINE.
--
-- Assignment semantics remain unchanged:
--   * actionable assignments are current
--   * completed assignment remains current only while guard is on_mission
--
-- Timeline semantics are separated from assignment semantics:
--   * current assignment -> current job events
--   * no current assignment -> most recently completed job owned by guard
--
-- This prevents historical timeline visibility from resurrecting a
-- completed assignment as an active/current mission.

create or replace function public.get_guard_dispatch_workspace_rc2()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard public.guards;
  v_assignment public.job_assignments;
  v_history_job_id uuid;
  v_events jsonb;
begin

  select *
  into v_guard
  from public.guards
  where user_id=auth.uid();

  if v_guard.id is null then
    raise exception 'GUARD_PROFILE_NOT_FOUND'
      using errcode='42501';
  end if;

  -- Current mission ownership remains exactly aligned with B4.
  select *
  into v_assignment
  from public.job_assignments
  where guard_id=v_guard.id
    and (
      status in ('offered','accepted','en_route','arrived','active')
      or (
        v_guard.availability='on_mission'
        and status='completed'
      )
    )
  order by assigned_at desc
  limit 1;

  -- Timeline authority is intentionally independent from whether the
  -- assignment is still current.
  --
  -- Prefer the current assignment. If none exists, retain visibility
  -- into the guard's most recently completed assigned job.
  if v_assignment.job_id is not null then
    v_history_job_id := v_assignment.job_id;
  else
    select ja.job_id
    into v_history_job_id
    from public.job_assignments ja
    where ja.guard_id=v_guard.id
      and ja.status='completed'
    order by coalesce(ja.completed_at,ja.assigned_at) desc,
             ja.assigned_at desc
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',me.id,
        'job_id',me.job_id,
        'event_type',me.event_type,
        'payload',me.payload,
        'created_at',me.created_at
      )
      order by me.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.mission_events me
  where v_history_job_id is not null
    and me.job_id=v_history_job_id;

  return jsonb_build_object(
    'guard',
    jsonb_build_object(
      'id',v_guard.id,
      'user_id',v_guard.user_id,
      'name',
        coalesce(
          (
            select full_name
            from public.profiles
            where id=v_guard.user_id
          ),
          'Guard'
        ),
      'badge_number',v_guard.badge_number,
      'availability',v_guard.availability
    ),
    'assignment',
      case
        when v_assignment.id is null then null
        else public.dispatch_mission_json_rc2(v_assignment.job_id)
      end,
    'events',v_events
  );

end;
$$;

revoke all on function public.get_guard_dispatch_workspace_rc2() from public;
grant execute on function public.get_guard_dispatch_workspace_rc2() to authenticated;

commit;
