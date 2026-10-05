-- Co Pilot Security Marketplace OS — Marketplace Operations + Money Engine V1
-- Pricing, estimates, payout holds, notifications, service compliance, and risk-ready request fields.
begin;

alter table public.clients
  add column if not exists verification_status text not null default 'verified',
  add column if not exists risk_level text not null default 'low',
  add column if not exists risk_note text,
  add column if not exists stripe_customer_id text;

alter table public.agencies
  add column if not exists stripe_connected_account_id text,
  add column if not exists payout_status text not null default 'not_connected';

alter table public.marketplace_jobs
  add column if not exists estimated_total_cents integer,
  add column if not exists platform_fee_cents integer,
  add column if not exists agency_payout_cents integer,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists payment_status text not null default 'estimate_only',
  add column if not exists payout_status text not null default 'not_ready',
  add column if not exists payout_hold_reason text,
  add column if not exists client_risk_level text not null default 'low';

create table if not exists public.pricing_rules(
  service_type text primary key,
  label text not null,
  base_rate_cents integer not null,
  flat_fee_cents integer not null default 0,
  minimum_minutes integer not null default 60,
  platform_fee_bps integer not null default 2500,
  agency_minimum_payout_cents integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.job_financials(
  job_id uuid primary key references public.marketplace_jobs(id) on delete cascade,
  client_id uuid references public.clients(id),
  agency_id uuid references public.agencies(id),
  service_type text not null,
  duration_minutes integer not null,
  subtotal_cents integer not null,
  priority_surcharge_cents integer not null default 0,
  after_hours_surcharge_cents integer not null default 0,
  total_cents integer not null,
  platform_fee_cents integer not null,
  agency_payout_cents integer not null,
  payment_status text not null default 'estimate_only',
  payout_status text not null default 'held_until_report',
  hold_reason text not null default 'report_required_before_payout',
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_notifications(
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.profiles(id),
  recipient_role public.app_role,
  agency_id uuid references public.agencies(id),
  client_id uuid references public.clients(id),
  guard_id uuid references public.guards(id),
  job_id uuid references public.marketplace_jobs(id),
  type text not null,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.pricing_rules(service_type,label,base_rate_cents,flat_fee_cents,minimum_minutes,platform_fee_bps,agency_minimum_payout_cents) values
 ('unarmed_patrol','Unarmed patrol',6500,0,60,2500,1500),
 ('standard_patrol','Unarmed patrol',6500,0,60,2500,1500),
 ('mobile_patrol','Mobile property check',0,5900,30,2500,1500),
 ('event_security','Event security',7500,0,120,2500,1500),
 ('alarm_response','Alarm response',6500,9500,60,2500,2000),
 ('armed_guard','Armed guard request',11000,0,120,2500,2500)
on conflict(service_type) do update set
 label=excluded.label,base_rate_cents=excluded.base_rate_cents,flat_fee_cents=excluded.flat_fee_cents,
 minimum_minutes=excluded.minimum_minutes,platform_fee_bps=excluded.platform_fee_bps,
 agency_minimum_payout_cents=excluded.agency_minimum_payout_cents,updated_at=now();

create index if not exists job_financials_status_idx on public.job_financials(payment_status,payout_status,created_at desc);
create index if not exists platform_notifications_recipient_idx on public.platform_notifications(recipient_user_id,read_at,created_at desc);
create index if not exists platform_notifications_role_idx on public.platform_notifications(recipient_role,read_at,created_at desc);

alter table public.pricing_rules enable row level security;
alter table public.job_financials enable row level security;
alter table public.platform_notifications enable row level security;

drop policy if exists pricing_rules_read on public.pricing_rules;
create policy pricing_rules_read on public.pricing_rules for select to authenticated using(active=true or public.current_role()='platform_admin'::public.app_role);

drop policy if exists job_financials_scope on public.job_financials;
create policy job_financials_scope on public.job_financials for select to authenticated using(
 public.current_role()='platform_admin'::public.app_role
 or client_id in(select id from public.clients where user_id=auth.uid())
 or agency_id in(select public.user_agency_ids())
);
drop policy if exists platform_notifications_scope on public.platform_notifications;
create policy platform_notifications_scope on public.platform_notifications for select to authenticated using(
 recipient_user_id=auth.uid()
 or recipient_role=public.current_role()
 or agency_id in(select public.user_agency_ids())
 or client_id in(select id from public.clients where user_id=auth.uid())
 or public.current_role()='platform_admin'::public.app_role
);

create or replace function public.calculate_job_estimate(
 p_service_type text,
 p_priority public.job_priority default 'standard',
 p_duration_minutes integer default 60,
 p_scheduled_for timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
 r public.pricing_rules; v_minutes integer; v_subtotal integer; v_priority integer:=0; v_after integer:=0;
 v_total integer; v_fee_bps integer; v_fee integer; v_payout integer; v_hour integer;
begin
 select * into r from public.pricing_rules where service_type=coalesce(nullif(p_service_type,''),'standard_patrol') and active=true;
 if r.service_type is null then select * into r from public.pricing_rules where service_type='standard_patrol'; end if;
 v_minutes:=greatest(coalesce(p_duration_minutes,60),r.minimum_minutes);
 v_subtotal:=r.flat_fee_cents + ceiling((r.base_rate_cents::numeric*v_minutes::numeric)/60)::integer;
 if p_priority='priority' then v_priority:=ceiling(v_subtotal*.25)::integer; end if;
 if p_priority='emergency' then v_priority:=ceiling(v_subtotal*.35)::integer; end if;
 if p_scheduled_for is not null then v_hour:=extract(hour from p_scheduled_for at time zone 'America/New_York')::int; if v_hour>=22 or v_hour<6 then v_after:=ceiling(v_subtotal*.20)::integer; end if; end if;
 v_total:=v_subtotal+v_priority+v_after;
 v_fee_bps:=case when p_priority='emergency' then 3000 when p_priority='priority' then 2500 else r.platform_fee_bps end;
 v_fee:=greatest(1500,ceiling(v_total::numeric*v_fee_bps/10000)::integer);
 v_payout:=greatest(r.agency_minimum_payout_cents,v_total-v_fee);
 return jsonb_build_object('service_type',r.service_type,'label',r.label,'duration_minutes',v_minutes,'subtotal_cents',v_subtotal,'priority_surcharge_cents',v_priority,'after_hours_surcharge_cents',v_after,'total_cents',v_total,'platform_fee_cents',v_fee,'agency_payout_cents',v_payout,'platform_fee_bps',v_fee_bps,'payment_status','estimate_only','payout_status','held_until_report');
end $$;
create or replace function public.agency_can_claim_service(p_agency_id uuid,p_service_type text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_compliance jsonb; v_missing text[]:=array[]::text[];
begin
 v_compliance:=public.compute_agency_compliance_status(p_agency_id);
 if v_compliance->>'status'<>'compliant' then return jsonb_build_object('allowed',false,'reason','COMPLIANCE_INCOMPLETE','compliance',v_compliance); end if;
 if coalesce(p_service_type,'')='armed_guard' and not exists(select 1 from public.agency_documents where agency_id=p_agency_id and document_type='armed_endorsement' and status='approved' and (expires_on is null or expires_on>=current_date)) then
   v_missing:=array['armed_endorsement'];
   return jsonb_build_object('allowed',false,'reason','ARMED_DOCS_REQUIRED','missing',to_jsonb(v_missing));
 end if;
 return jsonb_build_object('allowed',true,'reason',null,'compliance',v_compliance);
end $$;

create or replace function public.get_client_job_estimate(
 p_property_id uuid,
 p_service_type text,
 p_priority public.job_priority default 'standard',
 p_duration_minutes integer default 60,
 p_scheduled_for timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client_id uuid;
begin
 select id into v_client_id from public.clients where user_id=auth.uid() limit 1;
 if v_client_id is null then raise exception 'CLIENT_WORKSPACE_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.properties where id=p_property_id and client_id=v_client_id and archived_at is null) then raise exception 'PROPERTY_NOT_FOUND' using errcode='23514'; end if;
 return public.calculate_job_estimate(p_service_type,p_priority,p_duration_minutes,p_scheduled_for);
end $$;

create or replace function public.notify_role(p_role public.app_role,p_job_id uuid,p_type text,p_title text,p_body text,p_priority text default 'normal')
returns void language sql security definer set search_path=public set row_security=off as $$
 insert into public.platform_notifications(recipient_role,job_id,type,title,body,priority)
 values(p_role,p_job_id,p_type,p_title,p_body,p_priority);
$$;
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
declare v_client_id uuid; v_job_id uuid; v_est jsonb; v_risk text;
begin
  if auth.uid() is null then raise exception 'Your session has expired. Sign in again.' using errcode='28000'; end if;
  select c.id,c.risk_level into v_client_id,v_risk from public.clients c join public.profiles p on p.id=c.user_id where c.user_id=auth.uid() and p.role='client' and p.account_status='approved' limit 1;
  if v_client_id is null then raise exception 'Your approved Client workspace could not be resolved.' using errcode='42501'; end if;
  if not exists(select 1 from public.properties p where p.id=p_property_id and p.client_id=v_client_id and p.archived_at is null) then raise exception 'Select an active property owned by your Client account.' using errcode='23514'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Mission title is required.' using errcode='23514'; end if;
  if p_duration_minutes not between 15 and 1440 then raise exception 'Mission duration must be between 15 minutes and 24 hours.' using errcode='23514'; end if;

  v_est:=public.calculate_job_estimate(p_service_type,p_priority,p_duration_minutes,p_scheduled_for);
  insert into public.marketplace_jobs(client_id,property_id,title,instructions,priority,status,scheduled_for,duration_minutes,accepted_agency_id,accepted_at,service_type,requested_start,client_contact_phone,access_notes,estimated_total_cents,platform_fee_cents,agency_payout_cents,pricing_snapshot,payment_status,payout_status,payout_hold_reason,client_risk_level,payout_cents)
  values(v_client_id,p_property_id,btrim(p_title),nullif(btrim(p_instructions),''),p_priority,'open',p_scheduled_for,(v_est->>'duration_minutes')::int,null,null,v_est->>'service_type',coalesce(nullif(btrim(p_requested_start),''),'now'),nullif(btrim(p_client_contact_phone),''),nullif(btrim(p_access_notes),''),(v_est->>'total_cents')::int,(v_est->>'platform_fee_cents')::int,(v_est->>'agency_payout_cents')::int,v_est,'estimate_only','held_until_report','payment_authorization_pending',(v_risk),(v_est->>'agency_payout_cents')::int)
  returning id into v_job_id;
  insert into public.job_financials(job_id,client_id,service_type,duration_minutes,subtotal_cents,priority_surcharge_cents,after_hours_surcharge_cents,total_cents,platform_fee_cents,agency_payout_cents,payment_status,payout_status,hold_reason)
  values(v_job_id,v_client_id,v_est->>'service_type',(v_est->>'duration_minutes')::int,(v_est->>'subtotal_cents')::int,(v_est->>'priority_surcharge_cents')::int,(v_est->>'after_hours_surcharge_cents')::int,(v_est->>'total_cents')::int,(v_est->>'platform_fee_cents')::int,(v_est->>'agency_payout_cents')::int,'estimate_only','held_until_report','payment_authorization_pending');

  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(v_job_id,auth.uid(),'client_submitted',jsonb_build_object('status','open','property_id',p_property_id,'service_type',v_est->>'service_type','requested_start',p_requested_start,'pricing',v_est));
  perform public.notify_role('agency_admin',v_job_id,'new_marketplace_job','New marketplace job',btrim(p_title)||' is waiting in Marketplace.',case when p_priority='emergency' then 'urgent' else 'normal' end);
  perform public.notify_role('platform_admin',v_job_id,'client_request_submitted','Client submitted request',btrim(p_title)||' entered the marketplace.',case when p_priority='emergency' then 'urgent' else 'normal' end);
  return v_job_id;
end $$;

create or replace function public.get_agency_workspace_rc1a()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_user_id uuid := auth.uid();
  v_agency_id uuid; v_agency_name text; v_agency_status public.agency_status;
  v_profile_status public.account_status; v_jobs jsonb; v_compliance jsonb; v_can_claim boolean;
begin
  select w.agency_id, w.agency_name, w.agency_status into v_agency_id, v_agency_name, v_agency_status from public.resolve_my_agency_workspace() w;
  if v_agency_id is null then raise exception 'AGENCY_NOT_FOUND: No Agency workspace is connected to this account.' using errcode='42501'; end if;
  insert into public.agency_members(agency_id,user_id,role,is_active) values(v_agency_id,v_user_id,'agency_admin',true) on conflict(agency_id,user_id) do update set role='agency_admin',is_active=true;
  select p.account_status into v_profile_status from public.profiles p where p.id=v_user_id;
  v_compliance:=public.compute_agency_compliance_status(v_agency_id);
  v_can_claim:=v_agency_status='approved' and v_profile_status='approved' and v_compliance->>'status'='compliant';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',j.id,'title',j.title,'instructions',j.instructions,'status',j.status,'priority',j.priority,
    'accepted_agency_id',j.accepted_agency_id,'accepted_at',j.accepted_at,'scheduled_for',j.scheduled_for,
    'duration_minutes',j.duration_minutes,'payout_cents',coalesce(j.agency_payout_cents,j.payout_cents),'required_guards',j.required_guards,
    'service_type',coalesce(j.service_type,'standard_patrol'),'requested_start',coalesce(j.requested_start,'now'),
    'client_contact_phone',j.client_contact_phone,'access_notes',j.access_notes,
    'estimated_total_cents',j.estimated_total_cents,'platform_fee_cents',j.platform_fee_cents,'agency_payout_cents',j.agency_payout_cents,
    'payment_status',j.payment_status,'payout_status',j.payout_status,'payout_hold_reason',j.payout_hold_reason,
    'can_claim',v_can_claim,'claim_block_reason',case when v_agency_status<>'approved' then 'AGENCY_NOT_APPROVED' when v_profile_status<>'approved' then 'ACCOUNT_NOT_APPROVED' when v_compliance->>'status'<>'compliant' then 'COMPLIANCE_INCOMPLETE' else null end,
    'created_at',j.created_at,'updated_at',j.updated_at,
    'property',jsonb_build_object('name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'latitude',pr.latitude,'longitude',pr.longitude,'photo_url',pr.photo_url),
    'client',jsonb_build_object('display_name',c.display_name,'risk_level',c.risk_level)
  ) order by j.created_at desc),'[]'::jsonb) into v_jobs
  from public.marketplace_jobs j join public.properties pr on pr.id=j.property_id join public.clients c on c.id=j.client_id
  where j.status='open' or j.accepted_agency_id=v_agency_id;

  return jsonb_build_object('agency',jsonb_build_object('id',v_agency_id,'name',v_agency_name,'status',v_agency_status),'compliance',v_compliance,'can_claim',v_can_claim,'access',jsonb_build_object('profile_status',v_profile_status,'can_claim',v_can_claim,'claim_block_reason',case when v_agency_status<>'approved' then 'AGENCY_NOT_APPROVED' when v_profile_status<>'approved' then 'ACCOUNT_NOT_APPROVED' when v_compliance->>'status'<>'compliant' then 'COMPLIANCE_INCOMPLETE' else null end),'jobs',v_jobs);
end $$;

create or replace function public.claim_marketplace_job_rc1a(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_user_id uuid:=auth.uid(); v_agency_id uuid; v_agency_status public.agency_status; v_profile_status public.account_status;
  v_service text; v_access jsonb; v_claimed public.marketplace_jobs;
begin
  select agency_id,agency_status into v_agency_id,v_agency_status from public.resolve_my_agency_workspace();
  if v_agency_id is null then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_FOUND'); end if;
  select account_status into v_profile_status from public.profiles where id=v_user_id;
  select service_type into v_service from public.marketplace_jobs where id=p_job_id;
  v_access:=public.agency_can_claim_service(v_agency_id,coalesce(v_service,'standard_patrol'));
  if v_agency_status<>'approved' then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_APPROVED'); end if;
  if v_profile_status<>'approved' then return jsonb_build_object('accepted',false,'reason','ACCOUNT_NOT_APPROVED'); end if;
  if coalesce((v_access->>'allowed')::boolean,false)=false then return jsonb_build_object('accepted',false,'reason',coalesce(v_access->>'reason','COMPLIANCE_INCOMPLETE'),'access',v_access); end if;

  update public.marketplace_jobs set status='accepted',accepted_agency_id=v_agency_id,accepted_at=now(),updated_at=now(),payout_status='held_until_report',payout_hold_reason='report_required_before_payout'
  where id=p_job_id and status='open' and accepted_agency_id is null returning * into v_claimed;
  if v_claimed.id is null then return jsonb_build_object('accepted',false,'reason','ALREADY_CLAIMED_OR_UNAVAILABLE','job_id',p_job_id); end if;
  update public.job_financials set agency_id=v_agency_id,payout_status='held_until_report',hold_reason='report_required_before_payout',updated_at=now() where job_id=p_job_id;
  insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,v_agency_id,'awaiting_guard') on conflict(job_id) do update set agency_id=excluded.agency_id,status='awaiting_guard';
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,v_user_id,'agency_claimed',jsonb_build_object('agency_id',v_agency_id,'status','accepted','payout_status','held_until_report'));
  perform public.notify_role('platform_admin',p_job_id,'agency_claimed_job','Agency claimed job','Agency claimed a marketplace job; payout is held until report.', 'normal');
  return jsonb_build_object('accepted',true,'reason',null,'job_id',p_job_id,'agency_id',v_agency_id,'payout_status','held_until_report');
end $$;

drop function if exists public.review_mission_report(uuid,text,text);
create function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid; v_report public.mission_reports;
begin
  select agency_id into v_agency from public.resolve_my_agency_workspace();
  if v_agency is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
  select * into v_report from public.mission_reports where id=p_report_id for update;
  if v_report.id is null or v_report.agency_id<>v_agency then raise exception 'REPORT_NOT_FOUND' using errcode='40400'; end if;
  if p_action='publish' then
    update public.mission_reports set status='published',agency_review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
    update public.job_financials set payout_status='ready_for_payout',hold_reason='stripe_payout_not_connected',updated_at=now() where job_id=v_report.job_id;
    update public.marketplace_jobs set payout_status='ready_for_payout',payout_hold_reason='stripe_payout_not_connected',updated_at=now() where id=v_report.job_id;
    perform public.notify_role('platform_admin',v_report.job_id,'report_published_payout_ready','Report published','Agency report published; payout is ready once Stripe is connected.', 'normal');
  elsif p_action='clarification' then
    update public.mission_reports set status='clarification_requested',clarification_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
    update public.job_financials set payout_status='held_until_report',hold_reason='report_clarification_requested',updated_at=now() where job_id=v_report.job_id;
    update public.marketplace_jobs set payout_status='held_until_report',payout_hold_reason='report_clarification_requested',updated_at=now() where id=v_report.job_id;
  else raise exception 'Unsupported report action.' using errcode='22023'; end if;
  return v_report;
end $$;

grant execute on function public.review_mission_report(uuid,text,text) to authenticated;
revoke all on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz) from public;
revoke all on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz) from public;
grant execute on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz) to authenticated;
grant execute on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz) to authenticated;
commit;
