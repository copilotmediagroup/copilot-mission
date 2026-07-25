# Platform Admin Command Center Engine Contract

## Responsibility
Provide one live, read-only operational snapshot of every existing engine and expose Agency Engine controls without duplicating mission, guard, property, or marketplace business rules.

## Database authority
`get_platform_command_center()` is the only Platform Command Center read model. It composes authoritative records from agencies, properties, guards, marketplace jobs, assignments, Mission Engine state, and mission events.

## Realtime inputs
Agencies, properties, guards, marketplace jobs, assignments, mission engine state, and mission events.

## Release gate
1. Client creates a property; Property count and Properties view update without refresh.
2. Client creates a mission; Marketplace and mission table update.
3. Agency claims it; mission Agency column and state update.
4. Guard goes online; Online Guard metric and Guard card update.
5. Agency assigns Guard; mission Guard column and Guard state update.
6. Guard accepts and progresses; Mission Engine state updates at each transition.
7. Mission completes; Completed metric updates and Guard returns Available.
8. Agency approval actions continue to function.
9. Non-platform roles cannot execute `get_platform_command_center()`.
10. Refresh reproduces the same snapshot from Supabase.

## Known limitation
Live route visualization requires the future Live Location Engine. This release exposes coordinates and freshness but does not invent GPS tracking.
