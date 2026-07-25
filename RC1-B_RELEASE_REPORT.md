# Co Pilot Security Marketplace OS RC1-B

## Agency Approval Engine

RC1-B completes the Platform Admin agency lifecycle. Mission Control now includes a dedicated Agency Control workspace with pending, approved, suspended and denied queues.

### Database changes
- Added approval, denial and suspension metadata to `agencies`.
- Added immutable `agency_audit_events` history.
- Added Platform Admin-only read RPC for Agency Control.
- Added atomic RPCs for approve, deny, suspend and reactivate.
- Approval repairs the owner profile and owner membership in the same transaction.
- All administrative RPCs verify `platform_admin` from Supabase data.

### Frontend changes
- Added Agencies navigation to Mission Control.
- Added agency queue tabs, operational cards and detail view.
- Added approve, deny with reason, suspend with reason and reactivate actions.
- Added precise status messaging and audit history.
- Updated build badge to `RC1-B · APPROVAL ENGINE`.

### Install order
1. Replace the GitHub repository with this package.
2. Run `supabase/migrations/202607250008_rc1b_agency_approval_engine.sql` in Supabase.
3. Restart the app.

### Verification gate
1. Create or locate a pending Agency.
2. Confirm it appears in Mission Control → Agencies → Pending.
3. Approve once.
4. Confirm it moves to Approved and its owner can access Marketplace.
5. Suspend it with a reason and confirm Marketplace access is blocked.
6. Reactivate it and confirm access returns.
7. Confirm every action appears in the Agency audit history.
