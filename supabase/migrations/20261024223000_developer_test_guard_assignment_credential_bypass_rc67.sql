-- RC67: Developer Test missions use real selected Guard accounts without requiring
-- production credential verification. Production missions remain fully gated.
create or replace function public.guard_assignment_eligible_rc1(p_guard_id uuid,p_agency_id uuid,p_job_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
 select exists(
  select 1
  from public.guards g
  join public.marketplace_jobs j on j.id=p_job_id
  where g.id=p_guard_id
    and g.agency_id=p_agency_id
    and g.agency_approved=true
    and g.online_intent=true
    and (
      coalesce(j.pricing_snapshot->>'developer_test','false')='true'
      or exists(
        select 1 from public.guard_credentials gc
        where gc.guard_id=g.id
          and gc.credential_type='security_officer'
          and gc.verification_status='verified'
          and (gc.expires_on is null or gc.expires_on>=current_date)
      )
    )
    and (
      j.service_type<>'armed_guard'
      or coalesce(j.pricing_snapshot->>'developer_test','false')='true'
      or exists(
        select 1 from public.guard_credentials gc
        where gc.guard_id=g.id
          and gc.credential_type='armed_qualification'
          and gc.verification_status='verified'
          and (gc.expires_on is null or gc.expires_on>=current_date)
      )
    )
    and not public.guard_has_schedule_conflict_rc1(g.id,j.id)
 )
$$;
revoke all on function public.guard_assignment_eligible_rc1(uuid,uuid,uuid) from public,anon;
grant execute on function public.guard_assignment_eligible_rc1(uuid,uuid,uuid) to authenticated,service_role;

create or replace function public.enforce_guard_base_credential_assignment_rc1()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_developer_test boolean:=false;
begin
 if new.guard_id is not null
    and new.status not in('cancelled','declined','completed','awaiting_guard')
    and (tg_op='INSERT' or old.guard_id is distinct from new.guard_id or old.status is distinct from new.status) then
   select coalesce(j.pricing_snapshot->>'developer_test','false')='true'
     into v_developer_test
   from public.marketplace_jobs j
   where j.id=new.job_id;
   if not coalesce(v_developer_test,false) then
     perform public.require_verified_guard_base_credential_rc1(new.guard_id);
   end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_guard_base_credential_assignment_rc1() from public,anon,authenticated;
grant execute on function public.enforce_guard_base_credential_assignment_rc1() to service_role;
