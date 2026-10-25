-- RC56: Messaging identity integrity.
-- Sender identity is derived exclusively from auth.uid(); callers cannot impersonate Agency or Guard roles.

create or replace function public.current_user_agency_for_messages()
returns uuid language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_agency_id uuid; v_status public.agency_status;
begin
  if auth.uid() is null then return null; end if;
  if public.current_role()='agency_admin' then
    select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
    if v_agency_id is not null and v_status='approved' then return v_agency_id; end if;
  end if;
  select g.agency_id into v_agency_id from public.guards g join public.agencies a on a.id=g.agency_id where g.user_id=auth.uid() and a.status='approved' limit 1;
  if v_agency_id is not null then return v_agency_id; end if;
  select am.agency_id into v_agency_id from public.agency_members am join public.agencies a on a.id=am.agency_id where am.user_id=auth.uid() and am.is_active=true and a.status='approved' order by case when am.role='agency_admin' then 0 else 1 end limit 1;
  return v_agency_id;
end $function$;

create or replace function public.send_agency_message(p_channel text,p_body text,p_job_id uuid default null,p_sender_role text default null,p_recipient_guard_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_agency_id uuid; v_role text; v_msg public.agency_messages; v_actor uuid; v_sender_guard_id uuid;
begin
  v_actor:=auth.uid();
  if v_actor is null then raise exception 'MESSAGE_AUTH_REQUIRED' using errcode='42501'; end if;
  v_agency_id:=public.current_user_agency_for_messages();
  if v_agency_id is null then raise exception 'MESSAGE_AGENCY_NOT_FOUND' using errcode='42501'; end if;
  if nullif(trim(p_body),'') is null then raise exception 'MESSAGE_BODY_REQUIRED' using errcode='22023'; end if;
  if p_channel not in ('all_guards','active_mission','post_job') then raise exception 'INVALID_MESSAGE_CHANNEL' using errcode='22023'; end if;

  select id into v_sender_guard_id from public.guards where user_id=v_actor and agency_id=v_agency_id limit 1;
  if v_sender_guard_id is not null then v_role:='guard';
  elsif exists(select 1 from public.agency_members where user_id=v_actor and agency_id=v_agency_id and is_active=true) or public.current_role()='agency_admin'::public.app_role then v_role:='agency';
  else raise exception 'MESSAGE_SENDER_NOT_AUTHORIZED' using errcode='42501'; end if;

  if p_sender_role is not null and p_sender_role<>v_role then raise exception 'MESSAGE_SENDER_ROLE_MISMATCH' using errcode='42501'; end if;
  if v_role='guard' and p_recipient_guard_id is not null then raise exception 'GUARD_CANNOT_SET_RECIPIENT_GUARD' using errcode='42501'; end if;
  if p_recipient_guard_id is not null and not exists(select 1 from public.guards where id=p_recipient_guard_id and agency_id=v_agency_id) then raise exception 'MESSAGE_GUARD_NOT_IN_AGENCY' using errcode='42501'; end if;
  if p_job_id is not null and not exists(select 1 from public.marketplace_jobs where id=p_job_id and accepted_agency_id=v_agency_id) then raise exception 'MESSAGE_JOB_NOT_IN_AGENCY' using errcode='42501'; end if;

  insert into public.agency_messages(agency_id,job_id,sender_user_id,sender_guard_id,recipient_guard_id,sender_role,channel,body)
  values(v_agency_id,p_job_id,v_actor,case when v_role='guard' then v_sender_guard_id else null end,case when v_role='agency' then p_recipient_guard_id else null end,v_role,p_channel,trim(p_body)) returning * into v_msg;
  return jsonb_build_object('id',v_msg.id,'channel',v_msg.channel,'sender_role',v_msg.sender_role,'sender_guard_id',v_msg.sender_guard_id,'recipient_guard_id',v_msg.recipient_guard_id,'recipient_name',case when v_msg.recipient_guard_id is null then null else coalesce((select p.full_name from public.guards g join public.profiles p on p.id=g.user_id where g.id=v_msg.recipient_guard_id),'Guard') end,'sender_name',coalesce((select full_name from public.profiles where id=v_actor),case when v_role='guard' then 'Guard' else 'Agency' end),'body',v_msg.body,'context',case v_msg.channel when 'all_guards' then 'All Guards' when 'active_mission' then 'Mission Thread' else 'Post-Job Follow-up' end,'created_at',v_msg.created_at);
end $function$;

-- Keep legacy overload safe for older clients by deriving identity the same way through the canonical function.
create or replace function public.send_agency_message(p_channel text,p_body text,p_job_id uuid default null,p_sender_role text default null)
returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
begin
  return public.send_agency_message(p_channel,p_body,p_job_id,p_sender_role,null::uuid);
end $function$;

revoke all on function public.current_user_agency_for_messages() from public,anon;
grant execute on function public.current_user_agency_for_messages() to authenticated,service_role;
revoke all on function public.send_agency_message(text,text,uuid,text,uuid) from public,anon;
grant execute on function public.send_agency_message(text,text,uuid,text,uuid) to authenticated,service_role;
revoke all on function public.send_agency_message(text,text,uuid,text) from public,anon;
grant execute on function public.send_agency_message(text,text,uuid,text) to authenticated,service_role;
