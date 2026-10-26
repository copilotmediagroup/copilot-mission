-- Final rating gate: only a guard who actually completed the client's published mission can be rated.
create or replace function public.rate_mission_guard(p_job_id uuid,p_guard_id uuid,p_rating integer,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client public.clients; v_report public.mission_reports; v_rating public.guard_ratings; v_comment text; v_completed boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_client from public.clients where user_id=auth.uid() limit 1;
 if v_client.id is null then raise exception 'CLIENT_REQUIRED' using errcode='42501'; end if;
 if p_rating<1 or p_rating>5 then raise exception 'RATING_MUST_BE_1_TO_5' using errcode='22023'; end if;
 v_comment:=nullif(trim(coalesce(p_comment,'')),'');
 if v_comment is not null and char_length(v_comment)>1000 then raise exception 'RATING_COMMENT_TOO_LONG' using errcode='22023'; end if;
 select mr.* into v_report from public.mission_reports mr join public.marketplace_jobs j on j.id=mr.job_id where mr.job_id=p_job_id and mr.client_id=v_client.id and mr.status in('published','archived') and j.status='completed' limit 1;
 if v_report.id is null then raise exception 'COMPLETED_PUBLISHED_MISSION_REQUIRED' using errcode='42501'; end if;
 select exists(
   select 1 from public.job_assignments a where a.job_id=p_job_id and a.guard_id=p_guard_id and a.status='completed'
   union all
   select 1 from public.job_guard_slots s where s.job_id=p_job_id and s.guard_id=p_guard_id and s.status='completed'
 ) into v_completed;
 if not v_completed then raise exception 'GUARD_DID_NOT_COMPLETE_MISSION' using errcode='42501'; end if;
 if exists(select 1 from public.guard_ratings where job_id=p_job_id and guard_id=p_guard_id) then raise exception 'GUARD_ALREADY_RATED' using errcode='23505'; end if;
 insert into public.guard_ratings(job_id,client_id,guard_id,rating,comment) values(p_job_id,v_client.id,p_guard_id,p_rating,v_comment) returning * into v_rating;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'client_guard_rated',jsonb_build_object('guard_id',p_guard_id,'rating',p_rating));
 return jsonb_build_object('id',v_rating.id,'job_id',v_rating.job_id,'guard_id',v_rating.guard_id,'rating',v_rating.rating,'comment',v_rating.comment,'created_at',v_rating.created_at);
end $$;
revoke all on function public.rate_mission_guard(uuid,uuid,integer,text) from public,anon;
grant execute on function public.rate_mission_guard(uuid,uuid,integer,text) to authenticated;
