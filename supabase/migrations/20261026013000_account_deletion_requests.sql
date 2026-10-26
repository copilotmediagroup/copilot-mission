create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','processing','completed','cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id)
);

alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from anon;
grant select, insert on public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own
on public.account_deletion_requests for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own
on public.account_deletion_requests for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function public.request_my_account_deletion()
returns public.account_deletion_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.account_deletion_requests;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.account_deletion_requests(user_id,status,requested_at,completed_at)
  values (auth.uid(),'requested',now(),null)
  on conflict (user_id) do update
    set status='requested', requested_at=now(), completed_at=null
  returning * into result;
  return result;
end;
$$;

revoke all on function public.request_my_account_deletion() from public, anon;
grant execute on function public.request_my_account_deletion() to authenticated;
