-- RC3.2 Proximity & Dispatch Intelligence Engine
-- Extends the authoritative agency live-location projection with presentation identity.
begin;

create or replace function public.get_agency_live_locations_rc12()
returns jsonb
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare
  v_agency_id uuid;
  v_now timestamptz := now();
begin
  select am.agency_id into v_agency_id
  from public.agency_members am
  where am.user_id=auth.uid() and am.is_active=true
  limit 1;

  if v_agency_id is null then
    raise exception 'AGENCY_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'guard_id',g.id,
      'name',coalesce(p.full_name,'Guard'),
      'avatar_url',p.avatar_url,
      'availability',g.availability,
      'latitude',g.current_latitude,
      'longitude',g.current_longitude,
      'last_location_at',g.last_location_at,
      'freshness',case
        when g.availability='offline' then 'offline'
        when g.last_location_at is null then 'waiting'
        when g.last_location_at >= v_now-interval '2 minutes' then 'live'
        when g.last_location_at >= v_now-interval '10 minutes' then 'stale'
        else 'expired'
      end
    ) order by p.full_name)
    from public.guards g
    join public.profiles p on p.id=g.user_id
    where g.agency_id=v_agency_id
  ),'[]'::jsonb);
end;
$$;

grant execute on function public.get_agency_live_locations_rc12() to authenticated;

commit;
