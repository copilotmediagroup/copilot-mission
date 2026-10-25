-- RC64: quarantine and manually reconcile uncertain Capture/Void/Refund processor outcomes.
create or replace function public.get_payment_lifecycle_reconciliation_queue_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'job_id',j.id,'title',j.title,'client_id',j.client_id,'amount_cents',coalesce(f.total_cents,j.estimated_total_cents,0),
  'payment_status',j.payment_status,'hold_reason',j.payout_hold_reason,'processor_transaction_id',j.processor_transaction_id,
  'processor_response',j.processor_response,'payout_status',j.payout_status,'job_status',j.status,'updated_at',j.updated_at
 ) order by j.updated_at asc)
 from public.marketplace_jobs j left join public.job_financials f on f.job_id=j.id
 where j.payment_status in ('capture_unknown','void_unknown','refund_unknown') and j.payout_hold_reason='payment_reconciliation_required'),'[]'::jsonb);
end $$;

create or replace function public.resolve_payment_lifecycle_unknown_rc1(p_job_id uuid,p_outcome text,p_note text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials; v_outcome text:=lower(btrim(coalesce(p_outcome,''))); v_note text:=nullif(btrim(coalesce(p_note,'')),''); v_expected text; v_event text; v_payout text; v_hold text; v_job_status text;
begin
 if public.current_role() is distinct from 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if v_note is null then raise exception 'PROCESSOR_VERIFICATION_NOTE_REQUIRED' using errcode='22023'; end if;
 select * into j from public.marketplace_jobs where id=p_job_id for update;
 if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='P0002'; end if;
 select * into f from public.job_financials where job_id=p_job_id for update;
 if f.job_id is null or f.payment_status is distinct from j.payment_status then raise exception 'FINANCIAL_RECONCILIATION_FAILED' using errcode='22023'; end if;
 if j.payout_hold_reason<>'payment_reconciliation_required' then raise exception 'JOB_NOT_AWAITING_PAYMENT_RECONCILIATION' using errcode='22023'; end if;
 if j.payment_status='capture_unknown' then
  if v_outcome not in ('captured','authorized') then raise exception 'CAPTURE_RECONCILIATION_OUTCOME_INVALID' using errcode='22023'; end if;
  if v_outcome='captured' then v_expected:='captured';v_payout:='held_until_report';v_hold:='report_required_before_payout';v_job_status:=j.status; else v_expected:='authorized';v_payout:='not_ready';v_hold:='capture_retry_required';v_job_status:=j.status; end if;
 elsif j.payment_status='void_unknown' then
  if v_outcome not in ('voided','authorized') then raise exception 'VOID_RECONCILIATION_OUTCOME_INVALID' using errcode='22023'; end if;
  if v_outcome='voided' then v_expected:='voided';v_payout:='not_ready';v_hold:='payment_voided';v_job_status:='cancelled'; else v_expected:='authorized';v_payout:='not_ready';v_hold:='void_retry_required';v_job_status:=j.status; end if;
 elsif j.payment_status='refund_unknown' then
  if v_outcome not in ('refunded','captured') then raise exception 'REFUND_RECONCILIATION_OUTCOME_INVALID' using errcode='22023'; end if;
  if v_outcome='refunded' then v_expected:='refunded';v_payout:='not_ready';v_hold:='payment_refunded';v_job_status:=j.status; else v_expected:='captured';v_payout:='not_ready';v_hold:='refund_retry_required';v_job_status:=j.status; end if;
 else raise exception 'JOB_NOT_AWAITING_LIFECYCLE_RECONCILIATION' using errcode='22023'; end if;
 v_event:='payment_'||replace(j.payment_status,'_unknown','')||'_reconciled';
 update public.marketplace_jobs set payment_status=v_expected,payout_status=v_payout,payout_hold_reason=v_hold,status=v_job_status,updated_at=now() where id=p_job_id;
 update public.job_financials set payment_status=v_expected,payout_status=v_payout,hold_reason=v_hold,updated_at=now() where job_id=p_job_id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),v_event,jsonb_build_object('outcome',v_expected,'processor','maverick_easy_pay_direct','transaction_id',j.processor_transaction_id,'note',v_note,'resolved_by',auth.uid()));
 return jsonb_build_object('success',true,'job_id',p_job_id,'outcome',v_expected);
end $$;
revoke all on function public.get_payment_lifecycle_reconciliation_queue_rc1() from public,anon;
revoke all on function public.resolve_payment_lifecycle_unknown_rc1(uuid,text,text) from public,anon;
grant execute on function public.get_payment_lifecycle_reconciliation_queue_rc1() to authenticated,service_role;
grant execute on function public.resolve_payment_lifecycle_unknown_rc1(uuid,text,text) to authenticated,service_role;
