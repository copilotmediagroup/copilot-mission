create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android')),
  app_target text not null check (app_target in ('client','guard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.mobile_push_tokens enable row level security;
revoke all on public.mobile_push_tokens from public, anon, authenticated;

create or replace function public.register_mobile_push_token(p_token text,p_platform text,p_app_target text)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if nullif(btrim(p_token),'') is null then raise exception 'TOKEN_REQUIRED' using errcode='23514'; end if;
  if length(btrim(p_token)) > 4096 then raise exception 'TOKEN_TOO_LONG' using errcode='23514'; end if;
  if p_platform not in ('ios','android') then raise exception 'INVALID_PLATFORM' using errcode='23514'; end if;
  if p_app_target not in ('client','guard') then raise exception 'INVALID_APP_TARGET' using errcode='23514'; end if;
  select role::text into v_role from public.profiles where id=auth.uid();
  if v_role is distinct from p_app_target then raise exception 'APP_ROLE_MISMATCH' using errcode='42501'; end if;
  insert into public.mobile_push_tokens(user_id,token,platform,app_target)
  values(auth.uid(),btrim(p_token),p_platform,p_app_target)
  on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,app_target=excluded.app_target,updated_at=now(),last_seen_at=now();
end $$;

create or replace function public.unregister_mobile_push_token(p_token text)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if nullif(btrim(p_token),'') is null then return; end if;
  delete from public.mobile_push_tokens where token=btrim(p_token) and user_id=auth.uid();
end $$;

revoke execute on function public.register_mobile_push_token(text,text,text) from public, anon;
revoke execute on function public.unregister_mobile_push_token(text) from public, anon;

grant execute on function public.register_mobile_push_token(text,text,text) to authenticated;
grant execute on function public.unregister_mobile_push_token(text) to authenticated;

create or replace function public.unregister_all_mobile_push_tokens(p_app_target text default null)
returns integer language plpgsql security definer set search_path=public set row_security=off as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_app_target is not null and p_app_target not in ('client','guard') then raise exception 'INVALID_APP_TARGET' using errcode='23514'; end if;
  delete from public.mobile_push_tokens
  where user_id=auth.uid() and (p_app_target is null or app_target=p_app_target);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.unregister_all_mobile_push_tokens(text) from public, anon;
grant execute on function public.unregister_all_mobile_push_tokens(text) to authenticated;
