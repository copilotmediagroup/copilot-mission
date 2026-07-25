-- Co Pilot Security Marketplace v1.5.5
-- One-time additive migration: property media and reliable agency claim responses.

alter table public.properties add column if not exists photo_path text;
alter table public.properties add column if not exists photo_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('property-photos','property-photos',true,8388608,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists property_photos_client_insert on storage.objects;
create policy property_photos_client_insert on storage.objects for insert to authenticated
with check(bucket_id='property-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.current_role()='client');

drop policy if exists property_photos_client_update on storage.objects;
create policy property_photos_client_update on storage.objects for update to authenticated
using(bucket_id='property-photos' and owner_id=auth.uid()::text)
with check(bucket_id='property-photos' and owner_id=auth.uid()::text);

drop policy if exists property_photos_client_delete on storage.objects;
create policy property_photos_client_delete on storage.objects for delete to authenticated
using(bucket_id='property-photos' and owner_id=auth.uid()::text);

create or replace function public.accept_marketplace_job(p_job_id uuid,p_agency_id uuid)
returns table(accepted boolean,reason text,job_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_job public.marketplace_jobs; v_status public.job_status;
begin
  if not exists(
    select 1 from public.agencies a
    where a.id=p_agency_id and (
      a.owner_user_id=auth.uid() or exists(select 1 from public.agency_members am where am.agency_id=a.id and am.user_id=auth.uid() and am.role='agency_admin' and am.is_active)
    )
  ) then return query select false,'not_authorized',p_job_id; return; end if;

  if not exists(select 1 from public.agencies where id=p_agency_id and status='approved') then
    return query select false,'agency_not_approved',p_job_id; return;
  end if;

  update public.marketplace_jobs set status='accepted',accepted_agency_id=p_agency_id,accepted_at=now(),updated_at=now()
  where id=p_job_id and status='open' and accepted_agency_id is null returning * into v_job;

  if v_job.id is null then
    select status into v_status from public.marketplace_jobs where id=p_job_id;
    if v_status is null then return query select false,'mission_unavailable',p_job_id;
    else return query select false,'already_claimed',p_job_id; end if;
    return;
  end if;

  insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,p_agency_id,'awaiting_guard') on conflict(job_id) do nothing;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'agency_claimed',jsonb_build_object('agency_id',p_agency_id,'status','accepted'));
  return query select true,null::text,p_job_id;
end $$;

grant execute on function public.accept_marketplace_job(uuid,uuid) to authenticated;
