-- RC3.4 Dynamic Marketplace Map Engine
-- Agency-owned, constrained marketplace coverage preference.
create or replace function public.set_agency_marketplace_radius_rc34(p_radius_miles numeric)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_agency_id uuid;
begin
  if p_radius_miles not in (5,10,15,25,50) then
    raise exception 'INVALID_MARKETPLACE_RADIUS';
  end if;
  select am.agency_id into v_agency_id
  from public.agency_members am
  where am.user_id=auth.uid() and am.role='agency_admin' and am.is_active=true
  limit 1;
  if v_agency_id is null then
    raise exception 'AGENCY_NOT_FOUND';
  end if;
  update public.agencies
  set service_radius_miles=p_radius_miles
  where id=v_agency_id;
  return jsonb_build_object('agency_id',v_agency_id,'service_radius_miles',p_radius_miles);
end;
$$;
revoke all on function public.set_agency_marketplace_radius_rc34(numeric) from public;
grant execute on function public.set_agency_marketplace_radius_rc34(numeric) to authenticated;
