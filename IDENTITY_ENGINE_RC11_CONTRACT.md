# Identity Engine RC1.1 — Role Integrity Contract

## Responsibility
Maintain one authoritative role per authenticated user and prevent incompatible role workspaces.

## Authority
`public.profiles.role` is the identity authority. `clients`, `agency_members`, and `guards` are role-specific projections and may never contradict it.

## Invariants
- Platform Admin, Agency Admin, and Guard identities cannot exist in `clients`.
- Every Client identity has exactly one `clients` row.
- Agency membership role equals profile role.
- Every Guard roster entry has a Guard profile and active membership in the same Agency.
- Role transitions cannot silently delete properties, missions, or other operational records.
