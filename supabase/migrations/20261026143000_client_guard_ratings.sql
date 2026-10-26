-- Client -> individual Guard reputation. One rating per job/guard; agencies are never rated.
create table if not exists public.guard_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, guard_id),
  check (comment is null or char_length(comment) <= 1000)
);
create index if not exists guard_ratings_guard_created_idx on public.guard_ratings(guard_id,created_at desc);
create index if not exists guard_ratings_client_created_idx on public.guard_ratings(client_id,created_at desc);
alter table public.guard_ratings enable row level security;
revoke all on table public.guard_ratings from public,anon,authenticated;

create or replace function public.rate_mission_guard(p_job_id uuid,p_guard_id uuid,p_rating integer,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client public.clients; v_report public.mission_reports; v_rating public.guard_ratings; v_comment text; v_assigned boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_client from public.clients where user_id=auth.uid() limit 1;
 if v_client.id is null then raise exception 'CLIENT_REQUIRED' using errcode='42501'; end if;
 if p_rating<1 or p_rating>5 then raise exception 'RATING_MUST_BE_1_TO_5' using errcode='22023'; end if;
 v_comment:=nullif(trim(coalesce(p_comment,'')),'');
 if v_comment is not null and char_length(v_comment)>1000 then raise exception 'RATING_COMMENT_TOO_LONG' using errcode='22023'; end if;
 select * into v_report from public.mission_reports where job_id=p_job_id and client_id=v_client.id and status in('published','archived') limit 1;
 if v_report.id is null then raise exception 'PUBLISHED_REPORT_REQUIRED' using errcode='42501'; end if;
 select exists(select 1 from public.job_assignments a where a.job_id=p_job_id and a.guard_id=p_guard_id union all select 1 from public.job_guard_slots s where s.job_id=p_job_id and s.guard_id=p_guard_id) into v_assigned;
 if not v_assigned then raise exception 'GUARD_NOT_ASSIGNED_TO_MISSION' using errcode='42501'; end if;
 if exists(select 1 from public.guard_ratings where job_id=p_job_id and guard_id=p_guard_id) then raise exception 'GUARD_ALREADY_RATED' using errcode='23505'; end if;
 insert into public.guard_ratings(job_id,client_id,guard_id,rating,comment) values(p_job_id,v_client.id,p_guard_id,p_rating,v_comment) returning * into v_rating;
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,auth.uid(),'client_guard_rated',jsonb_build_object('guard_id',p_guard_id,'rating',p_rating));
 return jsonb_build_object('id',v_rating.id,'job_id',v_rating.job_id,'guard_id',v_rating.guard_id,'rating',v_rating.rating,'comment',v_rating.comment,'created_at',v_rating.created_at);
end;$$;
revoke all on function public.rate_mission_guard(uuid,uuid,integer,text) from public,anon;
grant execute on function public.rate_mission_guard(uuid,uuid,integer,text) to authenticated;

create or replace function public.get_my_mission_guard_ratings(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_client uuid;
begin
 select id into v_client from public.clients where user_id=auth.uid();
 if v_client is null then raise exception 'CLIENT_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.mission_reports where job_id=p_job_id and client_id=v_client and status in('published','archived')) then raise exception 'PUBLISHED_REPORT_REQUIRED' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'guard_id',r.guard_id,'rating',r.rating,'comment',r.comment,'created_at',r.created_at)) from public.guard_ratings r where r.job_id=p_job_id and r.client_id=v_client),'[]'::jsonb);
end;$$;
revoke all on function public.get_my_mission_guard_ratings(uuid) from public,anon;
grant execute on function public.get_my_mission_guard_ratings(uuid) to authenticated;

create or replace function public.get_guard_rating_summary(p_guard_id uuid)
returns jsonb language sql stable security definer set search_path=public set row_security=off as $$
 select jsonb_build_object('guard_id',p_guard_id,'average_rating',coalesce(round(avg(r.rating)::numeric,2),0),'rating_count',count(r.id)) from public.guard_ratings r where r.guard_id=p_guard_id;
$$;
revoke all on function public.get_guard_rating_summary(uuid) from public,anon;
grant execute on function public.get_guard_rating_summary(uuid) to authenticated;
