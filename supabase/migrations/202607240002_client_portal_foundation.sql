-- Co Pilot Security Marketplace v1.3.0
-- Additive migration: Client Portal Foundation
-- Safe to run after 202607240001_marketplace_foundation.sql.

-- Clients enter the marketplace immediately. Agencies remain pending for verification.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path=public
as $$
declare
  requested_role public.app_role;
  requested_status public.account_status;
  new_agency_id uuid;
begin
  requested_role := case
    when new.raw_user_meta_data->>'account_type' = 'agency_admin' then 'agency_admin'::public.app_role
    else 'client'::public.app_role
  end;
  requested_status := case
    when requested_role = 'client' then 'approved'::public.account_status
    else 'pending'::public.account_status
  end;

  insert into public.profiles(id, role, account_status, full_name)
  values(new.id, requested_role, requested_status, nullif(new.raw_user_meta_data->>'full_name',''));

  if requested_role = 'agency_admin' then
    insert into public.agencies(owner_user_id, name, status)
    values(new.id, coalesce(nullif(new.raw_user_meta_data->>'agency_name',''), 'New Agency'), 'pending')
    returning id into new_agency_id;
    insert into public.agency_members(agency_id, user_id, role, is_active)
    values(new_agency_id, new.id, 'agency_admin', true);
  else
    insert into public.clients(user_id, display_name)
    values(new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)));
  end if;
  return new;
end;
$$;

-- A client may create and manage only properties belonging to their own client row.
create policy properties_client_insert on public.properties
for insert to authenticated
with check (client_id in (select id from public.clients where user_id=auth.uid()));

create policy properties_client_update on public.properties
for update to authenticated
using (client_id in (select id from public.clients where user_id=auth.uid()))
with check (client_id in (select id from public.clients where user_id=auth.uid()));

create policy properties_client_delete on public.properties
for delete to authenticated
using (client_id in (select id from public.clients where user_id=auth.uid()));

-- A client may submit jobs only for its own client record and own property.
create policy jobs_client_insert on public.marketplace_jobs
for insert to authenticated
with check (
  client_id in (select id from public.clients where user_id=auth.uid())
  and property_id in (select p.id from public.properties p join public.clients c on c.id=p.client_id where c.user_id=auth.uid())
  and status='open'
  and accepted_agency_id is null
);

-- Clients may update or cancel only jobs that have not yet been accepted.
create policy jobs_client_update_open on public.marketplace_jobs
for update to authenticated
using (
  client_id in (select id from public.clients where user_id=auth.uid())
  and status='open'
)
with check (
  client_id in (select id from public.clients where user_id=auth.uid())
  and status in ('open','cancelled')
  and accepted_agency_id is null
);

-- Property changes also drive the live client workspace.
do $$
begin
  alter publication supabase_realtime add table public.properties;
exception
  when duplicate_object then null;
end $$;
