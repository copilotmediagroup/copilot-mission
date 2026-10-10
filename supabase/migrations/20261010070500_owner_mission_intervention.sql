-- Owner mission intervention: audited operational flags from Mission Command.
create table if not exists public.mission_owner_flags (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved')),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists mission_owner_flags_one_open_per_job on public.mission_owner_flags(job_id) where status='open';
alter table public.mission_owner_flags enable row level security;
drop policy if exists mission_owner_flags_platform_admin_select on public.mission_owner_flags;
create policy mission_owner_flags_platform_admin_select on public.mission_owner_flags for select to authenticated using (public.current_role()='platform_admin');

create or replace function public.flag_mission_for_owner(p_job_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_actor uuid:=auth.uid(); v_flag public.mission_owner_flags%rowtype; v_title text;
begin
  if public.current_role() <> 'platform_admin' then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select title into v_title from public.marketplace_jobs where id=p_job_id;
  if v_title is null then raise exception 'MISSION_NOT_FOUND'; end if;
  insert into public.mission_owner_flags(job_id,note,created_by) values(p_job_id,nullif(trim(p_note),''),v_actor)
  on conflict (job_id) where status='open' do update set note=coalesce(excluded.note,public.mission_owner_flags.note)
  returning * into v_flag;
  insert into public.mission_events(job_id,event_type,payload,actor_user_id)
  values(p_job_id,'owner_attention_flagged',jsonb_build_object('flag_id',v_flag.id,'note',v_flag.note),v_actor);
  insert into public.owner_audit_log(actor_user_id,action,entity_type,entity_id,metadata)
  values(v_actor,'mission_owner_flagged','marketplace_job',p_job_id,jsonb_build_object('flag_id',v_flag.id,'note',v_flag.note));
  return to_jsonb(v_flag);
end $$;
revoke all on function public.flag_mission_for_owner(uuid,text) from public,anon;
grant execute on function public.flag_mission_for_owner(uuid,text) to authenticated;
