# Native Workspace Layout

Target durable layout:
- `native/client/android` — CO PILOT SECURITY / `com.copilotsecurity.client`
- `native/client/ios` — CO PILOT SECURITY / `com.copilotsecurity.client`
- `native/guard/android` — CO PILOT GUARD / `com.copilotsecurity.guard`
- `native/guard/ios` — CO PILOT GUARD / `com.copilotsecurity.guard`

## Safety rule
Do not create a second target into a root `android/` or `ios/` directory that already represents another app. Existing preparation remains overwrite-safe, but durable isolated generation must be proven before either app is treated as store-ready.

## Certification rule
Each target/platform gets its own signing, permissions, store assets and physical-device evidence. Sharing Supabase does not make the native binaries interchangeable.
