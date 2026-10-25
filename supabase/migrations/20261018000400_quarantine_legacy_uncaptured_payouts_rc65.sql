-- RC65: legacy completed estimates must never remain payable without a captured Client payment.
update public.marketplace_jobs
set payout_status='not_ready', payout_hold_reason='legacy_uncaptured_payment_no_payout', updated_at=now()
where coalesce(pricing_snapshot->>'developer_test','false')<>'true'
  and payout_status='ready_for_payout'
  and payment_status<>'captured';

update public.job_financials f
set payout_status='not_ready', hold_reason='legacy_uncaptured_payment_no_payout', updated_at=now()
where payout_status='ready_for_payout' and payment_status<>'captured';
