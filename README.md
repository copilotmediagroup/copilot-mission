# Data Market House Sales OS v0.4.1

## Outreach & Follow-Up Engine

This release extends the existing Portfolio Activation and Prospecting foundations with a complete outreach workflow.

### Employee interface
- Contact Buyer workspace
- Call and email modes
- Approved email template selection
- Required activity outcomes
- Decision-maker selection
- Follow-up scheduling
- Due, overdue, and upcoming queues
- Complete and snooze controls
- Next Best Action surfaced on Today
- Agency timeline and ownership renewal

### Owner interface
- Outreach Command dashboard
- Calls and emails logged today
- Overdue follow-up visibility
- Stale relationship detection
- Team activity timeline
- Approved email template management

### Included migrations
Run in sequence when provisioning a fresh Supabase project:
1. `001_dmh_sales_os.sql`
2. `002_portfolio_activation_engine.sql`
3. `003_prospecting_agency_ownership_engine.sql`
4. `004_outreach_follow_up_engine.sql`

The connected Supabase base URL and publishable key remain included from v0.2.1.

## Run
```bash
npm install
npm run dev
```

## Build validation
```bash
npm run build
```

## v0.4.1 Prospect Identity Correction
- Added agency general email to Identify and Claim steps.
- Duplicate detection now checks agency and decision-maker email addresses.
- Added migration 005 for normalized email identity and database duplicate search.

## v0.5.1 — Controlled Portfolio Distribution Engine

- Employee must select an owned agency and verified recipient before any masked file can move.
- Repeat-recipient and high-volume warnings are generated before delivery.
- Every distribution captures employee, agency, contact, file version, method, reason, timestamp and follow-up.
- Employee distribution history and Owner Distribution Command are included.
- Portfolio files lock automatically in reserved, payment-pending and sold states.
- Production schema and RLS are in `supabase/migrations/006_controlled_portfolio_distribution_engine.sql`.
