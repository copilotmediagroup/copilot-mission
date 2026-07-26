# RC1.2 Live Location Acceptance Gate

1. Apply `202607260001_rc12_live_location_engine.sql`.
2. Sign in as a Guard and go online.
3. Approve browser location permission.
4. Confirm `guards.current_latitude`, `current_longitude`, and `last_location_at` update.
5. Confirm exactly one Guard-online event exists for that online transition.
6. Leave the Guard online for two minutes; GPS changes must not create Presence or Mission events.
7. Sign in as the owning Agency; confirm the Guard displays `Live GPS` and updates through Realtime.
8. Confirm an unrelated Agency cannot retrieve that Guard location.
9. Confirm Platform Admin Live Operations receives current coordinates through the existing Guard projection.
10. Go offline; GPS publishing must stop and exactly one Guard-offline event must be created.
11. Refresh while online; browser GPS should resume after the portal hydrates the Guard state.
12. Verify Marketplace, Dispatch, Mission, Reporting, and Live Operations behavior remains unchanged.
