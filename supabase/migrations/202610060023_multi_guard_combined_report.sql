-- Multi-guard jobs produce one combined immutable report after every required slot completes.
create or replace function public.build_multi_guard_report_snapshot_rc1(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
select jsonb_build_object(
 'report_schema','co_pilot_multi_guard_report_v1',
 'job',jsonb_build_object('id',j.id,'title',j.title,'priority',j.priority,'instructions',j.instructions,'scheduled_for',j.scheduled_for,'duration_minutes',j.duration_minutes,'required_guards',j.required_guards,'completed_at',j.updated_at),
 'property',jsonb_build_object('id',pr.id,'name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'photo_url',pr.photo_url,'latitude',pr.latitude,'longitude',pr.longitude),
 'client',jsonb_build_object('id',c.id,'name',c.display_name),
 'agency',jsonb_build_object('id',a.id,'name',a.name,'license_number',a.license_number),
 'staffing',jsonb_build_object('required_guards',j.required_guards,'completed_guards',(select count(*) from public.job_guard_slots s where s.job_id=j.id and s.status='completed')),
 'guards',coalesce((select jsonb_agg(jsonb_build_object('slot_number',s.slot_number,'guard',jsonb_build_object('id',g.id,'name',p.full_name,'badge_number',g.badge_number),'mission',jsonb_build_object('state',ms.state,'started_at',ms.mission_started_at,'route_started_at',ms.route_started_at,'arrived_at',ms.arrived_at,'completed_at',ms.completed_at,'checkpoint_index',ms.checkpoint_index,'evidence',ms.evidence,'incidents',ms.incidents,'engine_version',ms.version)) order by s.slot_number) from public.job_guard_slots s join public.guard_slot_mission_state ms on ms.slot_id=s.id join public.guards g on g.id=s.guard_id left join public.profiles p on p.id=g.user_id where s.job_id=j.id),'[]'::jsonb),
 'timeline',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'event_type',e.event_type,'payload',e.payload,'created_at',e.created_at,'actor_name',ep.full_name) order by e.created_at) from public.mission_events e left join public.profiles ep on ep.id=e.actor_user_id where e.job_id=j.id),'[]'::jsonb),'generated_at',now())
from public.marketplace_jobs j join public.properties pr on pr.id=j.property_id join public.clients c on c.id=j.client_id join public.agencies a on a.id=j.accepted_agency_id
where j.id=p_job_id and j.required_guards>1 and j.status='completed' and (select count(*) from public.job_guard_slots s where s.job_id=j.id and s.status='completed')>=j.required_guards;
$$;
revoke all on function public.build_multi_guard_report_snapshot_rc1(uuid) from public,anon;grant execute on function public.build_multi_guard_report_snapshot_rc1(uuid) to authenticated,service_role;

create or replace function public.ensure_multi_guard_mission_report_rc1(p_job_id uuid)
returns public.mission_reports language plpgsql security definer set search_path=public set row_security=off as $$
declare v_job public.marketplace_jobs;v_report public.mission_reports;v_snapshot jsonb;
begin
 select * into v_job from public.marketplace_jobs where id=p_job_id for update;if v_job.id is null or coalesce(v_job.required_guards,1)<=1 then raise exception 'MULTI_GUARD_JOB_REQUIRED';end if;
 if v_job.status<>'completed' or (select count(*) from public.job_guard_slots where job_id=p_job_id and status='completed')<v_job.required_guards then raise exception 'MISSION_NOT_COMPLETED';end if;
 v_snapshot:=public.build_multi_guard_report_snapshot_rc1(p_job_id);if v_snapshot is null then raise exception 'REPORT_SNAPSHOT_UNAVAILABLE';end if;
 insert into public.mission_reports(job_id,agency_id,client_id,guard_id,snapshot) values(p_job_id,v_job.accepted_agency_id,v_job.client_id,null,v_snapshot) on conflict(job_id) do nothing;
 select * into v_report from public.mission_reports where job_id=p_job_id;return v_report;
end $$;
revoke all on function public.ensure_multi_guard_mission_report_rc1(uuid) from public,anon;grant execute on function public.ensure_multi_guard_mission_report_rc1(uuid) to authenticated,service_role;
