create or replace function public.mark_platform_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public set row_security=off as $$
begin
 update public.platform_notifications n set read_at=coalesce(n.read_at,now())
 where n.id=p_notification_id and (
   n.recipient_user_id=auth.uid() or n.recipient_role=public.current_role()
   or n.agency_id in(select public.user_agency_ids())
   or n.client_id in(select id from public.clients where user_id=auth.uid())
   or public.current_role()='platform_admin'::public.app_role
 );
end $$;
create or replace function public.mark_all_platform_notifications_read()
returns integer language plpgsql security definer set search_path=public set row_security=off as $$
declare v_count integer;
begin
 update public.platform_notifications n set read_at=coalesce(n.read_at,now())
 where n.read_at is null and (
   n.recipient_user_id=auth.uid() or n.recipient_role=public.current_role()
   or n.agency_id in(select public.user_agency_ids())
   or n.client_id in(select id from public.clients where user_id=auth.uid())
   or public.current_role()='platform_admin'::public.app_role
 );
 get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.mark_platform_notification_read(uuid) from public,anon;
revoke all on function public.mark_all_platform_notifications_read() from public,anon;
grant execute on function public.mark_platform_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_platform_notifications_read() to authenticated;
