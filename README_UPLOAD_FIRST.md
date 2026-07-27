# Co Pilot Security Marketplace v3.2.1 — Marketplace Proximity Authority

Upload these files over the current repository and replace only matching files.
Do not delete the repository.

Changed files:
- src/AgencyMarketplace.tsx
- src/styles.css
- src/modules/dispatch/useMarketplaceProximity.ts (new)
- package.json

No SQL migration is required for this build.

## Visible acceptance checks
1. Every open-job card shows NEAREST ONLINE GUARD without opening the card.
2. Every routable job card shows the guard name, live-traffic ETA, and road distance.
3. Jobs are ranked by fastest guard response time.
4. The fastest-ranked job is selected automatically when Marketplace opens.
5. The map immediately shows a blue road route from the fastest online guard to the selected job.
6. A FASTEST ONLINE RESPONSE banner overlays the map with guard, ETA, and road distance.
7. The right rail is DISPATCH INTELLIGENCE, not Agency Capacity.
8. Clicking another job changes the route and dispatch recommendation.
9. Missing coordinates or live GPS show a clear unavailable state; no invented ETA is displayed.
