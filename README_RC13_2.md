# RC1.3.2 Client Portal Scroll Authority Fix

Upload this changeset over the current RC1.3/RC1.3.1 repository.

No database migration is required.

This correction moves desktop scrolling from the browser/body to `.client-main`, gives the client portal a real viewport-height shell, and adds an in-flow clearance block above the fixed Developer Mode dock.

Acceptance:
1. Reload Bolt preview.
2. Open Client Portal > Active Requests.
3. Scroll inside the client content area.
4. Confirm the timeline and final content can move completely above the Developer Mode controls.
5. Confirm the page has no horizontal scrollbar.
