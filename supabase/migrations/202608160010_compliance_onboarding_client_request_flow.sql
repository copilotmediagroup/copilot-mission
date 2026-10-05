-- Co Pilot Security Marketplace OS — Compliance Gate, Agency Onboarding, Client Request V2
-- Connects document compliance to claim eligibility and upgrades agency/client intake.
begin;

alter table public.agencies
  add column if not exists owner_contact_name text,
  add column if not exists operating_states text[] not null default '{}',
  add column if not exists service_categories text[] not null default '{}',
  add column if not exists application_note text,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists application_review_note text;

alter table public.marketplace_jobs
  add column if not exists service_type text not null default 'standard_patrol',
  add column if not exists requested_start text not null default 'now',
  add column if not exists client_contact_phone text,
  add column if not exists access_notes text;

create index if not exists marketplace_jobs_service_idx
on public.marketplace_jobs(service_type, priority, status, created_at desc);

create or replace function public.submit_agency_application(
  p_owner_contact_name text,
  p_operating_states text[] default array['FL'],
  p_service_categories text[] default array['unarmed'],
  p_license_number text default null,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_agency_id uuid; v_name text; v_status public.agency_status;
begin
  select agency_id, agency_name, agency_status into v_agency_id, v_name, v_status
  from public.resolve_my_agency_workspace();

  if v_agency_id is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;

  update public.agencies
     set owner_contact_name = nullif(trim(p_owner_contact_name),''),
         operating_states = coalesce(p_operating_states,array['FL']),
         service_categories = coalesce(p_service_categories,array['unarmed']),
         license_number = nullif(trim(p_license_number),''),
         application_note = nullif(trim(p_note),''),
         application_submitted_at = now(),
         status = case when status='approved' then status else 'pending'::public.agency_status end
   where id = v_agency_id;

  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload)
  values(auth.uid(),'agency_application_submitted','agency',v_agency_id,jsonb_build_object('states',p_operating_states,'services',p_service_categories));

  return jsonb_build_object('agency_id',v_agency_id,'submitted',true,'status','pending');
end $$;

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
  from public.marketplace_jobs j join public.properties pr on pr.id=j.property_id join public.clients c on c.id=j.client_id
  where (j.status='open' and v_can_claim) or j.accepted_agency_id=v_agency_id;

  return jsonb_build_object(
    'agency',jsonb_build_object('id',v_agency_id,'name',v_agency_name,'status',v_agency_status),
    'compliance',v_compliance,
    'can_claim',v_can_claim,
    'access',jsonb_build_object('profile_status',v_profile_status,'can_claim',v_can_claim,'claim_block_reason',case when v_agency_status<>'approved' then 'AGENCY_NOT_APPROVED' when v_profile_status<>'approved' then 'ACCOUNT_NOT_APPROVED' when v_compliance->>'status'<>'compliant' then 'COMPLIANCE_INCOMPLETE' else null end),
    'jobs',v_jobs
  );
end $$;

create or replace function public.claim_marketplace_job_rc1a(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_user_id uuid:=auth.uid(); v_agency_id uuid; v_agency_status public.agency_status; v_profile_status public.account_status;
  v_compliance jsonb; v_claimed public.marketplace_jobs;
begin
  select agency_id, agency_status into v_agency_id, v_agency_status from public.resolve_my_agency_workspace();
  if v_agency_id is null then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_FOUND'); end if;
  select account_status into v_profile_status from public.profiles where id=v_user_id;
  v_compliance:=public.compute_agency_compliance_status(v_agency_id);

  if v_agency_status <> 'approved' then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_APPROVED'); end if;
  if v_profile_status <> 'approved' then return jsonb_build_object('accepted',false,'reason','ACCOUNT_NOT_APPROVED'); end if;
  if v_compliance->>'status' <> 'compliant' then return jsonb_build_object('accepted',false,'reason','COMPLIANCE_INCOMPLETE','compliance',v_compliance); end if;

  update public.marketplace_jobs set status='accepted',accepted_agency_id=v_agency_id,accepted_at=now(),updated_at=now()
  where id=p_job_id and status='open' and accepted_agency_id is null returning * into v_claimed;
  if v_claimed.id is null then return jsonb_build_object('accepted',false,'reason','ALREADY_CLAIMED_OR_UNAVAILABLE','job_id',p_job_id); end if;
  insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,v_agency_id,'awaiting_guard') on conflict(job_id) do update set agency_id=excluded.agency_id,status='awaiting_guard';
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,v_user_id,'agency_claimed',jsonb_build_object('agency_id',v_agency_id,'status','accepted'));
  return jsonb_build_object('accepted',true,'reason',null,'job_id',p_job_id,'agency_id',v_agency_id);
end $$;

create or replace function public.create_marketplace_job_v2(
  p_property_id uuid,
  p_title text,
  p_instructions text default null,
  p_priority public.job_priority default 'standard',
  p_scheduled_for timestamptz default null,
  p_duration_minutes integer default 60,
  p_service_type text default 'standard_patrol',
  p_requested_start text default 'now',
  p_client_contact_phone text default null,
  p_access_notes text default null
)
returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client_id uuid; v_job_id uuid;
begin
  if auth.uid() is null then raise exception 'Your session has expired. Sign in again.' using errcode='28000'; end if;
  select c.id into v_client_id from public.clients c join public.profiles p on p.id=c.user_id where c.user_id=auth.uid() and p.role='client' and p.account_status='approved' limit 1;
  if v_client_id is null then raise exception 'Your approved Client workspace could not be resolved.' using errcode='42501'; end if;
  if not exists(select 1 from public.properties p where p.id=p_property_id and p.client_id=v_client_id and p.archived_at is null) then raise exception 'Select an active property owned by your Client account.' using errcode='23514'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Mission title is required.' using errcode='23514'; end if;
  if p_duration_minutes not between 15 and 1440 then raise exception 'Mission duration must be between 15 minutes and 24 hours.' using errcode='23514'; end if;

  insert into public.marketplace_jobs(client_id,property_id,title,instructions,priority,status,scheduled_for,duration_minutes,accepted_agency_id,accepted_at,service_type,requested_start,client_contact_phone,access_notes)
  values(v_client_id,p_property_id,btrim(p_title),nullif(btrim(p_instructions),''),p_priority,'open',p_scheduled_for,p_duration_minutes,null,null,coalesce(nullif(btrim(p_service_type),''),'standard_patrol'),coalesce(nullif(btrim(p_requested_start),''),'now'),nullif(btrim(p_client_contact_phone),''),nullif(btrim(p_access_notes),''))
  returning id into v_job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(v_job_id,auth.uid(),'client_submitted',jsonb_build_object('status','open','property_id',p_property_id,'service_type',p_service_type,'requested_start',p_requested_start));
  return v_job_id;
end $$;

revoke all on function public.submit_agency_application(text,text[],text[],text,text) from public;
revoke all on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text) from public;
grant execute on function public.submit_agency_application(text,text[],text[],text,text) to authenticated;
grant execute on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text) to authenticated;

grant execute on function public.get_agency_workspace_rc1a() to authenticated;
grant execute on function public.claim_marketplace_job_rc1a(uuid) to authenticated;
commit;
