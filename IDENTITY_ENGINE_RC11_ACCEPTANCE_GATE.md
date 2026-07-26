# Identity Engine RC1.1 — Acceptance Gate

Run migration `202607250019_identity_role_integrity.sql`, then verify:

1. Platform Admin profile remains `platform_admin`.
2. Platform Admin no longer appears in `public.clients`.
3. Command Center Clients count changes from 2 to 1.
4. The real Client can still log in and access their property and missions.
5. Agency Admin remains attached to the Agency and does not appear in Clients.
6. Guard remains attached to the Agency and does not appear in Clients.
7. Execute `select public.get_identity_integrity_report();` while authenticated as Platform Admin.
8. `clean` is `true`.
9. `invalid_client_workspaces` is `0`.
10. Attempting to insert a Platform Admin into `clients` fails with `IDENTITY_ROLE_MISMATCH`.

The engine is not verified until all ten checks pass.
