-- V4 agency settings center: owner-controlled profile, brand and operating preferences.
alter table public.agencies
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists public_phone text,
  add column if not exists business_address text,
  add column if not exists description text,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('agency-branding','agency-branding',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists agency_branding_read on storage.objects;
create policy agency_branding_read on storage.objects for select using(bucket_id='agency-branding');
drop policy if exists agency_branding_insert on storage.objects;
create policy agency_branding_insert on storage.objects for insert to authenticated with check(bucket_id='agency-branding' and split_part(name,'/',1) in(select public.user_agency_ids()::text));
drop policy if exists agency_branding_update on storage.objects;
create policy agency_branding_update on storage.objects for update to authenticated using(bucket_id='agency-branding' and split_part(name,'/',1) in(select public.user_agency_ids()::text)) with check(bucket_id='agency-branding');

create or replace function public.get_my_agency_settings_rc1()
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.agencies;
begin
 select ag.* into a from public.agencies ag join public.agency_members am on am.agency_id=ag.id where am.user_id=auth.uid() and am.role='agency_admin' and am.is_active limit 1;
 if a.id is null then raise exception 'AGENCY_NOT_FOUND'; end if;
 return jsonb_build_object('id',a.id,'name',a.name,'status',a.status,'license_number',a.license_number,'service_radius_miles',a.service_radius_miles,'logo_url',a.logo_url,'website',a.website,'public_phone',a.public_phone,'business_address',a.business_address,'description',a.description,'settings',a.settings,'payout_method',a.payout_method,'payout_note',a.payout_note);
end $$;

create or replace function public.update_my_agency_settings_rc1(p_name text,p_logo_url text,p_website text,p_public_phone text,p_business_address text,p_description text,p_service_radius_miles numeric,p_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 select agency_id into aid from public.agency_members where user_id=auth.uid() and role='agency_admin' and is_active limit 1;
 if aid is null then raise exception 'AGENCY_NOT_FOUND'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
 if p_service_radius_miles is null or p_service_radius_miles<1 or p_service_radius_miles>500 then raise exception 'INVALID_SERVICE_RADIUS'; end if;
 update public.agencies set name=trim(p_name),logo_url=nullif(trim(p_logo_url),''),website=nullif(trim(p_website),''),public_phone=nullif(trim(p_public_phone),''),business_address=nullif(trim(p_business_address),''),description=nullif(trim(p_description),''),service_radius_miles=p_service_radius_miles,settings=coalesce(p_settings,'{}'::jsonb),updated_at=now() where id=aid;
 return public.get_my_agency_settings_rc1();
end $$;
revoke all on function public.get_my_agency_settings_rc1() from public;
revoke all on function public.update_my_agency_settings_rc1(text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.get_my_agency_settings_rc1() to authenticated;
grant execute on function public.update_my_agency_settings_rc1(text,text,text,text,text,text,numeric,jsonb) to authenticated;
