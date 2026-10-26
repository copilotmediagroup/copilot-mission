create or replace function public.get_my_guard_reports()
returns setof public.mission_reports
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
declare v_guard_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select id into v_guard_id from public.guards where user_id=auth.uid() limit 1;
  if v_guard_id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
  return query
    select r.* from public.mission_reports r
    where r.guard_id=v_guard_id
       or exists(select 1 from public.job_guard_slots s where s.job_id=r.job_id and s.guard_id=v_guard_id)
    order by coalesce(r.published_at,r.updated_at,r.created_at) desc;
end $$;
revoke all on function public.get_my_guard_reports() from public,anon;
grant execute on function public.get_my_guard_reports() to authenticated;
