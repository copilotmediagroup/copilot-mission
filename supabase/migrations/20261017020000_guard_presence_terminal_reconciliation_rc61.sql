-- RC61: Reconcile Guard presence when a parent mission becomes terminal.
-- Assignment/slot completion triggers handle normal transitions, but legacy/test flows can
-- terminalize a job while leaving a Guard latched on_mission. Parent-job terminalization is
-- therefore also an authoritative availability release boundary.
create or replace function public.reconcile_guard_presence_for_terminal_job_rc61()
returns trigger
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard_id uuid;
  v_online boolean;
  v_has_active boolean;
begin
  if new.status not in ('completed','cancelled') or old.status in ('completed','cancelled') then
    return new;
  end if;

  for v_guard_id in
    select a.guard_id from public.job_assignments a where a.job_id=new.id and a.guard_id is not null
    union
    select s.guard_id from public.job_guard_slots s where s.job_id=new.id and s.guard_id is not null
  loop
    select coalesce(g.online_intent,false) into v_online from public.guards g where g.id=v_guard_id;
    if not found then continue; end if;

    select exists(
      select 1 from public.job_assignments a
      join public.marketplace_jobs j on j.id=a.job_id
      where a.guard_id=v_guard_id and j.id<>new.id
        and a.status in('offered','assigned','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
      union all
      select 1 from public.job_guard_slots s
      join public.marketplace_jobs j on j.id=s.job_id
      where s.guard_id=v_guard_id and j.id<>new.id
        and s.status in('offered','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
    ) into v_has_active;

    update public.guards
    set availability=case when v_has_active then 'on_mission' when v_online then 'available' else 'offline' end
    where id=v_guard_id;
  end loop;
  return new;
end $$;

drop trigger if exists trg_guard_presence_terminal_job_rc61 on public.marketplace_jobs;
create trigger trg_guard_presence_terminal_job_rc61
after update of status on public.marketplace_jobs
for each row execute function public.reconcile_guard_presence_for_terminal_job_rc61();

-- One-time reconciliation for stale on_mission rows that have no active operational mission.
update public.guards g
set availability=case when coalesce(g.online_intent,false) then 'available' else 'offline' end
where g.availability='on_mission'
  and not exists(
    select 1 from public.job_assignments a join public.marketplace_jobs j on j.id=a.job_id
    where a.guard_id=g.id and a.status in('offered','assigned','accepted','en_route','arrived','active')
      and j.status in('accepted','assigned','active')
  )
  and not exists(
    select 1 from public.job_guard_slots s join public.marketplace_jobs j on j.id=s.job_id
    where s.guard_id=g.id and s.status in('offered','accepted','en_route','arrived','active')
      and j.status in('accepted','assigned','active')
  );

revoke all on function public.reconcile_guard_presence_for_terminal_job_rc61() from public, anon, authenticated;
grant execute on function public.reconcile_guard_presence_for_terminal_job_rc61() to service_role;
