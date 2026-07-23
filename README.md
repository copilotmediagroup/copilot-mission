# Co Pilot Guard OS v0.7.2 — Timeline Engine

This build adds the permanent mission-history layer above the v0.7.1 Event Bus while preserving the approved mobile Guard workflow.

## Added

- Timeline Engine automatically subscribes to all Mission and Guardian events
- Immutable reverse-chronological mission history capped at 250 entries
- Monotonic sequence numbers for audit ordering
- Source classification: Mission, Guardian, Evidence, Incident, and System
- Severity classification: Info, Warning, and Critical
- Expandable event metadata for reporting, audit, and future playback
- Desktop Mission Timeline panel with live event count and source filters
- Guardian emergency events appear immediately and receive warning/critical treatment
- Existing mobile Guard dashboard, mission transitions, and Guardian controls remain unchanged

## Architecture

Mission Engine controls state → Event Bus distributes information → Timeline Engine records history → Guardian Engine protects the guard

## Run

```bash
npm install
npm run dev
```

Use `/developer` to open the existing visual state lab.
