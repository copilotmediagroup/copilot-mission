# CO PILOT Mobile Physical-Device Certification

Use this only on release-candidate native builds connected to the production-equivalent backend. Record device/OS/build and pass/fail evidence for every row. Do not alter mission status manually to make a test pass.

## Release candidate
- Git commit:
- Client build/version:
- Guard build/version:
- Backend project/environment:
- Client device / OS:
- Guard device / OS:
- Tester / date:

## Client — CO PILOT SECURITY
- [ ] Install/launch shows Client branding and never Guard/Agency/Owner UI.
- [ ] Sign in, terminate app, relaunch: authenticated session restores correctly.
- [ ] Wrong-role account is blocked without exposing another portal.
- [ ] Add/select property and request security using the existing request flow.
- [ ] Card-on-file/payment form loads and payment/authorization behavior matches web production behavior.
- [ ] Assigned guard and agency appear when the existing backend assigns them.
- [ ] Live tracking updates without manual refresh during the active mission.
- [ ] Native notification arrives; tapping it opens Client Activity for mission context.
- [ ] Proof/evidence visible to Client when existing mission rules permit it.
- [ ] Completed mission appears in Activity/Reports as expected.

## Guard — CO PILOT GUARD
- [ ] Install/launch shows Guard branding and never Client/Agency/Owner UI.
- [ ] Sign in, terminate app, relaunch: authenticated session restores correctly.
- [ ] Wrong-role account is blocked without exposing another portal.
- [ ] Assignment notification arrives; tapping it refreshes the real assigned mission.
- [ ] Foreground GPS publishes guard location during an active mission.
- [ ] Background the app for 10+ minutes: persistent tracking notice remains and location continues updating.
- [ ] Deny notification/location permission: app fails safely and clearly instead of pretending tracking is active.
- [ ] Return to foreground: mission remains current; no duplicate/rapid GPS publisher is created.
- [ ] Camera capture uploads mission evidence; photo renders correctly after upload.
- [ ] Evidence GPS metadata is present when location permission is granted.
- [ ] Agency↔Guard messaging works during the assignment.
- [ ] Existing checkpoint/arrival/completion flow works end-to-end without manual database edits.
- [ ] After mission completion, background location stops and does not continue general tracking.

## Cross-device/realtime
- [ ] Client sees Guard movement while Guard app is foregrounded.
- [ ] Client continues seeing Guard movement while Guard app is backgrounded.
- [ ] Agency web sees the same Guard/mission state without reload where realtime is expected.
- [ ] Mission completion propagates to Client, Guard and Agency surfaces.
- [ ] No duplicate mission, evidence, notification, or location publisher is observed.

## Release decision
- [ ] All required tests passed.
- [ ] Failures have reproducible issue IDs and are resolved/retested.
- [ ] Store privacy/permission disclosures match observed runtime behavior.
- [ ] Release candidate commit/build IDs above match the binaries being submitted.
