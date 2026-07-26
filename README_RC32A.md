# RC3.2A — Live Location Contract Certification

Upload this changes-only package over RC3.2. No database migration is required.

This release repairs the engine boundary that caused the blank build: every live-location consumer now resolves against one certified repository API. It does not alter mission state, routing authority, dispatch rules, or notification data.
