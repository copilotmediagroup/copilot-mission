-- RC57: Internal trigger/helper execute boundary.
-- Trigger functions are invoked by PostgreSQL triggers and do not need client EXECUTE.
-- Revoke direct API execution from PUBLIC/anon/authenticated while leaving service_role for maintenance.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and (
        p.prorettype = 'pg_catalog.trigger'::regtype
        or p.proname in (
          'assert_required_real_photo_rc1',
          'mission_required_real_photo_exists',
          'validate_required_checkpoint_media_rc1',
          'release_guard_availability_rc1',
          'compute_agency_compliance_status'
        )
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;
