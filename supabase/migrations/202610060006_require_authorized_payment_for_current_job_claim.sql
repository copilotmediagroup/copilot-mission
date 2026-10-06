-- Current marketplace claim path: atomic winner plus mandatory authorized payment.
create or replace function public.claim_marketplace_job_rc1a(p_job_id uuid) returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_user_id uuid:=auth.uid(); v_agency_id uuid; v_agency_status public.agency_status; v_profile_status public.account_status; v_service text; v_access jsonb; v_claimed public.marketplace_jobs;
begin
 if v_user_id is null then return jsonb_build_object('accepted',false,'reason','SESSION_REQUIRED'); end if;
 select agency_id,agency_status into v_agency_id,v_agency_status from public.resolve_my_agency_workspace();
 if v_agency_id is null then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_FOUND'); end if;
 select account_status into v_profile_status from public.profiles where id=v_user_id;
 select service_type into v_service from public.marketplace_jobs where id=p_job_id;
 v_access:=public.agency_can_claim_service(v_agency_id,coalesce(v_service,'standard_patrol'));
 if v_agency_status<>'approved' then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_APPROVED'); end if;
 if v_profile_status<>'approved' then return jsonb_build_object('accepted',false,'reason','ACCOUNT_NOT_APPROVED'); end if;
 if coalesce((v_access->>'allowed')::boolean,false)=false then return jsonb_build_object('accepted',false,'reason',coalesce(v_access->>'reason','COMPLIANCE_INCOMPLETE'),'access',v_access); end if;
 update public.marketplace_jobs set status='accepted',accepted_agency_id=v_agency_id,accepted_at=now(),updated_at=now(),payout_status='held_until_report',payout_hold_reason='report_required_before_payout' where id=p_job_id and status='open' and accepted_agency_id is null and payment_status in ('authorized','captured') returning * into v_claimed;
 if v_claimed.id is null then return jsonb_build_object('accepted',false,'reason','ALREADY_CLAIMED_UNPAID_OR_UNAVAILABLE','job_id',p_job_id); end if;
 update public.job_financials set agency_id=v_agency_id,payout_status='held_until_report',hold_reason='report_required_before_payout',updated_at=now() where job_id=p_job_id;
 insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,v_agency_id,'awaiting_guard') on conflict(job_id) do update set agency_id=excluded.agency_id,status='awaiting_guard';
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,v_user_id,'agency_claimed',jsonb_build_object('agency_id',v_agency_id,'status','accepted','payment_status',v_claimed.payment_status,'payout_status','held_until_report'));
 perform public.notify_role('platform_admin',p_job_id,'agency_claimed_job','Agency claimed job','Agency claimed a marketplace job; payout is held until report.', 'normal');
 return jsonb_build_object('accepted',true,'reason',null,'job_id',p_job_id,'agency_id',v_agency_id,'payment_status',v_claimed.payment_status,'payout_status','held_until_report');
end $function$;

revoke all on function public.claim_marketplace_job_rc1a(uuid) from public,anon;
grant execute on function public.claim_marketplace_job_rc1a(uuid) to authenticated,service_role;
