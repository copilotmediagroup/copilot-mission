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
Guard background tracking now has an additive native adapter that forwards native location updates into the existing `publishGuardLocation` contract. The existing web GPS engine remains unchanged. Physical-device permission/disclosure, battery behavior and store-policy verification are still required before release.

## Next native steps
1. Create current iOS/Android projects on a supported build machine.
2. Add app icons/splash assets and separate Client/Guard bundle identifiers or native targets.
3. Native push tokens now have authenticated persistence plus APNs/FCM delivery source. Provider credentials, Edge Function deployment and physical-device delivery still require release-environment verification.
4. Native camera output is wired into the existing mission-evidence upload contract with optional native GPS metadata.
5. Verify the additive Guard background-location adapter on physical devices while keeping existing mission state transitions untouched.
6. Test the full client-to-agency-to-guard lifecycle on physical devices before store submission.

## Release preflight
Run `npm run mobile:preflight` before native release work. It intentionally fails while native platform projects/toolchains are absent, so source readiness cannot be mistaken for App Store/Play Store readiness.
