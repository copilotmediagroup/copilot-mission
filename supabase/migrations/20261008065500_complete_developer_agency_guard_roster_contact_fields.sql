create or replace function public.get_developer_agency_workspace_rc2(p_agency_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare a public.agencies;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='platform_admin') then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into a from public.agencies where id=p_agency_id;
  if a.id is null then raise exception 'AGENCY_NOT_FOUND'; end if;
  return jsonb_build_object(
    'agency',jsonb_build_object('id',a.id,'name',a.name,'status',a.status),
    'guards',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',g.id,'user_id',g.user_id,'agency_id',g.agency_id,'name',coalesce(p.full_name,'Guard'),
      'email',coalesce(u.email,''),'phone',g.phone,'badge_number',g.badge_number,
      'availability',g.availability,'avatar_url',coalesce(g.avatar_url,p.avatar_url),
      'latitude',g.current_latitude,'longitude',g.current_longitude,'last_location_at',g.last_location_at,'created_at',g.created_at
    ) order by p.full_name),'[]')
      from public.guards g left join public.profiles p on p.id=g.user_id left join auth.users u on u.id=g.user_id
      where g.agency_id=p_agency_id),
    'jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from public.marketplace_jobs j where j.accepted_agency_id=p_agency_id or j.status='open')
  );
end $$;
