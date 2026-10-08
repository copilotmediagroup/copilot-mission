drop policy if exists mission_evidence_admin_insert on storage.objects;
create policy mission_evidence_admin_insert on storage.objects for insert to authenticated with check (
 bucket_id='mission-evidence'
 and public.current_role()='platform_admin'::public.app_role
 and exists (
  select 1 from public.marketplace_jobs j
  join public.job_assignments a on a.job_id=j.id
  where j.id=((storage.foldername(name))[1])::uuid
    and a.guard_id=((storage.foldername(name))[2])::uuid
    and coalesce(j.pricing_snapshot->>'developer_test','false')='true'
    and exists (select 1 from public.mission_engine_state s where s.job_id=j.id and s.guard_id=a.guard_id and s.state in ('active','checkpoint') and s.checkpoint_index=((storage.foldername(name))[3])::integer)
 )
);
