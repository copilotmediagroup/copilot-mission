-- Unify private mission evidence reads across Live Guard, Agency, Client report, and Platform Admin.
-- Root cause: storage.objects policies queried mission_evidence_media directly, but that
-- metadata table has RLS enabled with no SELECT policies. Platform Admin appeared to work
-- only because its old storage policy bypassed the metadata join entirely.
create or replace function public.can_read_mission_evidence_object_rc1(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path=public
set row_security=off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.mission_evidence_media m
    join public.marketplace_jobs j on j.id=m.job_id
    where m.storage_path=p_object_name
      and (
        public.current_role()='platform_admin'::public.app_role
        or exists (
          select 1 from public.guards g
          where g.id=m.guard_id and g.user_id=auth.uid()
        )
        or j.accepted_agency_id in (select public.user_agency_ids())
        or exists (
          select 1 from public.mission_reports r
          where r.job_id=m.job_id
            and r.client_id=public.auth_client_id()
            and r.status in ('published','archived')
        )
      )
  );
$$;
revoke all on function public.can_read_mission_evidence_object_rc1(text) from public,anon;
grant execute on function public.can_read_mission_evidence_object_rc1(text) to authenticated,service_role;

drop policy if exists mission_evidence_admin_read on storage.objects;
drop policy if exists mission_evidence_agency_read on storage.objects;
drop policy if exists mission_evidence_guard_read on storage.objects;
drop policy if exists mission_evidence_report_read on storage.objects;
drop policy if exists mission_evidence_developer_guard_report_read on storage.objects;
drop policy if exists mission_evidence_authorized_read on storage.objects;
create policy mission_evidence_authorized_read on storage.objects
for select to authenticated
using (
  bucket_id='mission-evidence'
  and public.can_read_mission_evidence_object_rc1(name)
);
