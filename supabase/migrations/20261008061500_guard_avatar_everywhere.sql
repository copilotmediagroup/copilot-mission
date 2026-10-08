-- Guard avatar propagation adapters. Canonical image remains guards.avatar_url.
create or replace function public.get_guard_roster()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_agency uuid; v_guards jsonb; v_invites jsonb;
begin
  select id into v_agency from public.agencies where owner_user_id=auth.uid() limit 1;
  if v_agency is null then raise exception 'AGENCY_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'phone',coalesce(g.phone,p.phone),'email',u.email,'badge_number',g.badge_number,'availability',g.availability,'avatar_url',g.avatar_url,'created_at',g.created_at) order by p.full_name),'[]') into v_guards from public.guards g join public.profiles p on p.id=g.user_id join auth.users u on u.id=g.user_id where g.agency_id=v_agency;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc),'[]') into v_invites from public.guard_invitations i where i.agency_id=v_agency;
  return jsonb_build_object('guards',v_guards,'invitations',v_invites);
end $$;
