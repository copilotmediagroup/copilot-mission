-- Harden the retained legacy agency claim RPC so it cannot bypass the current payment gate.
create or replace function public.accept_marketplace_job(p_job_id uuid,p_agency_id uuid) returns table(accepted boolean,reason text,job_id uuid) language plpgsql security definer set search_path to 'public' as $function$
declare v_job public.marketplace_jobs; v_status public.job_status;
begin
 if auth.uid() is null then return query select false,'not_authorized',p_job_id; return; end if;
 if not exists(select 1 from public.agencies a where a.id=p_agency_id and (a.owner_user_id=auth.uid() or exists(select 1 from public.agency_members am where am.agency_id=a.id and am.user_id=auth.uid() and am.role='agency_admin' and am.is_active))) then return query select false,'not_authorized',p_job_id; return; end if;
 if not exists(select 1 from public.agencies where id=p_agency_id and status='approved') then return query select false,'agency_not_approved',p_job_id; return; end if;
 update public.marketplace_jobs set status='accepted',accepted_agency_id=p_agency_id,accepted_at=now(),updated_at=now() where id=p_job_id and status='open' and accepted_agency_id is null and payment_status in ('authorized','captured') returning * into v_job;
 if v_job.id is null then
  select status into v_status from public.marketplace_jobs where id=p_job_id;
  if v_status is null then return query select false,'mission_unavailable',p_job_id;
  elsif exists(select 1 from public.marketplace_jobs where id=p_job_id and status='open' and accepted_agency_id is null and payment_status not in ('authorized','captured')) then return query select false,'payment_not_authorized',p_job_id;
  else return query select false,'already_claimed',p_job_id; end if; return;
 end if;
 insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,p_agency_id,'awaiting_guard') on conflict(job_id) do nothing;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'agency_claimed',jsonb_build_object('agency_id',p_agency_id,'status','accepted','payment_status',v_job.payment_status));
 return query select true,null::text,p_job_id;
end $function$;
revoke all on function public.accept_marketplace_job(uuid,uuid) from public,anon;
grant execute on function public.accept_marketplace_job(uuid,uuid) to authenticated,service_role;
