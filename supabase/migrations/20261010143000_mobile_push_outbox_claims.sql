-- Atomic outbox claiming/completion for a trusted server-side delivery worker.
create index if not exists mobile_push_outbox_pending_idx
on public.mobile_push_outbox(created_at)
where delivered_at is null;

create or replace function public.claim_mobile_push_outbox(p_limit integer default 25,p_stale_after_seconds integer default 300)
returns table(notification_id uuid,attempt_count integer)
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  return query
  with candidates as (
    select o.notification_id from public.mobile_push_outbox o
    where o.delivered_at is null
      and (o.claimed_at is null or o.claimed_at < now()-make_interval(secs=>greatest(60,least(coalesce(p_stale_after_seconds,300),3600))))
    order by o.created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.mobile_push_outbox o
    set claimed_at=now(),attempt_count=o.attempt_count+1,last_error=null
    from candidates c where o.notification_id=c.notification_id
    returning o.notification_id,o.attempt_count
  ) select c.notification_id,c.attempt_count from claimed c;
end $$;

create or replace function public.finish_mobile_push_outbox(p_notification_id uuid,p_delivered boolean,p_error text default null)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  update public.mobile_push_outbox set
    delivered_at=case when coalesce(p_delivered,false) then now() else delivered_at end,
    claimed_at=null,
    last_error=case when coalesce(p_delivered,false) then null else left(coalesce(nullif(btrim(p_error),''),'DELIVERY_FAILED'),120) end
  where notification_id=p_notification_id;
end $$;

revoke all on function public.claim_mobile_push_outbox(integer,integer) from public,anon,authenticated;
revoke all on function public.finish_mobile_push_outbox(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.claim_mobile_push_outbox(integer,integer) to service_role;
grant execute on function public.finish_mobile_push_outbox(uuid,boolean,text) to service_role;
