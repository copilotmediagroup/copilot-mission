-- RC41: remove synthetic zero-dollar legacy ledger rows and prevent them going forward.
-- Historical jobs without a stored financial split remain historical; we do not invent money.
delete from public.marketplace_ledger_entries l
using public.marketplace_jobs j
where l.job_id=j.id
  and l.entry_type='earning'
  and l.amount_cents=0
  and l.external_reference is null
  and l.source='mission_report'
  and ((l.account_type='agency' and j.agency_payout_cents is null)
    or (l.account_type='platform' and j.platform_fee_cents is null));

create or replace function public.sync_marketplace_earnings_for_report_rc1()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare j public.marketplace_jobs; f public.job_financials;begin
 if new.status<>'published' or old.status='published' then return new;end if;
 select * into j from public.marketplace_jobs where id=new.job_id;
 if j.id is null or coalesce(j.pricing_snapshot->>'developer_test','false')='true' then return new;end if;
 if j.status<>'completed' or j.accepted_agency_id is null then raise exception 'EARNINGS_JOB_NOT_SETTLEABLE';end if;
 select * into f from public.job_financials where job_id=j.id;
 if f.job_id is null or f.agency_id is distinct from j.accepted_agency_id then raise exception 'EARNINGS_FINANCIALS_MISSING';end if;
 if j.agency_payout_cents is null or j.platform_fee_cents is null or f.agency_payout_cents is null or f.platform_fee_cents is null then raise exception 'EARNINGS_SPLIT_MISSING';end if;
 if j.agency_payout_cents<0 or j.platform_fee_cents<0 or f.agency_payout_cents<>j.agency_payout_cents or f.platform_fee_cents<>j.platform_fee_cents then raise exception 'INVALID_EARNINGS_SPLIT';end if;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at)
 values(j.id,j.accepted_agency_id,'agency','earning',j.agency_payout_cents,'available','Mission earnings · '||coalesce(j.title,'Security mission'),now()) on conflict do nothing;
 insert into public.marketplace_ledger_entries(job_id,agency_id,account_type,entry_type,amount_cents,status,description,available_at)
 values(j.id,null,'platform','earning',j.platform_fee_cents,'available','Platform fee · '||coalesce(j.title,'Security mission'),now()) on conflict do nothing;
 return new;
end $$;
