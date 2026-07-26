# Co Pilot Security Marketplace OS — RC3.0

## Agency Operations Center

RC3.0 replaces the former Agency operations placeholder with a database-authoritative command surface.

### Included

- Single Operations Center projection RPC
- Unified live Agency map
- Online Guard status and GPS freshness
- Dispatch Queue
- Missions in Motion
- Emergency Queue
- Completed mission projection
- Mission inspector and database-enforced Guard assignment
- Checkpoint, evidence, and incident visibility
- Realtime operational feed
- Responsive desktop and mobile layouts

### Installation

Upload this package over the certified RC2.1C repository. Do not delete the repository first.

Run:

`supabase/migrations/202607260006_rc30_agency_operations_center.sql`

Then deploy and complete the RC3.0 acceptance gate.
