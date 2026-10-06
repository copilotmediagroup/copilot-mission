-- Co Pilot Security Marketplace OS — Maverick / Easy Pay Direct processor fields
-- Keeps payment processing processor-neutral while supporting NMI/Maverick transaction IDs.
begin;

alter table public.marketplace_jobs
  add column if not exists payment_processor text not null default 'maverick_easy_pay_direct',
  add column if not exists processor_transaction_id text,
  add column if not exists processor_auth_code text,
  add column if not exists processor_response jsonb not null default '{}'::jsonb;

alter table public.job_financials
  add column if not exists payment_processor text not null default 'maverick_easy_pay_direct',
  add column if not exists processor_transaction_id text,
  add column if not exists processor_auth_code text,
  add column if not exists processor_response jsonb not null default '{}'::jsonb;

alter table public.agencies
  add column if not exists payout_method text not null default 'manual',
  add column if not exists payout_note text;

update public.marketplace_jobs set payment_processor='maverick_easy_pay_direct' where payment_processor is null;
update public.job_financials set payment_processor='maverick_easy_pay_direct' where payment_processor is null;

create index if not exists marketplace_jobs_processor_payment_idx
on public.marketplace_jobs(payment_processor,payment_status,payout_status,created_at desc);

create index if not exists job_financials_processor_idx
on public.job_financials(payment_processor,payment_status,payout_status,created_at desc);

commit;
