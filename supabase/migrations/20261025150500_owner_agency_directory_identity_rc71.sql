-- RC71: expose the agency's uploaded branding image to the Platform Agency directory.
create or replace function public.get_owner_document_review_center()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_docs jsonb; v_agencies jsonb;
begin
  if public.current_role() <> 'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'agency_id',d.agency_id,'agency_name',a.name,'agency_status',a.status,'owner_name',coalesce(p.full_name,'Owner'),'document_type',d.document_type,'operating_state',d.operating_state,'service_category',d.service_category,'file_path',d.file_path,'file_name',d.file_name,'mime_type',d.mime_type,'file_size',d.file_size,'expires_on',d.expires_on,'status',case when d.status='approved' and d.expires_on<current_date then 'expired' else d.status end,'submitted_note',d.submitted_note,'review_note',d.review_note,'reviewed_at',d.reviewed_at,'created_at',d.created_at) order by d.created_at desc),'[]'::jsonb) into v_docs
  from public.agency_documents d join public.agencies a on a.id=d.agency_id left join public.profiles p on p.id=a.owner_user_id;
  select coalesce(jsonb_agg(jsonb_build_object('agency_id',a.id,'agency_name',a.name,'agency_status',a.status,'avatar_url',a.logo_url,'compliance',public.compute_agency_compliance_status(a.id)) order by a.created_at desc),'[]'::jsonb) into v_agencies
  from public.agencies a;
  return jsonb_build_object('documents',v_docs,'agencies',v_agencies);
end $$;
revoke all on function public.get_owner_document_review_center() from public, anon, authenticated;
grant execute on function public.get_owner_document_review_center() to authenticated;
