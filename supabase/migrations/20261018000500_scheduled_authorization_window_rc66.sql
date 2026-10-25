-- RC66: prevent long-lived card authorization holds for future scheduled work.
-- NMI states authorization lifetime is processor/card-brand dependent, so Co Pilot
-- authorizes near service time instead of pretending a fixed hold duration is universal.
create or replace function public.payment_authorization_timing_rc1(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_job public.marketplace_jobs%rowtype;
  v_client uuid;
  v_now timestamptz:=now();
  v_open_at timestamptz;
  v_requires_fresh boolean:=false;
begin
  if auth.uid() is null then raise exception 'SESSION_REQUIRED' using errcode='28000'; end if;
  select * into v_job from public.marketplace_jobs where id=p_job_id;
  if v_job.id is null then raise exception 'JOB_NOT_FOUND' using errcode='P0002'; end if;
  select id into v_client from public.clients where user_id=auth.uid() limit 1;
  if public.current_role()<>'platform_admin'::public.app_role and v_job.client_id is distinct from v_client then
    raise exception 'JOB_ACCESS_DENIED' using errcode='42501';
  end if;
  if coalesce(v_job.requested_start,'now')='vacation' then
    -- Vacation packages span days and cannot safely rely on one long authorization hold.
    return jsonb_build_object('authorize_now',false,'requires_fresh_authorization',true,'reason','VACATION_REQUIRES_SERVICE_WINDOW_AUTHORIZATION','scheduled_for',v_job.scheduled_for,'authorization_opens_at',null);
  end if;
  if v_job.scheduled_for is null or coalesce(v_job.requested_start,'now')='immediate' then
    return jsonb_build_object('authorize_now',true,'requires_fresh_authorization',false,'reason','AUTHORIZATION_WINDOW_OPEN','scheduled_for',v_job.scheduled_for,'authorization_opens_at',v_now);
  end if;
  -- Conservative marketplace policy: open authorization 72h before scheduled service.
  -- This is an application window, not a claim about issuer/processor hold duration.
  v_open_at:=v_job.scheduled_for-interval '72 hours';
  v_requires_fresh:=v_now<v_open_at;
  return jsonb_build_object('authorize_now',not v_requires_fresh,'requires_fresh_authorization',v_requires_fresh,'reason',case when v_requires_fresh then 'AUTHORIZATION_NOT_YET_OPEN' else 'AUTHORIZATION_WINDOW_OPEN' end,'scheduled_for',v_job.scheduled_for,'authorization_opens_at',v_open_at);
end $$;
revoke all on function public.payment_authorization_timing_rc1(uuid) from public,anon;
grant execute on function public.payment_authorization_timing_rc1(uuid) to authenticated;
