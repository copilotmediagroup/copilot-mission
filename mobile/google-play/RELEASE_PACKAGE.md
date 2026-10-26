# Google Play Release Package — CO PILOT Mobile

Prepared for two independent Google Play listings.

## Apps
- CO PILOT SECURITY — Client — package `com.copilotsecurity.client`
- CO PILOT GUARD — Guard — package `com.copilotsecurity.guard`
- Initial release version: 1.0 / versionCode 1

## 2026 submission baseline
New phone/tablet apps submitted after August 31, 2026 must target Android 16 / API 36. Both native workspaces must be rebuilt against API 36 before Play upload. Google Play uses Android App Bundles (.aab) for new releases.

## Owner-only inputs still required
- Google Play developer account identity/verification
- Private Android upload/signing key material
- Public privacy-policy URL
- Public support URL(s)
- Legal/privacy contact email
- Final icon/feature graphic/screenshots
- Reviewer credentials for restricted app areas
- FCM production credentials and live notification canary

## Submission order
1. Supply private release inputs outside git.
2. Install Android API 36 on release build machine and rebuild both isolated projects.
3. Produce signed AAB for Client and Guard with Play App Signing configured.
4. Complete Data safety using the app-specific worksheets in this folder and verify against production behavior.
5. Complete App content: privacy policy, ads declaration, app access, target audience, content rating, permissions.
6. Complete account-deletion requirement before production submission because the marketplace offers account creation.
7. Upload signed AABs to Internal testing first.
8. Run DEVICE_CERTIFICATION.md on physical devices and FCM canary.
9. Promote only the certified build to production.

Do not mark an owner/provider/device item complete from source inspection alone.
