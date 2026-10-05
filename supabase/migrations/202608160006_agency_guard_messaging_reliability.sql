-- Co Pilot Security Marketplace OS — Agency/Guard Messaging Reliability
-- Ensures guard replies resolve to the same approved agency inbox the agency portal reads.
begin;

create or replace function public.current_user_agency_for_messages()
returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status;
begin
  if public.current_role()='agency_admin' then
    select agency_id, agency_status into v_agency_id, v_status from public.resolve_my_agency_workspace();
    if v_agency_id is not null and v_status='approved' then return v_agency_id; end if;
  end if;

  select g.agency_id into v_agency_id
  from public.guards g
  join public.agencies a on a.id=g.agency_id
  where g.user_id=auth.uid() and a.status='approved'
  limit 1;
  if v_agency_id is not null then return v_agency_id; end if;

  select am.agency_id into v_agency_id
  from public.agency_members am
  join public.agencies a on a.id=am.agency_id
  where am.user_id=auth.uid() and am.is_active=true and a.status='approved'
  order by case when am.role='agency_admin' then 0 else 1 end
  limit 1;
  return v_agency_id;
end $$;

create or replace function public.get_agency_messages()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid;
begin
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',m.id,'channel',m.channel,'sender_role',m.sender_role,
      'sender_name',coalesce(p.full_name,case when m.sender_role='agency' then 'Agency' when m.sender_role='guard' then 'Guard' else 'Co Pilot' end),
      'body',m.body,
      'context',case m.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,
      'created_at',m.created_at
    ) order by m.created_at desc)
    from (select * from public.agency_messages where agency_id=v_agency_id order by created_at desc limit 80) m
    left join public.profiles p on p.id=m.sender_user_id
  ),'[]'::jsonb);
end $$;

create or replace function public.send_agency_message(p_channel text,p_body text,p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_role text; v_msg public.agency_messages;
begin
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then raise exception 'MESSAGE_AGENCY_NOT_FOUND' using errcode='42501'; end if;
  if nullif(trim(p_body),'') is null then raise exception 'MESSAGE_BODY_REQUIRED' using errcode='22023'; end if;
  if p_channel not in ('all_guards','active_mission','post_job') then raise exception 'INVALID_MESSAGE_CHANNEL' using errcode='22023'; end if;
  v_role:=case when exists(select 1 from public.guards where user_id=auth.uid() and agency_id=v_agency_id) then 'guard' else 'agency' end;
  insert into public.agency_messages(agency_id,job_id,sender_user_id,sender_role,channel,body)
  values(v_agency_id,p_job_id,auth.uid(),v_role,p_channel,trim(p_body)) returning * into v_msg;
  return jsonb_build_object(
    'id',v_msg.id,'channel',v_msg.channel,'sender_role',v_msg.sender_role,
    'sender_name',coalesce((select full_name from public.profiles where id=auth.uid()),case when v_role='guard' then 'Guard' else 'Agency' end),
    'body',v_msg.body,
    'context',case v_msg.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,
    'created_at',v_msg.created_at
  );
end $$;

grant execute on function public.current_user_agency_for_messages() to authenticated;
grant execute on function public.get_agency_messages() to authenticated;
grant execute on function public.send_agency_message(text,text,uuid) to authenticated;
commit;
