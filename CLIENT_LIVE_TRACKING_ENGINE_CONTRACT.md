# Client Live Tracking Engine v1.0 — Contract

## Responsibility
Present one client-authorized mission experience from request through published report.

## Authorities consumed
- Marketplace Engine: request and agency claim
- Dispatch Engine: assignment and Guard response
- Mission Engine: lifecycle and checkpoints
- Live Location Engine: coordinates and freshness
- Reporting Engine: published-report availability

## Authority boundary
This engine is read-only. It cannot assign a Guard, advance a mission, publish GPS, complete a checkpoint, or publish a report.

## Read authority
`get_client_live_tracking_experience()` returns only the authenticated Client's latest relevant mission.

## Presentation states
Finding coverage → Agency preparing → Guard assigned → Guard confirmed → En route → Patrol active → Review → Complete → Report available.

## Privacy
The Client receives only the assigned Guard for their own mission. Other Guards, agencies, Clients, and marketplace jobs are excluded.
