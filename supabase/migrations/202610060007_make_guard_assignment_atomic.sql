-- Guard assignment is agency-owned, payment-gated, serialized on the guard row, and rejects active commitments.
create or replace function public.assign_guard_rc2(p_job_id uuid,p_guard_id uuid) returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_user_id uuid:=auth.uid(); v_agency_id uuid; v_agency_status public.agency_status; v_job public.marketplace_jobs; v_guard public.guards; v_assignment public.job_assignments; v_conflict uuid;
begin
 if v_user_id is null then raise exception 'SESSION_REQUIRED' using errcode='42501'; end if;
 select agency_id,agency_status into v_agency_id,v_agency_status from public.resolve_my_agency_workspace();
 if v_agency_id is null or v_agency_status<>'approved' then raise exception 'AGENCY_NOT_APPROVED' using errcode='42501'; end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id for update;
 if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='22023'; end if;
 if v_job.accepted_agency_id is distinct from v_agency_id then raise exception 'MISSION_NOT_OWNED_BY_AGENCY' using errcode='42501'; end if;
 if v_job.status<>'accepted' then raise exception 'MISSION_NOT_AWAITING_GUARD' using errcode='22023'; end if;
 if v_job.payment_status not in ('authorized','captured') then raise exception 'MISSION_PAYMENT_NOT_AUTHORIZED' using errcode='22023'; end if;
 select * into v_assignment from public.job_assignments where job_id=p_job_id for update;
 if v_assignment.id is null or v_assignment.agency_id is distinct from v_agency_id then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='22023'; end if;
 if v_assignment.status<>'awaiting_guard' or v_assignment.guard_id is not null then raise exception 'ASSIGNMENT_ALREADY_OFFERED_OR_LOCKED' using errcode='22023'; end if;
 select * into v_guard from public.guards where id=p_guard_id and agency_id=v_agency_id for update;
 if v_guard.id is null then raise exception 'GUARD_NOT_IN_AGENCY' using errcode='42501'; end if;
 if v_guard.availability<>'available' then raise exception 'GUARD_NOT_AVAILABLE' using errcode='22023'; end if;
 select ja.job_id into v_conflict from public.job_assignments ja join public.marketplace_jobs mj on mj.id=ja.job_id where ja.guard_id=p_guard_id and ja.job_id<>p_job_id and ja.status in ('offered','accepted','active') and mj.status in ('assigned','active') limit 1;
 if v_conflict is not null then raise exception 'GUARD_ALREADY_COMMITTED' using errcode='22023'; end if;
 update public.job_assignments set guard_id=p_guard_id,status='offered',assigned_at=now(),offered_at=now(),accepted_at=null,declined_at=null,locked_at=null,response_deadline=now()+interval '15 minutes',assignment_version=assignment_version+1 where id=v_assignment.id and status='awaiting_guard' and guard_id is null;
 if not found then raise exception 'ASSIGNMENT_ALREADY_OFFERED_OR_LOCKED' using errcode='22023'; end if;
 update public.guards set availability='reserved' where id=p_guard_id and availability='available'; if not found then raise exception 'GUARD_NOT_AVAILABLE' using errcode='22023'; end if;
 update public.marketplace_jobs set status='assigned',updated_at=now() where id=p_job_id and status='accepted' and payment_status in ('authorized','captured'); if not found then raise exception 'MISSION_NOT_ASSIGNABLE' using errcode='22023'; end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,v_user_id,'guard_assignment_offered',jsonb_build_object('agency_id',v_agency_id,'guard_id',p_guard_id,'response_deadline',now()+interval '15 minutes','assignment_version',v_assignment.assignment_version+1));
 return jsonb_build_object('success',true,'job_id',p_job_id,'guard_id',p_guard_id,'status','offered');
end;$function$;
revoke all on function public.assign_guard_rc2(uuid,uuid) from public,anon;
grant execute on function public.assign_guard_rc2(uuid,uuid) to authenticated,service_role;
