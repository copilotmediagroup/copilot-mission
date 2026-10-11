# Physical Device Canary

Run only after provider credentials, reviewed migrations, push functions, and a signed target build are ready.

1. Register exactly one test device for the intended Client or Guard account.
2. Confirm its token belongs to the correct app target and authenticated user.
3. Send one target-specific notification; never use role broadcast for the canary.
4. Confirm one device receives it once and notification tap routes to the expected app destination.
5. For Guard, confirm active-mission foreground/background location behavior separately; push success does not certify GPS.
6. Run `npm run mobile:push:health` and require healthy queue output before enabling recurring worker scheduling.
7. Record result in DEVICE_CERTIFICATION.md against the exact signed commit/build.

Failure rule: do not enable scheduler; fix provider/configuration issue and repeat a single-device canary.
