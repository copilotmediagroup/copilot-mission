-- Agency Settings V4: team visibility, account profile and safe deactivation controls.
create or replace function public.get_my_agency_account_center_rc1()
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid; me jsonb; members jsonb;
begin
 select am.agency_id into aid from public.agency_members am where am.user_id=auth.uid() and am.role='agency_admin' and am.is_active limit 1;
 if aid is null then raise exception 'AGENCY_NOT_FOUND'; end if;
 select jsonb_build_object('user_id',p.id,'full_name',p.full_name,'phone',p.phone,'account_status',p.account_status,'email',u.email,'created_at',p.created_at) into me from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',coalesce(p.full_name,u.email),'email',u.email,'phone',p.phone,'role',am.role,'is_active',am.is_active,'created_at',am.created_at) order by am.created_at),'[]'::jsonb) into members from public.agency_members am join public.profiles p on p.id=am.user_id join auth.users u on u.id=p.id where am.agency_id=aid and am.role='agency_admin';
 return jsonb_build_object('profile',me,'members',members);
end $$;

create or replace function public.update_my_account_profile_rc1(p_full_name text,p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 update public.profiles set full_name=nullif(trim(p_full_name),''),phone=nullif(trim(p_phone),''),updated_at=now() where id=auth.uid();
 return (select jsonb_build_object('full_name',full_name,'phone',phone,'account_status',account_status) from public.profiles where id=auth.uid());
end $$;

create or replace function public.deactivate_my_agency_account_rc1(p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid; active_jobs int;
begin
 if upper(trim(coalesce(p_confirmation,''))) <> 'DEACTIVATE' then raise exception 'CONFIRMATION_REQUIRED'; end if;
 select a.id into aid from public.agencies a where a.owner_user_id=auth.uid();
 if aid is null then raise exception 'OWNER_REQUIRED'; end if;
 select count(*) into active_jobs from public.jobs where agency_id=aid and status in ('accepted','assigned','active');
 if active_jobs>0 then raise exception 'ACTIVE_MISSIONS_EXIST'; end if;
 update public.agencies set status='suspended',updated_at=now() where id=aid;
 update public.profiles set account_status='disabled',updated_at=now() where id=auth.uid();
 update public.agency_members set is_active=false where agency_id=aid and user_id=auth.uid();
 return jsonb_build_object('deactivated',true,'agency_id',aid);
end $$;

revoke all on function public.get_my_agency_account_center_rc1() from public;
revoke all on function public.update_my_account_profile_rc1(text,text) from public;
revoke all on function public.deactivate_my_agency_account_rc1(text) from public;
grant execute on function public.get_my_agency_account_center_rc1() to authenticated;
grant execute on function public.update_my_account_profile_rc1(text,text) to authenticated;
grant execute on function public.deactivate_my_agency_account_rc1(text) to authenticated;
