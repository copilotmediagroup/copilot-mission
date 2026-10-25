-- RC49: Agency logo updates must remain inside the caller's agency prefix.
-- Existing USING was tenant-scoped, but WITH CHECK only constrained the bucket.
drop policy if exists agency_branding_update on storage.objects;
create policy agency_branding_update on storage.objects
for update to authenticated
using(
  bucket_id='agency-branding'
  and split_part(name,'/',1) in (select public.user_agency_ids()::text)
)
with check(
  bucket_id='agency-branding'
  and split_part(name,'/',1) in (select public.user_agency_ids()::text)
);
