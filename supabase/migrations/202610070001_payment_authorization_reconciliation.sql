-- RC1: quarantine and reconcile payment authorizations whose gateway result is unknown.
create or replace function public.get_payment_authorization_reconciliation_queue()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'job_id',j.id,'title',j.title,'client_id',j.client_id,
      'amount_cents',coalesce(f.total_cents,j.estimated_total_cents,0),
      'payment_status',j.payment_status,'hold_reason',j.payout_hold_reason,
      'processor_transaction_id',j.processor_transaction_id,
      'processor_response',j.processor_response,'updated_at',j.updated_at
    ) order by j.updated_at asc)
    from public.marketplace_jobs j
    left join public.job_financials f on f.job_id=j.id
    where j.payment_status='authorization_unknown'
      and j.payout_hold_reason='payment_reconciliation_required'
  ),'[]'::jsonb);
end $$;

create or replace function public.resolve_payment_authorization_unknown_rc1(
  p_job_id uuid,
  p_outcome text,
  p_processor_transaction_id text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  j public.marketplace_jobs;
  v_outcome text:=lower(trim(coalesce(p_outcome,'')));
  v_tx text:=nullif(trim(coalesce(p_processor_transaction_id,'')),'');
  v_note text:=nullif(trim(coalesce(p_note,'')),'');
begin
  if not public.is_platform_admin() then
    raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if v_outcome not in ('authorized','declined') then
    raise exception 'RECONCILIATION_OUTCOME_INVALID' using errcode='22023';
  end if;
  if v_outcome='authorized' and v_tx is null then
    raise exception 'PROCESSOR_TRANSACTION_REFERENCE_REQUIRED' using errcode='22023';
  end if;

  select * into j from public.marketplace_jobs where id=p_job_id for update;
  if j.id is null then raise exception 'JOB_NOT_FOUND' using errcode='P0002'; end if;
  if j.payment_status<>'authorization_unknown' or j.payout_hold_reason<>'payment_reconciliation_required' then
    raise exception 'JOB_NOT_AWAITING_PAYMENT_RECONCILIATION' using errcode='22023';
  end if;

  if v_outcome='authorized' then
    update public.marketplace_jobs set payment_processor='maverick_easy_pay_direct',payment_status='authorized',payout_status='held_until_report',payout_hold_reason='report_required_before_payout',processor_transaction_id=v_tx,status='open',updated_at=now() where id=p_job_id;
    update public.job_financials set payment_processor='maverick_easy_pay_direct',payment_status='authorized',payout_status='held_until_report',hold_reason='report_required_before_payout',processor_transaction_id=v_tx,updated_at=now() where job_id=p_job_id;
    perform public.notify_role('agency_admin',p_job_id,'new_marketplace_job','New marketplace job',coalesce(j.title,'Security request')||' is waiting in Marketplace.','normal');
  else
    update public.marketplace_jobs set payment_processor='maverick_easy_pay_direct',payment_status='declined',payout_status='not_ready',payout_hold_reason='payment_declined',processor_transaction_id=coalesce(v_tx,processor_transaction_id),status='cancelled',updated_at=now() where id=p_job_id;
    update public.job_financials set payment_processor='maverick_easy_pay_direct',payment_status='declined',payout_status='not_ready',hold_reason='payment_declined',processor_transaction_id=coalesce(v_tx,processor_transaction_id),updated_at=now() where job_id=p_job_id;
  end if;

  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
  values(p_job_id,auth.uid(),'payment_authorization_reconciled',jsonb_build_object('outcome',v_outcome,'processor','maverick_easy_pay_direct','transaction_id',v_tx,'note',v_note,'resolved_by',auth.uid()));

  return jsonb_build_object('success',true,'job_id',p_job_id,'outcome',v_outcome,'transaction_id',v_tx);
end $$;

revoke all on function public.get_payment_authorization_reconciliation_queue() from public,anon;
revoke all on function public.resolve_payment_authorization_unknown_rc1(uuid,text,text,text) from public,anon;
grant execute on function public.get_payment_authorization_reconciliation_queue() to authenticated,service_role;
grant execute on function public.resolve_payment_authorization_unknown_rc1(uuid,text,text,text) to authenticated,service_role;
