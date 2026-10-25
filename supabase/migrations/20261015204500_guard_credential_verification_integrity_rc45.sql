-- RC45: Agency qualification submission is not Platform verification.
-- Agency admins may submit/update credential facts, but only Platform Admin may mark them verified/rejected.
create or replace function public.submit_agency_guard_credential_rc1(
 p_guard_id uuid,p_credential_type text,p_license_number text,p_jurisdiction text,p_expires_on date default null
) returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid;v_status public.agency_status;v_id uuid;
begin
 if auth.uid() is null then raise exception 'SESSION_REQUIRED' using errcode='42501';end if;
 select agency_id,agency_status into v_agency,v_status from public.resolve_my_agency_workspace();
 if v_agency is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501';end if;
 if p_credential_type not in('security_officer','armed_qualification') then raise exception 'INVALID_CREDENTIAL_TYPE' using errcode='22023';end if;
 if nullif(trim(p_license_number),'') is null then raise exception 'LICENSE_NUMBER_REQUIRED' using errcode='22023';end if;
 if not exists(select 1 from public.guards g where g.id=p_guard_id and g.agency_id=v_agency and g.agency_approved=true) then raise exception 'GUARD_NOT_APPROVED_BY_AGENCY' using errcode='42501';end if;
 insert into public.guard_credentials(guard_id,credential_type,license_number,jurisdiction,expires_on,verification_status,verified_at,verified_by)
 values(p_guard_id,p_credential_type,trim(p_license_number),upper(trim(coalesce(nullif(p_jurisdiction,''),'FL'))),p_expires_on,'pending',null,null)
 on conflict(guard_id,credential_type,jurisdiction) do update set
   license_number=excluded.license_number,
   expires_on=excluded.expires_on,
   verification_status='pending',verified_at=null,verified_by=null,updated_at=now()
 returning id into v_id;
 return jsonb_build_object('id',v_id,'guard_id',p_guard_id,'agency_id',v_agency,'verification_status','pending');
end $$;
revoke all on function public.submit_agency_guard_credential_rc1(uuid,text,text,text,date) from public,anon;
grant execute on function public.submit_agency_guard_credential_rc1(uuid,text,text,text,date) to authenticated,service_role;

create or replace function public.review_guard_credential_rc1(p_credential_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_row public.guard_credentials;
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_status not in('verified','rejected') then raise exception 'INVALID_REVIEW_STATUS' using errcode='22023';end if;
 update public.guard_credentials set verification_status=p_status,verified_at=case when p_status='verified' then now() else null end,verified_by=auth.uid(),updated_at=now() where id=p_credential_id returning * into v_row;
 if v_row.id is null then raise exception 'CREDENTIAL_NOT_FOUND' using errcode='22023';end if;
 return jsonb_build_object('id',v_row.id,'guard_id',v_row.guard_id,'verification_status',v_row.verification_status,'verified_at',v_row.verified_at);
end $$;
revoke all on function public.review_guard_credential_rc1(uuid,text) from public,anon;
grant execute on function public.review_guard_credential_rc1(uuid,text) to authenticated,service_role;

-- Remove the broad Agency UPDATE path that allowed clients to set verification fields themselves.
drop policy if exists guard_credentials_agency_write on public.guard_credentials;
drop policy if exists guard_credentials_agency_insert on public.guard_credentials;
create policy guard_credentials_agency_insert on public.guard_credentials for insert to authenticated
 with check(exists(select 1 from public.guards g join public.agencies a on a.id=g.agency_id where g.id=guard_id and (a.owner_user_id=auth.uid() or exists(select 1 from public.agency_members am where am.agency_id=a.id and am.user_id=auth.uid() and am.role='agency_admin' and am.is_active))) and verification_status='pending' and verified_at is null and verified_by is null);
-- Any direct Agency update policy must remain pending-only with verified fields null; verification itself flows through Platform review.
