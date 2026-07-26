-- Co Pilot Security Marketplace v1.5.0 — Real Marketplace Claim Engine

-- Every mission creation becomes immediately visible on the shared mission timeline.
create or replace function public.record_marketplace_job_created()
returns trigger
language plpgsql
security definer set search_path=public
as $$
begin
  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(new.id,auth.uid(),'mission_created',jsonb_build_object(
    'status',new.status,
    'priority',new.priority,
    'client_id',new.client_id,
    'property_id',new.property_id
  ));
  return new;
end;
$$;

drop trigger if exists marketplace_job_created_event on public.marketplace_jobs;
create trigger marketplace_job_created_event
after insert on public.marketplace_jobs
for each row execute function public.record_marketplace_job_created();

-- Platform Admin needs complete event visibility for Mission Control.
drop policy if exists events_scoped on public.mission_events;
create policy events_scoped on public.mission_events for select using(
  public.current_role()='platform_admin'
  or job_id in(select id from public.marketplace_jobs)
);

-- Reassert an atomic first-writer-wins claim. The row update succeeds only while open.
create or replace function public.accept_marketplace_job(p_job_id uuid,p_agency_id uuid)
returns table(accepted boolean,reason text,job_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_job public.marketplace_jobs;
begin
  if not exists(select 1 from public.agency_members where agency_id=p_agency_id and user_id=auth.uid() and role='agency_admin' and is_active) then
    return query select false,'not_authorized',p_job_id; return;
  end if;
  if not exists(select 1 from public.agencies where id=p_agency_id and status='approved') then
    return query select false,'agency_not_approved',p_job_id; return;
  end if;

  update public.marketplace_jobs
  set status='accepted',accepted_agency_id=p_agency_id,accepted_at=now(),updated_at=now()
  where id=p_job_id and status='open'
  returning * into v_job;

  if v_job.id is null then
    return query select false,'already_claimed',p_job_id; return;
  end if;

  insert into public.job_assignments(job_id,agency_id,status)
  values(p_job_id,p_agency_id,'awaiting_guard');

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'agency_claimed',jsonb_build_object('agency_id',p_agency_id,'status','accepted'));

  return query select true,null::text,p_job_id;
end $$;

grant execute on function public.accept_marketplace_job(uuid,uuid) to authenticated;
