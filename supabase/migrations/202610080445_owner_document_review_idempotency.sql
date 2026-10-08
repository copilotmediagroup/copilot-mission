-- Owner document review decisions are single-decision operations.
-- Prevents double clicks, stale tabs and replayed requests from producing duplicate reviews/audit events.
create or replace function public.review_agency_document(p_document_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_doc public.agency_documents; v_compliance jsonb;
begin
  if public.current_role() <> 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_decision not in('approved','rejected','needs_info') then raise exception 'INVALID_DOCUMENT_DECISION' using errcode='22023'; end if;

  select * into v_doc from public.agency_documents where id=p_document_id for update;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_doc.status <> 'pending' then
    return jsonb_build_object('document_id',v_doc.id,'status',v_doc.status,'agency_id',v_doc.agency_id,'already_decided',true,'compliance',public.compute_agency_compliance_status(v_doc.agency_id));
  end if;

  update public.agency_documents set status=p_decision,reviewer_user_id=auth.uid(),reviewed_at=now(),review_note=p_note,updated_at=now() where id=p_document_id returning * into v_doc;
  insert into public.document_reviews(document_id,reviewer_user_id,decision,note) values(v_doc.id,auth.uid(),p_decision,p_note);
  v_compliance:=public.compute_agency_compliance_status(v_doc.agency_id);
  if v_compliance->>'status'='compliant' then
    update public.agencies set status='approved' where id=v_doc.agency_id and status <> 'suspended';
    update public.profiles set account_status='approved',updated_at=now() where id=(select owner_user_id from public.agencies where id=v_doc.agency_id);
  end if;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'agency_document_'||p_decision,'agency_document',v_doc.id,jsonb_build_object('agency_id',v_doc.agency_id,'note',p_note,'compliance',v_compliance));
  return jsonb_build_object('document_id',v_doc.id,'status',v_doc.status,'agency_id',v_doc.agency_id,'already_decided',false,'compliance',v_compliance);
end $$;
revoke all on function public.review_agency_document(uuid,text,text) from public;
grant execute on function public.review_agency_document(uuid,text,text) to authenticated;
