-- Guard profile parity: return full moderated reputation, including written client feedback,
-- for both production Guard and Developer Mode selected-Guard profiles.
create or replace function public.get_my_guard_settings_rc1()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare g public.guards; p public.profiles; u_email text;
begin
  select * into g from public.guards where user_id=auth.uid();
  if g.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND'; end if;
  select * into p from public.profiles where id=g.user_id;
  select email into u_email from auth.users where id=g.user_id;
  return jsonb_build_object(
    'id',g.id,'user_id',g.user_id,'agency_id',g.agency_id,
    'name',coalesce(nullif(trim(p.full_name),''),u_email,'Guard'),
    'email',coalesce(u_email,''),'avatar_url',coalesce(g.avatar_url,p.avatar_url),
    'phone',coalesce(g.phone,p.phone),'badge_number',g.badge_number,'availability',g.availability,
    'emergency_contact_name',g.emergency_contact_name,'emergency_contact_phone',g.emergency_contact_phone,
    'preferred_shift',g.preferred_shift,'max_travel_miles',g.max_travel_miles,
    'notification_preferences',g.notification_preferences,
    'reputation',public.get_guard_reputation(g.id)
  );
end $$;
revoke all on function public.get_my_guard_settings_rc1() from public,anon;
grant execute on function public.get_my_guard_settings_rc1() to authenticated;

create or replace function public.get_developer_guard_settings_rc1(p_guard_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare g public.guards; p public.profiles; u_email text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='platform_admin') then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into g from public.guards where id=p_guard_id;
  if g.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND'; end if;
  select * into p from public.profiles where id=g.user_id;
  select email into u_email from auth.users where id=g.user_id;
  return jsonb_build_object(
    'id',g.id,'user_id',g.user_id,'agency_id',g.agency_id,
    'name',coalesce(nullif(trim(p.full_name),''),u_email,'Guard'),
    'email',coalesce(u_email,''),'avatar_url',coalesce(g.avatar_url,p.avatar_url),
    'phone',coalesce(g.phone,p.phone),'badge_number',g.badge_number,'availability',g.availability,
    'emergency_contact_name',g.emergency_contact_name,'emergency_contact_phone',g.emergency_contact_phone,
    'preferred_shift',g.preferred_shift,'max_travel_miles',g.max_travel_miles,
    'notification_preferences',g.notification_preferences,
    'reputation',public.get_guard_reputation(g.id)
  );
end $$;
revoke all on function public.get_developer_guard_settings_rc1(uuid) from public,anon;
grant execute on function public.get_developer_guard_settings_rc1(uuid) to authenticated;
