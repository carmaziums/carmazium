# CarMazium isolated sandbox evidence — 20 November 2026

These are the executed integration harnesses, not CI tests or production setup instructions. They deliberately require an existing local QA workspace with source/backend compiled from 13ec38cf3ae62f702e3c5ceaa672d21f1f645342, loopback PostgreSQL 5544/carmazium_sandbox_utf8, API 8080 and private fixture/configuration files. Copy the infra directory into that isolated workspace. Never supply production secrets or run against a customer database.

Secrets, passwords, cookies, identity session data, private fixture files and payment screenshots are excluded. All payment scripts require a Stripe test key; the seed also checks the exact authorized sandbox account. Test emails use example.com and outbound email was disabled. Schema scripts use existing repository migrations; the private-documents migration was applied only before its Supabase storage section. Provider capabilities had to be reseeded to APPROVED after that migration.

Run steps were seed → prepare jobs → hosted test checkout → schema completion and signed event replay → provider/customer completion → dispute/refund/reversal → cancellation cleanup. A native-created job and its IDs were written to the private checkout fixtures by quote-native. These scripts are stateful evidence and should not be rerun blindly. Admin refund HTTP correctly refused cookie-only access; service-refund and inspection-settlement-refund explicitly test the service layer, not an authentication bypass or admin UI.

See the parent emulator QA log for results, APK provenance, limitations and the distinction between native/API/service-layer tests.
