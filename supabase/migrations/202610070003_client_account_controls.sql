-- Client account controls: profile branding and safe deactivation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-branding','client-branding',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "client branding insert own" on storage.objects;
create policy "client branding insert own" on storage.objects for insert to authenticated
with check(bucket_id='client-branding' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "client branding update own" on storage.objects;
create policy "client branding update own" on storage.objects for update to authenticated
using(bucket_id='client-branding' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='client-branding' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "client branding delete own" on storage.objects;
create policy "client branding delete own" on storage.objects for delete to authenticated
using(bucket_id='client-branding' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.get_my_client_account_rc1()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 select jsonb_build_object('user_id',p.id,'full_name',p.full_name,'phone',p.phone,'avatar_url',p.avatar_url,'account_status',p.account_status,'email',u.email,'created_at',p.created_at)
 into result from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.role='client';
 if result is null then raise exception 'Client account unavailable'; end if;
 return result;
end $$;

create or replace function public.update_my_client_account_rc1(p_full_name text,p_phone text,p_avatar_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 update public.profiles set full_name=nullif(trim(p_full_name),''),phone=nullif(trim(p_phone),''),avatar_url=nullif(trim(p_avatar_url),''),updated_at=now()
 where id=auth.uid() and role='client';
 return public.get_my_client_account_rc1();
end $$;

create or replace function public.deactivate_my_client_account_rc1(p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; active_count integer;
begin
 if p_confirmation <> 'DEACTIVATE' then raise exception 'Type DEACTIVATE to confirm.'; end if;
 select id into cid from public.clients where user_id=auth.uid();
 if cid is null then raise exception 'Client workspace unavailable.'; end if;
 select count(*) into active_count from public.marketplace_jobs where client_id=cid and status in ('open','accepted','assigned','active');
 if active_count > 0 then raise exception 'Complete or cancel active security requests before deactivating your account.'; end if;
 update public.profiles set account_status='disabled',updated_at=now() where id=auth.uid() and role='client';
 return jsonb_build_object('deactivated',true);
end $$;

grant execute on function public.get_my_client_account_rc1() to authenticated;
grant execute on function public.update_my_client_account_rc1(text,text,text) to authenticated;
grant execute on function public.deactivate_my_client_account_rc1(text) to authenticated;
