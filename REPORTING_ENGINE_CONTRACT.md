# Reporting Engine v1.0 — Contract

## Responsibility
Consume only completed Mission Engine records and create an immutable report snapshot for Agency review, Client publication, Platform visibility, and archive.

## Authority
`mission_reports` is the reporting lifecycle authority. Mission facts are copied into `snapshot` once and are not rewritten by the UI.

## States
`pending_review → clarification_requested → published → archived`

## Invariants
- Reports can only be created from `mission_engine_state.state = completed`.
- One report exists per mission.
- Agency may add review/clarification notes but cannot rewrite checkpoint, evidence, guard, property, timeline, or mission facts.
- Clients can read only reports belonging to them and only after publication.
- Platform Admin observes report state but does not override Mission Engine facts.
