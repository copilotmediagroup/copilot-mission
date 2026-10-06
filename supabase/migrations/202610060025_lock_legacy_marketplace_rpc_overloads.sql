-- Legacy overloads remain for compatibility, but anonymous callers must never create or quote marketplace work.
revoke all on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz) from public,anon;
grant execute on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz) to authenticated,service_role;
revoke all on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz,text) from public,anon;
grant execute on function public.calculate_job_estimate(text,public.job_priority,integer,timestamptz,text) to authenticated,service_role;
revoke all on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz) from public,anon;
grant execute on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz) to authenticated,service_role;
revoke all on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz,text) from public,anon;
grant execute on function public.get_client_job_estimate(uuid,text,public.job_priority,integer,timestamptz,text) to authenticated,service_role;
revoke all on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text) from public,anon;
grant execute on function public.create_marketplace_job_v2(uuid,text,text,public.job_priority,timestamptz,integer,text,text,text,text) to authenticated,service_role;
