-- RC40: reconcile the marketplace ledger with external payouts and financial reversals.
-- Provider-neutral: these RPCs record money movement that occurred externally; they never move funds.
alter table public.marketplace_ledger_entries add column if not exists external_reference text;
alter table public.marketplace_ledger_entries add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists marketplace_ledger_external_ref_uq on public.marketplace_ledger_entries(source,external_reference,account_type) where external_reference is not null;

create or replace function public.record_agency_payout_reconciliation(p_job_id uuid,p_external_reference text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials; r public.agency_payout_reconciliation; v_ref text:=nullif(trim(p_external_reference),''); v_earning public.marketplace_ledger_entries;
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if v_ref is null then raise exception 'PAYOUT_REFERENCE_REQUIRED' using errcode='22023'; end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023'; end if;
 if coalesce(j.pricing_snapshot->>'developer_test','false')='true' then raise exception 'DEVELOPER_TEST_PAYOUT_FORBIDDEN' using errcode='42501'; end if;
 if j.status<>'completed' or j.payout_status<>'ready_for_payout' then raise exception 'PAYOUT_NOT_READY' using errcode='22023'; end if;
 if j.accepted_agency_id is null or coalesce(j.agency_payout_cents,0)<=0 then raise exception 'PAYOUT_DATA_INVALID' using errcode='22023'; end if;
 select * into f from public.job_financials where job_id=p_job_id for update;
 if f.job_id is null or f.payout_status<>'ready_for_payout' or f.agency_id is distinct from j.accepted_agency_id or f.agency_payout_cents<>j.agency_payout_cents then raise exception 'FINANCIAL_RECONCILIATION_FAILED' using errcode='22023'; end if;
 select * into v_earning from public.marketplace_ledger_entries where job_id=j.id and account_type='agency' and agency_id=j.accepted_agency_id and entry_type='earning' for update;
 if v_earning.id is null or v_earning.amount_cents<>j.agency_payout_cents or v_earning.status not in('available','held') then raise exception 'LEDGER_RECONCILIATION_FAILED' using errcode='22023'; end if;
 insert into public.agency_payout_reconciliation(job_id,agency_id,amount_cents,payout_method,external_reference,note,recorded_by)
 values(j.id,j.accepted_agency_id,j.agency_payout_cents,coalesce((select nullif(payout_method,'') from public.agencies where id=j.accepted_agency_id),'manual'),v_ref,nullif(trim(p_note),''),auth.uid())
 on conflict(job_id) do nothing returning * into r;
 if r.id is null then raise exception 'PAYOUT_ALREADY_RECORDED' using errcode='23505'; end if;
 update public.marketplace_ledger_entries set status='withdrawn',external_reference=v_ref,source='external_payout',metadata=metadata||jsonb_build_object('reconciliation_id',r.id,'payout_method',r.payout_method),updated_at=now() where id=v_earning.id;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,source,external_reference,available_at,metadata)
 values(j.id,j.accepted_agency_id,'agency','payout',j.agency_payout_cents,'withdrawn','Agency payout · '||coalesce(j.title,'Security mission'),'external_payout_record',v_ref,now(),jsonb_build_object('reconciliation_id',r.id,'payout_method',r.payout_method))
 on conflict do nothing;
 update public.job_financials set payout_status='paid',hold_reason=null,updated_at=now() where job_id=j.id;
 update public.marketplace_jobs set payout_status='paid',payout_hold_reason=null,updated_at=now() where id=j.id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(j.id,auth.uid(),'agency_payout_reconciled',jsonb_build_object('reconciliation_id',r.id,'agency_id',r.agency_id,'amount_cents',r.amount_cents,'method',r.payout_method,'external_reference',r.external_reference,'ledger_entry_id',v_earning.id));
 perform public.notify_role('agency_admin',j.id,'agency_payout_reconciled','Agency payout recorded','Co Pilot recorded the external payout for this completed mission.','normal');
 return to_jsonb(r);
end $$;

create or replace function public.record_marketplace_ledger_adjustment_rc1(p_job_id uuid,p_account_type text,p_amount_cents integer,p_reason text,p_external_reference text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; v_reason text:=nullif(btrim(p_reason),''); v_ref text:=nullif(btrim(p_external_reference),''); v_agency uuid; v_entry public.marketplace_ledger_entries; v_type text;
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_account_type not in('agency','platform') then raise exception 'INVALID_LEDGER_ACCOUNT' using errcode='22023';end if;
 if p_amount_cents=0 then raise exception 'ADJUSTMENT_AMOUNT_REQUIRED' using errcode='22023';end if;
 if v_reason is null or v_ref is null then raise exception 'ADJUSTMENT_REASON_AND_REFERENCE_REQUIRED' using errcode='22023';end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023';end if;
 if coalesce(j.pricing_snapshot->>'developer_test','false')='true' then raise exception 'DEVELOPER_TEST_FINANCIAL_ADJUSTMENT_FORBIDDEN' using errcode='42501';end if;
 if j.status<>'completed' then raise exception 'COMPLETED_JOB_REQUIRED' using errcode='22023';end if;
 v_agency:=case when p_account_type='agency' then j.accepted_agency_id else null end;
 if p_account_type='agency' and v_agency is null then raise exception 'AGENCY_REQUIRED' using errcode='22023';end if;
 v_type:=case when p_amount_cents<0 then 'refund' else 'adjustment' end;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,source,external_reference,available_at,metadata)
 values(j.id,v_agency,p_account_type,v_type,p_amount_cents,'available',v_reason,'financial_adjustment',v_ref,now(),jsonb_build_object('recorded_by',auth.uid())) returning * into v_entry;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(j.id,auth.uid(),'financial_ledger_adjusted',jsonb_build_object('ledger_entry_id',v_entry.id,'account_type',p_account_type,'amount_cents',p_amount_cents,'reason',v_reason,'external_reference',v_ref));
 return to_jsonb(v_entry);
exception when unique_violation then raise exception 'ADJUSTMENT_REFERENCE_ALREADY_RECORDED' using errcode='23505';
end $$;
revoke all on function public.record_marketplace_ledger_adjustment_rc1(uuid,text,integer,text,text) from public,anon;
grant execute on function public.record_marketplace_ledger_adjustment_rc1(uuid,text,integer,text,text) to authenticated,service_role;

create or replace function public.set_marketplace_ledger_hold_rc1(p_job_id uuid,p_hold boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; n integer;begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;if j.id is null then raise exception 'JOB_NOT_FOUND';end if;
 if coalesce(j.pricing_snapshot->>'developer_test','false')='true' then raise exception 'DEVELOPER_TEST_LEDGER_HOLD_FORBIDDEN';end if;
 update public.marketplace_ledger_entries set status=case when p_hold then 'held' else 'available' end,metadata=metadata||jsonb_build_object('hold_reason',case when p_hold then coalesce(nullif(btrim(p_reason),''),'platform_review') else null end,'hold_changed_by',auth.uid()),updated_at=now()
 where job_id=p_job_id and entry_type in('earning','adjustment','refund') and status in('available','held');get diagnostics n=row_count;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),case when p_hold then 'financial_ledger_held' else 'financial_ledger_released' end,jsonb_build_object('reason',p_reason,'entries_changed',n));
 return jsonb_build_object('job_id',p_job_id,'held',p_hold,'entries_changed',n);
end $$;
revoke all on function public.set_marketplace_ledger_hold_rc1(uuid,boolean,text) from public,anon;
grant execute on function public.set_marketplace_ledger_hold_rc1(uuid,boolean,text) to authenticated,service_role;

create or replace function public.get_my_agency_earnings_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare aid uuid;begin
 select agency_id into aid from public.agency_members where user_id=auth.uid() and status='active' limit 1;
 if aid is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501';end if;
 return jsonb_build_object('summary',jsonb_build_object(
  'pending_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='pending' and entry_type<>'payout'),0),
  'available_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='available' and entry_type<>'payout'),0),
  'held_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='held' and entry_type<>'payout'),0),
  'withdrawn_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and entry_type='payout' and status='withdrawn'),0),
  'lifetime_earned_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and entry_type in('earning','adjustment','refund') and status<>'reversed'),0)),
  'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'job_id',l.job_id,'title',j.title,'entry_type',l.entry_type,'amount_cents',l.amount_cents,'status',l.status,'description',l.description,'external_reference',l.external_reference,'available_at',l.available_at,'created_at',l.created_at) order by l.created_at desc) from public.marketplace_ledger_entries l join public.marketplace_jobs j on j.id=l.job_id where l.agency_id=aid),'[]'::jsonb),
  'withdrawals_enabled',false,'withdrawal_message','Bank withdrawals will be enabled after the marketplace payout provider is connected.');
end $$;
