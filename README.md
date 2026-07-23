# Co Pilot Guard OS v0.7.1 — Event Bus

This build adds the event-driven communication foundation beneath the existing Guard OS interface.

## Added

- Typed central Event Bus
- Mission and Guardian event channels
- Wildcard subscriptions for future Timeline, Notification, Realtime, and Reporting engines
- In-memory event history capped at 100 system events
- Mission Engine automatically publishes every newly generated mission event
- Guardian actions publish typed safety events
- Guardian subscribes to mission completion/reset events for automatic cleanup
- Reusable `useEventBus` hook

## Architecture

Guard Action → Mission Engine → Event Bus → Guardian / Timeline / Notifications / Realtime / Reports

The visual mission experience and navigation remain unchanged.
