# Co Pilot Guard OS — v0.7.3

## Design System Foundation

This release preserves the verified v0.7.2.2 global shell and introduces a reusable visual system for the Guard experience.

### Included
- Shared spacing, radius, elevation, border, color, typography, motion, and focus tokens
- Unified primary and secondary button behavior, including loading and disabled states
- Unified status chips and card treatment
- Purposeful mission-state, timeline, drawer, and completion motion
- Improved timeline hierarchy, event accents, scrolling, and hover behavior
- Keyboard focus visibility and 44px minimum interaction targets
- Reduced-motion support
- Reusable skeleton and empty-state primitives for future screens
- Responsive spacing audit without changing the verified shell architecture

### Release discipline
No mission logic or workflow behavior was changed. This is a quality and consistency release built on the stable v0.7.2.2 layout foundation.

### Run
```bash
npm install
npm run dev
```

### Production validation
```bash
npm run build
```
