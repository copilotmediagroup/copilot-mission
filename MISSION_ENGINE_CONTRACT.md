# Co Pilot Security Marketplace OS — Mission Engine Contract

## Release classification

**Implementation candidate. Not verified until the acceptance gate is completed in the connected Supabase/Bolt environment.**

## Owner

Mission Engine

## Responsibility

Own the operational mission lifecycle after an Agency claims a mission: Guard offer, response, route, arrival, checkpoint execution, evidence, incidents, review, completion, recovery, timeline, and Guard release.

## Database authority

`public.mission_engine_state`

All Guard mission actions pass through:

`public.transition_guard_mission(...)`

All Guard screens hydrate from:

`public.get_guard_mission_snapshot(...)`

Legacy RC2/RC2.2/RC2.3 RPCs delegate to the Mission Engine so older UI callers cannot create a second authority.

## State machine

`awaiting_guard → offered → accepted → en_route → active → checkpoint → review → completed`

Decline is legal only from `offered` and returns to `awaiting_guard` while preserving Agency ownership.

## Engine guarantees

- A Guard can act only on their own assignment.
- Optimistic version checks reject stale transitions.
- Route, checkpoint, review, and completion progress survive refresh, logout, browser changes, and deployments.
- Evidence and incidents can be saved during active patrol, checkpoint progress, and review.
- Checkpoints must be completed in order and exactly once.
- Required proof is enforced by the database.
- Draft incidents block checkpoint or mission completion where applicable.
- Completion atomically completes the assignment and mission and returns the Guard to `available`.
- Timeline events are written by the same transition that changes state.

## Known limitations

- The package cannot be marked verified until the full acceptance test is performed in Bolt against the connected Supabase project.
- Actual media files still depend on the existing Storage implementation; this engine owns the evidence record and progression state.
- Client report publication/review is outside this acceptance gate unless already implemented by the existing report surface.
