-- Co Pilot Security Marketplace OS RC3.1 — Notification Engine
-- One durable event, explicit recipients, realtime delivery, persistent unread state.
begin;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  category text not null,
  severity text not null default 'standard' check (severity in ('standard','priority','emergency','success','warning')),
  title text not null,
  body text not null,
  action_kind text,
  action_target text,
  job_id uuid references public.marketplace_jobs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  state text not null default 'unread' check (state in ('unread','read','withdrawn')),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id,user_id)
);

create index if not exists notification_recipients_user_state_created_idx
  on public.notification_recipients(user_id,state,created_at desc);
create index if not exists notification_events_job_created_idx
  on public.notification_events(job_id,created_at desc);

alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;

drop policy if exists notification_events_via_recipient on public.notification_events;
create policy notification_events_via_recipient on public.notification_events
for select using (exists (
  select 1 from public.notification_recipients nr
  where nr.event_id=notification_events.id and nr.user_id=auth.uid()
));

drop policy if exists notification_recipients_self on public.notification_recipients;
create policy notification_recipients_self on public.notification_recipients
for select using (user_id=auth.uid());

create or replace function public.publish_notification_rc31(
  p_event_key text,
  p_category text,
  p_severity text,
  p_title text,
  p_body text,
  p_action_kind text,
  p_action_target text,
  p_job_id uuid,
  p_payload jsonb,
  p_user_ids uuid[],
  p_agency_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare v_event_id uuid;
begin
  insert into public.notification_events(event_key,category,severity,title,body,action_kind,action_target,job_id,payload)
  values(p_event_key,p_category,p_severity,p_title,p_body,p_action_kind,p_action_target,p_job_id,coalesce(p_payload,'{}'::jsonb))
  on conflict(event_key) do update set event_key=excluded.event_key
  returning id into v_event_id;

  insert into public.notification_recipients(event_id,user_id,agency_id)
  select v_event_id,u,coalesce(p_agency_id,(select am.agency_id from public.agency_members am where am.user_id=u and am.is_active=true order by am.created_at limit 1))
  from unnest(coalesce(p_user_ids,array[]::uuid[])) u
  on conflict(event_id,user_id) do nothing;
  return v_event_id;
end;
$$;

create or replace function public.notify_marketplace_job_rc31()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_users uuid[]; v_severity text; v_event uuid;
begin
  if new.status <> 'open' then return new; end if;
  select coalesce(array_agg(distinct am.user_id),array[]::uuid[]) into v_users
  from public.agency_members am
  join public.agencies a on a.id=am.agency_id and a.status='approved'
  join public.profiles p on p.id=am.user_id and p.account_status='approved'
  where am.is_active=true and am.role='agency_admin';

  v_severity := case new.priority::text when 'emergency' then 'emergency' when 'priority' then 'priority' else 'standard' end;
  v_event := public.publish_notification_rc31(
    'marketplace_job:'||new.id::text,
    'marketplace',v_severity,
    case new.priority::text when 'emergency' then 'Emergency request nearby' when 'priority' then 'New priority marketplace job' else 'New marketplace job' end,
    new.title,
    'open_marketplace_job',new.id::text,new.id,
    jsonb_build_object('priority',new.priority,'scheduled_for',new.scheduled_for,'duration_minutes',new.duration_minutes),
    v_users,null
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_marketplace_job_rc31 on public.marketplace_jobs;
create trigger trg_notify_marketplace_job_rc31
after insert on public.marketplace_jobs
for each row execute function public.notify_marketplace_job_rc31();

create or replace function public.withdraw_marketplace_notification_rc31()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
begin
  if old.status='open' and new.status<>'open' then
    update public.notification_recipients nr set state='withdrawn'
    from public.notification_events ne
    where ne.id=nr.event_id and ne.event_key='marketplace_job:'||new.id::text
      and (new.accepted_agency_id is null or nr.agency_id is distinct from new.accepted_agency_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdraw_marketplace_notification_rc31 on public.marketplace_jobs;
create trigger trg_withdraw_marketplace_notification_rc31
after update of status,accepted_agency_id on public.marketplace_jobs
for each row execute function public.withdraw_marketplace_notification_rc31();

create or replace function public.get_my_notifications_rc31(p_limit integer default 40)
returns jsonb language sql security definer set search_path=public set row_security=off as $$
  select jsonb_build_object(
    'unread_count',count(*) filter(where nr.state='unread'),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'recipient_id',nr.id,'state',nr.state,'delivered_at',nr.delivered_at,'read_at',nr.read_at,
      'id',ne.id,'category',ne.category,'severity',ne.severity,'title',ne.title,'body',ne.body,
      'action_kind',ne.action_kind,'action_target',ne.action_target,'job_id',ne.job_id,
      'payload',ne.payload,'created_at',ne.created_at
    ) order by ne.created_at desc) filter(where nr.id is not null),'[]'::jsonb)
  )
  from (
    select * from public.notification_recipients
    where user_id=auth.uid() and state<>'withdrawn'
    order by created_at desc limit greatest(1,least(coalesce(p_limit,40),100))
  ) nr
  join public.notification_events ne on ne.id=nr.event_id;
$$;

create or replace function public.mark_notification_delivered_rc31(p_recipient_id uuid)
returns void language sql security definer set search_path=public set row_security=off as $$
  update public.notification_recipients set delivered_at=coalesce(delivered_at,now())
  where id=p_recipient_id and user_id=auth.uid();
$$;

create or replace function public.mark_notification_read_rc31(p_recipient_id uuid)
returns void language sql security definer set search_path=public set row_security=off as $$
  update public.notification_recipients set state='read',read_at=coalesce(read_at,now()),delivered_at=coalesce(delivered_at,now())
  where id=p_recipient_id and user_id=auth.uid();
$$;

create or replace function public.mark_all_notifications_read_rc31()
returns void language sql security definer set search_path=public set row_security=off as $$
  update public.notification_recipients set state='read',read_at=coalesce(read_at,now()),delivered_at=coalesce(delivered_at,now())
  where user_id=auth.uid() and state='unread';
$$;

do $$ begin
  alter publication supabase_realtime add table public.notification_recipients;
exception when duplicate_object then null; end $$;

grant execute on function public.get_my_notifications_rc31(integer) to authenticated;
grant execute on function public.mark_notification_delivered_rc31(uuid) to authenticated;
grant execute on function public.mark_notification_read_rc31(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read_rc31() to authenticated;

commit;
