-- CANDIDATE ONLY: isolated integration testing required; no production approval granted.
-- No existing jobs are backfilled. Automatic capture starts disabled.
BEGIN;
CREATE SCHEMA IF NOT EXISTS copisec_payments;
REVOKE ALL ON SCHEMA copisec_payments FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA copisec_payments TO service_role;
CREATE TABLE copisec_payments.operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES public.marketplace_jobs(id),
 action text NOT NULL CHECK(action IN ('capture','void','refund')),
 state text NOT NULL DEFAULT 'processing' CHECK(state IN ('processing','approved','declined','unknown')),
 actor_user_id uuid,
 transaction_id text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 prior_payment_status text NOT NULL,
 prior_job_payout text NOT NULL,
 prior_job_hold text,
 prior_financial_payout text NOT NULL,
 prior_financial_hold text NOT NULL,
 processor_response jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_unresolved_payment_operation_per_job
 ON copisec_payments.operations(job_id) WHERE state IN ('processing','unknown');
ALTER TABLE copisec_payments.operations ENABLE ROW LEVEL SECURITY;
CREATE TABLE copisec_payments.capture_outbox (
 job_id uuid PRIMARY KEY REFERENCES public.marketplace_jobs(id),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','succeeded','blocked','unknown')),
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE copisec_payments.capture_outbox ENABLE ROW LEVEL SECURITY;
CREATE TABLE copisec_payments.control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 automatic_capture_enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE copisec_payments.control ENABLE ROW LEVEL SECURITY;
INSERT INTO copisec_payments.control(singleton) VALUES(true);
REVOKE ALL ON ALL TABLES IN SCHEMA copisec_payments FROM PUBLIC,anon,authenticated;

CREATE FUNCTION copisec_payments.enqueue_completed_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,copisec_payments AS $$
BEGIN
 IF NEW.status::text='completed' AND NEW.payment_status='authorized'
 AND coalesce(NEW.pricing_snapshot->>'developer_test','false')<>'true'
 AND nullif(NEW.processor_transaction_id,'') IS NOT NULL THEN
  INSERT INTO copisec_payments.capture_outbox(job_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION copisec_payments.enqueue_completed_capture() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enqueue_server_verified_capture
AFTER INSERT OR UPDATE OF status,payment_status ON public.marketplace_jobs
FOR EACH ROW EXECUTE FUNCTION copisec_payments.enqueue_completed_capture();

CREATE FUNCTION public.reserve_payment_operation_rc1(p_job_id uuid,p_action text,p_actor_user_id uuid,p_amount_cents integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,copisec_payments AS $$
DECLARE j public.marketplace_jobs%rowtype; f public.job_financials%rowtype;
 o copisec_payments.operations%rowtype; actor_role text; amount integer; required integer; guard_ids uuid[]; g uuid; cp integer;
 expected text; progressing text; success text;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('capture','void','refund') THEN RAISE EXCEPTION 'INVALID_PAYMENT_ACTION'; END IF;
 SELECT * INTO j FROM public.marketplace_jobs WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
 IF coalesce(j.pricing_snapshot->>'developer_test','false')='true' THEN RAISE EXCEPTION 'DEVELOPER_TEST_PROCESSOR_FORBIDDEN'; END IF;
 IF p_actor_user_id IS NULL THEN
  IF p_action<>'capture' OR NOT EXISTS(SELECT 1 FROM copisec_payments.capture_outbox WHERE job_id=j.id AND state='processing')
   THEN RAISE EXCEPTION 'SERVER_CAPTURE_CLAIM_REQUIRED'; END IF;
 ELSE
  SELECT role::text INTO actor_role FROM public.profiles WHERE id=p_actor_user_id AND account_status::text='approved';
  IF actor_role IS NULL THEN RAISE EXCEPTION 'APPROVED_ACCOUNT_REQUIRED'; END IF;
  IF actor_role<>'platform_admin' AND NOT(p_action='void' AND actor_role='client' AND EXISTS(SELECT 1 FROM public.clients WHERE id=j.client_id AND user_id=p_actor_user_id))
   THEN RAISE EXCEPTION 'PAYMENT_ACTOR_FORBIDDEN'; END IF;
 END IF;
 expected:=CASE WHEN p_action='refund' THEN 'captured' ELSE 'authorized' END;
 progressing:=CASE p_action WHEN 'capture' THEN 'capturing' WHEN 'void' THEN 'voiding' ELSE 'refunding' END;
 success:=CASE p_action WHEN 'capture' THEN 'captured' WHEN 'void' THEN 'voided' ELSE 'refunded' END;
 SELECT * INTO f FROM public.job_financials WHERE job_id=j.id FOR UPDATE;
 IF NOT FOUND OR f.payment_status<>j.payment_status OR f.processor_transaction_id IS DISTINCT FROM j.processor_transaction_id
 OR nullif(j.processor_transaction_id,'') IS NULL OR f.total_cents<=0 OR f.total_cents<>j.estimated_total_cents THEN RAISE EXCEPTION 'FINANCIAL_RECONCILIATION_FAILED'; END IF;
 amount:=coalesce(p_amount_cents,f.total_cents);
 IF amount<>f.total_cents THEN RAISE EXCEPTION 'FULL_AMOUNT_REQUIRED'; END IF;
 IF j.payment_status=success THEN
  SELECT * INTO o FROM copisec_payments.operations WHERE job_id=j.id AND action=p_action AND state='approved' AND transaction_id=j.processor_transaction_id AND amount_cents=f.total_cents ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN to_jsonb(o); END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM copisec_payments.operations WHERE job_id=j.id AND state IN ('processing','unknown')) THEN RAISE EXCEPTION 'PAYMENT_RECONCILIATION_REQUIRED'; END IF;
 IF j.payment_status<>expected THEN RAISE EXCEPTION 'PAYMENT_STATE_CHANGED'; END IF;
 IF p_action='capture' THEN
  IF j.status::text<>'completed' THEN RAISE EXCEPTION 'COMPLETED_MISSION_REQUIRED'; END IF;
  required:=greatest(1,coalesce(j.required_guards,1));
  IF required>1 THEN SELECT array_agg(DISTINCT guard_id) INTO guard_ids FROM public.job_guard_slots WHERE job_id=j.id AND status='completed' AND guard_id IS NOT NULL;
  ELSE SELECT array_agg(DISTINCT guard_id) INTO guard_ids FROM public.job_assignments WHERE job_id=j.id AND status='completed' AND guard_id IS NOT NULL; END IF;
  IF coalesce(cardinality(guard_ids),0)<required THEN RAISE EXCEPTION 'MISSION_STAFFING_INCOMPLETE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mission_reports WHERE job_id=j.id AND status::text IN ('pending_review','clarification_requested')) THEN RAISE EXCEPTION 'MISSION_REPORT_NOT_READY'; END IF;
  FOREACH g IN ARRAY guard_ids LOOP
   FOREACH cp IN ARRAY ARRAY[2,4] LOOP
    IF NOT EXISTS(SELECT 1 FROM public.mission_evidence_media m JOIN storage.objects s ON s.bucket_id='mission-evidence' AND s.name=m.storage_path
      WHERE m.job_id=j.id AND m.guard_id=g AND m.checkpoint_index=cp AND m.kind='photo') THEN RAISE EXCEPTION 'REQUIRED_SECURED_PHOTO_MISSING'; END IF;
   END LOOP;
  END LOOP;
 ELSIF p_action='void' THEN
  IF j.status::text='completed' THEN RAISE EXCEPTION 'PRE_COMPLETION_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.job_assignments WHERE job_id=j.id AND status NOT IN ('completed','cancelled','declined'))
  OR EXISTS(SELECT 1 FROM public.job_guard_slots WHERE job_id=j.id AND guard_id IS NOT NULL AND status NOT IN ('completed','cancelled','declined')) THEN RAISE EXCEPTION 'OPERATIONAL_CANCELLATION_REQUIRED'; END IF;
 ELSE
  IF j.payout_status='paid' OR f.payout_status='paid' THEN RAISE EXCEPTION 'PAYOUT_ALREADY_PAID'; END IF;
 END IF;
 INSERT INTO copisec_payments.operations(job_id,action,actor_user_id,transaction_id,amount_cents,prior_payment_status,prior_job_payout,prior_job_hold,prior_financial_payout,prior_financial_hold)
 VALUES(j.id,p_action,p_actor_user_id,j.processor_transaction_id,amount,j.payment_status,j.payout_status,j.payout_hold_reason,f.payout_status,f.hold_reason) RETURNING * INTO o;
 UPDATE public.marketplace_jobs SET payment_status=progressing,payout_status='not_ready',payout_hold_reason='processor_action_in_progress',updated_at=now() WHERE id=j.id;
 UPDATE public.job_financials SET payment_status=progressing,payout_status='not_ready',hold_reason='processor_action_in_progress',updated_at=now() WHERE job_id=j.id;
 RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.reserve_payment_operation_rc1(uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_operation_rc1(uuid,text,uuid,integer) TO service_role;

CREATE FUNCTION public.finalize_payment_operation_rc1(p_operation_id uuid,p_outcome text,p_response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,copisec_payments AS $$
DECLARE o copisec_payments.operations%rowtype; j public.marketplace_jobs%rowtype; f public.job_financials%rowtype;
 job_key uuid; progressing text; result text; payout text; hold text;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('approved','declined','unknown') THEN RAISE EXCEPTION 'INVALID_PROCESSOR_OUTCOME'; END IF;
 SELECT job_id INTO job_key FROM copisec_payments.operations WHERE id=p_operation_id;
 IF job_key IS NULL THEN RAISE EXCEPTION 'PAYMENT_OPERATION_NOT_FOUND'; END IF;
 SELECT * INTO j FROM public.marketplace_jobs WHERE id=job_key FOR UPDATE;
 SELECT * INTO f FROM public.job_financials WHERE job_id=job_key FOR UPDATE;
 SELECT * INTO o FROM copisec_payments.operations WHERE id=p_operation_id FOR UPDATE;
 IF o.state=p_outcome THEN RETURN to_jsonb(o); END IF;
 IF o.state<>'processing' THEN RAISE EXCEPTION 'PAYMENT_OPERATION_ALREADY_FINAL'; END IF;
 progressing:=CASE o.action WHEN 'capture' THEN 'capturing' WHEN 'void' THEN 'voiding' ELSE 'refunding' END;
 IF j.payment_status<>progressing OR f.payment_status<>progressing OR j.processor_transaction_id IS DISTINCT FROM o.transaction_id
 OR f.processor_transaction_id IS DISTINCT FROM o.transaction_id OR f.total_cents<>o.amount_cents THEN RAISE EXCEPTION 'PAYMENT_FINALIZATION_CONFLICT'; END IF;
 result:=CASE WHEN p_outcome='declined' THEN o.prior_payment_status WHEN p_outcome='unknown' THEN o.action||'_unknown'
 WHEN o.action='capture' THEN 'captured' WHEN o.action='void' THEN 'voided' ELSE 'refunded' END;
 payout:=CASE WHEN p_outcome='approved' AND o.action='capture' THEN 'held_until_report' ELSE 'not_ready' END;
 hold:=CASE WHEN p_outcome='unknown' THEN 'payment_reconciliation_required' WHEN o.action='capture' THEN 'report_required_before_payout' WHEN o.action='void' THEN 'payment_voided' ELSE 'payment_refunded' END;
 UPDATE public.marketplace_jobs SET payment_status=result,
  payout_status=CASE WHEN p_outcome='declined' THEN o.prior_job_payout ELSE payout END,
  payout_hold_reason=CASE WHEN p_outcome='declined' THEN o.prior_job_hold ELSE hold END,
  processor_response=coalesce(p_response,'{}'),updated_at=now() WHERE id=job_key;
 IF p_outcome='approved' AND o.action='void' THEN UPDATE public.marketplace_jobs SET status='cancelled' WHERE id=job_key; END IF;
 UPDATE public.job_financials SET payment_status=result,
  payout_status=CASE WHEN p_outcome='declined' THEN o.prior_financial_payout ELSE payout END,
  hold_reason=CASE WHEN p_outcome='declined' THEN o.prior_financial_hold ELSE hold END,
  processor_response=coalesce(p_response,'{}'),updated_at=now() WHERE job_id=job_key;
 UPDATE copisec_payments.operations SET state=p_outcome,processor_response=coalesce(p_response,'{}'),updated_at=now() WHERE id=o.id RETURNING * INTO o;
 INSERT INTO public.mission_events(job_id,actor_user_id,event_type,payload)
 VALUES(job_key,o.actor_user_id,'payment_'||o.action||'_'||p_outcome,jsonb_build_object('operation_id',o.id,'status',result,'amount_cents',o.amount_cents));
 IF o.action='capture' THEN UPDATE copisec_payments.capture_outbox SET state=CASE p_outcome WHEN 'approved' THEN 'succeeded' WHEN 'unknown' THEN 'unknown' ELSE 'blocked' END,
 last_error=CASE WHEN p_outcome='approved' THEN NULL ELSE p_outcome END,updated_at=now() WHERE job_id=job_key; END IF;
 RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.finalize_payment_operation_rc1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment_operation_rc1(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.claim_server_capture_jobs_rc1(p_limit integer DEFAULT 5)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,copisec_payments AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM copisec_payments.control WHERE automatic_capture_enabled) THEN RETURN; END IF;
 RETURN QUERY WITH picked AS (SELECT job_id FROM copisec_payments.capture_outbox WHERE state='pending' AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT least(20,greatest(1,p_limit)))
 UPDATE copisec_payments.capture_outbox q SET state='processing',attempts=q.attempts+1,updated_at=now() FROM picked p WHERE q.job_id=p.job_id RETURNING q.job_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_server_capture_jobs_rc1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_server_capture_jobs_rc1(integer) TO service_role;

CREATE FUNCTION public.record_server_capture_failure_rc1(p_job_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,copisec_payments AS $$
BEGIN
 UPDATE copisec_payments.capture_outbox q SET state=CASE WHEN EXISTS(SELECT 1 FROM copisec_payments.operations WHERE job_id=q.job_id AND state IN ('processing','unknown')) THEN 'unknown' ELSE 'blocked' END,last_error=left(p_reason,500),updated_at=now() WHERE job_id=p_job_id AND state='processing';
END $$;
REVOKE ALL ON FUNCTION public.record_server_capture_failure_rc1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_server_capture_failure_rc1(uuid,text) TO service_role;

-- Keep the existing admin reconciliation API compatible with operation reservations.
create or replace function public.resolve_payment_lifecycle_unknown_rc1(p_job_id uuid,p_outcome text,p_note text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,copisec_payments set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials; v_outcome text:=lower(btrim(coalesce(p_outcome,''))); v_note text:=nullif(btrim(coalesce(p_note,'')),''); v_expected text; v_event text; v_payout text; v_hold text; v_job_status text;
begin
 if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
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
 update public.marketplace_jobs set payment_status=v_expected,payout_status=v_payout,payout_hold_reason=v_hold,updated_at=now() where id=p_job_id;
 if v_job_status='cancelled' then update public.marketplace_jobs set status='cancelled' where id=p_job_id;end if;
 update public.job_financials set payment_status=v_expected,payout_status=v_payout,hold_reason=v_hold,updated_at=now() where job_id=p_job_id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),v_event,jsonb_build_object('outcome',v_expected,'processor','maverick_easy_pay_direct','transaction_id',j.processor_transaction_id,'note',v_note,'resolved_by',auth.uid()));
 update copisec_payments.operations set state=case when v_outcome in ('captured','voided','refunded') then 'approved' else 'declined' end,processor_response=processor_response||jsonb_build_object('reconciled_outcome',v_expected,'verification_note',v_note,'resolved_by',auth.uid()),updated_at=now() where job_id=p_job_id and state='unknown';
 update copisec_payments.capture_outbox set state=case when v_expected='captured' then 'succeeded' else 'blocked' end,last_error=case when v_expected='captured' then null else 'Manually reconciled; explicit retry required' end,updated_at=now() where job_id=p_job_id;
 return jsonb_build_object('success',true,'job_id',p_job_id,'outcome',v_expected);
end $$;

REVOKE ALL ON FUNCTION public.resolve_payment_lifecycle_unknown_rc1(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_payment_lifecycle_unknown_rc1(uuid,text,text) TO authenticated,service_role;

CREATE FUNCTION public.recover_server_capture_leases_rc1() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,copisec_payments AS $$
DECLARE item record; recovered integer:=0;
BEGIN
 -- Expired processor reservations become UNKNOWN, never automatically retryable.
 FOR item IN SELECT id FROM copisec_payments.operations WHERE state='processing' AND updated_at<now()-interval '10 minutes' LOOP
  BEGIN
   PERFORM public.finalize_payment_operation_rc1(item.id,'unknown',jsonb_build_object('reason','Processor reservation lease expired; manual reconciliation required'));
   recovered:=recovered+1;
  EXCEPTION WHEN OTHERS THEN
   UPDATE copisec_payments.capture_outbox q SET state='unknown',last_error='Lease recovery conflict; manual reconciliation required',updated_at=now() FROM copisec_payments.operations o WHERE o.id=item.id AND q.job_id=o.job_id;
  END;
 END LOOP;
 -- A worker that crashed BEFORE making a reservation cannot have called the processor.
 UPDATE copisec_payments.capture_outbox q SET state=case when attempts<3 then 'pending' else 'blocked' end,last_error='Unreserved worker lease expired',updated_at=now()
 WHERE q.state='processing' AND q.updated_at<now()-interval '10 minutes'
 AND NOT EXISTS(SELECT 1 FROM copisec_payments.operations o WHERE o.job_id=q.job_id AND o.state IN ('processing','unknown'));
 RETURN recovered;
END $$;
REVOKE ALL ON FUNCTION public.recover_server_capture_leases_rc1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_server_capture_leases_rc1() TO service_role;
COMMIT;
