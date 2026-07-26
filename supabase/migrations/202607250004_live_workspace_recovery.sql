-- Co Pilot Security Marketplace v1.5.7.2
-- Live Workspace Recovery & Release Gate
-- Additive and idempotent. Run after 202607250003_marketplace_lifecycle_stabilization.sql.

-- Repair client accounts created before the client companion row was guaranteed.
insert into public.clients(user_id, display_name)
select
  p.id,
  coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1), 'Client')
from public.profiles p
join auth.users u on u.id = p.id
left join public.clients c on c.user_id = p.id
where p.role = 'client'
  and c.id is null
on conflict (user_id) do nothing;

-- Resolve the authenticated client's authoritative workspace. The function is
-- intentionally database-driven: it validates the profile role and repairs a
-- missing companion row without trusting a frontend-supplied client id.
create or replace function public.ensure_client_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_client_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Your session has expired. Sign in again.' using errcode = '28000';
  end if;

  select p.role,
         coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1), 'Client')
    into v_role, v_display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_user_id;

  if v_role is null then
    raise exception 'Your authenticated profile is missing.' using errcode = 'P0002';
  end if;

  if v_role <> 'client' then
    raise exception 'This account is not authorized for the Client workspace.' using errcode = '42501';
  end if;

  insert into public.clients(user_id, display_name)
  values (v_user_id, v_display_name)
  on conflict (user_id) do update
    set display_name = case
      when nullif(btrim(public.clients.display_name), '') is null then excluded.display_name
      else public.clients.display_name
    end
  returning id into v_client_id;

  return v_client_id;
end;
$$;

grant execute on function public.ensure_client_workspace() to authenticated;
