-- Repository schema parity for the Operations Copilot message-feed RPC already used by production.
-- Additive CREATE OR REPLACE only; no mission lifecycle tables or transitions are modified.
create or replace function public.operations_copilot_message_feed()
returns table(job_id uuid, message_id uuid, sender_role text, sender_name text, body text, created_at timestamptz)
language sql security definer set search_path=public set row_security=off as $$
  select mm.job_id, mm.id, mm.sender_role::text,
         coalesce(p.full_name, mm.sender_role::text) as sender_name,
         mm.body, mm.created_at
  from public.mission_messages mm
  left join public.profiles p on p.user_id=mm.sender_user_id
  join public.marketplace_jobs j on j.id=mm.job_id
  where public.current_role()='platform_admin'::public.app_role
    and mm.sender_role::text <> 'system'
    and j.status in ('accepted','assigned','active')
    and mm.created_at >= now()-interval '24 hours'
  order by mm.created_at desc;
$$;
revoke all on function public.operations_copilot_message_feed() from public,anon;
grant execute on function public.operations_copilot_message_feed() to authenticated;
