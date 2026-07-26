# Schema Contract Engine Acceptance Gate

1. Run migration `202607250021_schema_contract_engine.sql`.
2. Run `npm run validate:schema`; it must pass.
3. Run `npm run build`; it must pass in Bolt.
4. As Platform Admin, run `select public.get_schema_contract_report();`.
5. Confirm `clean: true` and `missing_contracts: []`.
6. Open Agency Reports; no `am.status` error may appear.
7. Confirm the completed mission report appears.
8. Open the report and refresh; the same report must return.
9. Publish the report.
10. Confirm the Client sees the published report.

The Reporting Engine remains unverified until all ten checks pass.
