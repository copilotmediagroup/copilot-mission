# Google Play Permission Declaration Notes

## CO PILOT GUARD
ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION: mission position, route/arrival and evidence context.
ACCESS_BACKGROUND_LOCATION: continuing active-mission progress and operational-safety status when app is backgrounded. This is core Guard mission functionality and must match the in-app prominent disclosure and physical-device behavior.
CAMERA: guard-initiated mission evidence capture.
POST_NOTIFICATIONS: assignments, messages, mission alerts, reminders and persistent active-mission location notice where Android requires it.
FOREGROUND_SERVICE / FOREGROUND_SERVICE_LOCATION: supports active-mission location operation.

## CO PILOT SECURITY Client
Client native configuration now removes camera and location permissions. The Client manifest retains INTERNET and notification access; re-audit merged release manifest before signing.
