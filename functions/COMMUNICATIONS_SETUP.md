# Spone Labs communication cutover

Disabled by default. Set COMMUNICATIONS_ENABLED=true only after the central Mailjet connection, DNS and shared quota are verified. Set COMMUNICATIONS_START_AT to the cutover UTC timestamp and COMMUNICATIONS_ENDPOINT to the central communicationsIngest URL. The default source service account must have roles/run.invoker on that one central service and be allowlisted there for this app.

Deploy the adapter and the changed existing email handlers together. Do not enable both the old customer sender and this outbox. Existing authentication/OTP messages continue through their original sender. No newsletter subscriptions are created. No journal entries, documents or recordings are copied.

The outbox is server-only; Firestore rules must deny client access to communicationsOutbox. Successful hub acknowledgments are idempotent. Hub outages retain events; rejected events are blocked for review. To revert, disable capture first and drain or withdraw queued events before enabling the old sender. Never replay old profiles.
