# Account Deletion — Google Play Gate

The marketplace offers in-app account creation for Client and Agency accounts. Google Play therefore requires a clear account-deletion path and an external web resource where users can request deletion.

Source implementation now includes authenticated Client and Guard account-deletion requests backed by an RLS-protected Supabase request table/RPC. The remaining Play gate is the public account-deletion web URL plus operational processing/retention policy and physical verification.

Required implementation before production submission:
1. Authenticated in-app Delete account / Request account deletion control.
2. Public account-deletion URL referenced in Play Console.
3. Backend process that deletes the account and associated user data, while clearly identifying any records retained for legitimate legal, fraud, security, transaction, or regulatory obligations.
4. Privacy policy must explain retention/deletion.
5. Physical test and evidence that the workflow functions.

Do not falsely state that all mission/payment/security records are immediately erased if production obligations require retention.
