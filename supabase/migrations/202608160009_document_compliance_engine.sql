-- Co Pilot Security Marketplace OS — Document Compliance Engine
-- Private document storage, agency uploads, owner review workflow, audit log, and agency eligibility calculation.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('agency-documents','agency-documents',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists agency_documents_storage_read on storage.objects;
create policy agency_documents_storage_read on storage.objects for select to authenticated using(
  bucket_id='agency-documents' and (
    public.current_role()='platform_admin'::public.app_role
    or exists(select 1 from public.agency_members am where am.user_id=auth.uid() and am.is_active=true and am.agency_id::text=split_part(storage.objects.name,'/',1))
  )
);

drop policy if exists agency_documents_storage_insert on storage.objects;
create policy agency_documents_storage_insert on storage.objects for insert to authenticated with check(
  bucket_id='agency-documents' and (
    public.current_role()='platform_admin'::public.app_role
    or exists(select 1 from public.agency_members am where am.user_id=auth.uid() and am.is_active=true and am.agency_id::text=split_part(storage.objects.name,'/',1))
  )
);

drop policy if exists agency_documents_storage_update on storage.objects;
create policy agency_documents_storage_update on storage.objects for update to authenticated using(
  bucket_id='agency-documents' and (
    public.current_role()='platform_admin'::public.app_role
    or exists(select 1 from public.agency_members am where am.user_id=auth.uid() and am.is_active=true and am.agency_id::text=split_part(storage.objects.name,'/',1))
  )
) with check(bucket_id='agency-documents');

drop policy if exists agency_documents_storage_delete on storage.objects;
create policy agency_documents_storage_delete on storage.objects for delete to authenticated using(
  bucket_id='agency-documents' and public.current_role()='platform_admin'::public.app_role
);

create table if not exists public.agency_documents(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  document_type text not null,
  operating_state text not null default 'FL',
  service_category text not null default 'unarmed',
  file_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  expires_on date,
  status text not null default 'pending' check(status in('pending','approved','rejected','needs_info','expired')),
  submitted_note text,
  reviewer_user_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_reviews(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.agency_documents(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id),
  decision text not null check(decision in('approved','rejected','needs_info')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_audit_log(
  id bigserial primary key,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agency_documents_agency_status_idx on public.agency_documents(agency_id,status,created_at desc);
create index if not exists agency_documents_review_queue_idx on public.agency_documents(status,created_at desc);
create index if not exists document_reviews_document_idx on public.document_reviews(document_id,created_at desc);
create index if not exists owner_audit_log_created_idx on public.owner_audit_log(created_at desc);

alter table public.agency_documents enable row level security;
alter table public.document_reviews enable row level security;
alter table public.owner_audit_log enable row level security;

drop policy if exists agency_documents_scope on public.agency_documents;
create policy agency_documents_scope on public.agency_documents for select using(
  agency_id in(select public.user_agency_ids()) or public.current_role()='platform_admin'::public.app_role
);

drop policy if exists agency_documents_agency_insert on public.agency_documents;
create policy agency_documents_agency_insert on public.agency_documents for insert with check(
  agency_id in(select public.user_agency_ids()) and uploaded_by=auth.uid()
);

drop policy if exists agency_documents_owner_update on public.agency_documents;
create policy agency_documents_owner_update on public.agency_documents for update using(
  public.current_role()='platform_admin'::public.app_role
) with check(public.current_role()='platform_admin'::public.app_role);

drop policy if exists document_reviews_scope on public.document_reviews;
create policy document_reviews_scope on public.document_reviews for select using(
  public.current_role()='platform_admin'::public.app_role or exists(
    select 1 from public.agency_documents d where d.id=document_reviews.document_id and d.agency_id in(select public.user_agency_ids())
  )
);

drop policy if exists document_reviews_owner_insert on public.document_reviews;
create policy document_reviews_owner_insert on public.document_reviews for insert with check(public.current_role()='platform_admin'::public.app_role);

drop policy if exists owner_audit_log_admin on public.owner_audit_log;
create policy owner_audit_log_admin on public.owner_audit_log for select using(public.current_role()='platform_admin'::public.app_role);

create or replace function public.compute_agency_compliance_status(p_agency_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_required text[]:=array['agency_license','general_liability','w9'];
  v_missing text[];
  v_expiring integer;
  v_status text;
begin
  select array(
    select r from unnest(v_required) r
    except
    select d.document_type from public.agency_documents d
    where d.agency_id=p_agency_id and d.status='approved' and (d.expires_on is null or d.expires_on>=current_date)
  ) into v_missing;

  select count(*)::int into v_expiring
  from public.agency_documents d
  where d.agency_id=p_agency_id and d.status='approved' and d.expires_on between current_date and current_date+interval '30 days';

  v_status:=case when coalesce(array_length(v_missing,1),0)=0 then 'compliant' else 'incomplete' end;
  return jsonb_build_object('status',v_status,'missing',coalesce(to_jsonb(v_missing),'[]'::jsonb),'expiring_soon',v_expiring);
end $$;

create or replace function public.get_my_agency_documents()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare
  v_agency_id uuid; v_name text; v_status public.agency_status; v_docs jsonb; v_compliance jsonb;
begin
  select agency_id,agency_name,agency_status into v_agency_id,v_name,v_status from public.resolve_my_agency_workspace();
  if v_agency_id is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
  v_compliance:=public.compute_agency_compliance_status(v_agency_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'agency_id',agency_id,'document_type',document_type,'operating_state',operating_state,'service_category',service_category,'file_path',file_path,'file_name',file_name,'mime_type',mime_type,'file_size',file_size,'expires_on',expires_on,'status',status,'submitted_note',submitted_note,'review_note',review_note,'reviewed_at',reviewed_at,'created_at',created_at,'updated_at',updated_at) order by created_at desc),'[]'::jsonb) into v_docs
  from public.agency_documents where agency_id=v_agency_id;
  return jsonb_build_object('agency',jsonb_build_object('id',v_agency_id,'name',v_name,'status',v_status),'compliance',v_compliance,'documents',v_docs);
end $$;

create or replace function public.submit_agency_document(p_document_type text,p_operating_state text,p_service_category text,p_file_path text,p_file_name text,p_mime_type text default null,p_file_size bigint default null,p_expires_on date default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_name text; v_status public.agency_status; v_doc public.agency_documents;
begin
  select agency_id,agency_name,agency_status into v_agency_id,v_name,v_status from public.resolve_my_agency_workspace();
  if v_agency_id is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501'; end if;
  if p_file_path is null or split_part(p_file_path,'/',1)<>v_agency_id::text then raise exception 'DOCUMENT_PATH_MISMATCH' using errcode='22023'; end if;
  insert into public.agency_documents(agency_id,uploaded_by,document_type,operating_state,service_category,file_path,file_name,mime_type,file_size,expires_on,submitted_note,status)
  values(v_agency_id,auth.uid(),lower(trim(p_document_type)),upper(coalesce(nullif(trim(p_operating_state),''),'FL')),coalesce(nullif(trim(p_service_category),''),'unarmed'),p_file_path,p_file_name,p_mime_type,p_file_size,p_expires_on,p_note,'pending')
  returning * into v_doc;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'agency_document_submitted','agency_document',v_doc.id,jsonb_build_object('agency_id',v_agency_id,'document_type',v_doc.document_type));
  return jsonb_build_object('id',v_doc.id,'agency_id',v_doc.agency_id,'document_type',v_doc.document_type,'operating_state',v_doc.operating_state,'service_category',v_doc.service_category,'file_path',v_doc.file_path,'file_name',v_doc.file_name,'mime_type',v_doc.mime_type,'file_size',v_doc.file_size,'expires_on',v_doc.expires_on,'status',v_doc.status,'submitted_note',v_doc.submitted_note,'created_at',v_doc.created_at);
end $$;

create or replace function public.get_owner_document_review_center()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_docs jsonb; v_agencies jsonb;
begin
  if public.current_role() <> 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'agency_id',d.agency_id,'agency_name',a.name,'agency_status',a.status,'owner_name',coalesce(p.full_name,'Owner'),'document_type',d.document_type,'operating_state',d.operating_state,'service_category',d.service_category,'file_path',d.file_path,'file_name',d.file_name,'mime_type',d.mime_type,'file_size',d.file_size,'expires_on',d.expires_on,'status',case when d.status='approved' and d.expires_on<current_date then 'expired' else d.status end,'submitted_note',d.submitted_note,'review_note',d.review_note,'reviewed_at',d.reviewed_at,'created_at',d.created_at) order by d.created_at desc),'[]'::jsonb) into v_docs
  from public.agency_documents d join public.agencies a on a.id=d.agency_id left join public.profiles p on p.id=a.owner_user_id;
  select coalesce(jsonb_agg(jsonb_build_object('agency_id',a.id,'agency_name',a.name,'agency_status',a.status,'compliance',public.compute_agency_compliance_status(a.id)) order by a.created_at desc),'[]'::jsonb) into v_agencies from public.agencies a;
  return jsonb_build_object('documents',v_docs,'agencies',v_agencies);
end $$;

create or replace function public.review_agency_document(p_document_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_doc public.agency_documents; v_compliance jsonb;
begin
  if public.current_role() <> 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_decision not in('approved','rejected','needs_info') then raise exception 'INVALID_DOCUMENT_DECISION' using errcode='22023'; end if;
  update public.agency_documents set status=p_decision,reviewer_user_id=auth.uid(),reviewed_at=now(),review_note=p_note,updated_at=now() where id=p_document_id returning * into v_doc;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND' using errcode='40400'; end if;
  insert into public.document_reviews(document_id,reviewer_user_id,decision,note) values(v_doc.id,auth.uid(),p_decision,p_note);
  v_compliance:=public.compute_agency_compliance_status(v_doc.agency_id);
  if v_compliance->>'status'='compliant' then
    update public.agencies set status='approved' where id=v_doc.agency_id and status <> 'suspended';
    update public.profiles set account_status='approved',updated_at=now() where id=(select owner_user_id from public.agencies where id=v_doc.agency_id);
  end if;
  insert into public.owner_audit_log(actor_user_id,action,target_type,target_id,payload) values(auth.uid(),'agency_document_'||p_decision,'agency_document',v_doc.id,jsonb_build_object('agency_id',v_doc.agency_id,'note',p_note,'compliance',v_compliance));
  return jsonb_build_object('document_id',v_doc.id,'status',v_doc.status,'agency_id',v_doc.agency_id,'compliance',v_compliance);
end $$;

revoke all on function public.compute_agency_compliance_status(uuid) from public;
revoke all on function public.get_my_agency_documents() from public;
revoke all on function public.submit_agency_document(text,text,text,text,text,text,bigint,date,text) from public;
revoke all on function public.get_owner_document_review_center() from public;
revoke all on function public.review_agency_document(uuid,text,text) from public;
grant execute on function public.compute_agency_compliance_status(uuid) to authenticated;
grant execute on function public.get_my_agency_documents() to authenticated;
grant execute on function public.submit_agency_document(text,text,text,text,text,text,bigint,date,text) to authenticated;
grant execute on function public.get_owner_document_review_center() to authenticated;
grant execute on function public.review_agency_document(uuid,text,text) to authenticated;

commit;
