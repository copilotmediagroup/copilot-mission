# Co Pilot Guard OS v0.7.2.2 — Global Shell & Viewport Repair

This quality build repairs the shared application shell without adding new product features.

## Corrected

- Desktop mission pages now begin below the fixed global and page headers
- Header, sidebar, workspace, and timeline use exact coordinated offsets
- Review & Submit is balanced into an intentional two-column desktop composition
- Completed mission content is visually centered in the usable mission workspace
- Mobile fills the complete device viewport with no inherited top or left gap
- Mobile phone-frame padding, radius, shadow, and desktop offsets are removed
- Bottom navigation, page body, and timeline trigger share the same mobile width
- Timeline rail behavior from v0.7.2.1 is preserved
- No new features or workflow changes

## Architecture

Mission Engine controls state → Event Bus distributes information → Timeline Engine records history → Guardian Engine protects the guard

## Run

```bash
npm install
npm run dev
```

Use `/developer` to open the existing visual state lab.
