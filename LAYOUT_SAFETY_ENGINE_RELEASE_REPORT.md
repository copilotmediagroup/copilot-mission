# Layout Safety Engine v1.0 — Acceptance Build

## Responsibility
Prevent fixed developer/session controls, mobile navigation, browser safe areas, and bottom action surfaces from covering application content.

## Root cause
The authenticated portals used fixed bottom controls while several workspaces ended at the viewport edge. Reports, Guard invitations, and other long workspaces could therefore render their final rows and actions underneath the fixed controls.

## Architecture change
A shared `--portal-safe-bottom` layout contract now applies to every authenticated workspace. The Agency shell and high-risk workspaces reserve bottom clearance and expose a terminal spacer so the last record and action can always scroll fully above fixed controls.

## Covered surfaces
- Agency Marketplace
- Operations
- Guards and invitations
- Reports and report detail
- Platform Command Center
- Client workspaces
- Mobile authenticated layouts

## Acceptance gate
1. Open Agency Reports and scroll to the final report action.
2. Confirm no report content or action is covered by Developer Mode, Sign Out, or preview controls.
3. Open Guards and scroll to the final invitation.
4. Confirm status and Revoke controls remain fully visible and clickable.
5. Repeat on Operations, Marketplace, Platform Admin, and Client portals.
6. Resize to desktop, tablet, and mobile widths.
7. Confirm the last interactive element on every page can scroll above all fixed UI.
8. Confirm no horizontal overflow is introduced.

## Release status
Implementation candidate. Verification requires the acceptance gate in Bolt preview.
