# Co Pilot Mobile Architecture

## Product shells
- CO PILOT SECURITY — Client mobile experience.
- CO PILOT GUARD — Guard field experience.
- Agency and Owner remain web/desktop products.

## Safety boundary
The existing Supabase mission lifecycle, dispatch, evidence and marketplace engines remain authoritative. Native code is an adapter for device capabilities, not a second mission engine.

## Native capability layer
`src/mobile/nativePlatform.ts` exposes guarded adapters for foreground location, camera capture and push registration. Browser behavior remains unchanged because native APIs execute only when Capacitor reports a native platform.

## Build policy
Production native releases package the local `dist` bundle. Do not point the production Capacitor `server.url` at Netlify and do not ship an OTA mechanism that changes app features outside store review. Server APIs/data can remain remote.

## Guard background location
Foreground location is scaffolded only. True Guard background tracking requires a purpose-built native implementation, explicit permission/disclosure, battery-aware behavior, and store-policy review before release. Do not replace the existing web GPS engine until device testing proves parity.

## Next native steps
1. Create current iOS/Android projects on a supported build machine.
2. Add app icons/splash assets and separate Client/Guard bundle identifiers or native targets.
3. Wire native push tokens to a server-side token table/RPC.
4. Wire native camera output into the existing mission-evidence upload contract.
5. Add Guard background-location adapter while keeping existing mission state transitions untouched.
6. Test the full client-to-agency-to-guard lifecycle on physical devices before store submission.
