-- RC52: Registered mission proof is immutable to Guards.
-- Upload authorization remains checkpoint-scoped. Storage objects that have been
-- registered in mission_evidence_media cannot be deleted by the Guard afterward.
-- Unregistered objects remain deletable by their owning Guard for failed-upload cleanup.

drop policy if exists mission_evidence_guard_delete on storage.objects;
create policy mission_evidence_guard_delete on storage.objects
for delete to authenticated
using (
  bucket_id='mission-evidence'
  and exists (
    select 1
    from public.guards g
    where g.user_id=auth.uid()
      and g.id=((storage.foldername(storage.objects.name))[2])::uuid
  )
  and not exists (
    select 1
    from public.mission_evidence_media m
    where m.storage_path=storage.objects.name
  )
);
