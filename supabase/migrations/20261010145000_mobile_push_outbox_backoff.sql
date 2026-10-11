-- Add bounded exponential retry spacing so provider outages cannot create a retry storm.
alter table public.mobile_push_outbox add column if not exists next_attempt_at timestamptz not null default now();
create index if not exists mobile_push_outbox_ready_idx on public.mobile_push_outbox(next_attempt_at,created_at)
where delivered_at is null and abandoned_at is null;

create or replace function public.claim_mobile_push_outbox(p_limit integer default 25,p_stale_after_seconds integer default 300)
returns table(notification_id uuid,attempt_count integer)
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.mobile_push_outbox set abandoned_at=now(),claimed_at=null,last_error=coalesce(last_error,'MAX_ATTEMPTS_EXCEEDED')
  where delivered_at is null and abandoned_at is null and attempt_count>=5;
  return query with candidates as (
    select o.notification_id from public.mobile_push_outbox o
    where o.delivered_at is null and o.abandoned_at is null and o.attempt_count<5 and o.next_attempt_at<=now()
      and (o.claimed_at is null or o.claimed_at < now()-make_interval(secs=>greatest(60,least(coalesce(p_stale_after_seconds,300),3600))))
    order by o.next_attempt_at,o.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.mobile_push_outbox o set claimed_at=now(),attempt_count=o.attempt_count+1,last_error=null
    from candidates c where o.notification_id=c.notification_id returning o.notification_id,o.attempt_count
  ) select c.notification_id,c.attempt_count from claimed c;
end $$;

create or replace function public.finish_mobile_push_outbox(p_notification_id uuid,p_delivered boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.mobile_push_outbox set
    delivered_at=case when coalesce(p_delivered,false) then now() else delivered_at end,
    claimed_at=null,
    next_attempt_at=case when coalesce(p_delivered,false) then next_attempt_at else now()+make_interval(secs=>least(3600,30*power(2,greatest(0,attempt_count-1))::integer)) end,
    last_error=case when coalesce(p_delivered,false) then null else left(coalesce(nullif(btrim(p_error),''),'DELIVERY_FAILED'),120) end
  where notification_id=p_notification_id;
end $$;
