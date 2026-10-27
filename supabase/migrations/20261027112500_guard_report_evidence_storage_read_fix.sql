-- Guard report evidence read: compare the storage object's bucket-relative name
-- directly with the registered evidence path. Keep mission-evidence private.
drop policy if exists mission_evidence_developer_guard_report_read on storage.objects;
create policy mission_evidence_developer_guard_report_read on storage.objects
for select to authenticated
using (
  bucket_id='mission-evidence'
  and public.current_role()='platform_admin'::public.app_role
  and exists (
    select 1
    from public.mission_evidence_media m
    join public.marketplace_jobs j on j.id=m.job_id
    where m.storage_path = name
      and coalesce(j.pricing_snapshot->>'developer_test','false')='true'
  )
);
