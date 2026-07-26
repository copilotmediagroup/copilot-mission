-- Co Pilot Security Marketplace OS — Schema Contract Engine v1.0
-- Repairs Reporting Engine membership contract and installs runtime schema validation.
begin;

-- Reporting reads active membership through the canonical boolean column.
create or replace function public.get_agency_reports()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid;
begin
 select am.agency_id into v_agency
 from public.agency_members am
 join public.agencies a on a.id=am.agency_id
 where am.user_id=auth.uid()
   and am.role='agency_admin'
   and am.is_active=true
   and a.status='approved'
 limit 1;
 if v_agency is null then raise exception 'APPROVED_AGENCY_REQUIRED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.mission_reports r where r.agency_id=v_agency),'[]'::jsonb);
end;$$;

create or replace function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid; v_report public.mission_reports;
begin
 select am.agency_id into v_agency
 from public.agency_members am
 join public.agencies a on a.id=am.agency_id
 where am.user_id=auth.uid()
   and am.role='agency_admin'
   and am.is_active=true
   and a.status='approved'
 limit 1;
 if v_agency is null then raise exception 'APPROVED_AGENCY_REQUIRED'; end if;

 select * into v_report from public.mission_reports where id=p_report_id for update;
 if v_report.id is null or v_report.agency_id is distinct from v_agency then raise exception 'REPORT_NOT_OWNED_BY_AGENCY'; end if;
 if p_action='publish' then
   if v_report.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE'; end if;
   update public.mission_reports
   set status='published',agency_review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now()
   where id=p_report_id returning * into v_report;
   insert into public.mission_events(job_id,event_type,actor_user_id,payload)
   values(v_report.job_id,'report_published',auth.uid(),jsonb_build_object('report_id',v_report.id,'version',v_report.version));
 elsif p_action='clarification' then
   if v_report.status<>'pending_review' then raise exception 'REPORT_NOT_RETURNABLE'; end if;
   if nullif(trim(p_note),'') is null then raise exception 'CLARIFICATION_NOTE_REQUIRED'; end if;
   update public.mission_reports
   set status='clarification_requested',clarification_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now()
   where id=p_report_id returning * into v_report;
   insert into public.mission_events(job_id,event_type,actor_user_id,payload)
   values(v_report.job_id,'report_clarification_requested',auth.uid(),jsonb_build_object('report_id',v_report.id));
 else raise exception 'UNKNOWN_REPORT_ACTION'; end if;
 return to_jsonb(v_report);
end;$$;

-- Runtime contract report for the tables and columns this release depends on.
create or replace function public.get_schema_contract_report()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_missing jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='platform_admin') then
   raise exception 'PLATFORM_ADMIN_REQUIRED';
 end if;

 with expected(table_name,column_name) as (
   values
   ('profiles','id'),('profiles','role'),
   ('agencies','id'),('agencies','status'),
   ('agency_members','agency_id'),('agency_members','user_id'),('agency_members','role'),('agency_members','is_active'),
   ('clients','id'),('clients','user_id'),
   ('guards','id'),('guards','user_id'),('guards','agency_id'),('guards','availability'),
   ('marketplace_jobs','id'),('marketplace_jobs','client_id'),
   ('mission_engine_state','job_id'),('mission_engine_state','state'),('mission_engine_state','agency_id'),('mission_engine_state','guard_id'),
   ('mission_events','job_id'),('mission_events','event_type'),
   ('mission_reports','id'),('mission_reports','job_id'),('mission_reports','agency_id'),('mission_reports','client_id'),('mission_reports','status'),('mission_reports','snapshot')
 ), missing as (
   select e.table_name,e.column_name
   from expected e
   left join information_schema.columns c
     on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name
   where c.column_name is null
 )
 select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name)),'[]'::jsonb) into v_missing from missing;

 return jsonb_build_object(
   'engine','schema_contract_v1',
   'generated_at',now(),
   'clean',jsonb_array_length(v_missing)=0,
   'missing_contracts',v_missing,
   'agency_members_contract',jsonb_build_object(
      'active_column','is_active',
      'legacy_status_column_exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='agency_members' and column_name='status')
   ),
   'reporting_functions',jsonb_build_object(
      'get_agency_reports',to_regprocedure('public.get_agency_reports()') is not null,
      'review_mission_report',to_regprocedure('public.review_mission_report(uuid,text,text)') is not null,
      'get_client_reports',to_regprocedure('public.get_client_reports()') is not null
   )
 );
end;$$;

revoke all on function public.get_schema_contract_report() from public;
grant execute on function public.get_schema_contract_report() to authenticated;
grant execute on function public.get_agency_reports() to authenticated;
grant execute on function public.review_mission_report(uuid,text,text) to authenticated;

commit;
