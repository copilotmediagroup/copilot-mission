# v3.6 — Guard Operational State Engine

This release removes competing guard-status interpretations from Marketplace and Operations.

## Authority

`get_agency_guard_state()` now returns the canonical operational state, GPS freshness, route eligibility, and exact ineligibility reason for every guard.

Canonical states:

- `offline`
- `online_unavailable`
- `available`
- `reserved`
- `on_mission`
- `gps_stale`

## Observer surfaces

- Agency header counters
- Marketplace available-guard pool
- Marketplace proximity/routing
- Operations KPI counters
- Operations guard rail
- Operations dispatch selector
- Operations map guard locations

A guard is route-eligible only when the guard is available, has coordinates, and has GPS no older than ten minutes. Stale GPS within ten minutes remains usable and is visibly labeled stale; expired GPS is excluded with an exact reason.
