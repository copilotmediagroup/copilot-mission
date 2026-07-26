-- Co Pilot Security Marketplace v1.5.7
-- Marketplace Lifecycle Stabilization
-- One-time additive migration. Run after all v1.5.6 migrations.

-- Canonical client submission path. The database validates ownership and always
-- creates a marketplace-visible open mission. Frontend mode state cannot alter it.
create or replace function public.create_marketplace_job(
  p_client_id uuid,
  p_property_id uuid,
  p_title text,
  p_instructions text default null,
  p_priority public.job_priority default 'standard',
  p_scheduled_for timestamptz default null,
  p_duration_minutes integer default 60
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job_id uuid;
begin
  if public.current_role() <> 'client' then
    raise exception 'Only an authenticated client can create a marketplace mission.' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.clients c
    where c.id=p_client_id and c.user_id=auth.uid()
  ) then
    raise exception 'Client account does not belong to the authenticated user.' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id=p_property_id
      and p.client_id=p_client_id
      and p.archived_at is null
  ) then
    raise exception 'Select an active property owned by this client.' using errcode='23514';
  end if;

  if nullif(btrim(p_title),'') is null then
    raise exception 'Mission title is required.' using errcode='23514';
  end if;

  if p_duration_minutes not between 15 and 1440 then
    raise exception 'Mission duration must be between 15 minutes and 24 hours.' using errcode='23514';
  end if;

  insert into public.marketplace_jobs(
    client_id, property_id, title, instructions, status, priority,
    scheduled_for, duration_minutes, accepted_agency_id, accepted_at
  ) values (
    p_client_id, p_property_id, btrim(p_title), nullif(btrim(p_instructions),''),
    'open', p_priority, p_scheduled_for, p_duration_minutes, null, null
  ) returning id into v_job_id;

  return v_job_id;
end;
$$;

grant execute on function public.create_marketplace_job(uuid,uuid,text,text,public.job_priority,timestamptz,integer) to authenticated;

-- Agency admins need the linked property/client presentation fields for every
-- mission they are authorized to see. Job visibility remains controlled by the
-- marketplace_jobs RLS policy.
drop policy if exists properties_marketplace_agency_read on public.properties;
create policy properties_marketplace_agency_read on public.properties
for select to authenticated
using (
  public.current_role()='agency_admin'
  and exists (
    select 1 from public.marketplace_jobs j
    where j.property_id=properties.id
      and (j.status='open' or j.accepted_agency_id in(select public.user_agency_ids()))
  )
);

drop policy if exists clients_marketplace_agency_read on public.clients;
create policy clients_marketplace_agency_read on public.clients
for select to authenticated
using (
  public.current_role()='agency_admin'
  and exists (
    select 1 from public.marketplace_jobs j
    where j.client_id=clients.id
      and (j.status='open' or j.accepted_agency_id in(select public.user_agency_ids()))
  )
);
