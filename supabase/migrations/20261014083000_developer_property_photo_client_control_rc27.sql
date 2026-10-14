-- Preserve normal Client control of property photos uploaded by Platform Admin during Live Account Test.
-- Authorization remains path-based: only the authenticated Client whose auth.uid() is the first folder may mutate the object.

drop policy if exists property_photos_client_delete on storage.objects;
create policy property_photos_client_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-photos'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.current_role() = 'client'::public.app_role
);

drop policy if exists property_photos_client_update on storage.objects;
create policy property_photos_client_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-photos'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.current_role() = 'client'::public.app_role
)
with check (
  bucket_id = 'property-photos'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.current_role() = 'client'::public.app_role
);
