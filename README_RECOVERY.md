# Co Pilot Mission Recovery — Live Location Contract Reconciliation

This package repairs the mixed repository contract currently preventing Vite from starting.

It restores the two compatibility exports expected by existing consumers:

- `writeGuardLocation`
- `subscribeToLiveLocations`

Both delegate to the already-existing canonical implementations:

- `publishGuardLocation`
- `subscribeToLocationChanges`

No Supabase migration is required.

Upload this package over the current repository without deleting other files.
