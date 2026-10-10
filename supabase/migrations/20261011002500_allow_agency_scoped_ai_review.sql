create or replace function public.start_document_ai_review(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_doc public.agency_documents; v_review public.document_ai_reviews; v_role public.app_role;
begin
 v_role:=public.current_role(); select * into v_doc from public.agency_documents where id=p_document_id;
 if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
 if v_role<>'platform_admin'::public.app_role and not (v_role='agency_admin'::public.app_role and exists(select 1 from public.user_agency_ids() x where x=v_doc.agency_id)) then raise exception 'AI_REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 insert into public.document_ai_reviews(document_id,agency_id,status,started_at) values(v_doc.id,v_doc.agency_id,'processing',now()) returning * into v_review;
 insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'document_ai_review_started','agency_document',v_doc.id,jsonb_build_object('ai_review_id',v_review.id,'agency_id',v_doc.agency_id)); return to_jsonb(v_review);
end $function$;

create or replace function public.complete_document_ai_review(p_review_id uuid,p_provider text,p_model text,p_decision text,p_confidence numeric,p_extracted_fields jsonb,p_rule_results jsonb,p_flags jsonb,p_summary text,p_error_message text default null)
returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_review public.document_ai_reviews; v_status text; v_role public.app_role;
begin
 v_role:=public.current_role(); select * into v_review from public.document_ai_reviews where id=p_review_id;
 if v_review.id is null then raise exception 'AI_REVIEW_NOT_FOUND' using errcode='P0002'; end if;
 if v_role<>'platform_admin'::public.app_role and not (v_role='agency_admin'::public.app_role and exists(select 1 from public.user_agency_ids() x where x=v_review.agency_id)) then raise exception 'AI_REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_decision is not null and p_decision not in('approved','action_required','manual_review') then raise exception 'INVALID_AI_DECISION' using errcode='22023'; end if;
 v_status:=case when p_error_message is null then 'completed' else 'failed' end;
 update public.document_ai_reviews set provider=coalesce(nullif(p_provider,''),'openai'),model=p_model,status=v_status,decision=p_decision,confidence=p_confidence,extracted_fields=coalesce(p_extracted_fields,'{}'::jsonb),rule_results=coalesce(p_rule_results,'[]'::jsonb),flags=coalesce(p_flags,'[]'::jsonb),summary=p_summary,error_message=p_error_message,completed_at=now(),updated_at=now() where id=p_review_id returning * into v_review;
 insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'document_ai_review_completed','agency_document',v_review.document_id,jsonb_build_object('ai_review_id',v_review.id,'decision',v_review.decision,'confidence',v_review.confidence,'status',v_review.status)); return to_jsonb(v_review);
end $function$;
