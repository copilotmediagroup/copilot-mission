-- RC39: provider-neutral marketplace earnings ledger.
-- This records earned balances only. It does not custody funds or initiate bank transfers.
create table if not exists public.marketplace_ledger_entries(
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.marketplace_jobs(id) on delete restrict,
 agency_id uuid references public.agencies(id) on delete restrict,
 account_type text not null check(account_type in('agency','platform')),
 entry_type text not null check(entry_type in('earning','adjustment','refund','payout')),
 amount_cents integer not null,
 status text not null check(status in('pending','available','held','withdrawn','reversed')),
 description text not null,
 source text not null default 'mission_report',
 available_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint marketplace_ledger_agency_scope check((account_type='agency' and agency_id is not null) or (account_type='platform' and agency_id is null))
);
create unique index if not exists marketplace_ledger_job_credit_uq on public.marketplace_ledger_entries(job_id,account_type) where entry_type='earning';
create index if not exists marketplace_ledger_agency_idx on public.marketplace_ledger_entries(agency_id,status,created_at desc);
create index if not exists marketplace_ledger_platform_idx on public.marketplace_ledger_entries(account_type,status,created_at desc);
alter table public.marketplace_ledger_entries enable row level security;
drop policy if exists marketplace_ledger_read_scope on public.marketplace_ledger_entries;
create policy marketplace_ledger_read_scope on public.marketplace_ledger_entries for select to authenticated using(
 public.current_role()='platform_admin'::public.app_role or
 (account_type='agency' and agency_id in(select agency_id from public.agency_members where user_id=auth.uid() and status='active'))
);

create or replace function public.sync_marketplace_earnings_for_report_rc1()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs;begin
 if new.status<>'published' or old.status='published' then return new;end if;
 select * into j from public.marketplace_jobs where id=new.job_id;
 if j.id is null or coalesce(j.pricing_snapshot->>'developer_test','false')='true' then return new;end if;
 if j.status<>'completed' or j.accepted_agency_id is null then raise exception 'EARNINGS_JOB_NOT_SETTLEABLE';end if;
 if coalesce(j.agency_payout_cents,0)<0 or coalesce(j.platform_fee_cents,0)<0 then raise exception 'INVALID_EARNINGS_SPLIT';end if;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at)
 values(j.id,j.accepted_agency_id,'agency','earning',coalesce(j.agency_payout_cents,0),'available','Mission earnings · '||coalesce(j.title,'Security mission'),now())
 on conflict do nothing;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at)
 values(j.id,null,'platform','earning',coalesce(j.platform_fee_cents,0),'available','Platform fee · '||coalesce(j.title,'Security mission'),now())
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists mission_report_marketplace_earnings on public.mission_reports;
create trigger mission_report_marketplace_earnings after update of status on public.mission_reports for each row execute function public.sync_marketplace_earnings_for_report_rc1();

-- Backfill only real, completed, already-published missions. Idempotent unique indexes prevent duplicates.
insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at,created_at)
select j.id,j.accepted_agency_id,'agency','earning',coalesce(j.agency_payout_cents,0),case when j.payout_status='paid' then 'withdrawn' else 'available' end,'Mission earnings · '||coalesce(j.title,'Security mission'),coalesce(r.published_at,r.updated_at),coalesce(r.published_at,r.updated_at,now())
from public.mission_reports r join public.marketplace_jobs j on j.id=r.job_id
where r.status='published' and j.status='completed' and j.accepted_agency_id is not null and coalesce(j.pricing_snapshot->>'developer_test','false')<>'true'
on conflict do nothing;
insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at,created_at)
select j.id,null,'platform','earning',coalesce(j.platform_fee_cents,0),'available','Platform fee · '||coalesce(j.title,'Security mission'),coalesce(r.published_at,r.updated_at),coalesce(r.published_at,r.updated_at,now())
from public.mission_reports r join public.marketplace_jobs j on j.id=r.job_id
where r.status='published' and j.status='completed' and j.accepted_agency_id is not null and coalesce(j.pricing_snapshot->>'developer_test','false')<>'true'
on conflict do nothing;

create or replace function public.get_my_agency_earnings_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare aid uuid;begin
 select agency_id into aid from public.agency_members where user_id=auth.uid() and status='active' limit 1;
 if aid is null then raise exception 'AGENCY_NOT_FOUND' using errcode='42501';end if;
 return jsonb_build_object(
  'summary',jsonb_build_object(
   'pending_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='pending'),0),
   'available_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='available'),0),
   'held_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='held'),0),
   'withdrawn_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and status='withdrawn'),0),
   'lifetime_earned_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where agency_id=aid and entry_type='earning' and status<>'reversed'),0)
  ),
  'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'job_id',l.job_id,'title',j.title,'entry_type',l.entry_type,'amount_cents',l.amount_cents,'status',l.status,'description',l.description,'available_at',l.available_at,'created_at',l.created_at) order by l.created_at desc) from public.marketplace_ledger_entries l join public.marketplace_jobs j on j.id=l.job_id where l.agency_id=aid),'[]'::jsonb),
  'withdrawals_enabled',false,
  'withdrawal_message','Bank withdrawals will be enabled after the marketplace payout provider is connected.'
 );
end $$;
revoke all on function public.get_my_agency_earnings_rc1() from public,anon;
grant execute on function public.get_my_agency_earnings_rc1() to authenticated,service_role;

create or replace function public.get_platform_earnings_rc1()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
begin
 if auth.uid() is null or public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object('available_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where account_type='platform' and status='available'),0),'lifetime_earned_cents',coalesce((select sum(amount_cents) from public.marketplace_ledger_entries where account_type='platform' and entry_type='earning' and status<>'reversed'),0),'withdrawals_enabled',false);
end $$;
revoke all on function public.get_platform_earnings_rc1() from public,anon;
grant execute on function public.get_platform_earnings_rc1() to authenticated,service_role;
