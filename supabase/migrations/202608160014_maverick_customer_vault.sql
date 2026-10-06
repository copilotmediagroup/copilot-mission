-- Co Pilot Security Marketplace OS — Maverick card-on-file vault
-- Store only NMI/Maverick customer vault references, never raw card data.
begin;

alter table public.clients
  add column if not exists maverick_customer_vault_id text,
  add column if not exists maverick_payment_last4 text,
  add column if not exists maverick_payment_brand text,
  add column if not exists maverick_payment_saved_at timestamptz,
  add column if not exists payment_processor text not null default 'maverick_easy_pay_direct';

create index if not exists clients_maverick_vault_idx
on public.clients(maverick_customer_vault_id)
where maverick_customer_vault_id is not null;

commit;
