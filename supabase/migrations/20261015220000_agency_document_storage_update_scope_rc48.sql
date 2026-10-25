-- RC48: Preserve agency tenant scope on document object updates.
-- The prior UPDATE USING clause scoped the existing object, but WITH CHECK only checked
-- the bucket. An agency member could therefore rename/move an owned object into another
-- agency's prefix. Keep both old and new object names inside the caller's agency scope.
drop policy if exists agency_documents_storage_update on storage.objects;
create policy agency_documents_storage_update on storage.objects
for update to authenticated
using(
  bucket_id='agency-documents' and (
    public.current_role()='platform_admin'::public.app_role
    or exists(
      select 1 from public.agency_members am
      where am.user_id=auth.uid() and am.is_active=true
        and am.agency_id::text=split_part(storage.objects.name,'/',1)
    )
  )
)
with check(
  bucket_id='agency-documents' and (
    public.current_role()='platform_admin'::public.app_role
    or exists(
      select 1 from public.agency_members am
      where am.user_id=auth.uid() and am.is_active=true
        and am.agency_id::text=split_part(storage.objects.name,'/',1)
    )
  )
);
