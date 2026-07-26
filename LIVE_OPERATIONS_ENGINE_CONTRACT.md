# Live Operations Engine Contract

## Responsibility
Observe existing platform engines in real time. It never performs mission, reporting, guard-presence, or marketplace business transitions.

## Database authority
`get_live_operations_center()` is the single Platform Admin read model.

## Inputs
Marketplace jobs, assignments, Mission Engine state/events, Guard Presence, Reports.

## Outputs
Authoritative counters, mission pipeline, event feed, map-ready guard coordinates, and engine-health status.
