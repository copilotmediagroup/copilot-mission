-- Co Pilot Security Marketplace v1.3.1
-- Additive migration: verified property locations and geocoding metadata.
-- Run after 202607240002_client_portal_foundation.sql.

alter table public.properties
  add column if not exists street text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists formatted_address text,
  add column if not exists geocoding_provider text,
  add column if not exists geocoding_place_id text;

update public.properties
set formatted_address = address
where formatted_address is null and address is not null;

create index if not exists properties_location_lookup_idx
  on public.properties(state, city, postal_code);

create index if not exists properties_coordinates_idx
  on public.properties(latitude, longitude)
  where latitude is not null and longitude is not null;
