create or replace function public.get_developer_guard_messages_rc1(p_guard_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid;
begin
  if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  select agency_id into v_agency_id from public.guards where id=p_guard_id;
  if v_agency_id is null then raise exception 'GUARD_NOT_FOUND' using errcode='40400'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'channel',m.channel,'sender_role',m.sender_role,'sender_guard_id',m.sender_guard_id,'recipient_guard_id',m.recipient_guard_id,'recipient_name',case when m.recipient_guard_id is null then null else coalesce(rp.full_name,'Guard') end,'sender_name',coalesce(gp.full_name,sp.full_name,case when m.sender_role='agency' then 'Agency' when m.sender_role='guard' then 'Guard' else 'Co Pilot' end),'body',m.body,'context',case m.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,'created_at',m.created_at) order by m.created_at desc)
    from (select * from public.agency_messages where agency_id=v_agency_id and (recipient_guard_id is null or recipient_guard_id=p_guard_id or sender_guard_id=p_guard_id) order by created_at desc limit 80) m
    left join public.profiles sp on sp.id=m.sender_user_id
    left join public.guards sg on sg.id=m.sender_guard_id
    left join public.profiles gp on gp.id=sg.user_id
    left join public.guards rg on rg.id=m.recipient_guard_id
    left join public.profiles rp on rp.id=rg.user_id),'[]'::jsonb);
end $$;

create or replace function public.send_developer_guard_message_rc1(p_guard_id uuid,p_channel text,p_body text,p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_msg public.agency_messages;
begin
  if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_guard from public.guards where id=p_guard_id;
  if v_guard.id is null then raise exception 'GUARD_NOT_FOUND' using errcode='40400'; end if;
  if nullif(trim(p_body),'') is null then raise exception 'MESSAGE_BODY_REQUIRED' using errcode='22023'; end if;
  if p_channel not in ('all_guards','active_mission','post_job') then raise exception 'INVALID_MESSAGE_CHANNEL' using errcode='22023'; end if;
  if p_job_id is not null and not exists(select 1 from public.marketplace_jobs j where j.id=p_job_id and j.accepted_agency_id=v_guard.agency_id and (exists(select 1 from public.job_assignments a where a.job_id=j.id and a.guard_id=p_guard_id) or exists(select 1 from public.job_guard_slots s where s.job_id=j.id and s.guard_id=p_guard_id))) then raise exception 'MISSION_NOT_OWNED_BY_SELECTED_GUARD' using errcode='42501'; end if;
  insert into public.agency_messages(agency_id,job_id,sender_user_id,sender_guard_id,recipient_guard_id,sender_role,channel,body) values(v_guard.agency_id,p_job_id,auth.uid(),p_guard_id,null,'guard',p_channel,trim(p_body)) returning * into v_msg;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'developer_live_account_guard_message_sent','guard',p_guard_id,jsonb_build_object('message_id',v_msg.id,'job_id',p_job_id,'live_account_test',true));
  return jsonb_build_object('id',v_msg.id,'channel',v_msg.channel,'sender_role','guard','sender_guard_id',p_guard_id,'recipient_guard_id',null,'sender_name',coalesce((select p.full_name from public.profiles p where p.id=v_guard.user_id),'Guard'),'body',v_msg.body,'context',case v_msg.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,'created_at',v_msg.created_at);
end $$;

revoke all on function public.get_developer_guard_messages_rc1(uuid) from public,anon;
revoke all on function public.send_developer_guard_message_rc1(uuid,text,text,uuid) from public,anon;
grant execute on function public.get_developer_guard_messages_rc1(uuid) to authenticated,service_role;
grant execute on function public.send_developer_guard_message_rc1(uuid,text,text,uuid) to authenticated,service_role;
