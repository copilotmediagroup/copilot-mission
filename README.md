# Co Pilot Security Marketplace v1.1.0.2

## Marketplace Architecture & Report Overflow Fix

This release preserves the v1.1.0 Live Marketplace Engine while correcting two marketplace architecture issues.

### Changes
- Replaced the agency sidebar **Clients / Your Clients** entry with **Assignments / Won Marketplace Jobs**.
- Reinforces that clients belong to the platform marketplace rather than an individual agency.
- Agencies receive assignment-scoped access after winning marketplace work.
- Mission reports now render through a document-body portal, preventing phone-shell or transformed-parent constraints.
- Desktop report width is constrained to the actual viewport and no longer extends beneath the Mission Timeline panel.
- Added minimum-width and overflow safeguards throughout report grids.
- Printing and PDF-save behavior remain intact.

Supabase is not connected in this prototype. Marketplace events and data remain simulated client-side.


## Runtime Recovery
- Restored the missing `Building2` Lucide icon import used by the Assignments navigation and opportunity metadata.
- Resolves the blank-screen React crash in `AgencyMarketplace.tsx`.
