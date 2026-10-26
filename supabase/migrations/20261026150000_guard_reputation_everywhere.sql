-- Surface guard reputation in client/agency/guard profile experiences.
create or replace function public.get_guard_rating_summary(p_guard_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
select jsonb_build_object('guard_id',p_guard_id,'average_rating',coalesce(round(avg(r.rating)::numeric,2),0),'rating_count',count(r.id)) from public.guard_ratings r where r.guard_id=p_guard_id;
$$;
revoke all on function public.get_guard_rating_summary(uuid) from public,anon;
grant execute on function public.get_guard_rating_summary(uuid) to authenticated;

create or replace function public.get_client_live_tracking_experience()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_result jsonb; v_guard_id uuid; v_avatar_url text; v_reputation jsonb;
begin
 v_result:=public.get_client_live_tracking_experience_rc13();
 if v_result is null or v_result='null'::jsonb then return v_result; end if;
 begin v_guard_id:=nullif(v_result #>> '{guard,id}','')::uuid; exception when others then v_guard_id:=null; end;
 if v_guard_id is not null then
  select coalesce(g.avatar_url,p.avatar_url) into v_avatar_url from public.guards g left join public.profiles p on p.id=g.user_id where g.id=v_guard_id limit 1;
  v_reputation:=public.get_guard_rating_summary(v_guard_id);
  v_result:=jsonb_set(v_result,'{guard,avatar_url}',to_jsonb(v_avatar_url),true);
  v_result:=jsonb_set(v_result,'{guard,reputation}',coalesce(v_reputation,'{}'::jsonb),true);
 end if;
 return v_result;
end $$;
revoke all on function public.get_client_live_tracking_experience() from public,anon;
grant execute on function public.get_client_live_tracking_experience() to authenticated;

create or replace function public.get_guard_roster()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status; v_guards jsonb; v_invites jsonb;
begin
 select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
 if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'phone',coalesce(g.phone,p.phone),'email',u.email,'badge_number',g.badge_number,'availability',g.availability,'created_at',g.created_at,'avatar_url',coalesce(g.avatar_url,p.avatar_url),'reputation',public.get_guard_rating_summary(g.id)) order by p.full_name),'[]') into v_guards from public.guards g join public.profiles p on p.id=g.user_id join auth.users u on u.id=g.user_id where g.agency_id=v_agency_id;
 update public.guard_invitations set status='expired' where agency_id=v_agency_id and status='pending' and expires_at<=now();
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'full_name',i.full_name,'phone',i.phone,'badge_number',i.badge_number,'status',i.status,'expires_at',i.expires_at,'created_at',i.created_at) order by i.created_at desc),'[]') into v_invites from public.guard_invitations i where i.agency_id=v_agency_id;
 return jsonb_build_object('guards',v_guards,'invitations',v_invites);
end $$;
revoke all on function public.get_guard_roster() from public,anon;
grant execute on function public.get_guard_roster() to authenticated;

create or replace function public.get_my_guard_settings_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare g public.guards; p public.profiles;
begin
 select * into g from public.guards where user_id=auth.uid(); if g.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND'; end if;
 select * into p from public.profiles where id=auth.uid();
 return jsonb_build_object('id',g.id,'user_id',g.user_id,'agency_id',g.agency_id,'name',coalesce(p.full_name,p.email,'Guard'),'email',p.email,'avatar_url',coalesce(g.avatar_url,p.avatar_url),'phone',g.phone,'badge_number',g.badge_number,'availability',g.availability,'emergency_contact_name',g.emergency_contact_name,'emergency_contact_phone',g.emergency_contact_phone,'preferred_shift',g.preferred_shift,'max_travel_miles',g.max_travel_miles,'notification_preferences',g.notification_preferences,'reputation',public.get_guard_rating_summary(g.id));
end $$;
revoke all on function public.get_my_guard_settings_rc1() from public,anon;
grant execute on function public.get_my_guard_settings_rc1() to authenticated;
