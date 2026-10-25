-- RC44: authoritative Client withdrawal gate + financial safety.
-- Withdrawal is only permitted while a mission is still open/unclaimed.
create or replace function public.withdraw_client_job_rc2(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client uuid:=public.auth_client_id();v_job public.marketplace_jobs;v_ledger_count integer:=0;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if v_client is null then raise exception 'CLIENT_REQUIRED' using errcode='42501';end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id and client_id=v_client for update;
 if v_job.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023';end if;
 if v_job.status='cancelled' then return jsonb_build_object('withdrawn',true,'job_id',v_job.id,'status','cancelled','payment_status',v_job.payment_status);end if;
 if v_job.status<>'open' or v_job.accepted_agency_id is not null then raise exception 'JOB_ALREADY_ACCEPTED' using errcode='55000';end if;
 if exists(select 1 from public.job_assignments a where a.job_id=v_job.id and a.status not in('cancelled','declined','completed'))
    or exists(select 1 from public.job_guard_slots s where s.job_id=v_job.id and s.guard_id is not null and s.status not in('cancelled','completed'))
    or exists(select 1 from public.mission_engine_state m where m.job_id=v_job.id and m.state not in('awaiting_guard','cancelled','completed')) then
   raise exception 'MISSION_ALREADY_STAFFED' using errcode='55000';
 end if;
 -- Authorized card transactions require a processor void/reversal. Never silently label them refunded.
 if v_job.payment_status='authorized' and coalesce(v_job.processor_transaction_id,'')<>'' and coalesce(v_job.pricing_snapshot->>'developer_test','false')<>'true' then
   raise exception 'PAYMENT_REVERSAL_REQUIRED' using errcode='55000';
 end if;
 update public.marketplace_jobs set status='cancelled',payout_status='not_ready',payout_hold_reason='client_withdrawn',updated_at=now() where id=v_job.id and status='open';
 if not found then raise exception 'JOB_STATE_CHANGED' using errcode='40001';end if;
 update public.job_assignments set status='cancelled' where job_id=v_job.id and status in('awaiting_guard','offered');
 update public.job_guard_slots set status='cancelled',updated_at=now() where job_id=v_job.id and status in('awaiting_guard','offered');
 update public.mission_engine_state set state='cancelled',updated_at=now() where job_id=v_job.id and state='awaiting_guard';
 if to_regclass('public.marketplace_ledger_entries') is not null then
   update public.marketplace_ledger_entries set status='reversed',updated_at=now(),metadata=metadata||jsonb_build_object('reversal_reason','client_withdrawn') where job_id=v_job.id and status in('pending','available','held');
   get diagnostics v_ledger_count=row_count;
 end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(v_job.id,auth.uid(),'job_cancelled',jsonb_build_object('source','client','client_id',v_client,'payment_status',v_job.payment_status,'ledger_entries_reversed',v_ledger_count));
 return jsonb_build_object('withdrawn',true,'job_id',v_job.id,'status','cancelled','payment_status',v_job.payment_status,'ledger_entries_reversed',v_ledger_count);
end $$;
revoke all on function public.withdraw_client_job_rc2(uuid) from public,anon;
grant execute on function public.withdraw_client_job_rc2(uuid) to authenticated,service_role;

create or replace function public.withdraw_developer_client_job_rc1(p_client_id uuid,p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_job public.marketplace_jobs;v_ledger_count integer:=0;
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id and client_id=p_client_id for update;
 if v_job.id is null then raise exception 'JOB_NOT_FOUND' using errcode='22023';end if;
 if coalesce(v_job.pricing_snapshot->>'developer_test','false')<>'true' then raise exception 'DEVELOPER_TEST_JOB_REQUIRED' using errcode='42501';end if;
 if v_job.status='cancelled' then return jsonb_build_object('withdrawn',true,'job_id',v_job.id,'status','cancelled');end if;
 if v_job.status<>'open' or v_job.accepted_agency_id is not null then raise exception 'JOB_ALREADY_ACCEPTED' using errcode='55000';end if;
 if exists(select 1 from public.job_assignments a where a.job_id=v_job.id and a.status not in('cancelled','declined','completed')) or exists(select 1 from public.job_guard_slots s where s.job_id=v_job.id and s.guard_id is not null and s.status not in('cancelled','completed')) then raise exception 'MISSION_ALREADY_STAFFED' using errcode='55000';end if;
 update public.marketplace_jobs set status='cancelled',payout_status='not_ready',payout_hold_reason='developer_test_no_payout',updated_at=now() where id=v_job.id and status='open';
 if not found then raise exception 'JOB_STATE_CHANGED' using errcode='40001';end if;
 update public.job_assignments set status='cancelled' where job_id=v_job.id and status in('awaiting_guard','offered');
 update public.job_guard_slots set status='cancelled',updated_at=now() where job_id=v_job.id and status in('awaiting_guard','offered');
 update public.mission_engine_state set state='cancelled',updated_at=now() where job_id=v_job.id and state='awaiting_guard';
 if to_regclass('public.marketplace_ledger_entries') is not null then update public.marketplace_ledger_entries set status='reversed',updated_at=now(),metadata=metadata||jsonb_build_object('reversal_reason','developer_client_withdrawn') where job_id=v_job.id and status in('pending','available','held');get diagnostics v_ledger_count=row_count;end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(v_job.id,auth.uid(),'job_cancelled',jsonb_build_object('source','developer_live_account_test','client_id',p_client_id,'no_real_charge',true,'no_real_payout',true,'ledger_entries_reversed',v_ledger_count));
 return jsonb_build_object('withdrawn',true,'job_id',v_job.id,'status','cancelled','ledger_entries_reversed',v_ledger_count);
end $$;
revoke all on function public.withdraw_developer_client_job_rc1(uuid,uuid) from public,anon;
grant execute on function public.withdraw_developer_client_job_rc1(uuid,uuid) to authenticated,service_role;
