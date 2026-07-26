-- Co Pilot Security Marketplace OS RC2 — Dispatch Engine
-- Database-owned assignment, guard response, mission lock, timeline, and role projections.
begin;

alter table public.job_assignments add column if not exists offered_at timestamptz;
alter table public.job_assignments add column if not exists declined_at timestamptz;
alter table public.job_assignments add column if not exists locked_at timestamptz;
alter table public.job_assignments add column if not exists response_deadline timestamptz;
alter table public.job_assignments add column if not exists assignment_version integer not null default 0;
create index if not exists job_assignments_guard_status_idx on public.job_assignments(guard_id,status);

create or replace function public.dispatch_mission_json_rc2(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
select jsonb_build_object(
 'assignment_id',ja.id,'job_id',j.id,'agency_id',ja.agency_id,'guard_id',ja.guard_id,'status',ja.status,
 'assigned_at',ja.assigned_at,'offered_at',ja.offered_at,'accepted_at',ja.accepted_at,'declined_at',ja.declined_at,'locked_at',ja.locked_at,
 'title',j.title,'instructions',j.instructions,'priority',j.priority,'scheduled_for',j.scheduled_for,'duration_minutes',j.duration_minutes,
 'property',jsonb_build_object('name',pr.name,'address',coalesce(pr.formatted_address,pr.address),'latitude',pr.latitude,'longitude',pr.longitude,'photo_url',pr.photo_url),
 'client',jsonb_build_object('display_name',c.display_name),
 'guard',case when g.id is null then null else jsonb_build_object('id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'badge_number',g.badge_number,'availability',g.availability) end
)
from public.job_assignments ja join public.marketplace_jobs j on j.id=ja.job_id join public.properties pr on pr.id=j.property_id join public.clients c on c.id=j.client_id
left join public.guards g on g.id=ja.guard_id left join public.profiles p on p.id=g.user_id where j.id=p_job_id;
$$;

create or replace function public.get_agency_dispatch_workspace_rc2()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_name text; v_status public.agency_status; v_guards jsonb; v_missions jsonb; v_events jsonb;
begin
 select agency_id,agency_name,agency_status into v_agency_id,v_name,v_status from public.resolve_my_agency_workspace();
 if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED: Approved Agency required.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'user_id',g.user_id,'name',coalesce(p.full_name,'Guard'),'badge_number',g.badge_number,'availability',g.availability) order by p.full_name),'[]') into v_guards
 from public.guards g join public.profiles p on p.id=g.user_id where g.agency_id=v_agency_id;
 select coalesce(jsonb_agg(public.dispatch_mission_json_rc2(ja.job_id) order by ja.assigned_at desc),'[]') into v_missions from public.job_assignments ja where ja.agency_id=v_agency_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',me.id,'job_id',me.job_id,'event_type',me.event_type,'payload',me.payload,'created_at',me.created_at) order by me.created_at desc),'[]') into v_events
 from public.mission_events me join public.job_assignments ja on ja.job_id=me.job_id where ja.agency_id=v_agency_id and me.created_at>now()-interval '7 days';
 return jsonb_build_object('agency',jsonb_build_object('id',v_agency_id,'name',v_name),'guards',v_guards,'missions',v_missions,'events',v_events);
end;$$;

create or replace function public.assign_guard_rc2(p_job_id uuid,p_guard_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_agency_id uuid; v_status public.agency_status; v_job public.marketplace_jobs; v_guard public.guards; v_assignment public.job_assignments;
begin
 select agency_id,agency_status into v_agency_id,v_status from public.resolve_my_agency_workspace();
 if v_agency_id is null or v_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id for update;
 if v_job.id is null or v_job.accepted_agency_id is distinct from v_agency_id or v_job.status not in ('accepted','assigned') then raise exception 'MISSION_NOT_ASSIGNABLE' using errcode='22023'; end if;
 select * into v_guard from public.guards where id=p_guard_id and agency_id=v_agency_id for update;
 if v_guard.id is null then raise exception 'GUARD_NOT_IN_AGENCY' using errcode='42501'; end if;
 if v_guard.availability<>'available' then raise exception 'GUARD_NOT_AVAILABLE' using errcode='22023'; end if;
 select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
 if v_assignment.status not in ('awaiting_guard','offered') then raise exception 'ASSIGNMENT_LOCKED' using errcode='22023'; end if;
 if v_assignment.guard_id is not null and v_assignment.guard_id<>p_guard_id then update public.guards set availability='available' where id=v_assignment.guard_id and availability='reserved'; end if;
 update public.job_assignments set guard_id=p_guard_id,status='offered',assigned_at=now(),offered_at=now(),declined_at=null,response_deadline=now()+interval '15 minutes',assignment_version=assignment_version+1 where job_id=p_job_id;
 update public.guards set availability='reserved' where id=p_guard_id;
 update public.marketplace_jobs set status='assigned',updated_at=now() where id=p_job_id;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_assigned',jsonb_build_object('agency_id',v_agency_id,'guard_id',p_guard_id,'assignment_status','offered'));
 return jsonb_build_object('success',true,'job_id',p_job_id,'guard_id',p_guard_id,'status','offered');
end;$$;

create or replace function public.get_guard_dispatch_workspace_rc2()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_assignment public.job_assignments; v_events jsonb;
begin
 select * into v_guard from public.guards where user_id=auth.uid();
 if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select * into v_assignment from public.job_assignments where guard_id=v_guard.id and status in ('offered','accepted','en_route','arrived','active') order by assigned_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',me.id,'job_id',me.job_id,'event_type',me.event_type,'payload',me.payload,'created_at',me.created_at) order by me.created_at desc),'[]') into v_events from public.mission_events me where v_assignment.job_id is not null and me.job_id=v_assignment.job_id;
 return jsonb_build_object('guard',jsonb_build_object('id',v_guard.id,'user_id',v_guard.user_id,'name',coalesce((select full_name from public.profiles where id=v_guard.user_id),'Guard'),'badge_number',v_guard.badge_number,'availability',v_guard.availability),'assignment',case when v_assignment.id is null then null else public.dispatch_mission_json_rc2(v_assignment.job_id) end,'events',v_events);
end;$$;

create or replace function public.respond_to_assignment_rc2(p_job_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_guard public.guards; v_assignment public.job_assignments;
begin
 if p_response not in ('accept','decline') then raise exception 'INVALID_RESPONSE' using errcode='22023'; end if;
 select * into v_guard from public.guards where user_id=auth.uid(); if v_guard.id is null then raise exception 'GUARD_PROFILE_NOT_FOUND' using errcode='42501'; end if;
 select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
 if v_assignment.guard_id is distinct from v_guard.id or v_assignment.status<>'offered' then raise exception 'ASSIGNMENT_NOT_OFFERED_TO_GUARD' using errcode='42501'; end if;
 if p_response='accept' then
  update public.job_assignments set status='accepted',accepted_at=now(),locked_at=now(),response_deadline=null where id=v_assignment.id;
  update public.guards set availability='on_mission' where id=v_guard.id;
  update public.marketplace_jobs set status='active',updated_at=now() where id=p_job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_accepted',jsonb_build_object('guard_id',v_guard.id,'mission_locked',true,'timeline_started_at',now()));
  return jsonb_build_object('success',true,'job_id',p_job_id,'status','accepted');
 else
  update public.job_assignments set guard_id=null,status='awaiting_guard',declined_at=now(),offered_at=null,response_deadline=null,assignment_version=assignment_version+1 where id=v_assignment.id;
  update public.guards set availability='available' where id=v_guard.id;
  update public.marketplace_jobs set status='accepted',updated_at=now() where id=p_job_id;
  insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'guard_declined',jsonb_build_object('guard_id',v_guard.id,'returned_to_marketplace',false,'assignment_status','awaiting_guard'));
  return jsonb_build_object('success',true,'job_id',p_job_id,'status','awaiting_guard');
 end if;
end;$$;

revoke all on function public.dispatch_mission_json_rc2(uuid) from public;
revoke all on function public.get_agency_dispatch_workspace_rc2() from public;
revoke all on function public.assign_guard_rc2(uuid,uuid) from public;
revoke all on function public.get_guard_dispatch_workspace_rc2() from public;
revoke all on function public.respond_to_assignment_rc2(uuid,text) from public;
grant execute on function public.get_agency_dispatch_workspace_rc2() to authenticated;
grant execute on function public.assign_guard_rc2(uuid,uuid) to authenticated;
grant execute on function public.get_guard_dispatch_workspace_rc2() to authenticated;
grant execute on function public.respond_to_assignment_rc2(uuid,text) to authenticated;
commit;
