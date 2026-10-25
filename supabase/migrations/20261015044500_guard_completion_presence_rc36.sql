-- RC36: mission completion must honor the persistent Online/Offline latch.
-- A Guard who chose Online returns to Available automatically after their final active
-- assignment completes. A Guard whose online_intent is false remains Offline.
create or replace function public.refresh_guard_availability_after_assignment_completion_rc36()
returns trigger
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard_id uuid;
  v_online boolean;
  v_has_other_active boolean;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  v_guard_id := new.guard_id;
  if v_guard_id is null then return new; end if;

  select online_intent into v_online from public.guards where id=v_guard_id;
  if not found then return new; end if;

  select exists(
    select 1 from public.job_assignments a
      join public.marketplace_jobs j on j.id=a.job_id
      where a.guard_id=v_guard_id and a.id<>new.id
        and a.status in('offered','assigned','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
    union all
    select 1 from public.job_guard_slots s
      join public.marketplace_jobs j on j.id=s.job_id
      where s.guard_id=v_guard_id
        and s.status in('offered','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
  ) into v_has_other_active;

  update public.guards
  set availability=case when v_has_other_active then 'on_mission' when v_online then 'available' else 'offline' end
  where id=v_guard_id;
  return new;
end $$;

drop trigger if exists trg_guard_completion_presence_rc36 on public.job_assignments;
create trigger trg_guard_completion_presence_rc36
after update of status on public.job_assignments
for each row execute function public.refresh_guard_availability_after_assignment_completion_rc36();

create or replace function public.refresh_guard_availability_after_slot_completion_rc36()
returns trigger
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_guard_id uuid;
  v_online boolean;
  v_has_other_active boolean;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  v_guard_id := new.guard_id;
  if v_guard_id is null then return new; end if;

  select online_intent into v_online from public.guards where id=v_guard_id;
  if not found then return new; end if;

  select exists(
    select 1 from public.job_guard_slots s
      join public.marketplace_jobs j on j.id=s.job_id
      where s.guard_id=v_guard_id and s.id<>new.id
        and s.status in('offered','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
    union all
    select 1 from public.job_assignments a
      join public.marketplace_jobs j on j.id=a.job_id
      where a.guard_id=v_guard_id
        and a.status in('offered','assigned','accepted','en_route','arrived','active')
        and j.status in('accepted','assigned','active')
  ) into v_has_other_active;

  update public.guards
  set availability=case when v_has_other_active then 'on_mission' when v_online then 'available' else 'offline' end
  where id=v_guard_id;
  return new;
end $$;

drop trigger if exists trg_guard_slot_completion_presence_rc36 on public.job_guard_slots;
create trigger trg_guard_slot_completion_presence_rc36
after update of status on public.job_guard_slots
for each row execute function public.refresh_guard_availability_after_slot_completion_rc36();
