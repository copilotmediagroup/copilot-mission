# RC2.1A Engine Contract Certification

Apply this changeset over the current RC2.1 repository. Do not delete the repository.

No Supabase migration is required.

Certified contract corrections:

- Mission time authority: Guard patrol, review, and completed views derive from the same Mission Engine timestamp.
- Property asset authority: Guard assignment and arrival views consume the client property photo; a neutral property state appears when no photo exists.
- Patrol transition authority: checkpoint progression is immediate and optimistic, with authoritative rollback on save failure.
- Marketplace filter authority: All, Open Jobs, Priority, Emergency, and My Guards have distinct datasets and empty states.
- Unified map authority: the Agency marketplace now consumes the Google Maps loader rather than the decorative map renderer.
