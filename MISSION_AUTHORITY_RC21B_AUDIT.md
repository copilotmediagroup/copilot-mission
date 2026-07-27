# RC2.1B Mission Authority Audit

## Finding

The screenshots did not prove three live engines disagreed. The Client screenshot was running **Developer Preview**, which intentionally renders simulated data, while the Guard and Agency screens were being judged as live operational views. Developer Mode defaulted to Preview, making simulated and live results easy to compare as though they came from the same database.

A separate real defect was confirmed: Guard dashboard metrics were hard-coded (`Jobs Today = 0`, fixed duty time) and did not consume mission authority.

A second real defect was confirmed: the Guard arrival screen still rendered a stock property image instead of the assigned property's authoritative `photo_url`.

## Authority correction

- Developer Mode now defaults to **Live Test** and persists the selected authority mode.
- Preview is explicitly labeled **SIMULATED DATA**.
- Guard daily metrics now come from one database RPC using:
  - `mission_engine_state` for completed jobs;
  - `patrol_checkpoint_completions` for check-ins;
  - `guard_presence_events` for duty duration.
- The browser supplies the Guard's IANA timezone so “today” follows the Guard's local calendar day.
- Guard metric subscriptions refresh from the same authoritative tables.
- Arrival presentation consumes `assignment.property.photo_url`; no unrelated stock image is used.

## Invariant

A Preview role is a design simulation and must never be treated as evidence of live cross-role consistency. Live certification requires authenticated Client, Agency, and Guard accounts in Live Test mode.
