-- Launch-safe manual agency payout ledger. Recording confirms an external payout; it does not move money.
create table if not exists public.agency_payout_reconciliation(
 id uuid primary key default gen_random_uuid(), job_id uuid not null unique references public.marketplace_jobs(id) on delete restrict,
 agency_id uuid not null references public.agencies(id) on delete restrict, amount_cents integer not null check(amount_cents>0),
 payout_method text not null default 'manual', external_reference text not null, note text, recorded_at timestamptz not null default now(),
 recorded_by uuid references public.profiles(id), created_at timestamptz not null default now());
create index if not exists agency_payout_reconciliation_agency_idx on public.agency_payout_reconciliation(agency_id,recorded_at desc);
alter table public.agency_payout_reconciliation enable row level security;
revoke all on public.agency_payout_reconciliation from public,anon,authenticated;
grant select,insert on public.agency_payout_reconciliation to service_role;

create or replace function public.get_platform_payout_queue() returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('job_id',j.id,'title',j.title,'agency_id',j.accepted_agency_id,'agency_name',a.name,'amount_cents',j.agency_payout_cents,'payout_status',j.payout_status,'hold_reason',j.payout_hold_reason,'payout_method',coalesce(a.payout_method,'manual'),'external_reference',r.external_reference,'recorded_at',r.recorded_at,'updated_at',j.updated_at) order by j.updated_at desc) from public.marketplace_jobs j join public.agencies a on a.id=j.accepted_agency_id left join public.agency_payout_reconciliation r on r.job_id=j.id where j.payout_status in ('ready_for_payout','paid')),'[]'::jsonb);
end $$;

create or replace function public.record_agency_payout_reconciliation(p_job_id uuid,p_external_reference text,p_note text default null) returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials; r public.agency_payout_reconciliation; v_ref text:=nullif(trim(p_external_reference),'');
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if v_ref is null then raise exception 'PAYOUT_REFERENCE_REQUIRED' using errcode='22023'; end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023'; end if;
 if j.status<>'completed' or j.payout_status<>'ready_for_payout' then raise exception 'PAYOUT_NOT_READY' using errcode='22023'; end if;
 if j.accepted_agency_id is null or coalesce(j.agency_payout_cents,0)<=0 then raise exception 'PAYOUT_DATA_INVALID' using errcode='22023'; end if;
 select * into f from public.job_financials where job_id=p_job_id for update;
 if f.job_id is null or f.payout_status<>'ready_for_payout' or f.agency_id is distinct from j.accepted_agency_id or f.agency_payout_cents<>j.agency_payout_cents then raise exception 'FINANCIAL_RECONCILIATION_FAILED' using errcode='22023'; end if;
 insert into public.agency_payout_reconciliation(job_id,agency_id,amount_cents,payout_method,external_reference,note,recorded_by) values(j.id,j.accepted_agency_id,j.agency_payout_cents,coalesce((select nullif(payout_method,'') from public.agencies where id=j.accepted_agency_id),'manual'),v_ref,nullif(trim(p_note),''),auth.uid()) on conflict(job_id) do nothing returning * into r;
 if r.id is null then raise exception 'PAYOUT_ALREADY_RECORDED' using errcode='23505'; end if;
 update public.job_financials set payout_status='paid',hold_reason=null,updated_at=now() where job_id=j.id;
 update public.marketplace_jobs set payout_status='paid',payout_hold_reason=null,updated_at=now() where id=j.id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(j.id,auth.uid(),'agency_payout_reconciled',jsonb_build_object('reconciliation_id',r.id,'agency_id',r.agency_id,'amount_cents',r.amount_cents,'method',r.payout_method,'external_reference',r.external_reference));
 perform public.notify_role('agency_admin',j.id,'agency_payout_reconciled','Agency payout recorded','Co Pilot recorded the external payout for this completed mission.','normal');
 return to_jsonb(r);
end $$;
revoke all on function public.get_platform_payout_queue() from public,anon;
revoke all on function public.record_agency_payout_reconciliation(uuid,text,text) from public,anon;
grant execute on function public.get_platform_payout_queue() to authenticated,service_role;
grant execute on function public.record_agency_payout_reconciliation(uuid,text,text) to authenticated,service_role;
