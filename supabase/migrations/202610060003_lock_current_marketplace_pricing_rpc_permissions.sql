-- Lock the current marketplace pricing/job RPC generation to signed-in users only.
-- Legacy overload removal is intentionally handled separately after dependency proof.
revoke all on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz,text,date,date,integer) from public, anon;
grant execute on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz,text,date,date,integer) to authenticated, service_role;

revoke all on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz,text,date,date,integer) from public, anon;
grant execute on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz,text,date,date,integer) to authenticated, service_role;

revoke all on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text,date,date,integer) from public, anon;
grant execute on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text,date,date,integer) to authenticated, service_role;
