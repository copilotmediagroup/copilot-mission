drop policy if exists mission_evidence_guard_insert on storage.objects;
create policy mission_evidence_guard_insert on storage.objects for insert to authenticated with check (bucket_id='mission-evidence' and public.can_upload_developer_mission_evidence_rc1(name));
