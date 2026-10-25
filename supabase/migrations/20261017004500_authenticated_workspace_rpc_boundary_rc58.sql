-- RC58: Authenticated workspace RPC boundary.
-- These Client/Agency/Guard endpoints are only meaningful after login; their existing
-- role/ownership checks remain authoritative, while anon/PUBLIC loses direct EXECUTE.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and (
      p.proname like 'get_agency_%'
      or p.proname like 'get_guard_%'
      or p.proname like 'get_my_%'
      or p.proname in (
        'archive_client_property','delete_client_property',
        'deactivate_my_agency_account_rc1','deactivate_my_client_account_rc1',
        'create_guard_invitation','revoke_guard_invitation',
        'set_guard_presence_rc13','publish_guard_location_rc12','register_guard_evidence_rc1',
        'update_my_account_profile_rc1','update_my_agency_settings_rc1',
        'update_my_client_account_rc1','update_my_guard_settings_rc1',
        'set_agency_marketplace_radius_rc34','submit_agency_application'
      )
    )
  loop
    execute format('revoke all on function %s from public, anon',r.fn);
    execute format('grant execute on function %s to authenticated, service_role',r.fn);
  end loop;
end $$;
