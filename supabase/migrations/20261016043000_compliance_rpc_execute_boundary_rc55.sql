-- RC55: Compliance submission/review RPC API boundary.
-- PostgreSQL functions default EXECUTE to PUBLIC when recreated; explicitly remove anon access.
do $boundary$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'submit_agency_document','submit_developer_agency_document_rc1',
        'start_document_ai_review','complete_document_ai_review','get_document_ai_review',
        'apply_document_ai_review','get_my_agency_documents','get_owner_document_review_center',
        'review_agency_document'
      ])
  loop
    execute format('revoke all on function %s from public, anon',r.signature);
    if split_part(r.signature::text,'(',1)='apply_document_ai_review' then
      execute format('revoke all on function %s from authenticated',r.signature);
      execute format('grant execute on function %s to service_role',r.signature);
    else
      execute format('grant execute on function %s to authenticated, service_role',r.signature);
    end if;
  end loop;
end
$boundary$;
