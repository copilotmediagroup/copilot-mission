-- RC59: Authenticated operational RPC boundary.
-- Operational mission, client-write, messaging, notification and authorization helpers
-- require a signed-in actor. Existing role/ownership checks remain authoritative.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname in (
      'agency_can_claim_service','assert_platform_admin_rc1b','auth_client_id','auth_guard_id',
      'can_read_assignment','can_read_client','can_read_marketplace_job','can_read_property',
      'complete_patrol_checkpoint_rc21','create_marketplace_job','create_marketplace_job_rc1',
      'create_verified_client_property_rc33','current_role','current_user_agency_for_messages',
      'current_user_guard_for_messages','dispatch_mission_json_rc2','ensure_client_workspace',
      'ensure_guard_execution_state_rc23','get_live_operations_center','get_mission_evidence_for_report_rc1',
      'get_mission_evidence_media_rc1','get_mission_evidence_signed_url_rc1','get_mission_route_history',
      'get_mission_route_history_rc12','get_mission_runtime_v2','get_visible_client_identities',
      'has_agency_access','is_platform_admin','mark_all_notifications_read_rc31',
      'mark_notification_delivered_rc31','mark_notification_read_rc31','resolve_my_agency_workspace',
      'send_agency_message','user_agency_ids'
    )
  loop
    execute format('revoke all on function %s from public, anon',r.fn);
    execute format('grant execute on function %s to authenticated, service_role',r.fn);
  end loop;
end $$;
