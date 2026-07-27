-- Co Pilot Security Marketplace RC3.3
-- Property & Dispatch Contract
-- One authoritative property-creation boundary. The database resolves ownership
-- from auth.uid(); the browser never gets to choose a client workspace.

create or replace function public.create_verified_client_property_rc33(
  p_property_id uuid,
  p_name text,
  p_address text,
  p_street text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_geocoding_provider text,
  p_geocoding_place_id text,
  p_photo_path text,
  p_photo_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_property_id uuid := coalesce(p_property_id, gen_random_uuid());
begin
  if v_user_id is null then
    raise exception 'Your session expired. Sign in again.' using errcode = '28000';
  end if;

  select c.id into v_client_id
  from public.clients c
  where c.user_id = v_user_id;

  if v_client_id is null then
    raise exception 'This signed-in account does not own a Client workspace. Switch to the actual Client account before creating a property.' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Property name is required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_address), '') is null then
    raise exception 'A verified property address is required.' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'Verified property coordinates are required.' using errcode = '22023';
  end if;

  insert into public.properties(
    id, client_id, name, address, formatted_address,
    street, city, state, postal_code,
    latitude, longitude, geocoding_provider, geocoding_place_id,
    photo_path, photo_url
  ) values (
    v_property_id, v_client_id, btrim(p_name), btrim(p_address), btrim(p_address),
    nullif(btrim(p_street), ''), nullif(btrim(p_city), ''), nullif(btrim(p_state), ''), nullif(btrim(p_postal_code), ''),
    p_latitude, p_longitude, nullif(btrim(p_geocoding_provider), ''), nullif(btrim(p_geocoding_place_id), ''),
    nullif(btrim(p_photo_path), ''), nullif(btrim(p_photo_url), '')
  );

  return v_property_id;
end;
$$;

grant execute on function public.create_verified_client_property_rc33(
  uuid,text,text,text,text,text,text,double precision,double precision,text,text,text,text
) to authenticated;

comment on function public.create_verified_client_property_rc33(
  uuid,text,text,text,text,text,text,double precision,double precision,text,text,text,text
) is 'Creates a verified property only inside the authenticated user''s authoritative Client workspace.';
