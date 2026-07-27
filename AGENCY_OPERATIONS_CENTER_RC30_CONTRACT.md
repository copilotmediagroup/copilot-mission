# RC3.0 Agency Operations Center — Engine Contract

## Authority
`get_agency_operations_center_rc30()` is the single read contract for the Agency Operations Center.

It projects, in one transactionally consistent response:

- Agency identity
- Guard roster, presence, GPS freshness, and active mission
- Agency-owned missions and Mission Engine state
- Checkpoint, evidence, and incident counts
- Operational KPIs
- Mission event feed

The UI does not independently reconstruct mission state from separate repositories.

## Write authority
Dispatch remains owned by the certified Dispatch/Mission Engine contract:

- `assign_guard_rc2()` validates Agency ownership and Guard availability.
- Mission state transitions remain owned by `mission_engine_state` and its transition RPCs.
- The Operations Center never writes directly to mission tables.

## Realtime contract
The projection reloads when authoritative tables change:

- `mission_engine_state`
- `job_assignments`
- `marketplace_jobs`
- `guards`
- `mission_events`

## Failure behavior
The Operations Center exposes authority failures as an explicit unavailable state. It does not replace live failures with simulated data in Live Test mode.
