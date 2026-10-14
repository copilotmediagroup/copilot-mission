-- Allow Platform Admin Live Account Test to upload a real logo into the selected Agency's canonical branding path.
-- Normal Agency policies remain unchanged; the Agency can continue to control files under its own agency-id folder.

drop policy if exists agency_branding_developer_insert on storage.objects;
create policy agency_branding_developer_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agency-branding'
  and public.current_role() = 'platform_admin'::public.app_role
  and exists (
    select 1
    from public.agencies a
    where a.id::text = split_part(name, '/', 1)
  )
);
