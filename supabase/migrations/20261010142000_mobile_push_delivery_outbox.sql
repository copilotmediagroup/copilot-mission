-- Durable push-delivery outbox. Additive only: notification creation/lifecycle behavior is unchanged.
create table if not exists public.mobile_push_outbox (
  notification_id uuid primary key references public.platform_notifications(id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  attempt_count integer not null default 0,
  last_error text
);
alter table public.mobile_push_outbox enable row level security;
revoke all on public.mobile_push_outbox from public,anon,authenticated;

create or replace function public.enqueue_mobile_push_notification()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
begin
  -- Only Client/Guard-targetable notifications belong in the native outbox.
  if new.recipient_user_id is not null
     or new.client_id is not null
     or new.guard_id is not null
     or new.recipient_role in ('client'::public.app_role,'guard'::public.app_role) then
    insert into public.mobile_push_outbox(notification_id) values(new.id)
    on conflict(notification_id) do nothing;
  end if;
  return new;
end $$;

revoke all on function public.enqueue_mobile_push_notification() from public,anon,authenticated;

drop trigger if exists platform_notifications_mobile_push_outbox on public.platform_notifications;
create trigger platform_notifications_mobile_push_outbox
after insert on public.platform_notifications
for each row execute function public.enqueue_mobile_push_notification();
