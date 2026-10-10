create or replace function public.get_client_account_for_platform_rc1(p_client_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if public.current_role() <> 'platform_admin' then raise exception 'Platform admin required'; end if;
 select jsonb_build_object('user_id',p.id,'full_name',p.full_name,'phone',p.phone,'avatar_url',p.avatar_url,'account_status',p.account_status,'email',u.email,'created_at',p.created_at)
 into result from public.clients c join public.profiles p on p.id=c.user_id join auth.users u on u.id=p.id where c.id=p_client_id;
 if result is null then raise exception 'Client account unavailable'; end if; return result;
end $$;
create or replace function public.update_client_account_for_platform_rc1(p_client_id uuid,p_full_name text,p_phone text,p_avatar_url text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target_user uuid;
begin
 if public.current_role() <> 'platform_admin' then raise exception 'Platform admin required'; end if;
 select user_id into target_user from public.clients where id=p_client_id; if target_user is null then raise exception 'Client account unavailable'; end if;
 update public.profiles set full_name=nullif(trim(p_full_name),''),phone=nullif(trim(p_phone),''),avatar_url=nullif(trim(p_avatar_url),''),updated_at=now() where id=target_user and role='client';
 return public.get_client_account_for_platform_rc1(p_client_id);
end $$;
drop policy if exists "client branding platform admin insert" on storage.objects;
create policy "client branding platform admin insert" on storage.objects for insert to authenticated with check (bucket_id='client-branding' and public.current_role()='platform_admin');
drop policy if exists "client branding platform admin update" on storage.objects;
create policy "client branding platform admin update" on storage.objects for update to authenticated using (bucket_id='client-branding' and public.current_role()='platform_admin') with check (bucket_id='client-branding' and public.current_role()='platform_admin');
