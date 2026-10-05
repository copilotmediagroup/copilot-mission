-- Co Pilot Security Marketplace OS — Direct guard message threads
-- Adds agency-to-specific-guard messaging while preserving all-guard broadcasts.
begin;

alter table public.agency_messages
  add column if not exists sender_guard_id uuid references public.guards(id) on delete set null,
  add column if not exists recipient_guard_id uuid references public.guards(id) on delete set null;

create index if not exists agency_messages_recipient_guard_idx
on public.agency_messages(agency_id, recipient_guard_id, created_at desc);

create index if not exists agency_messages_sender_guard_idx
on public.agency_messages(agency_id, sender_guard_id, created_at desc);

update public.agency_messages m
set sender_guard_id = g.id
from public.guards g
where m.sender_role = 'guard'
  and m.sender_guard_id is null
  and g.agency_id = m.agency_id
  and not exists (
    select 1 from public.guards g2
    where g2.agency_id = m.agency_id and g2.id <> g.id
  );

drop policy if exists agency_messages_scoped on public.agency_messages;
create policy agency_messages_scoped on public.agency_messages for select using(
  exists(
    select 1 from public.agency_members am
    where am.agency_id = agency_messages.agency_id
      and am.user_id = auth.uid()
      and am.is_active = true
      and am.role = 'agency_admin'::public.app_role
  )
  or public.current_role() = 'platform_admin'::public.app_role
  or exists(
    select 1 from public.guards g
    where g.agency_id = agency_messages.agency_id
      and g.user_id = auth.uid()
      and (
        agency_messages.recipient_guard_id is null
        or agency_messages.recipient_guard_id = g.id
        or agency_messages.sender_guard_id = g.id
        or agency_messages.sender_user_id = auth.uid()
      )
  )
);

create or replace function public.current_user_guard_for_messages()
returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard_id uuid;
begin
  select id into v_guard_id from public.guards where user_id=auth.uid() limit 1;
  return v_guard_id;
end $$;

create or replace function public.get_agency_messages()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_guard_id uuid; v_role public.app_role;
begin
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then return '[]'::jsonb; end if;
  v_role:=public.current_role();
  if v_role='guard'::public.app_role then
    select id into v_guard_id from public.guards where user_id=auth.uid() and agency_id=v_agency_id limit 1;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',m.id,'channel',m.channel,'sender_role',m.sender_role,
      'sender_guard_id',coalesce(m.sender_guard_id,sg.id),
      'recipient_guard_id',m.recipient_guard_id,
      'recipient_name',case when m.recipient_guard_id is null then null else coalesce(rp.full_name,'Guard') end,
      'sender_name',coalesce(sp.full_name,gp.full_name,case when m.sender_role='agency' then 'Agency' when m.sender_role='guard' then 'Guard' else 'Co Pilot' end),
      'body',m.body,
      'context',case m.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,
      'created_at',m.created_at
    ) order by m.created_at desc)
    from (
      select * from public.agency_messages
      where agency_id=v_agency_id
        and (
          v_role is distinct from 'guard'::public.app_role
          or recipient_guard_id is null
          or recipient_guard_id=v_guard_id
          or sender_guard_id=v_guard_id
          or sender_user_id=auth.uid()
        )
      order by created_at desc limit 80
    ) m
    left join public.profiles sp on sp.id=m.sender_user_id
    left join public.guards sg on sg.user_id=m.sender_user_id and sg.agency_id=m.agency_id
    left join public.guards gsender on gsender.id=coalesce(m.sender_guard_id,sg.id)
    left join public.profiles gp on gp.id=gsender.user_id
    left join public.guards rg on rg.id=m.recipient_guard_id
    left join public.profiles rp on rp.id=rg.user_id
  ),'[]'::jsonb);
end $$;

create or replace function public.send_agency_message(p_channel text,p_body text,p_job_id uuid default null,p_sender_role text default null,p_recipient_guard_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_role text; v_msg public.agency_messages; v_actor uuid; v_sender_guard_id uuid;
begin
  v_actor:=auth.uid();
  if v_actor is null then raise exception 'MESSAGE_AUTH_REQUIRED' using errcode='42501'; end if;
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then raise exception 'MESSAGE_AGENCY_NOT_FOUND' using errcode='42501'; end if;
  if nullif(trim(p_body),'') is null then raise exception 'MESSAGE_BODY_REQUIRED' using errcode='22023'; end if;
  if p_channel not in ('all_guards','active_mission','post_job') then raise exception 'INVALID_MESSAGE_CHANNEL' using errcode='22023'; end if;
  if p_sender_role is not null and p_sender_role not in ('agency','guard') then raise exception 'INVALID_MESSAGE_SENDER_ROLE' using errcode='22023'; end if;
  if p_recipient_guard_id is not null and not exists(select 1 from public.guards where id=p_recipient_guard_id and agency_id=v_agency_id) then raise exception 'MESSAGE_GUARD_NOT_IN_AGENCY' using errcode='42501'; end if;

  select id into v_sender_guard_id from public.guards where user_id=v_actor and agency_id=v_agency_id limit 1;
  v_role:=coalesce(p_sender_role,case when v_sender_guard_id is not null then 'guard' else 'agency' end);
  if v_role='guard' and v_sender_guard_id is null then
    select id into v_sender_guard_id from public.guards where agency_id=v_agency_id order by created_at asc limit 1;
  end if;

  insert into public.agency_messages(agency_id,job_id,sender_user_id,sender_guard_id,recipient_guard_id,sender_role,channel,body)
  values(v_agency_id,p_job_id,v_actor,case when v_role='guard' then v_sender_guard_id else null end,case when v_role='agency' then p_recipient_guard_id else null end,v_role,p_channel,trim(p_body)) returning * into v_msg;
  return jsonb_build_object(
    'id',v_msg.id,'channel',v_msg.channel,'sender_role',v_msg.sender_role,
    'sender_guard_id',v_msg.sender_guard_id,'recipient_guard_id',v_msg.recipient_guard_id,
    'recipient_name',case when v_msg.recipient_guard_id is null then null else coalesce((select p.full_name from public.guards g join public.profiles p on p.id=g.user_id where g.id=v_msg.recipient_guard_id),'Guard') end,
    'sender_name',coalesce((select full_name from public.profiles where id=v_actor),case when v_role='guard' then 'Guard' else 'Agency' end),
    'body',v_msg.body,
    'context',case v_msg.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,
    'created_at',v_msg.created_at
  );
end $$;

grant execute on function public.current_user_guard_for_messages() to authenticated;
grant execute on function public.get_agency_messages() to authenticated;
grant execute on function public.send_agency_message(text,text,uuid,text,uuid) to authenticated;
commit;
