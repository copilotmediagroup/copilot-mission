-- Co Pilot Security Marketplace OS RC1-A — Agency Marketplace Recovery
-- One authoritative Agency workspace resolver, marketplace reader, and claim path.
-- Safe to run after the existing marketplace foundation migrations.

begin;

create or replace function public.resolve_my_agency_workspace()
returns table(agency_id uuid, agency_name text, agency_status public.agency_status)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
begin
  if v_user_id is null then
    raise exception 'SESSION_EXPIRED: Sign in again.' using errcode = '28000';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if v_role is distinct from 'agency_admin'::public.app_role then
    raise exception 'ROLE_MISMATCH: This account is not an Agency Admin.' using errcode = '42501';
  end if;

  return query
  select a.id, a.name, a.status
  from public.agencies a
  left join public.agency_members am
    on am.agency_id = a.id
   and am.user_id = v_user_id
   and am.is_active = true
  where a.owner_user_id = v_user_id
     or am.role = 'agency_admin'::public.app_role
  order by (a.owner_user_id = v_user_id) desc, a.created_at asc
  limit 1;
end;
$$;

create or replace function public.get_agency_workspace_rc1a()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_agency_id uuid;
  v_agency_name text;
  v_agency_status public.agency_status;
  v_profile_status public.account_status;
  v_jobs jsonb;
begin
  select w.agency_id, w.agency_name, w.agency_status
    into v_agency_id, v_agency_name, v_agency_status
  from public.resolve_my_agency_workspace() w;

  if v_agency_id is null then
    raise exception 'AGENCY_NOT_FOUND: No Agency workspace is connected to this account.' using errcode = '42501';
  end if;

  -- Repair the owner membership invariant so all downstream systems share one contract.
  insert into public.agency_members(agency_id, user_id, role, is_active)
  values(v_agency_id, v_user_id, 'agency_admin', true)
  on conflict (agency_id, user_id)
  do update set role = 'agency_admin', is_active = true;

  select p.account_status into v_profile_status
  from public.profiles p where p.id = v_user_id;

  -- An approved agency implies its verified owner account is approved.
  if v_agency_status = 'approved' and v_profile_status <> 'approved' then
    update public.profiles
       set account_status = 'approved', updated_at = now()
     where id = v_user_id;
    v_profile_status := 'approved';
  end if;

  if v_agency_status <> 'approved' then
    raise exception 'AGENCY_NOT_APPROVED: Platform approval is required before marketplace access.' using errcode = '42501';
  end if;

  if v_profile_status <> 'approved' then
    raise exception 'ACCOUNT_NOT_APPROVED: This Agency Admin account is not approved.' using errcode = '42501';
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
  into v_jobs
  from public.marketplace_jobs j
  join public.properties pr on pr.id = j.property_id
  join public.clients c on c.id = j.client_id
  where j.status = 'open'
     or j.accepted_agency_id = v_agency_id;

  return jsonb_build_object(
    'agency', jsonb_build_object('id', v_agency_id, 'name', v_agency_name, 'status', v_agency_status),
    'jobs', v_jobs
  );
end;
$$;

create or replace function public.claim_marketplace_job_rc1a(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_workspace jsonb;
  v_agency_id uuid;
  v_claimed public.marketplace_jobs;
begin
  v_workspace := public.get_agency_workspace_rc1a();
  v_agency_id := (v_workspace->'agency'->>'id')::uuid;

  update public.marketplace_jobs
     set status = 'accepted',
         accepted_agency_id = v_agency_id,
         accepted_at = now(),
         updated_at = now()
   where id = p_job_id
     and status = 'open'
     and accepted_agency_id is null
  returning * into v_claimed;

  if v_claimed.id is null then
    return jsonb_build_object('accepted', false, 'reason', 'ALREADY_CLAIMED_OR_UNAVAILABLE', 'job_id', p_job_id);
  end if;

  insert into public.job_assignments(job_id, agency_id, status)
  values(p_job_id, v_agency_id, 'awaiting_guard')
  on conflict (job_id)
  do update set agency_id = excluded.agency_id, status = 'awaiting_guard';

  insert into public.mission_events(job_id, actor_user_id, event_type, payload)
  values(p_job_id, auth.uid(), 'agency_claimed', jsonb_build_object('agency_id', v_agency_id, 'status', 'accepted'));

  return jsonb_build_object('accepted', true, 'reason', null, 'job_id', p_job_id, 'agency_id', v_agency_id);
end;
$$;

revoke all on function public.resolve_my_agency_workspace() from public;
revoke all on function public.get_agency_workspace_rc1a() from public;
revoke all on function public.claim_marketplace_job_rc1a(uuid) from public;
grant execute on function public.resolve_my_agency_workspace() to authenticated;
grant execute on function public.get_agency_workspace_rc1a() to authenticated;
grant execute on function public.claim_marketplace_job_rc1a(uuid) to authenticated;

commit;
