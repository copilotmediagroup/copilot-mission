-- Co Pilot Security Marketplace OS — Guard Onboarding Engine RC1.1 (standalone repair)
-- Safe to run after the original migration failed; all objects are created idempotently.
-- Agency-owned invitations; public signup remains Client/Agency only.
begin;

create table if not exists public.guard_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  badge_number text,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','activated','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid not null references public.profiles(id),
  activated_user_id uuid references public.profiles(id),
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists guard_invitation_pending_email_idx on public.guard_invitations(agency_id,lower(email)) where status='pending';
create index if not exists guard_invitations_agency_created_idx on public.guard_invitations(agency_id,created_at desc);

create or replace function public.create_guard_invitation(p_full_name text,p_email text,p_phone text default null,p_badge_number text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status; v_token text; v_invite public.guard_invitations;
begin
  select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
  if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
  if nullif(trim(p_full_name),'') is null then raise exception 'GUARD_NAME_REQUIRED' using errcode='22023'; end if;
  if nullif(trim(p_email),'') is null or position('@' in p_email)=0 then raise exception 'VALID_EMAIL_REQUIRED' using errcode='22023'; end if;
  if exists(select 1 from public.guards g join public.profiles p on p.id=g.user_id join auth.users u on u.id=p.id where g.agency_id=v_agency_id and lower(u.email)=lower(trim(p_email))) then raise exception 'GUARD_ALREADY_EXISTS' using errcode='23505'; end if;
  update public.guard_invitations set status='revoked' where agency_id=v_agency_id and lower(email)=lower(trim(p_email)) and status='pending';
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.guard_invitations(agency_id,email,full_name,phone,badge_number,token_hash,invited_by)
  values(v_agency_id,lower(trim(p_email)),trim(p_full_name),nullif(trim(p_phone),''),nullif(trim(p_badge_number),''),md5(v_token),auth.uid()) returning * into v_invite;
  return jsonb_build_object('id',v_invite.id,'email',v_invite.email,'full_name',v_invite.full_name,'expires_at',v_invite.expires_at,'token',v_token);
end;$$;

create or replace function public.get_guard_roster()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status; v_guards jsonb; v_invites jsonb;
begin
  select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
  if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'phone',p.phone,'email',u.email,'badge_number',g.badge_number,'availability',g.availability,'created_at',g.created_at) order by p.full_name),'[]') into v_guards
  from public.guards g join public.profiles p on p.id=g.user_id join auth.users u on u.id=g.user_id where g.agency_id=v_agency_id;
  update public.guard_invitations set status='expired' where agency_id=v_agency_id and status='pending' and expires_at<=now();
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'full_name',i.full_name,'phone',i.phone,'badge_number',i.badge_number,'status',i.status,'expires_at',i.expires_at,'created_at',i.created_at) order by i.created_at desc),'[]') into v_invites
  from public.guard_invitations i where i.agency_id=v_agency_id;
  return jsonb_build_object('guards',v_guards,'invitations',v_invites);
end;$$;

create or replace function public.revoke_guard_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid;
begin
 select agency_id into v_agency_id from public.resolve_my_agency_workspace();
 update public.guard_invitations set status='revoked' where id=p_invitation_id and agency_id=v_agency_id and status='pending';
 if not found then raise exception 'PENDING_INVITATION_NOT_FOUND' using errcode='22023'; end if;
 return jsonb_build_object('success',true,'id',p_invitation_id);
end;$$;

-- Auth creation consumes a valid invitation atomically. No public Guard role selector exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested_role public.app_role; requested_status public.account_status; new_agency_id uuid; v_invite public.guard_invitations; v_token text;
begin
  v_token := nullif(new.raw_user_meta_data->>'guard_invite_token','');
  if v_token is not null then
    select * into v_invite from public.guard_invitations
    where token_hash=md5(v_token) and status='pending' and expires_at>now() and lower(email)=lower(new.email)
    for update;
    if v_invite.id is null then raise exception 'INVALID_OR_EXPIRED_GUARD_INVITATION'; end if;
    if not exists(select 1 from public.agencies where id=v_invite.agency_id and status='approved') then raise exception 'INVITING_AGENCY_NOT_APPROVED'; end if;
    insert into public.profiles(id,role,account_status,full_name,phone) values(new.id,'guard','approved',v_invite.full_name,v_invite.phone);
    insert into public.agency_members(agency_id,user_id,role,is_active) values(v_invite.agency_id,new.id,'guard',true);
    insert into public.guards(agency_id,user_id,badge_number,availability) values(v_invite.agency_id,new.id,v_invite.badge_number,'offline');
    update public.guard_invitations set status='activated',activated_user_id=new.id,activated_at=now() where id=v_invite.id;
    return new;
  end if;
  requested_role := case when new.raw_user_meta_data->>'account_type'='agency_admin' then 'agency_admin'::public.app_role else 'client'::public.app_role end;
  requested_status := case when requested_role='client' then 'approved'::public.account_status else 'pending'::public.account_status end;
  insert into public.profiles(id,role,account_status,full_name) values(new.id,requested_role,requested_status,nullif(new.raw_user_meta_data->>'full_name',''));
  if requested_role='agency_admin' then
    insert into public.agencies(owner_user_id,name,status) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'agency_name',''),'New Agency'),'pending') returning id into new_agency_id;
    insert into public.agency_members(agency_id,user_id,role,is_active) values(new_agency_id,new.id,'agency_admin',true);
  else
    insert into public.clients(user_id,display_name) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)));
  end if;
  return new;
end;$$;

revoke all on public.guard_invitations from anon,authenticated;
revoke all on function public.create_guard_invitation(text,text,text,text) from public;
revoke all on function public.get_guard_roster() from public;
revoke all on function public.revoke_guard_invitation(uuid) from public;
grant execute on function public.create_guard_invitation(text,text,text,text) to authenticated;
grant execute on function public.get_guard_roster() to authenticated;
grant execute on function public.revoke_guard_invitation(uuid) to authenticated;
commit;
