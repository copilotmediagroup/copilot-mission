-- RC53: Privileged Owner / Platform / compliance RPCs must never be executable by anon.
-- Function bodies retain their existing role/ownership checks; this closes the API execute surface itself.

do $boundary$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'approve_agency_rc1b','deny_agency_rc1b','suspend_agency_rc1b','reactivate_agency_rc1b',
        'owner_set_client_account_status','review_agency_document',
        'get_owner_client_governance','get_owner_document_review_center',
        'get_platform_agencies_rc1b','get_platform_live_locations','get_platform_live_locations_rc12',
        'get_platform_marketplace','get_client_account_for_platform_rc1','update_client_account_for_platform_rc1',
        'get_identity_integrity_report','get_schema_contract_report'
      ])
  loop
    execute format('revoke all on function %s from public, anon',r.signature);
    execute format('grant execute on function %s to authenticated, service_role',r.signature);
  end loop;
end
$boundary$;
