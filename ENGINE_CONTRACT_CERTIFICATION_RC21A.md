# RC2.1A Engine Contract

## Mission Time Authority
`mission_started_at` is the only patrol clock origin. All Guard mission duration surfaces derive from it. Completed duration freezes against `completed_at`.

## Property Asset Authority
`assignment.property.photo_url` is the only mission property-image source. When absent, the interface renders a neutral property state rather than unrelated stock media.

## Patrol Transition Authority
Checkpoint interaction advances immediately in the local Mission Engine. Supabase remains authoritative. A rejected mutation restores the exact previous mission snapshot and presents an error.

## Marketplace Filter Authority
- All: all authorized open jobs plus online agency Guards.
- Open Jobs: authorized standard jobs only.
- Priority: authorized priority jobs only.
- Emergency: authorized emergency jobs only.
- My Guards: online agency Guards only.

## Unified Map Authority
Agency, Guard, and Client mapping consume the same Google Maps loader and styling foundation. Role visibility is configured by authorized overlays rather than decorative role-specific maps.
