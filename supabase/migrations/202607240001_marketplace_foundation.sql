-- Co Pilot Security Marketplace v1.2.0 foundation
create extension if not exists pgcrypto;

create type public.app_role as enum ('platform_admin','agency_admin','guard','client');
create type public.agency_status as enum ('pending','approved','suspended','rejected');
create type public.account_status as enum ('pending','approved','disabled','rejected');
create type public.job_status as enum ('open','accepted','assigned','active','completed','cancelled');
create type public.job_priority as enum ('standard','priority','emergency');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  account_status public.account_status not null default 'pending',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  name text not null,
  status public.agency_status not null default 'pending',
  license_number text,
  service_radius_miles numeric(6,2) not null default 25,
  created_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null check (role in ('agency_admin','guard')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (agency_id,user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table public.guards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  badge_number text,
  availability text not null default 'offline' check (availability in ('offline','available','reserved','on_mission')),
  current_latitude double precision,
  current_longitude double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.marketplace_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  property_id uuid not null references public.properties(id),
  title text not null,
  instructions text,
  priority public.job_priority not null default 'standard',
  status public.job_status not null default 'open',
  scheduled_for timestamptz,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  payout_cents integer check (payout_cents >= 0),
  required_guards integer not null default 1 check (required_guards > 0),
  accepted_agency_id uuid references public.agencies(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique not null references public.marketplace_jobs(id) on delete cascade,
  agency_id uuid not null references public.agencies(id),
  guard_id uuid references public.guards(id),
  status text not null default 'awaiting_guard' check (status in ('awaiting_guard','offered','accepted','en_route','arrived','active','completed','cancelled')),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create table public.mission_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- Creates the application profile immediately after Supabase Auth creates a user.
-- Public signup is restricted to clients and agency administrators through user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path=public
as $$
declare
  requested_role public.app_role;
  new_agency_id uuid;
begin
  requested_role := case
    when new.raw_user_meta_data->>'account_type' = 'agency_admin' then 'agency_admin'::public.app_role
    else 'client'::public.app_role
  end;

  insert into public.profiles(id, role, account_status, full_name)
  values(new.id, requested_role, 'pending', nullif(new.raw_user_meta_data->>'full_name',''));

  if requested_role = 'agency_admin' then
    insert into public.agencies(owner_user_id, name, status)
    values(new.id, coalesce(nullif(new.raw_user_meta_data->>'agency_name',''), 'New Agency'), 'pending')
    returning id into new_agency_id;
    insert into public.agency_members(agency_id, user_id, role, is_active)
    values(new_agency_id, new.id, 'agency_admin', true);
  else
    insert into public.clients(user_id, display_name)
    values(new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index marketplace_jobs_open_idx on public.marketplace_jobs(status,priority,created_at desc);
create index agency_members_user_idx on public.agency_members(user_id,agency_id);
create index guards_agency_availability_idx on public.guards(agency_id,availability);
create index mission_events_job_idx on public.mission_events(job_id,created_at);

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid()
$$;

create or replace function public.user_agency_ids() returns setof uuid language sql stable security definer set search_path=public as $$
  select agency_id from public.agency_members where user_id=auth.uid() and is_active
$$;

create or replace function public.accept_marketplace_job(p_job_id uuid,p_agency_id uuid)
returns table(accepted boolean,reason text,job_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_job public.marketplace_jobs;
begin
  if not exists(select 1 from public.agency_members where agency_id=p_agency_id and user_id=auth.uid() and role='agency_admin' and is_active) then
    return query select false,'not_authorized',p_job_id; return;
  end if;
  if not exists(select 1 from public.agencies where id=p_agency_id and status='approved') then
    return query select false,'agency_not_approved',p_job_id; return;
  end if;
  update public.marketplace_jobs
    set status='accepted',accepted_agency_id=p_agency_id,accepted_at=now(),updated_at=now()
    where id=p_job_id and status='open'
    returning * into v_job;
  if v_job.id is null then return query select false,'already_accepted_or_unavailable',p_job_id; return; end if;
  insert into public.job_assignments(job_id,agency_id) values(p_job_id,p_agency_id);
  insert into public.mission_events(job_id,actor_user_id,event_type,payload)
    values(p_job_id,auth.uid(),'agency_accepted',jsonb_build_object('agency_id',p_agency_id));
  return query select true,null::text,p_job_id;
end $$;

grant execute on function public.accept_marketplace_job(uuid,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.guards enable row level security;
alter table public.marketplace_jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.mission_events enable row level security;

create policy profiles_self_or_admin on public.profiles for select using(id=auth.uid() or public.current_role()='platform_admin');
create policy agencies_visible on public.agencies for select using(status='approved' or owner_user_id=auth.uid() or public.current_role()='platform_admin');
create policy agency_members_own on public.agency_members for select using(user_id=auth.uid() or agency_id in(select public.user_agency_ids()) or public.current_role()='platform_admin');
create policy clients_self_or_platform on public.clients for select using(user_id=auth.uid() or public.current_role()='platform_admin');
create policy properties_client_or_platform on public.properties for select using(client_id in(select id from public.clients where user_id=auth.uid()) or public.current_role()='platform_admin');
create policy guards_agency_scope on public.guards for select using(agency_id in(select public.user_agency_ids()) or user_id=auth.uid() or public.current_role()='platform_admin');
create policy jobs_marketplace_visibility on public.marketplace_jobs for select using(
  public.current_role()='platform_admin'
  or client_id in(select id from public.clients where user_id=auth.uid())
  or (status='open' and public.current_role()='agency_admin')
  or accepted_agency_id in(select public.user_agency_ids())
  or id in(select ja.job_id from public.job_assignments ja join public.guards g on g.id=ja.guard_id where g.user_id=auth.uid())
);
create policy assignments_scoped on public.job_assignments for select using(agency_id in(select public.user_agency_ids()) or public.current_role()='platform_admin' or guard_id in(select id from public.guards where user_id=auth.uid()));
create policy events_scoped on public.mission_events for select using(job_id in(select id from public.marketplace_jobs));

alter publication supabase_realtime add table public.marketplace_jobs;
alter publication supabase_realtime add table public.job_assignments;
alter publication supabase_realtime add table public.mission_events;
