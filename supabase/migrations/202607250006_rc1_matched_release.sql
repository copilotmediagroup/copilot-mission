-- Co Pilot Security Marketplace RC1 — Matched Release
-- Corrective, idempotent migration to be run after 202607250005_rc1_foundation_lock.sql.
-- Provides database-authoritative live workspace RPCs and removes reliance on
-- cross-table frontend joins for the golden marketplace path.

begin;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p.role from public.profiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.get_my_agency_context()
returns table(agency_id uuid, agency_name text, agency_status public.agency_status)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Your session has expired. Sign in again.' using errcode='28000';
  end if;

  return query
  select a.id, a.name, a.status
  from public.agencies a
  join public.profiles p on p.id = auth.uid()
  left join public.agency_members am
    on am.agency_id = a.id
   and am.user_id = auth.uid()
   and am.is_active
  where p.role = 'agency_admin'
    and p.account_status = 'approved'
    and (a.owner_user_id = auth.uid() or am.role = 'agency_admin')
  order by (a.owner_user_id = auth.uid()) desc, a.created_at
  limit 1;
end;
$$;

create or replace function public.get_agency_marketplace()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_agency_id uuid;
  v_status public.agency_status;
  v_result jsonb;
begin
  select c.agency_id, c.agency_status
    into v_agency_id, v_status
  from public.get_my_agency_context() c;

  if v_agency_id is null then
    raise exception 'This account is not connected to an approved Agency Admin workspace.' using errcode='42501';
  end if;
  if v_status <> 'approved' then
    raise exception 'Your agency must be approved before accessing the live marketplace.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'title', j.title,
    'instructions', j.instructions,
    'status', j.status,
    'priority', j.priority,
    'accepted_agency_id', j.accepted_agency_id,
    'accepted_at', j.accepted_at,
    'scheduled_for', j.scheduled_for,
    'duration_minutes', j.duration_minutes,
    'payout_cents', j.payout_cents,
    'required_guards', j.required_guards,
    'created_at', j.created_at,
    'updated_at', j.updated_at,
    'property', jsonb_build_object(
      'name', pr.name,
      'address', coalesce(pr.formatted_address, pr.address),
      'latitude', pr.latitude,
      'longitude', pr.longitude,
      'photo_url', pr.photo_url
    ),
    'client', jsonb_build_object('display_name', c.display_name)
  ) order by j.created_at desc), '[]'::jsonb)
  into v_result
  from public.marketplace_jobs j
  join public.properties pr on pr.id = j.property_id
  join public.clients c on c.id = j.client_id
  where j.status = 'open'
     or j.accepted_agency_id = v_agency_id;

  return jsonb_build_object('agency_id', v_agency_id, 'jobs', v_result);
end;
$$;

create or replace function public.get_platform_marketplace()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare v_jobs jsonb; v_events jsonb; v_online integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform Admin access is required.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by (item->>'created_at')::timestamptz desc), '[]'::jsonb)
  into v_jobs
  from (
    select jsonb_build_object(
      'id', j.id, 'title', j.title, 'instructions', j.instructions,
      'status', j.status, 'priority', j.priority,
      'accepted_agency_id', j.accepted_agency_id, 'accepted_at', j.accepted_at,
      'scheduled_for', j.scheduled_for, 'duration_minutes', j.duration_minutes,
      'payout_cents', j.payout_cents, 'required_guards', j.required_guards,
      'created_at', j.created_at, 'updated_at', j.updated_at,
      'property', jsonb_build_object('name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'latitude',pr.latitude,'longitude',pr.longitude,'photo_url',pr.photo_url),
      'client', jsonb_build_object('display_name',c.display_name)
    ) item
    from public.marketplace_jobs j
    join public.properties pr on pr.id=j.property_id
    join public.clients c on c.id=j.client_id
    order by j.created_at desc
    limit 100
  ) q;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from (select id,job_id,event_type,payload,created_at from public.mission_events order by created_at desc limit 40) e;

  select count(*)::integer into v_online from public.guards where availability <> 'offline';
  return jsonb_build_object('jobs',v_jobs,'events',v_events,'onlineGuards',v_online);
end;
$$;

create or replace function public.create_marketplace_job_rc1(
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
set search_path = public
set row_security = off
as $$
declare v_client_id uuid; v_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Your session has expired. Sign in again.' using errcode='28000';
  end if;

  select c.id into v_client_id
  from public.clients c
  join public.profiles p on p.id=c.user_id
  where c.user_id=auth.uid()
    and p.role='client'
    and p.account_status='approved'
  limit 1;

  if v_client_id is null then
    raise exception 'Your approved Client workspace could not be resolved.' using errcode='42501';
  end if;
  if not exists(select 1 from public.properties p where p.id=p_property_id and p.client_id=v_client_id and p.archived_at is null) then
    raise exception 'Select an active property owned by your Client account.' using errcode='23514';
  end if;
  if nullif(btrim(p_title),'') is null then
    raise exception 'Mission title is required.' using errcode='23514';
  end if;
  if p_duration_minutes not between 15 and 1440 then
    raise exception 'Mission duration must be between 15 minutes and 24 hours.' using errcode='23514';
  end if;

  insert into public.marketplace_jobs(client_id,property_id,title,instructions,priority,status,scheduled_for,duration_minutes,accepted_agency_id,accepted_at)
  values(v_client_id,p_property_id,btrim(p_title),nullif(btrim(p_instructions),''),p_priority,'open',p_scheduled_for,p_duration_minutes,null,null)
  returning id into v_job_id;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(v_job_id,auth.uid(),'client_submitted',jsonb_build_object('status','open','property_id',p_property_id));

  return v_job_id;
end;
$$;

revoke all on function public.get_my_agency_context() from public;
revoke all on function public.get_agency_marketplace() from public;
revoke all on function public.get_platform_marketplace() from public;
revoke all on function public.create_marketplace_job_rc1(uuid,text,text,public.job_priority,timestamptz,integer) from public;
grant execute on function public.get_my_agency_context() to authenticated;
grant execute on function public.get_agency_marketplace() to authenticated;
grant execute on function public.get_platform_marketplace() to authenticated;
grant execute on function public.create_marketplace_job_rc1(uuid,text,text,public.job_priority,timestamptz,integer) to authenticated;

commit;
