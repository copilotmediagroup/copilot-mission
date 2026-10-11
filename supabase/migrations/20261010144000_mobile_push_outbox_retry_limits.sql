-- Bound automatic push retries and expose service-only queue health.
alter table public.mobile_push_outbox add column if not exists abandoned_at timestamptz;
create index if not exists mobile_push_outbox_abandoned_idx on public.mobile_push_outbox(abandoned_at) where abandoned_at is not null;

create or replace function public.claim_mobile_push_outbox(p_limit integer default 25,p_stale_after_seconds integer default 300)
returns table(notification_id uuid,attempt_count integer)
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.mobile_push_outbox set abandoned_at=now(),claimed_at=null,last_error=coalesce(last_error,'MAX_ATTEMPTS_EXCEEDED')
  where delivered_at is null and abandoned_at is null and attempt_count>=5;
  return query with candidates as (
    select o.notification_id from public.mobile_push_outbox o
    where o.delivered_at is null and o.abandoned_at is null and o.attempt_count<5
      and (o.claimed_at is null or o.claimed_at < now()-make_interval(secs=>greatest(60,least(coalesce(p_stale_after_seconds,300),3600))))
    order by o.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.mobile_push_outbox o set claimed_at=now(),attempt_count=o.attempt_count+1,last_error=null
    from candidates c where o.notification_id=c.notification_id returning o.notification_id,o.attempt_count
  ) select c.notification_id,c.attempt_count from claimed c;
end $$;

create or replace function public.mobile_push_outbox_health()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare result jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select jsonb_build_object(
    'pending',count(*) filter(where delivered_at is null and abandoned_at is null),
    'delivered',count(*) filter(where delivered_at is not null),
    'abandoned',count(*) filter(where abandoned_at is not null),
    'oldest_pending_at',min(created_at) filter(where delivered_at is null and abandoned_at is null)
  ) into result from public.mobile_push_outbox;
  return result;
end $$;
revoke all on function public.mobile_push_outbox_health() from public,anon,authenticated;
grant execute on function public.mobile_push_outbox_health() to service_role;
