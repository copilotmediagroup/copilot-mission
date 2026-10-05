create table if not exists public.agency_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid references public.marketplace_jobs(id) on delete set null,
  sender_user_id uuid not null references public.profiles(id),
  sender_role text not null check(sender_role in ('agency','guard','system')),
  channel text not null check(channel in ('all_guards','active_mission','post_job')),
  body text not null check(length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists agency_messages_agency_created_idx on public.agency_messages(agency_id,created_at desc);
alter table public.agency_messages enable row level security;

drop policy if exists agency_messages_scoped on public.agency_messages;
create policy agency_messages_scoped on public.agency_messages for select using(
  agency_id in(select public.user_agency_ids())
  or agency_id in(select agency_id from public.guards where user_id=auth.uid())
  or public.current_role()='platform_admin'
);

create or replace function public.current_user_agency_for_messages()
returns uuid language plpgsql security definer set search_path=public as $$
declare v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.agency_members where user_id=auth.uid() and is_active limit 1;
  if v_agency_id is null then select agency_id into v_agency_id from public.guards where user_id=auth.uid() limit 1; end if;
  return v_agency_id;
end $$;

create or replace function public.get_agency_messages()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_agency_id uuid;
begin
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',m.id,'channel',m.channel,'sender_role',m.sender_role,'sender_name',coalesce(p.full_name,case when m.sender_role='agency' then 'Agency' when m.sender_role='guard' then 'Guard' else 'Co Pilot' end),'body',m.body,'context',case m.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,'created_at',m.created_at) order by m.created_at desc)
    from (select * from public.agency_messages where agency_id=v_agency_id order by created_at desc limit 80) m
    left join public.profiles p on p.id=m.sender_user_id
  ),'[]'::jsonb);
end $$;

create or replace function public.send_agency_message(p_channel text,p_body text,p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_agency_id uuid; v_role text; v_msg public.agency_messages;
begin
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then raise exception 'MESSAGE_AGENCY_NOT_FOUND'; end if;
  if p_channel not in ('all_guards','active_mission','post_job') then raise exception 'INVALID_MESSAGE_CHANNEL'; end if;
  v_role:=case when exists(select 1 from public.guards where user_id=auth.uid() and agency_id=v_agency_id) then 'guard' else 'agency' end;
  insert into public.agency_messages(agency_id,job_id,sender_user_id,sender_role,channel,body)
  values(v_agency_id,p_job_id,auth.uid(),v_role,p_channel,trim(p_body)) returning * into v_msg;
  return jsonb_build_object('id',v_msg.id,'channel',v_msg.channel,'sender_role',v_msg.sender_role,'sender_name',coalesce((select full_name from public.profiles where id=auth.uid()),case when v_role='guard' then 'Guard' else 'Agency' end),'body',v_msg.body,'context',case v_msg.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,'created_at',v_msg.created_at);
end $$;

grant execute on function public.get_agency_messages() to authenticated;
grant execute on function public.send_agency_message(text,text,uuid) to authenticated;
do $$ begin alter publication supabase_realtime add table public.agency_messages; exception when duplicate_object then null; end $$;
