-- Developer Live Account Test must be able to render the same secured mission evidence
-- that the selected Guard produced, without making the private bucket public.
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
    where m.storage_path=storage.objects.name
      and coalesce(j.pricing_snapshot->>'developer_test','false')='true'
  )
);
