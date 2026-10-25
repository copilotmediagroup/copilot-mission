-- RC51: Revalidate Guard credentials when a mission becomes operational.
-- Assignment-time checks alone are insufficient because credentials can expire/revoke
-- after an offer is created and before the Guard accepts or starts travel.
create or replace function public.require_guard_mission_credentials_rc1(p_guard_id uuid,p_job_id uuid)
returns void language plpgsql stable security definer set search_path=public set row_security=off as $$
declare v_service text;
begin
  select service_type into v_service from public.marketplace_jobs where id=p_job_id;
  if v_service is null then raise exception 'JOB_NOT_FOUND' using errcode='22023'; end if;
  if not exists(select 1 from public.guard_credentials gc where gc.guard_id=p_guard_id and gc.credential_type='security_officer' and gc.verification_status='verified' and (gc.expires_on is null or gc.expires_on>=current_date)) then raise exception 'GUARD_SECURITY_CREDENTIAL_NOT_VERIFIED' using errcode='22023'; end if;
  if v_service='armed_guard' and not exists(select 1 from public.guard_credentials gc where gc.guard_id=p_guard_id and gc.credential_type='armed_qualification' and gc.verification_status='verified' and (gc.expires_on is null or gc.expires_on>=current_date)) then raise exception 'GUARD_ARMED_CREDENTIAL_NOT_VERIFIED' using errcode='22023'; end if;
end $$;
revoke all on function public.require_guard_mission_credentials_rc1(uuid,uuid) from public,anon;
grant execute on function public.require_guard_mission_credentials_rc1(uuid,uuid) to authenticated,service_role;

create or replace function public.enforce_guard_runtime_credentials_rc1()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if new.guard_id is not null and new.state in('accepted','en_route','active','checkpoint','review') and (tg_op='INSERT' or old.guard_id is distinct from new.guard_id or old.state is distinct from new.state) then
    perform public.require_guard_mission_credentials_rc1(new.guard_id,new.job_id);
  end if;
  return new;
end $$;
revoke all on function public.enforce_guard_runtime_credentials_rc1() from public,anon;
grant execute on function public.enforce_guard_runtime_credentials_rc1() to authenticated,service_role;

drop trigger if exists mission_engine_runtime_credential_gate on public.mission_engine_state;
create trigger mission_engine_runtime_credential_gate before insert or update on public.mission_engine_state for each row execute function public.enforce_guard_runtime_credentials_rc1();
drop trigger if exists guard_slot_runtime_credential_gate on public.guard_slot_mission_state;
create trigger guard_slot_runtime_credential_gate before insert or update on public.guard_slot_mission_state for each row execute function public.enforce_guard_runtime_credentials_rc1();
