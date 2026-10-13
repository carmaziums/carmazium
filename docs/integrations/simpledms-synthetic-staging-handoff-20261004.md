# SimpleDMS × CarMazium — synthetic staging technical handoff
**4 October 2026 — test-only onboarding instructions. This document is not a production data licence or credential.**

## Verified isolated stage
- Dedicated existing Railway project: `simpledms-stage`, service `partner-api-synthetic`. Although Railway calls its service environment "production", its application entrypoint is **synthetic staging only**, runs fake records, rejects real database/Stripe/Supabase runtime credentials, and has no production feed.
- HTTPS origin: `https://partner-api-synthetic-production.up.railway.app`
- Test endpoints:
  - `GET /health/live` — returns `{"ok":true,"syntheticOnly":true}`
  - `GET /staging-assets/demo-vehicle.svg` — fictional demo image
  - `GET /partners/v1/simpledms/auctions?page=1&limit=25`
  - `GET /partners/v1/simpledms/auctions/{auctionUuid}`
- The authenticated partner endpoints require an `X-Partner-Key` header server-side over HTTPS. Never put the secret in browser JavaScript, query strings, email or logs.
- Current deployment: exact commit `133e3fae03aba4b3b5f971f1c2e7be05a` from `integration/simpledms-staging-candidate-20261003`. Its CI suite and repeat remote anonymous-host checks passed on 4 October 2026. The stage has rollback available.

## Secretless, partner-provisioned test-key exchange
1. An authorised SimpleDMS engineer generates a **new, unpredictable random secret of at least 32 bytes** locally. Store the *raw* string only in the SimpleDMS server-side secret manager. **Never email or commit the raw secret.**
2. Calculate the **SHA-256 digest of the exact raw UTF-8 string**, as 64 lowercase hexadecimal characters. Share **only the digest** with CarMazium through the established `info@simpledms.co.uk` thread. The digest is not the usable API key; CarMazium cannot derive the raw secret.
3. CarMazium verifies the sender via its agreed technical contact and installs only the digest in `PARTNER_API_SIMPLEDMS_KEY_SHA256` on the **isolated synthetic Railway stage**; the global/partner feature flags and allowed synthetic field flags are configured explicitly and verified after restart. Do not alter the live CarMazium Fly API.
4. SimpleDMS sends the locally retained raw key as `X-Partner-Key` in its *own server-to-server* test call, then jointly verifies wrong/missing-key denial, pagination, one fictional auction, image URL, allowed sample VRM/bid/region fields, detail URL and removal/reconciliation. Arrange digest rotation/revocation testing before sign-off.
5. Record that a stage key authorises **synthetic sample data only**. Neither the digest nor raw key may be reused in production. Do not issue a production key until the separately signed live-data schedule and production approval.

**Optional local generator for SimpleDMS only:** An engineer may generate a key and its digest entirely on a machine they control (e.g. using Python `secrets.token_hex(32)` and `hashlib.sha256(raw.encode()).hexdigest()`). They must not paste the raw secret into any chat, email or shared log.

## Joint test criteria
- Missing/incorrect/disabled key: deny `401` or `404` as appropriate; enabled correct key gets a private-cacheable `200` with only synthetic test vehicles.
- Full, paginated 2–5 minute sync; at the end of a complete snapshot, remove vehicles no longer returned; after 15 minutes without freshness, hide or mark inventory stale in BuySmart. Test ended/withdrawn with synthetic fixtures.
- Allowlist optional synthetic fields individually: images, test registration, current observed bid and broad approved region. No seller, bidder, reserve, customer data or real vehicle metadata in stage.
- Review CarMazium referral URLs and direct auction links separately; do not claim production attribution until actual first-party consent and end-to-end conversion flows have been verified.
- Preserve exact source and deploy hashes; roll back isolated staging if required.

## Separate production gates
Commercial baseline agreed by email: waived £5,000 integration fee, free 90 days beginning **only on jointly accepted live launch**, no automatic renewal or exclusivity, further commercial terms by mutual written agreement.

The proposed live-data agreement and Schedule A must be signed by authorised representatives and cover agreed fields, seller-photo permissions, temporary caching, deletion and privacy notice; the optional historical-event licence and optional AI processing are separate and remain **disabled unless separately signed**. Production security review, genuine non-sensitive joint stage acceptance and a distinct production key/enablement decision are required. Do not turn outstanding backup investigation into an unnecessary blocker for **synthetic** staging work, but do not equate synthetic readiness with recovery approval or production readiness.

References:
- [Partner API contract](simpledms.md)
- [Draft pilot licence for signature](simpledms-pilot-data-licence-FOR-SIGNATURE.md)
- [Pilot/staging checklist](simpledms-pilot-agreement-and-staging-checklist.md)
- [Outstanding database/storage recovery tracking](https://github.com/carmaziums/carmazium/issues/364)
