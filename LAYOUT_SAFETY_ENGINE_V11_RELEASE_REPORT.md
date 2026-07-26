# Layout Safety Engine v1.1 — Release Report

## Root cause
The v1.0 build added bottom padding to child workspaces, but the authoritative desktop shell (`.premium-main`) still used `overflow: hidden` with a fixed viewport height. The added space existed inside content that could not be scrolled, so controls remained obscured.

## Architectural correction
- `.premium-main` is now the single vertical scroll authority for every Agency workspace.
- Fixed header/sidebar remain stationary.
- Reports, Guards, Operations, Marketplace, and placeholders participate in normal document flow.
- A 132px desktop end-of-scroll clearance protects content from Developer Mode and Bolt preview overlays.
- Mobile keeps its bottom navigation clearance plus an additional overlay-safe zone.

## Acceptance gate
1. Open Guards and scroll until the final invitation action is fully above both fixed bottom overlays.
2. Open Reports and scroll until the final report action is fully above both fixed bottom overlays.
3. Confirm the top bar and sidebar stay fixed while only the center workspace scrolls.
4. Confirm Operations and Marketplace reach their final cards/actions.
5. Resize desktop width and repeat.
6. Test mobile preview and confirm bottom navigation does not cover the final action.
