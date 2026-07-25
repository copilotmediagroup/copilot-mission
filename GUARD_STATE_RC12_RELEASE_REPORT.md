# Guard Onboarding RC1.2 — Roster State Authority

## Engine correction
The activated Guard roster was database-backed, but the Agency sidebar, mini-card, top KPI, and marketplace capacity surfaces still read an empty live-mode array. RC1.2 removes that split authority.

## Database authority
Migration `202607250012_agency_guard_state_authority.sql` adds `get_agency_guard_state()`.
It returns the Agency's roster and authoritative totals for total, online, offline, available, reserved, and on-mission Guards.

## Frontend authority
`useAgencyGuardState()` is the single live Guard-state service. The sidebar Guards badge, Agency mini-card, Online Guards KPI, marketplace capacity, roster, and dispatch availability now derive from the same database result. A Realtime subscription refreshes the state whenever `public.guards` changes.

## Verification gate
1. Run migration 202607250012.
2. Open Agency portal with one activated offline Guard.
3. Confirm sidebar Guards = 1.
4. Confirm mini-card Total Guards = 1.
5. Confirm Online Guards = 0.
6. Confirm roster = 1 and Guard status = offline.
7. Set Guard available/online and confirm Online and Available become 1 without reload.
8. Assign Guard and confirm Reserved becomes 1.
9. Guard accepts and confirm On Mission becomes 1.
10. Guard declines and confirm Available becomes 1.

Release fails if any surface reports a different count.

## Known limitation
The local production compile could not be certified in the packaging environment because the supplied package has no usable installed React/type dependencies. Bolt must run `npm install` and `npm run build` as the final compile gate.
