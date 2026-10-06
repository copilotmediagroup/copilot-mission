-- Mission report and payout-readiness APIs are authenticated surfaces only.
revoke all on function public.build_mission_report_snapshot(uuid) from public,anon;
revoke all on function public.ensure_mission_report(uuid) from public,anon;
revoke all on function public.get_agency_reports() from public,anon;
revoke all on function public.get_client_reports() from public,anon;
revoke all on function public.get_platform_report_summary() from public,anon;
revoke all on function public.review_mission_report(uuid,text,text) from public,anon;
grant execute on function public.build_mission_report_snapshot(uuid) to authenticated,service_role;
grant execute on function public.ensure_mission_report(uuid) to authenticated,service_role;
grant execute on function public.get_agency_reports() to authenticated,service_role;
grant execute on function public.get_client_reports() to authenticated,service_role;
grant execute on function public.get_platform_report_summary() to authenticated,service_role;
grant execute on function public.review_mission_report(uuid,text,text) to authenticated,service_role;
