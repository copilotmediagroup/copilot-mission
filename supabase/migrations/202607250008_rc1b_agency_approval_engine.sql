-- Co Pilot Security Marketplace OS RC1-B — Agency Approval Engine
-- Atomic platform administration for approve, deny, suspend and reactivate.

begin;

alter table public.agencies add column if not exists approved_at timestamptz;
alter table public.agencies add column if not exists approved_by uuid references public.profiles(id);
alter table public.agencies add column if not exists denied_at timestamptz;
alter table public.agencies add column if not exists denial_reason text;
alter table public.agencies add column if not exists suspended_at timestamptz;
alter table public.agencies add column if not exists suspension_reason text;
alter table public.agencies add column if not exists updated_at timestamptz not null default now();

create table if not exists public.agency_audit_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  reason text,
  previous_status public.agency_status,
  new_status public.agency_status,
  created_at timestamptz not null default now()
);

create index if not exists agency_audit_events_agency_idx on public.agency_audit_events(agency_id, created_at desc);
alter table public.agency_audit_events enable row level security;
drop policy if exists agency_audit_platform_only on public.agency_audit_events;
create policy agency_audit_platform_only on public.agency_audit_events for select using(public.is_platform_admin());

create or replace function public.assert_platform_admin_rc1b()
returns void
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if auth.uid() is null then raise exception 'SESSION_EXPIRED: Sign in again.' using errcode='28000'; end if;
  if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED: This action requires Platform Admin access.' using errcode='42501'; end if;
end;
$$;

create or replace function public.get_platform_agencies_rc1b()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare v_agencies jsonb; v_audit jsonb;
begin
  perform public.assert_platform_admin_rc1b();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'name',a.name,'status',a.status,'owner_user_id',a.owner_user_id,
    'owner_name',p.full_name,'owner_email',u.email,'owner_account_status',p.account_status,
    'license_number',a.license_number,'service_radius_miles',a.service_radius_miles,
    'created_at',a.created_at,'approved_at',a.approved_at,'suspended_at',a.suspended_at,
    'denial_reason',a.denial_reason,'suspension_reason',a.suspension_reason,
    'guard_count',(select count(*) from public.guards g where g.agency_id=a.id),
    'online_guard_count',(select count(*) from public.guards g where g.agency_id=a.id and g.availability<>'offline'),
    'active_mission_count',(select count(*) from public.marketplace_jobs j where j.accepted_agency_id=a.id and j.status in ('accepted','assigned','active')),
    'completed_mission_count',(select count(*) from public.marketplace_jobs j where j.accepted_agency_id=a.id and j.status='completed')
  ) order by case a.status when 'pending' then 0 when 'approved' then 1 when 'suspended' then 2 else 3 end,a.created_at desc),'[]'::jsonb)
  into v_agencies
  from public.agencies a
  join public.profiles p on p.id=a.owner_user_id
  left join auth.users u on u.id=a.owner_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'agency_id',e.agency_id,'action',e.action,'reason',e.reason,
    'actor_user_id',e.actor_user_id,'actor_name',p.full_name,'created_at',e.created_at
  ) order by e.created_at desc),'[]'::jsonb)
  into v_audit
  from public.agency_audit_events e left join public.profiles p on p.id=e.actor_user_id;

  return jsonb_build_object('agencies',v_agencies,'audit',v_audit);
end;
$$;

create or replace function public.approve_agency_rc1b(p_agency_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency public.agencies; v_previous public.agency_status;
begin
  perform public.assert_platform_admin_rc1b();
  select * into v_agency from public.agencies where id=p_agency_id for update;
  if v_agency.id is null then raise exception 'AGENCY_NOT_FOUND: Agency does not exist.' using errcode='P0002'; end if;
  v_previous:=v_agency.status;
  update public.profiles set account_status='approved',updated_at=now() where id=v_agency.owner_user_id;
  insert into public.agency_members(agency_id,user_id,role,is_active) values(v_agency.id,v_agency.owner_user_id,'agency_admin',true)
  on conflict(agency_id,user_id) do update set role='agency_admin',is_active=true;
  update public.agencies set status='approved',approved_at=now(),approved_by=auth.uid(),denied_at=null,denial_reason=null,suspended_at=null,suspension_reason=null,updated_at=now() where id=v_agency.id;
  insert into public.agency_audit_events(agency_id,actor_user_id,action,previous_status,new_status) values(v_agency.id,auth.uid(),'agency_approved',v_previous,'approved');
  return jsonb_build_object('success',true,'agency_id',v_agency.id,'status','approved');
end;$$;

create or replace function public.deny_agency_rc1b(p_agency_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency public.agencies; v_previous public.agency_status;
begin
  perform public.assert_platform_admin_rc1b();
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED: A denial reason is required.' using errcode='22023'; end if;
  select * into v_agency from public.agencies where id=p_agency_id for update;
  if v_agency.id is null then raise exception 'AGENCY_NOT_FOUND: Agency does not exist.' using errcode='P0002'; end if;
  v_previous:=v_agency.status;
  update public.agencies set status='rejected',denied_at=now(),denial_reason=btrim(p_reason),suspended_at=null,suspension_reason=null,updated_at=now() where id=v_agency.id;
  insert into public.agency_audit_events(agency_id,actor_user_id,action,reason,previous_status,new_status) values(v_agency.id,auth.uid(),'agency_denied',btrim(p_reason),v_previous,'rejected');
  return jsonb_build_object('success',true,'agency_id',v_agency.id,'status','rejected');
end;$$;

create or replace function public.suspend_agency_rc1b(p_agency_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency public.agencies; v_previous public.agency_status;
begin
  perform public.assert_platform_admin_rc1b();
  if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED: A suspension reason is required.' using errcode='22023'; end if;
  select * into v_agency from public.agencies where id=p_agency_id for update;
  if v_agency.id is null then raise exception 'AGENCY_NOT_FOUND: Agency does not exist.' using errcode='P0002'; end if;
  if v_agency.status<>'approved' then raise exception 'INVALID_AGENCY_STATE: Only approved agencies can be suspended.' using errcode='22023'; end if;
  v_previous:=v_agency.status;
  update public.agencies set status='suspended',suspended_at=now(),suspension_reason=btrim(p_reason),updated_at=now() where id=v_agency.id;
  insert into public.agency_audit_events(agency_id,actor_user_id,action,reason,previous_status,new_status) values(v_agency.id,auth.uid(),'agency_suspended',btrim(p_reason),v_previous,'suspended');
  return jsonb_build_object('success',true,'agency_id',v_agency.id,'status','suspended');
end;$$;

create or replace function public.reactivate_agency_rc1b(p_agency_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency public.agencies; v_previous public.agency_status;
begin
  perform public.assert_platform_admin_rc1b();
  select * into v_agency from public.agencies where id=p_agency_id for update;
  if v_agency.id is null then raise exception 'AGENCY_NOT_FOUND: Agency does not exist.' using errcode='P0002'; end if;
  if v_agency.status not in ('suspended','rejected') then raise exception 'INVALID_AGENCY_STATE: This agency is not suspended or denied.' using errcode='22023'; end if;
  v_previous:=v_agency.status;
  update public.profiles set account_status='approved',updated_at=now() where id=v_agency.owner_user_id;
  insert into public.agency_members(agency_id,user_id,role,is_active) values(v_agency.id,v_agency.owner_user_id,'agency_admin',true)
  on conflict(agency_id,user_id) do update set role='agency_admin',is_active=true;
  update public.agencies set status='approved',approved_at=coalesce(approved_at,now()),approved_by=auth.uid(),denied_at=null,denial_reason=null,suspended_at=null,suspension_reason=null,updated_at=now() where id=v_agency.id;
  insert into public.agency_audit_events(agency_id,actor_user_id,action,previous_status,new_status) values(v_agency.id,auth.uid(),'agency_reactivated',v_previous,'approved');
  return jsonb_build_object('success',true,'agency_id',v_agency.id,'status','approved');
end;$$;

revoke all on function public.assert_platform_admin_rc1b() from public;
revoke all on function public.get_platform_agencies_rc1b() from public;
revoke all on function public.approve_agency_rc1b(uuid) from public;
revoke all on function public.deny_agency_rc1b(uuid,text) from public;
revoke all on function public.suspend_agency_rc1b(uuid,text) from public;
revoke all on function public.reactivate_agency_rc1b(uuid) from public;
grant execute on function public.get_platform_agencies_rc1b() to authenticated;
grant execute on function public.approve_agency_rc1b(uuid) to authenticated;
grant execute on function public.deny_agency_rc1b(uuid,text) to authenticated;
grant execute on function public.suspend_agency_rc1b(uuid,text) to authenticated;
grant execute on function public.reactivate_agency_rc1b(uuid) to authenticated;

commit;
