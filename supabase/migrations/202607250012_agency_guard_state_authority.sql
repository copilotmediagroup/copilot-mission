-- RC1.2 Agency Guard State Authority
begin;
create or replace function public.get_agency_guard_state()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status; v_guards jsonb;
begin
  select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
  if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'phone',p.phone,
    'email',u.email,'badge_number',g.badge_number,'availability',g.availability,'created_at',g.created_at
  ) order by p.full_name),'[]'::jsonb) into v_guards
  from public.guards g join public.profiles p on p.id=g.user_id join auth.users u on u.id=g.user_id
  where g.agency_id=v_agency_id;
  return jsonb_build_object(
    'guards',v_guards,
    'summary',jsonb_build_object(
      'total',coalesce(jsonb_array_length(v_guards),0),
      'online',(select count(*) from public.guards where agency_id=v_agency_id and availability<>'offline'),
      'offline',(select count(*) from public.guards where agency_id=v_agency_id and availability='offline'),
      'available',(select count(*) from public.guards where agency_id=v_agency_id and availability='available'),
      'reserved',(select count(*) from public.guards where agency_id=v_agency_id and availability='reserved'),
      'on_mission',(select count(*) from public.guards where agency_id=v_agency_id and availability='on_mission')
    )
  );
end;$$;
revoke all on function public.get_agency_guard_state() from public;
grant execute on function public.get_agency_guard_state() to authenticated;
commit;
