-- Complete guard reputation: distribution, written feedback, mission history, and platform moderation.
alter table public.guard_ratings add column if not exists moderation_status text not null default 'visible';
alter table public.guard_ratings add column if not exists moderated_at timestamptz;
alter table public.guard_ratings add column if not exists moderated_by uuid references auth.users(id);
alter table public.guard_ratings add column if not exists moderation_reason text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='guard_ratings_moderation_status_check') then
  alter table public.guard_ratings add constraint guard_ratings_moderation_status_check check(moderation_status in('visible','removed'));
 end if;
end $$;

create or replace function public.get_guard_reputation(p_guard_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
with visible as (
 select r.* from public.guard_ratings r
 join public.marketplace_jobs j on j.id=r.job_id
 join public.mission_reports mr on mr.job_id=r.job_id and mr.client_id=r.client_id and mr.status in('published','archived')
 where r.guard_id=p_guard_id and r.moderation_status='visible' and j.status='completed'
), missions as (
 select count(distinct x.job_id)::int n from (
  select ja.job_id from public.job_assignments ja join public.marketplace_jobs j on j.id=ja.job_id where ja.guard_id=p_guard_id and ja.status='completed' and j.status='completed'
  union
  select s.job_id from public.job_guard_slots s join public.marketplace_jobs j on j.id=s.job_id where s.guard_id=p_guard_id and s.status='completed' and j.status='completed'
 ) x
)
select jsonb_build_object(
 'guard_id',p_guard_id,
 'average_rating',coalesce((select round(avg(rating)::numeric,2) from visible),0),
 'rating_count',(select count(*) from visible),
 'completed_mission_count',(select n from missions),
 'distribution',jsonb_build_object(
   '5',(select count(*) from visible where rating=5),'4',(select count(*) from visible where rating=4),'3',(select count(*) from visible where rating=3),'2',(select count(*) from visible where rating=2),'1',(select count(*) from visible where rating=1)
 ),
 'recent_feedback',coalesce((select jsonb_agg(jsonb_build_object('id',id,'rating',rating,'comment',comment,'created_at',created_at) order by created_at desc) from (select id,rating,comment,created_at from visible where comment is not null and trim(comment)<>'' order by created_at desc limit 5) q),'[]'::jsonb)
);
$$;
revoke all on function public.get_guard_reputation(uuid) from public,anon;
grant execute on function public.get_guard_reputation(uuid) to authenticated;

create or replace function public.get_guard_rating_summary(p_guard_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$ select public.get_guard_reputation(p_guard_id); $$;
revoke all on function public.get_guard_rating_summary(uuid) from public,anon;
grant execute on function public.get_guard_rating_summary(uuid) to authenticated;

create or replace function public.get_platform_guard_rating_moderation()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'job_id',r.job_id,'guard_id',r.guard_id,'guard_name',coalesce(p.full_name,'Guard'),'agency_id',g.agency_id,'rating',r.rating,'comment',r.comment,'created_at',r.created_at,'moderation_status',r.moderation_status,'moderated_at',r.moderated_at,'moderation_reason',r.moderation_reason) order by r.created_at desc) from public.guard_ratings r join public.guards g on g.id=r.guard_id left join public.profiles p on p.id=g.user_id),'[]'::jsonb);
end $$;
revoke all on function public.get_platform_guard_rating_moderation() from public,anon;
grant execute on function public.get_platform_guard_rating_moderation() to authenticated;

create or replace function public.moderate_guard_rating(p_rating_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare r public.guard_ratings; v_status text;
begin
 if public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_action not in('remove','restore') then raise exception 'INVALID_MODERATION_ACTION' using errcode='22023'; end if;
 v_status:=case when p_action='remove' then 'removed' else 'visible' end;
 update public.guard_ratings set moderation_status=v_status,moderated_at=now(),moderated_by=auth.uid(),moderation_reason=nullif(trim(coalesce(p_reason,'')),'') where id=p_rating_id returning * into r;
 if r.id is null then raise exception 'RATING_NOT_FOUND'; end if;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(r.job_id,auth.uid(),'guard_rating_moderated',jsonb_build_object('rating_id',r.id,'guard_id',r.guard_id,'action',p_action,'reason',p_reason));
 return jsonb_build_object('id',r.id,'moderation_status',r.moderation_status,'moderated_at',r.moderated_at);
end $$;
revoke all on function public.moderate_guard_rating(uuid,text,text) from public,anon;
grant execute on function public.moderate_guard_rating(uuid,text,text) to authenticated;
