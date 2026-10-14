-- Canonical client live tracking: route the public client RPC through the hardened RC13 implementation.
-- RC13 keeps live/active work ahead of history, preserves completed/report handoff when no active work exists,
-- uses latest assignment/report rows, treats offline guard GPS as expired, and returns the current job update timestamp.

begin;

create or replace function public.get_client_live_tracking_experience()
returns jsonb
language sql
security definer
set search_path=public
set row_security=off
as $$
  select public.get_client_live_tracking_experience_rc13();
$$;

revoke all on function public.get_client_live_tracking_experience() from public, anon;
grant execute on function public.get_client_live_tracking_experience() to authenticated, service_role;

revoke all on function public.get_client_live_tracking_experience_rc13() from public, anon;
grant execute on function public.get_client_live_tracking_experience_rc13() to authenticated, service_role;

commit;
