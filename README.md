# Co Pilot Guard OS — v0.7.0 Mission Engine

The Guard OS now uses an event-driven Mission Engine as the single source of truth for mission state, checkpoint progress, evidence, incidents, timestamps, and completion.

## Added in v0.7.0

- Central mission reducer and immutable mission snapshot
- Typed mission actions and events
- Centralized state transitions
- Mission event history capped at 50 events
- Evidence and incident updates routed through the engine
- Existing Guardian system subscribed to Mission Engine state
- Existing dashboard screens and interaction design preserved

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
