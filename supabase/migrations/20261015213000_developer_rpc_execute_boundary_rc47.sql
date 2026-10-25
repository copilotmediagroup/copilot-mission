-- RC47: Developer / Live Account Test RPCs are authenticated-only.
-- Every developer RPC performs its own Platform Admin authorization; removing anon EXECUTE
-- also prevents unauthenticated probing of these SECURITY DEFINER surfaces.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like '%developer%'
  loop
    execute format('revoke all on function %s from public, anon',r.signature);
    execute format('grant execute on function %s to authenticated, service_role',r.signature);
  end loop;
end $$;
