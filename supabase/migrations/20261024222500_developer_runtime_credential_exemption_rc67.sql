-- RC67: Developer Test runtime credential isolation.
-- Real missions continue to require verified Guard credentials at runtime.
create or replace function public.require_guard_mission_credentials_rc1(p_guard_id uuid,p_job_id uuid)
returns void language plpgsql stable security definer set search_path=public set row_security=off as $$
declare
  v_service text;
  v_developer_test boolean := false;
begin
  select
    service_type,
    coalesce((pricing_snapshot->>'developer_test')::boolean,false)
  into v_service,v_developer_test
  from public.marketplace_jobs
  where id=p_job_id;

  if v_service is null then
    raise exception 'JOB_NOT_FOUND' using errcode='22023';
  end if;

  -- Developer Test missions are synthetic and isolated from real marketplace/payment
  -- operations. They may exercise the mission lifecycle with the selected real account.
  if v_developer_test then
    return;
  end if;

  if not exists(
    select 1 from public.guard_credentials gc
    where gc.guard_id=p_guard_id
      and gc.credential_type='security_officer'
      and gc.verification_status='verified'
      and (gc.expires_on is null or gc.expires_on>=current_date)
  ) then
    raise exception 'GUARD_SECURITY_CREDENTIAL_NOT_VERIFIED' using errcode='22023';
  end if;

  if v_service='armed_guard' and not exists(
    select 1 from public.guard_credentials gc
    where gc.guard_id=p_guard_id
      and gc.credential_type='armed_qualification'
      and gc.verification_status='verified'
      and (gc.expires_on is null or gc.expires_on>=current_date)
  ) then
    raise exception 'GUARD_ARMED_CREDENTIAL_NOT_VERIFIED' using errcode='22023';
  end if;
end $$;
revoke all on function public.require_guard_mission_credentials_rc1(uuid,uuid) from public,anon;
grant execute on function public.require_guard_mission_credentials_rc1(uuid,uuid) to authenticated,service_role;
