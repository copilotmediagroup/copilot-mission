# Co Pilot Mobile Release Checklist

## Shared release gate
- [x] Client and Guard have separate bundle identifiers and product names.
- [x] Native bundles package local Vite assets; no production Netlify server URL.
- [x] Native role isolation prevents Client/Guard cross-portal access.
- [x] Existing Supabase mission lifecycle remains authoritative.
- [ ] Create current iOS and Android projects on supported build machines.
- [ ] Add production app icons, splash assets, privacy text and store metadata.
- [ ] Physical-device end-to-end lifecycle certification.

## Client app — CO PILOT SECURITY
- [x] Client-only native target.
- [x] Shared production Supabase backend.
- [ ] Physical-device authentication/session test.
- [x] Authenticated native push token persistence registry/RPC.
- [x] Native notification tap/action capture with mission routing payload.
- [x] APNs/FCM server delivery source implementation (provider credentials/deploy still required for live delivery).
- [ ] Request-security/payment/live-tracking device test.

## Guard app — CO PILOT GUARD
- [x] Guard-only native target.
- [x] Native mission camera uses existing secured evidence upload contract.
- [x] Native photo can include foreground GPS metadata.
- [x] Native push registration token capture.
- [x] Authenticated server-side push token persistence registry/RPC.
- [x] Native notification tap/action capture with mission routing payload.
- [x] APNs/FCM server delivery source implementation (provider credentials/deploy still required for live delivery).
- [x] Native background location source implementation.
- [x] Guard Android background bridge + native HTTP transport configured.
- [ ] Background-location permission/disclosure review and physical-device verification.
- [ ] Physical-device dispatch, GPS, evidence, messaging and completion test.

## Release rule
Do not mark either app store-ready until all unchecked device/server items above are completed and verified. Do not change the protected mission lifecycle merely to accommodate the native shell.
