# Client — Data Safety Worksheet

This is a source-derived worksheet, not a final legal declaration. Verify production SDK/provider behavior before entering Play Console answers.

Potentially collected/processed data:
- Account identity: name, email, authentication identifiers
- Property/service information and security requests
- Mission/activity information
- Payment-related transaction/customer references handled with the configured payment provider; do not claim raw card data is stored by Co Pilot unless production audit proves it
- Device push-notification token
- Location-related mission information displayed as part of requested service
- Messages and mission evidence/reports where used

Purposes may include app functionality, account management, fraud/security, service fulfillment, communications, and payment/service administration.

Questions requiring production verification:
- Exact third-party sharing versus service-provider processing
- Retention periods
- Encryption-in-transit declaration
- User deletion mechanism and retained records required for legal/financial/security purposes
- Whether Client actually invokes camera or device location in the production build; remove unused permissions where possible
