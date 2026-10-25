-- RC50: Repair deployed Developer Agency logo insert policy.
-- Qualify storage.objects.name explicitly so the agency prefix comparison cannot bind
-- to agencies.name inside the EXISTS subquery.
drop policy if exists agency_branding_developer_insert on storage.objects;
create policy agency_branding_developer_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='agency-branding'
  and public.current_role()='platform_admin'::public.app_role
  and exists (
    select 1 from public.agencies a
    where a.id::text=split_part(storage.objects.name,'/',1)
  )
);
