-- RC63: never expose or reconcile an Agency payout before the Client payment is captured.
create or replace function public.get_platform_payout_queue() returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('job_id',j.id,'title',j.title,'agency_id',j.accepted_agency_id,'agency_name',a.name,'amount_cents',j.agency_payout_cents,'payout_status',j.payout_status,'hold_reason',j.payout_hold_reason,'payout_method',coalesce(a.payout_method,'manual'),'external_reference',r.external_reference,'recorded_at',r.recorded_at,'updated_at',j.updated_at) order by j.updated_at desc) from public.marketplace_jobs j join public.agencies a on a.id=j.accepted_agency_id left join public.agency_payout_reconciliation r on r.job_id=j.id where j.payout_status='paid' or (j.payout_status='ready_for_payout' and j.payment_status='captured')),'[]'::jsonb);
end $$;

create or replace function public.record_agency_payout_reconciliation(p_job_id uuid,p_external_reference text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials; r public.agency_payout_reconciliation; v_ref text:=nullif(trim(p_external_reference),''); v_earning public.marketplace_ledger_entries;
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if v_ref is null then raise exception 'PAYOUT_REFERENCE_REQUIRED' using errcode='22023'; end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023'; end if;
 if coalesce(j.pricing_snapshot->>'developer_test','false')='true' then raise exception 'DEVELOPER_TEST_PAYOUT_FORBIDDEN' using errcode='42501'; end if;
 if j.status<>'completed' or j.payment_status<>'captured' or j.payout_status<>'ready_for_payout' then raise exception 'PAYOUT_NOT_READY' using errcode='22023'; end if;
 if j.accepted_agency_id is null or coalesce(j.agency_payout_cents,0)<=0 then raise exception 'PAYOUT_DATA_INVALID' using errcode='22023'; end if;
 select * into f from public.job_financials where job_id=p_job_id for update;
 if f.job_id is null or f.payment_status<>'captured' or f.payout_status<>'ready_for_payout' or f.agency_id is distinct from j.accepted_agency_id or f.agency_payout_cents<>j.agency_payout_cents then raise exception 'FINANCIAL_RECONCILIATION_FAILED' using errcode='22023'; end if;
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
