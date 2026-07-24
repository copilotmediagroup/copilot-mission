# Co Pilot Security Marketplace v1.3.2

## Address Accuracy + Map Confirmation

This release improves verified property search without changing the database schema.

### Included
- U.S.-only address results
- Browser-location bias with Riverview, Florida fallback
- Street-address-first ranking
- Florida and Riverview relevance boost
- Map preview with exact marker before save
- Existing structured address and coordinate storage preserved

## Installation
Upload the package to GitHub and synchronize Bolt. No new Supabase migration is required for this release.

## Test
Type `8624 Holly Grove` or the complete address. Select the Riverview, Florida result and visually confirm the marker before saving.
