create or replace function public.apply_document_ai_review(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
declare
  v_review public.document_ai_reviews;
  v_doc public.agency_documents;
  v_compliance jsonb;
  v_doc_status text;
  v_agency_status text;
begin
  select * into v_review from public.document_ai_reviews where id=p_review_id;
  if v_review.id is null then raise exception 'AI_REVIEW_NOT_FOUND'; end if;
  if v_review.status <> 'completed' then raise exception 'AI_REVIEW_NOT_COMPLETED'; end if;
  select * into v_doc from public.agency_documents where id=v_review.document_id for update;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;

  if v_review.decision='approved' and coalesce(v_review.confidence,0)>=0.95 and jsonb_array_length(coalesce(v_review.flags,'[]'::jsonb))=0 then
    v_doc_status:='approved';
  elsif v_review.decision='action_required' then
    v_doc_status:='needs_info';
  else
    return jsonb_build_object('applied',false,'reason','manual_review','document_id',v_doc.id,'agency_id',v_doc.agency_id);
  end if;

  update public.agency_documents
     set status=v_doc_status,
         reviewer_user_id=null,
         reviewed_at=now(),
         review_note=case when v_doc_status='approved' then 'Automatically approved by Co Pilot AI compliance rules.' else coalesce(v_review.summary,'AI review requires corrected documentation.') end,
         updated_at=now()
   where id=v_doc.id;

  update public.document_ai_reviews set auto_applied=true,updated_at=now() where id=v_review.id;
  v_compliance:=public.compute_agency_compliance_status(v_doc.agency_id);

  if v_compliance->>'status'='compliant' then
    update public.agencies set status='approved',updated_at=now() where id=v_doc.agency_id and status in ('pending','submitted','under_review','needs_info');
  elsif v_doc_status='needs_info' then
    update public.agencies set status='needs_info',updated_at=now() where id=v_doc.agency_id and status in ('pending','submitted','under_review','needs_info');
  end if;

  select status into v_agency_status from public.agencies where id=v_doc.agency_id;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload)
  values(null,'document_ai_review_auto_applied','agency_document',v_doc.id,jsonb_build_object('ai_review_id',v_review.id,'document_status',v_doc_status,'agency_id',v_doc.agency_id,'agency_status',v_agency_status,'compliance',v_compliance));

  return jsonb_build_object('applied',true,'document_id',v_doc.id,'document_status',v_doc_status,'agency_id',v_doc.agency_id,'agency_status',v_agency_status,'compliance',v_compliance);
end $function$;

revoke all on function public.apply_document_ai_review(uuid) from public, anon, authenticated;
grant execute on function public.apply_document_ai_review(uuid) to service_role;
