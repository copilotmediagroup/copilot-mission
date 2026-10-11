# CO PILOT Mobile Store Submission Matrix

This is the final owner-input gate before store submission. Do not guess or auto-fill legal/provider answers.

## Client — CO PILOT SECURITY
- Bundle ID: `com.copilotsecurity.client`
- Product name: CO PILOT SECURITY
- Support URL: OWNER INPUT REQUIRED
- Privacy policy URL: OWNER INPUT REQUIRED
- Marketing URL: optional
- Legal contact email: OWNER INPUT REQUIRED
- Category/content rating: OWNER REVIEW REQUIRED
- Final icon, splash, phone screenshots: REQUIRED
- Apple/Google signing identities: PRIVATE RELEASE INPUT

## Guard — CO PILOT GUARD
- Bundle ID: `com.copilotsecurity.guard`
- Product name: CO PILOT GUARD
- Support URL: OWNER INPUT REQUIRED
- Privacy policy URL: OWNER INPUT REQUIRED
- Legal contact email: OWNER INPUT REQUIRED
- Background-location disclosure: use `PRIVACY_DISCLOSURES.md`; verify against physical-device behavior before submission.
- Camera disclosure: use `PRIVACY_DISCLOSURES.md`; verify against physical-device behavior before submission.
- Category/content rating: OWNER REVIEW REQUIRED
- Final icon, splash, phone screenshots: REQUIRED
- Apple/Google signing identities: PRIVATE RELEASE INPUT

## Provider/runtime activation
- Apply the reviewed mobile push registry/outbox migrations to the intended backend.
- Deploy `mobile-push-dispatch` and `mobile-push-worker` only after provider secrets are configured.
- Configure APNs and FCM identities/keys in secret storage; never commit private keys.
- Configure a scheduler for the worker only after a live single-notification delivery test succeeds.
- Verify queue health and bounded retry/dead-letter behavior after activation.

## Submission rule
A source audit pass is not a store-readiness pass. Store submission requires native projects, private release inputs, provider activation, signed binaries, and every required row in `DEVICE_CERTIFICATION.md` verified on physical devices.
