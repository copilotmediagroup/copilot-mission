-- Multi-guard staffing foundation. Preserve the proven one-row job_assignments mission engine.
create table if not exists public.job_guard_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.marketplace_jobs(id) on delete cascade,
  agency_id uuid not null references public.agencies(id),
  slot_number integer not null check (slot_number between 1 and 20),
  guard_id uuid references public.guards(id),
  status text not null default 'awaiting_guard' check (status in ('awaiting_guard','offered','accepted','en_route','arrived','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id,slot_number), unique(job_id,guard_id)
);
create index if not exists job_guard_slots_agency_job_idx on public.job_guard_slots(agency_id,job_id,slot_number);
create index if not exists job_guard_slots_guard_idx on public.job_guard_slots(guard_id) where guard_id is not null;
alter table public.job_guard_slots enable row level security;
drop policy if exists job_guard_slots_scoped_read on public.job_guard_slots;
create policy job_guard_slots_scoped_read on public.job_guard_slots for select to authenticated using (
  agency_id in (select public.user_agency_ids()) or public.current_role()='platform_admin'
  or guard_id in (select id from public.guards where user_id=auth.uid())
  or job_id in (select j.id from public.marketplace_jobs j join public.clients c on c.id=j.client_id where c.user_id=auth.uid())
);

create or replace function public.ensure_job_guard_slots(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_job public.marketplace_jobs; v_n integer; v_existing integer;
begin
 select * into v_job from public.marketplace_jobs where id=p_job_id for update;
 if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='22023'; end if;
 if v_job.accepted_agency_id is null then raise exception 'MISSION_NOT_CLAIMED' using errcode='22023'; end if;
 v_n:=greatest(1,least(20,coalesce(v_job.required_guards,1)));
 insert into public.job_guard_slots(job_id,agency_id,slot_number)
 select v_job.id,v_job.accepted_agency_id,s from generate_series(1,v_n) s
 on conflict(job_id,slot_number) do update set agency_id=excluded.agency_id,updated_at=now();
 select count(*) into v_existing from public.job_guard_slots where job_id=p_job_id and status<>'cancelled';
 return jsonb_build_object('job_id',p_job_id,'required_guards',v_n,'slots',v_existing);
end $$;
revoke all on function public.ensure_job_guard_slots(uuid) from public,anon,authenticated;
grant execute on function public.ensure_job_guard_slots(uuid) to service_role;

create or replace function public.get_job_staffing_rc1(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_job public.marketplace_jobs; v_agency uuid; v_required integer; v_filled integer; v_accepted integer; v_slots jsonb;
begin
 if auth.uid() is null then raise exception 'SESSION_REQUIRED' using errcode='42501'; end if;
 select * into v_job from public.marketplace_jobs where id=p_job_id;
 if v_job.id is null then raise exception 'MISSION_NOT_FOUND' using errcode='22023'; end if;
 select agency_id into v_agency from public.resolve_my_agency_workspace();
 if public.current_role()<>'platform_admin'
    and v_job.accepted_agency_id is distinct from v_agency
    and not exists(select 1 from public.clients c where c.id=v_job.client_id and c.user_id=auth.uid())
    and not exists(select 1 from public.job_guard_slots s join public.guards g on g.id=s.guard_id where s.job_id=p_job_id and g.user_id=auth.uid())
 then raise exception 'MISSION_ACCESS_DENIED' using errcode='42501'; end if;
 v_required:=greatest(1,least(20,coalesce(v_job.required_guards,1)));
 select count(*) filter(where guard_id is not null and status<>'cancelled'),
        count(*) filter(where status in ('accepted','en_route','arrived','active','completed')),
        coalesce(jsonb_agg(jsonb_build_object('id',id,'slot_number',slot_number,'guard_id',guard_id,'status',status) order by slot_number),'[]'::jsonb)
 into v_filled,v_accepted,v_slots from public.job_guard_slots where job_id=p_job_id and status<>'cancelled';
 return jsonb_build_object('job_id',p_job_id,'required_guards',v_required,'filled_slots',v_filled,'accepted_slots',v_accepted,'fully_staffed',v_accepted>=v_required,'slots',v_slots);
end $$;
revoke all on function public.get_job_staffing_rc1(uuid) from public,anon;
grant execute on function public.get_job_staffing_rc1(uuid) to authenticated,service_role;

-- Successful claim now materializes exactly required_guards staffing slots.
create or replace function public.claim_marketplace_job_rc1a(p_job_id uuid) returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_user_id uuid:=auth.uid(); v_agency_id uuid; v_agency_status public.agency_status; v_profile_status public.account_status; v_service text; v_access jsonb; v_claimed public.marketplace_jobs; v_staffing jsonb;
begin
 if v_user_id is null then return jsonb_build_object('accepted',false,'reason','SESSION_REQUIRED'); end if;
 select agency_id,agency_status into v_agency_id,v_agency_status from public.resolve_my_agency_workspace();
 if v_agency_id is null then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_FOUND'); end if;
 select account_status into v_profile_status from public.profiles where id=v_user_id;
 select service_type into v_service from public.marketplace_jobs where id=p_job_id;
 v_access:=public.agency_can_claim_service(v_agency_id,coalesce(v_service,'standard_patrol'));
 if v_agency_status<>'approved' then return jsonb_build_object('accepted',false,'reason','AGENCY_NOT_APPROVED'); end if;
 if v_profile_status<>'approved' then return jsonb_build_object('accepted',false,'reason','ACCOUNT_NOT_APPROVED'); end if;
 if coalesce((v_access->>'allowed')::boolean,false)=false then return jsonb_build_object('accepted',false,'reason',coalesce(v_access->>'reason','COMPLIANCE_INCOMPLETE'),'access',v_access); end if;
 update public.marketplace_jobs set status='accepted',accepted_agency_id=v_agency_id,accepted_at=now(),updated_at=now(),payout_status='held_until_report',payout_hold_reason='report_required_before_payout' where id=p_job_id and status='open' and accepted_agency_id is null and payment_status in ('authorized','captured') returning * into v_claimed;
 if v_claimed.id is null then return jsonb_build_object('accepted',false,'reason','ALREADY_CLAIMED_UNPAID_OR_UNAVAILABLE','job_id',p_job_id); end if;
 update public.job_financials set agency_id=v_agency_id,payout_status='held_until_report',hold_reason='report_required_before_payout',updated_at=now() where job_id=p_job_id;
 insert into public.job_assignments(job_id,agency_id,status) values(p_job_id,v_agency_id,'awaiting_guard') on conflict(job_id) do update set agency_id=excluded.agency_id,status='awaiting_guard';
 v_staffing:=public.ensure_job_guard_slots(p_job_id);
 insert into public.mission_events(job_id,actor_user_id,event_type,payload) values(p_job_id,v_user_id,'agency_claimed',jsonb_build_object('agency_id',v_agency_id,'status','accepted','payment_status',v_claimed.payment_status,'payout_status','held_until_report','required_guards',v_claimed.required_guards,'staffing',v_staffing));
 perform public.notify_role('platform_admin',p_job_id,'agency_claimed_job','Agency claimed job','Agency claimed a marketplace job; payout is held until report.', 'normal');
 return jsonb_build_object('accepted',true,'reason',null,'job_id',p_job_id,'agency_id',v_agency_id,'payment_status',v_claimed.payment_status,'payout_status','held_until_report','required_guards',v_claimed.required_guards,'staffing',v_staffing);
end $function$;
revoke all on function public.claim_marketplace_job_rc1a(uuid) from public,anon;
grant execute on function public.claim_marketplace_job_rc1a(uuid) to authenticated,service_role;
