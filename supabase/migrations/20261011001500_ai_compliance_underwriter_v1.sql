begin;

create table if not exists public.document_ai_reviews(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.agency_documents(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  provider text not null default 'openai',
  model text,
  status text not null default 'queued' check(status in('queued','processing','completed','failed')),
  decision text check(decision is null or decision in('approved','action_required','manual_review')),
  confidence numeric(5,4) check(confidence is null or (confidence>=0 and confidence<=1)),
  extracted_fields jsonb not null default '{}'::jsonb,
  rule_results jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  summary text,
  error_message text,
  auto_applied boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists document_ai_reviews_document_idx on public.document_ai_reviews(document_id,created_at desc);
create index if not exists document_ai_reviews_agency_idx on public.document_ai_reviews(agency_id,created_at desc);
alter table public.document_ai_reviews enable row level security;
drop policy if exists document_ai_reviews_scope on public.document_ai_reviews;
create policy document_ai_reviews_scope on public.document_ai_reviews for select to authenticated using(
  public.current_role()='platform_admin'::public.app_role
  or agency_id in(select public.user_agency_ids())
);

create or replace function public.get_document_ai_review(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_doc public.agency_documents; v_review public.document_ai_reviews;
begin
  select * into v_doc from public.agency_documents where id=p_document_id;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  if public.current_role()<>'platform_admin'::public.app_role and v_doc.agency_id not in(select public.user_agency_ids()) then raise exception 'DOCUMENT_ACCESS_DENIED' using errcode='42501'; end if;
  select * into v_review from public.document_ai_reviews where document_id=p_document_id order by created_at desc limit 1;
  if v_review.id is null then return null; end if;
  return to_jsonb(v_review);
end $$;

create or replace function public.start_document_ai_review(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_doc public.agency_documents; v_review public.document_ai_reviews;
begin
  if public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_doc from public.agency_documents where id=p_document_id;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.document_ai_reviews(document_id,agency_id,status,started_at) values(v_doc.id,v_doc.agency_id,'processing',now()) returning * into v_review;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'document_ai_review_started','agency_document',v_doc.id,jsonb_build_object('ai_review_id',v_review.id,'agency_id',v_doc.agency_id));
  return to_jsonb(v_review);
end $$;

create or replace function public.complete_document_ai_review(p_review_id uuid,p_provider text,p_model text,p_decision text,p_confidence numeric,p_extracted_fields jsonb,p_rule_results jsonb,p_flags jsonb,p_summary text,p_error_message text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_review public.document_ai_reviews; v_status text;
begin
  if public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_decision is not null and p_decision not in('approved','action_required','manual_review') then raise exception 'INVALID_AI_DECISION' using errcode='22023'; end if;
  v_status:=case when p_error_message is null then 'completed' else 'failed' end;
  update public.document_ai_reviews set provider=coalesce(nullif(p_provider,''),'openai'),model=p_model,status=v_status,decision=p_decision,confidence=p_confidence,extracted_fields=coalesce(p_extracted_fields,'{}'::jsonb),rule_results=coalesce(p_rule_results,'[]'::jsonb),flags=coalesce(p_flags,'[]'::jsonb),summary=p_summary,error_message=p_error_message,completed_at=now(),updated_at=now() where id=p_review_id returning * into v_review;
  if v_review.id is null then raise exception 'AI_REVIEW_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'document_ai_review_completed','agency_document',v_review.document_id,jsonb_build_object('ai_review_id',v_review.id,'decision',v_review.decision,'confidence',v_review.confidence,'status',v_review.status));
  return to_jsonb(v_review);
end $$;

revoke all on function public.get_document_ai_review(uuid) from public;
revoke all on function public.start_document_ai_review(uuid) from public;
revoke all on function public.complete_document_ai_review(uuid,text,text,text,numeric,jsonb,jsonb,jsonb,text,text) from public;
grant execute on function public.get_document_ai_review(uuid) to authenticated;
grant execute on function public.start_document_ai_review(uuid) to authenticated;
grant execute on function public.complete_document_ai_review(uuid,text,text,text,numeric,jsonb,jsonb,jsonb,text,text) to authenticated;
commit;
