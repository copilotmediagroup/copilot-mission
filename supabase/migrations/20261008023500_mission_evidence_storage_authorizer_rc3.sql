create or replace function public.can_upload_developer_mission_evidence_rc1(p_object_name text)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
 select public.current_role()='platform_admin'::public.app_role and exists (
  select 1 from public.marketplace_jobs j join public.job_assignments a on a.job_id=j.id join public.mission_engine_state s on s.job_id=j.id and s.guard_id=a.guard_id
  where j.id=((storage.foldername(p_object_name))[1])::uuid and a.guard_id=((storage.foldername(p_object_name))[2])::uuid
    and coalesce(j.pricing_snapshot->>'developer_test','false')='true' and s.state in ('active','checkpoint')
    and s.checkpoint_index=((storage.foldername(p_object_name))[3])::integer
 );
$$;
revoke all on function public.can_upload_developer_mission_evidence_rc1(text) from public;
grant execute on function public.can_upload_developer_mission_evidence_rc1(text) to authenticated;
drop policy if exists mission_evidence_admin_insert on storage.objects;
create policy mission_evidence_admin_insert on storage.objects for insert to authenticated with check (bucket_id='mission-evidence' and public.can_upload_developer_mission_evidence_rc1(name));
