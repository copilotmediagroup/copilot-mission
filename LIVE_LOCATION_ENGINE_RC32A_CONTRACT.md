# RC3.2A — Live Location Engine Contract Certification

## Authority
`src/modules/location/liveLocationRepository.ts` is the only frontend repository allowed to publish, read, or subscribe to Guard location state.

## Canonical subscription
All new consumers use:

```ts
subscribeToLiveLocations(onChange)
```

The legacy `subscribeToGuardLocations` name remains as an explicit compatibility alias so certified RC1–RC3 consumers cannot fail during staged repository updates.

## Consumer rules
- Screens never create their own Supabase location channels.
- Hooks consume the repository contract.
- Proximity Intelligence reads the same `GuardLiveLocation` model used by Operations and Marketplace.
- Realtime events trigger an authoritative refresh; they do not mutate local mission authority.
