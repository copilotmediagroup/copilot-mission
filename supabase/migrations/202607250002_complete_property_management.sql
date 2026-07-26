-- Co Pilot Security Marketplace v1.5.6
-- Complete property lifecycle: edit, photo replacement/removal, archive, and safe permanent deletion.

alter table public.properties add column if not exists archived_at timestamptz;
alter table public.properties add column if not exists updated_at timestamptz not null default now();

create index if not exists properties_active_client_idx on public.properties(client_id, created_at desc) where archived_at is null;

create or replace function public.delete_client_property(p_property_id uuid)
returns table(deleted boolean, reason text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_property public.properties;
begin
  select * into v_property from public.properties
  where id=p_property_id
    and client_id in(select id from public.clients where user_id=auth.uid());

  if v_property.id is null then
    return query select false,'not_authorized'; return;
  end if;

  if exists(select 1 from public.marketplace_jobs where property_id=p_property_id) then
    return query select false,'mission_history_exists'; return;
  end if;

  delete from public.properties where id=p_property_id;
  return query select true,null::text;
end;
$$;

grant execute on function public.delete_client_property(uuid) to authenticated;

create or replace function public.archive_client_property(p_property_id uuid)
returns table(archived boolean, reason text)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(
    select 1 from public.properties p
    where p.id=p_property_id
      and p.client_id in(select id from public.clients where user_id=auth.uid())
  ) then
    return query select false,'not_authorized'; return;
  end if;

  if exists(
    select 1 from public.marketplace_jobs
    where property_id=p_property_id and status in('open','accepted','assigned','active')
  ) then
    return query select false,'active_mission_exists'; return;
  end if;

  update public.properties set archived_at=now(),updated_at=now() where id=p_property_id;
  return query select true,null::text;
end;
$$;

grant execute on function public.archive_client_property(uuid) to authenticated;
