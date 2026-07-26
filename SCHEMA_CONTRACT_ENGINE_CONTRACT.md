# Schema Contract Engine v1.0

## Responsibility
Prevent releases from referencing database columns that do not exist in the canonical schema.

## Canonical contract repaired
`public.agency_members` represents membership activity with `is_active boolean`. It does not use a `status` column.

## Release authorities
- Build-time: `npm run validate:schema`
- Runtime: `public.get_schema_contract_report()`
- Reporting membership: approved Agency + active `agency_members.is_active = true`

## Release rule
A release fails when a known invalid contract such as `agency_members.status` is found. UI code may not hide database contract failures.
