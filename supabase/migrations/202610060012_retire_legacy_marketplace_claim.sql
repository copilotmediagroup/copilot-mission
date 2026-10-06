-- Dependency audit found no application caller for the legacy two-argument claim RPC.
-- Keep the function for rollback/history but remove client execution paths.
revoke all on function public.accept_marketplace_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_marketplace_job(uuid,uuid) to service_role;
