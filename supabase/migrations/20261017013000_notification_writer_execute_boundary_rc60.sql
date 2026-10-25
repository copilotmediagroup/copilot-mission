-- RC60: Notification writer helpers are internal only.
-- Client/Agency/Guard flows invoke notify_role from trusted database functions;
-- no browser role should be able to forge arbitrary platform notifications.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and p.proname in ('notify_role','publish_notification_rc31')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',r.fn);
    execute format('grant execute on function %s to service_role',r.fn);
  end loop;
end $$;
