-- RC43: published Client proof isolation + complete multi-guard evidence attribution.
-- Clients may only retrieve evidence after the Agency publishes/archives the report.
create or replace function public.get_mission_evidence_for_report_rc2(p_job_id uuid)
returns table(id uuid,guard_id uuid,checkpoint_index integer,kind text,storage_path text,mime_type text,file_size bigint,captured_at timestamptz,latitude double precision,longitude double precision)
language plpgsql security definer set search_path=public set row_security=off as $$
declare v_role public.app_role:=public.current_role();v_client uuid:=public.auth_client_id();
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not (
  v_role='platform_admin'::public.app_role
  or exists(select 1 from public.marketplace_jobs j where j.id=p_job_id and j.accepted_agency_id in(select public.user_agency_ids()))
  or exists(select 1 from public.job_assignments a join public.guards g on g.id=a.guard_id where a.job_id=p_job_id and g.user_id=auth.uid())
  or exists(select 1 from public.job_guard_slots s join public.guards g on g.id=s.guard_id where s.job_id=p_job_id and g.user_id=auth.uid())
  or exists(select 1 from public.mission_reports r where r.job_id=p_job_id and r.client_id=v_client and r.status in('published','archived'))
 ) then raise exception 'MISSION_EVIDENCE_FORBIDDEN' using errcode='42501';end if;
 return query select m.id,m.guard_id,m.checkpoint_index,m.kind,m.storage_path,m.mime_type,m.file_size,m.captured_at,m.latitude,m.longitude from public.mission_evidence_media m where m.job_id=p_job_id order by m.guard_id,m.checkpoint_index,m.captured_at;
end $$;
revoke all on function public.get_mission_evidence_for_report_rc2(uuid) from public,anon;
grant execute on function public.get_mission_evidence_for_report_rc2(uuid) to authenticated,service_role;

create or replace function public.build_multi_guard_report_snapshot_rc1(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
select jsonb_build_object(
 'report_schema','co_pilot_multi_guard_report_v2',
 'job',jsonb_build_object('id',j.id,'title',j.title,'priority',j.priority,'instructions',j.instructions,'scheduled_for',j.scheduled_for,'duration_minutes',j.duration_minutes,'required_guards',j.required_guards,'completed_at',j.updated_at),
 'property',jsonb_build_object('id',pr.id,'name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'photo_url',pr.photo_url,'latitude',pr.latitude,'longitude',pr.longitude),
 'client',jsonb_build_object('id',c.id,'name',c.display_name),
 'agency',jsonb_build_object('id',a.id,'name',a.name,'license_number',a.license_number),
 'staffing',jsonb_build_object('required_guards',j.required_guards,'completed_guards',(select count(*) from public.job_guard_slots s where s.job_id=j.id and s.status='completed')),
 'guards',coalesce((select jsonb_agg(jsonb_build_object(
   'slot_number',s.slot_number,
   'guard',jsonb_build_object('id',g.id,'name',p.full_name,'badge_number',g.badge_number),
   'mission',jsonb_build_object('state',ms.state,'started_at',ms.mission_started_at,'route_started_at',ms.route_started_at,'arrived_at',ms.arrived_at,'completed_at',ms.completed_at,'checkpoint_index',ms.checkpoint_index,'evidence',ms.evidence,'incidents',ms.incidents,'engine_version',ms.version),
   'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'checkpoint_index',m.checkpoint_index,'kind',m.kind,'storage_path',m.storage_path,'mime_type',m.mime_type,'file_size',m.file_size,'captured_at',m.captured_at) order by m.checkpoint_index,m.captured_at) from public.mission_evidence_media m where m.job_id=j.id and m.guard_id=g.id),'[]'::jsonb)
  ) order by s.slot_number)
  from public.job_guard_slots s join public.guard_slot_mission_state ms on ms.slot_id=s.id join public.guards g on g.id=s.guard_id left join public.profiles p on p.id=g.user_id where s.job_id=j.id),'[]'::jsonb),
 'timeline',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'event_type',e.event_type,'payload',e.payload,'created_at',e.created_at,'actor_name',ep.full_name) order by e.created_at) from public.mission_events e left join public.profiles ep on ep.id=e.actor_user_id where e.job_id=j.id),'[]'::jsonb),
 'generated_at',now()
) from public.marketplace_jobs j join public.properties pr on pr.id=j.property_id join public.clients c on c.id=j.client_id join public.agencies a on a.id=j.accepted_agency_id
where j.id=p_job_id and j.required_guards>1 and j.status='completed' and (select count(*) from public.job_guard_slots s where s.job_id=j.id and s.status='completed')>=j.required_guards;
$$;
revoke all on function public.build_multi_guard_report_snapshot_rc1(uuid) from public,anon;
grant execute on function public.build_multi_guard_report_snapshot_rc1(uuid) to authenticated,service_role;
