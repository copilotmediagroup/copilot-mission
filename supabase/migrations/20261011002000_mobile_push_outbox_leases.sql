-- Prevent a stale push worker from finalizing a row after another worker has reclaimed it.
alter table public.mobile_push_outbox add column if not exists claim_token uuid;

drop function if exists public.claim_mobile_push_outbox(integer,integer);
create function public.claim_mobile_push_outbox(p_limit integer default 25,p_stale_after_seconds integer default 300)
returns table(notification_id uuid,attempt_count integer,claim_token uuid)
language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update public.mobile_push_outbox set abandoned_at=coalesce(abandoned_at,now()),claimed_at=null,claim_token=null,last_error=coalesce(last_error,'MAX_ATTEMPTS')
  where delivered_at is null and abandoned_at is null and attempt_count>=5;
  return query with candidates as (
    select o.notification_id from public.mobile_push_outbox o
    where o.delivered_at is null and o.abandoned_at is null and o.attempt_count<5 and o.next_attempt_at<=now()
      and (o.claimed_at is null or o.claimed_at<now()-make_interval(secs=>greatest(30,coalesce(p_stale_after_seconds,300))))
    order by o.next_attempt_at,o.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.mobile_push_outbox o set claimed_at=now(),attempt_count=o.attempt_count+1,last_error=null,claim_token=gen_random_uuid()
    from candidates c where o.notification_id=c.notification_id returning o.notification_id,o.attempt_count,o.claim_token
  ) select c.notification_id,c.attempt_count,c.claim_token from claimed c;
end;$$;

drop function if exists public.finish_mobile_push_outbox(uuid,boolean,text);
create function public.finish_mobile_push_outbox(p_notification_id uuid,p_claim_token uuid,p_delivered boolean,p_error text default null,p_terminal boolean default false)
returns boolean language plpgsql security definer set search_path=public set row_security=off as $$
declare changed integer;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  update public.mobile_push_outbox set
    delivered_at=case when coalesce(p_delivered,false) then now() else delivered_at end,
    abandoned_at=case when not coalesce(p_delivered,false) and coalesce(p_terminal,false) then now() else abandoned_at end,
    claimed_at=null,claim_token=null,
    next_attempt_at=case when coalesce(p_delivered,false) or coalesce(p_terminal,false) then next_attempt_at else now()+make_interval(secs=>least(3600,30*power(2,greatest(0,attempt_count-1))::integer)) end,
    last_error=case when coalesce(p_delivered,false) then null else left(coalesce(p_error,'DELIVERY_FAILED'),120) end
  where notification_id=p_notification_id and claim_token=p_claim_token and delivered_at is null and abandoned_at is null;
  get diagnostics changed=row_count; return changed=1;
end;$$;
revoke all on function public.claim_mobile_push_outbox(integer,integer) from public,anon,authenticated;
revoke all on function public.finish_mobile_push_outbox(uuid,uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_mobile_push_outbox(integer,integer) to service_role;
grant execute on function public.finish_mobile_push_outbox(uuid,uuid,boolean,text,boolean) to service_role;
