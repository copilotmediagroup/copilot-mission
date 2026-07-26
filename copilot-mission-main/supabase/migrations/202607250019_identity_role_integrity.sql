-- Identity Engine RC1.1 — Role Integrity
-- Repairs cross-role workspace contamination and enforces one authoritative role.

begin;

create table if not exists public.identity_integrity_audit (
  id bigint generated always as identity primary key,
  user_id uuid,
  issue_code text not null,
  action_taken text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Record every invalid Client workspace before repair.
insert into public.identity_integrity_audit(user_id, issue_code, action_taken, details)
select c.user_id,
       'NON_CLIENT_HAS_CLIENT_WORKSPACE',
       case when not exists(select 1 from public.properties pr where pr.client_id=c.id)
                  and not exists(select 1 from public.marketplace_jobs j where j.client_id=c.id)
            then 'REMOVED'
            else 'QUARANTINED_REQUIRES_REVIEW' end,
       jsonb_build_object('client_id',c.id,'profile_role',p.role,'display_name',c.display_name)
from public.clients c
join public.profiles p on p.id=c.user_id
where p.role <> 'client'::public.app_role;

-- Safe repair: remove invalid workspace rows only when no operational records depend on them.
delete from public.clients c
using public.profiles p
where p.id=c.user_id
  and p.role <> 'client'::public.app_role
  and not exists(select 1 from public.properties pr where pr.client_id=c.id)
  and not exists(select 1 from public.marketplace_jobs j where j.client_id=c.id);

-- Ensure every true Client has exactly one Client workspace.
insert into public.clients(user_id,display_name)
select p.id, coalesce(nullif(btrim(p.full_name),''), split_part(u.email,'@',1), 'Client')
from public.profiles p
left join auth.users u on u.id=p.id
left join public.clients c on c.user_id=p.id
where p.role='client'::public.app_role and c.id is null
on conflict(user_id) do nothing;

-- Client table may only contain identities whose authoritative profile role is Client.
create or replace function public.enforce_client_workspace_role()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role public.app_role;
begin
  select role into v_role from public.profiles where id=new.user_id;
  if v_role is distinct from 'client'::public.app_role then
    raise exception 'IDENTITY_ROLE_MISMATCH: Only Client profiles may own Client workspaces.' using errcode='23514';
  end if;
  return new;
end;$$;

drop trigger if exists clients_role_integrity on public.clients;
create trigger clients_role_integrity before insert or update of user_id on public.clients
for each row execute function public.enforce_client_workspace_role();

-- Role changes cannot leave incompatible workspaces behind or destroy operational data.
create or replace function public.enforce_profile_role_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_client_id uuid;
begin
  if new.role is not distinct from old.role then return new; end if;

  if new.role <> 'client'::public.app_role then
    select id into v_client_id from public.clients where user_id=new.id;
    if v_client_id is not null then
      if exists(select 1 from public.properties where client_id=v_client_id)
         or exists(select 1 from public.marketplace_jobs where client_id=v_client_id) then
        raise exception 'ROLE_CHANGE_BLOCKED_CLIENT_DATA: Archive or transfer Client records first.' using errcode='23514';
      end if;
      delete from public.clients where id=v_client_id;
    end if;
  end if;

  if new.role='client'::public.app_role and (
      exists(select 1 from public.agency_members where user_id=new.id and is_active)
      or exists(select 1 from public.guards where user_id=new.id)
  ) then
    raise exception 'ROLE_CHANGE_BLOCKED_AGENCY_OR_GUARD_MEMBERSHIP' using errcode='23514';
  end if;
  return new;
end;$$;

drop trigger if exists profiles_role_transition_integrity on public.profiles;
create trigger profiles_role_transition_integrity before update of role on public.profiles
for each row execute function public.enforce_profile_role_transition();

-- Agency membership roles must match the authoritative profile role.
create or replace function public.enforce_agency_member_role()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role public.app_role;
begin
  select role into v_role from public.profiles where id=new.user_id;
  if v_role is distinct from new.role then
    raise exception 'AGENCY_MEMBER_ROLE_MISMATCH' using errcode='23514';
  end if;
  return new;
end;$$;

drop trigger if exists agency_members_role_integrity on public.agency_members;
create trigger agency_members_role_integrity before insert or update of user_id,role on public.agency_members
for each row execute function public.enforce_agency_member_role();

-- Guard roster entries require a Guard profile and matching active Agency membership.
create or replace function public.enforce_guard_identity_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=new.user_id and role='guard'::public.app_role) then
    raise exception 'GUARD_PROFILE_REQUIRED' using errcode='23514';
  end if;
  if not exists(select 1 from public.agency_members where agency_id=new.agency_id and user_id=new.user_id and role='guard'::public.app_role and is_active) then
    raise exception 'ACTIVE_GUARD_MEMBERSHIP_REQUIRED' using errcode='23514';
  end if;
  return new;
end;$$;

drop trigger if exists guards_identity_integrity on public.guards;
create trigger guards_identity_integrity before insert or update of agency_id,user_id on public.guards
for each row execute function public.enforce_guard_identity_membership();

create or replace function public.get_identity_integrity_report()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if public.current_role() is distinct from 'platform_admin'::public.app_role then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  return jsonb_build_object(
    'generated_at',now(),
    'valid_clients',(select count(*) from public.clients c join public.profiles p on p.id=c.user_id where p.role='client'),
    'invalid_client_workspaces',(select count(*) from public.clients c join public.profiles p on p.id=c.user_id where p.role<>'client'),
    'clients_missing_workspace',(select count(*) from public.profiles p left join public.clients c on c.user_id=p.id where p.role='client' and c.id is null),
    'agency_member_role_conflicts',(select count(*) from public.agency_members am join public.profiles p on p.id=am.user_id where am.role<>p.role),
    'guard_identity_conflicts',(select count(*) from public.guards g join public.profiles p on p.id=g.user_id where p.role<>'guard'),
    'clean', not exists(select 1 from public.clients c join public.profiles p on p.id=c.user_id where p.role<>'client')
      and not exists(select 1 from public.profiles p left join public.clients c on c.user_id=p.id where p.role='client' and c.id is null)
      and not exists(select 1 from public.agency_members am join public.profiles p on p.id=am.user_id where am.role<>p.role)
      and not exists(select 1 from public.guards g join public.profiles p on p.id=g.user_id where p.role<>'guard'),
    'recent_repairs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.identity_integrity_audit order by created_at desc limit 25)x),'[]'::jsonb)
  );
end;$$;

revoke all on public.identity_integrity_audit from anon,authenticated;
revoke all on function public.get_identity_integrity_report() from public;
grant execute on function public.get_identity_integrity_report() to authenticated;

commit;
