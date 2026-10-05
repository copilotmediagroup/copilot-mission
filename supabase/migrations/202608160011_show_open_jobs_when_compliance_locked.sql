-- Co Pilot Security Marketplace OS — Show demand while compliance locked
-- Agencies should see open marketplace demand, but claim remains blocked by approval/compliance.
begin;

create or replace function public.get_agency_workspace_rc1a()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_user_id uuid := auth.uid();
  v_agency_id uuid; v_agency_name text; v_agency_status public.agency_status;
  v_profile_status public.account_status; v_jobs jsonb; v_compliance jsonb; v_can_claim boolean;
begin
  select w.agency_id, w.agency_name, w.agency_status into v_agency_id, v_agency_name, v_agency_status
  from public.resolve_my_agency_workspace() w;

  if v_agency_id is null then raise exception 'AGENCY_NOT_FOUND: No Agency workspace is connected to this account.' using errcode='42501'; end if;

  insert into public.agency_members(agency_id, user_id, role, is_active)
  values(v_agency_id, v_user_id, 'agency_admin', true)
  on conflict (agency_id, user_id) do update set role='agency_admin', is_active=true;

  select p.account_status into v_profile_status from public.profiles p where p.id=v_user_id;
  v_compliance := public.compute_agency_compliance_status(v_agency_id);
  v_can_claim := v_agency_status='approved' and v_profile_status='approved' and v_compliance->>'status'='compliant';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',j.id,'title',j.title,'instructions',j.instructions,'status',j.status,'priority',j.priority,
    'accepted_agency_id',j.accepted_agency_id,'accepted_at',j.accepted_at,'scheduled_for',j.scheduled_for,
    'duration_minutes',j.duration_minutes,'payout_cents',j.payout_cents,'required_guards',j.required_guards,
    'service_type',coalesce(j.service_type,'standard_patrol'),'requested_start',coalesce(j.requested_start,'now'),
    'client_contact_phone',j.client_contact_phone,'access_notes',j.access_notes,
    'created_at',j.created_at,'updated_at',j.updated_at,
    'property',jsonb_build_object('name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'latitude',pr.latitude,'longitude',pr.longitude,'photo_url',pr.photo_url),
    'client',jsonb_build_object('display_name',c.display_name)
  ) order by j.created_at desc),'[]'::jsonb) into v_jobs
  from public.marketplace_jobs j
  join public.properties pr on pr.id=j.property_id
  join public.clients c on c.id=j.client_id
  where j.status='open' or j.accepted_agency_id=v_agency_id;

  return jsonb_build_object(
    'agency',jsonb_build_object('id',v_agency_id,'name',v_agency_name,'status',v_agency_status),
    'compliance',v_compliance,
    'can_claim',v_can_claim,
    'access',jsonb_build_object(
      'profile_status',v_profile_status,
      'can_claim',v_can_claim,
      'claim_block_reason',case
        when v_agency_status<>'approved' then 'AGENCY_NOT_APPROVED'
        when v_profile_status<>'approved' then 'ACCOUNT_NOT_APPROVED'
        when v_compliance->>'status'<>'compliant' then 'COMPLIANCE_INCOMPLETE'
        else null
      end
    ),
    'jobs',v_jobs
  );
end $$;

grant execute on function public.get_agency_workspace_rc1a() to authenticated;
commit;
