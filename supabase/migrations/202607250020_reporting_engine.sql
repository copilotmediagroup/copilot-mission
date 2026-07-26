-- Co Pilot Security Marketplace OS — Reporting Engine v1.0
-- Completed Mission Engine records become immutable Agency-reviewed, Client-published reports.
begin;

create table if not exists public.mission_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.marketplace_jobs(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  guard_id uuid references public.guards(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review','clarification_requested','published','archived')),
  version integer not null default 1,
  snapshot jsonb not null,
  agency_review_note text,
  clarification_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mission_reports_agency_status_idx on public.mission_reports(agency_id,status,created_at desc);
create index if not exists mission_reports_client_status_idx on public.mission_reports(client_id,status,created_at desc);
alter table public.mission_reports enable row level security;
revoke all on public.mission_reports from anon, authenticated;

create or replace function public.build_mission_report_snapshot(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
  select jsonb_build_object(
    'report_schema','co_pilot_report_v1',
    'job',jsonb_build_object('id',j.id,'title',j.title,'priority',j.priority,'instructions',j.instructions,'scheduled_for',j.scheduled_for,'duration_minutes',j.duration_minutes,'completed_at',me.completed_at),
    'property',jsonb_build_object('id',pr.id,'name',pr.name,'address',pr.address,'photo_url',to_jsonb(pr)->>'photo_url','latitude',pr.latitude,'longitude',pr.longitude),
    'client',jsonb_build_object('id',c.id,'name',c.display_name),
    'agency',jsonb_build_object('id',a.id,'name',a.name,'license_number',a.license_number),
    'guard',jsonb_build_object('id',g.id,'name',gp.full_name,'badge_number',g.badge_number),
    'mission',jsonb_build_object('state',me.state,'started_at',me.mission_started_at,'route_started_at',me.route_started_at,'arrived_at',me.arrived_at,'completed_at',me.completed_at,'checkpoint_index',me.checkpoint_index,'evidence',me.evidence,'incidents',me.incidents,'engine_version',me.version),
    'timeline',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'event_type',e.event_type,'payload',e.payload,'created_at',e.created_at,'actor_name',ep.full_name) order by e.created_at) from public.mission_events e left join public.profiles ep on ep.id=e.actor_user_id where e.job_id=j.id),'[]'::jsonb),
    'generated_at',now()
  )
  from public.marketplace_jobs j
  join public.properties pr on pr.id=j.property_id
  join public.clients c on c.id=j.client_id
  join public.mission_engine_state me on me.job_id=j.id
  join public.agencies a on a.id=me.agency_id
  left join public.guards g on g.id=me.guard_id
  left join public.profiles gp on gp.id=g.user_id
  where j.id=p_job_id and me.state='completed';
$$;

create or replace function public.ensure_mission_report(p_job_id uuid)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_state public.mission_engine_state; v_job public.marketplace_jobs; v_report public.mission_reports; v_snapshot jsonb;
begin
 select * into v_state from public.mission_engine_state where job_id=p_job_id;
 if v_state.state is distinct from 'completed' then raise exception 'MISSION_NOT_COMPLETED'; end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id;
 v_snapshot:=public.build_mission_report_snapshot(p_job_id);
 if v_snapshot is null then raise exception 'REPORT_SNAPSHOT_UNAVAILABLE'; end if;
 insert into public.mission_reports(job_id,agency_id,client_id,guard_id,snapshot)
 values(p_job_id,v_state.agency_id,v_job.client_id,v_state.guard_id,v_snapshot)
 on conflict(job_id) do nothing;
 select * into v_report from public.mission_reports where job_id=p_job_id;
 return v_report;
end;$$;

create or replace function public.auto_create_mission_report()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if new.state='completed' and old.state is distinct from 'completed' then perform public.ensure_mission_report(new.job_id); end if;
 return new;
end;$$;
drop trigger if exists mission_engine_create_report on public.mission_engine_state;
create trigger mission_engine_create_report after update of state on public.mission_engine_state for each row execute function public.auto_create_mission_report();

-- Backfill completed missions.
do $$ declare r record; begin for r in select job_id from public.mission_engine_state where state='completed' loop perform public.ensure_mission_report(r.job_id); end loop; end $$;

create or replace function public.get_agency_reports()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid;
begin
 select am.agency_id into v_agency from public.agency_members am join public.agencies a on a.id=am.agency_id where am.user_id=auth.uid() and am.role='agency_admin' and am.is_active=true and a.status='approved' limit 1;
 if v_agency is null then raise exception 'APPROVED_AGENCY_REQUIRED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.mission_reports r where r.agency_id=v_agency),'[]'::jsonb);
end;$$;

create or replace function public.review_mission_report(p_report_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency uuid; v_report public.mission_reports;
begin
 select am.agency_id into v_agency from public.agency_members am join public.agencies a on a.id=am.agency_id where am.user_id=auth.uid() and am.role='agency_admin' and am.is_active=true and a.status='approved' limit 1;
 select * into v_report from public.mission_reports where id=p_report_id for update;
 if v_report.id is null or v_report.agency_id is distinct from v_agency then raise exception 'REPORT_NOT_OWNED_BY_AGENCY'; end if;
 if p_action='publish' then
   if v_report.status not in ('pending_review','clarification_requested') then raise exception 'REPORT_NOT_PUBLISHABLE'; end if;
   update public.mission_reports set status='published',agency_review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),published_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
   insert into public.mission_events(job_id,event_type,actor_user_id,payload) values(v_report.job_id,'report_published',auth.uid(),jsonb_build_object('report_id',v_report.id,'version',v_report.version));
 elsif p_action='clarification' then
   if v_report.status<>'pending_review' then raise exception 'REPORT_NOT_RETURNABLE'; end if;
   if nullif(trim(p_note),'') is null then raise exception 'CLARIFICATION_NOTE_REQUIRED'; end if;
   update public.mission_reports set status='clarification_requested',clarification_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1,updated_at=now() where id=p_report_id returning * into v_report;
   insert into public.mission_events(job_id,event_type,actor_user_id,payload) values(v_report.job_id,'report_clarification_requested',auth.uid(),jsonb_build_object('report_id',v_report.id));
 else raise exception 'UNKNOWN_REPORT_ACTION'; end if;
 return to_jsonb(v_report);
end;$$;

create or replace function public.get_client_reports()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client uuid;
begin
 select id into v_client from public.clients where user_id=auth.uid();
 if v_client is null then raise exception 'CLIENT_REQUIRED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.published_at desc) from public.mission_reports r where r.client_id=v_client and r.status in ('published','archived')),'[]'::jsonb);
end;$$;

grant execute on function public.get_agency_reports() to authenticated;
grant execute on function public.review_mission_report(uuid,text,text) to authenticated;
grant execute on function public.get_client_reports() to authenticated;

-- Extend Command Center with reporting observability.
create or replace function public.get_platform_report_summary()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='platform_admin') then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 return jsonb_build_object(
  'pending_review',(select count(*) from public.mission_reports where status='pending_review'),
  'clarification_requested',(select count(*) from public.mission_reports where status='clarification_requested'),
  'published',(select count(*) from public.mission_reports where status='published'),
  'reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'job_id',r.job_id,'status',r.status,'version',r.version,'created_at',r.created_at,'published_at',r.published_at,'title',r.snapshot#>>'{job,title}','agency',r.snapshot#>>'{agency,name}','client',r.snapshot#>>'{client,name}') order by r.created_at desc) from public.mission_reports r),'[]'::jsonb)
 );
end;$$;
grant execute on function public.get_platform_report_summary() to authenticated;
commit;
