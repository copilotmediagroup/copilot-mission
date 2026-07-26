# RC1.3 Client Live Tracking Engine — Contract

## Responsibility
Present one authenticated client's newest mission from request through report publication. This engine creates no mission, dispatch, presence, GPS, or reporting truth.

## Authoritative dependencies
- Marketplace job and property
- Latest assignment
- Mission Engine state
- RC1.2 Guard location state
- Mission timeline events
- Reporting Engine publication state

## Privacy contract
The database resolves the client from `auth.uid()`. The frontend never supplies a client ID or job ID to the tracking RPC. Only jobs owned by that client may be returned.

## Presentation states
Finding coverage → Agency accepted → Guard assigned → En route → On site → Patrol active → Mission review → Mission complete → Report published.

## Realtime contract
Realtime events trigger a fresh authorized RPC read. Realtime payloads are never treated as authoritative state.
