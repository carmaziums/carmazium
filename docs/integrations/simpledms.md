# SimpleDMS BuySmart — CarMazium restricted auction feed (draft)

**Status:** Implementation candidate. Disabled by default. Not approved for
production use or credential issue until data-sharing and commercial approval,
security review, tests and staging verification are complete.

## Purpose and boundaries

This is a **one-way, read-only** feed of approved, currently live CarMazium
dealer auctions for presentation inside SimpleDMS BuySmart. BuySmart should
display clear CarMazium attribution and deep-link dealers back to the original
auction. Registration, dealer verification, bidding, payment, seller contact,
handover and dispute handling **remain exclusively on CarMazium**.

No account, session, admin permission, payment authority, seller identity, VIN,
handover proof, reserve price, internal valuation or buyer identity is issued to
SimpleDMS by this API. Retail listings are not included. Data fields cannot be
expanded without a reviewed code change, except the three narrowly scoped
configuration flags described below.

## Endpoints

The backend base URL must be confirmed before exchanging credentials.

- `GET {BACKEND_BASE_URL}/partners/v1/simpledms/auctions?page=1&limit=25`
- `GET {BACKEND_BASE_URL}/partners/v1/simpledms/auctions/{auctionUuid}`

All requests must send the private `X-Partner-Key` HTTP header over HTTPS.
CarMazium user cookies, Supabase access tokens and ordinary admin/API keys do
not authenticate this feed.

Direct auction links carry fixed `utm_source=simpledms` and `utm_medium=partner_api` tags for CarMazium referral attribution. They do not carry secrets or personal data.\n\nThe default page size is 25; allowed page range 1–1000 and size 1–50. Results
include a current live-vehicle total and a `hasMore` marker. Responses send
`Cache-Control: private, no-store`, and partner routes are excluded from public
Swagger. The partner feed allows 60 requests/minute per client IP by default.
Partners must not make their API key available in browsers, mobile apps, source
control, diagnostic logs or shared screenshots.

**Default response (illustrative, not a real vehicle):**

```json
{
  "version": "1",
  "generatedAt": "2026-10-01T18:00:00.000Z",
  "pagination": {"page": 1, "limit": 25, "total": 1, "hasMore": false},
  "auctions": [{
    "id": "00000000-0000-4000-8000-000000000001",
    "listingId": "00000000-0000-4000-8000-000000000002",
    "title": "2020 Example Car",
    "vehicle": {
      "type": "CAR", "make": "Example", "model": "Car",
      "variant": "Sport", "year": 2020, "mileage": 45000,
      "fuel": "PETROL", "transmission": "AUTOMATIC",
      "bodyType": "HATCHBACK", "colour": "Blue", "engineSizeCc": 2000
    },
    "auction": {
      "status": "ACTIVE",
      "startTime": "2026-10-01T10:00:00.000Z",
      "endTime": "2026-10-02T10:00:00.000Z",
      "startingBidGbp": 5000
    },
    "images": [],
    "updatedAt": "2026-10-01T12:00:00.000Z",
    "url": "https://carmazium.com/auctions/live/00000000-0000-4000-8000-000000000001?utm_source=simpledms&utm_medium=partner_api"
  }]
}
```

Only ACTIVE auctions with start time reached, end time still in the future,
approved ACTIVE AUCTION-type listings and no deletion markers are returned.
For any ended, sold, cancelled, withdrawn, relisted or expired vehicle, the
partner **must remove the advert** when it disappears from the full live feed.
A past snapshot is not proof that an auction is still available. Re-check the
original CarMazium page at the point of referral.

A suggested starting integration cadence is a complete paginated refresh
every 2–5 minutes, subject to monitoring and agreed rate limits. There is no
incremental deletion/tombstone endpoint in v1; stale rows must be cleared
against each completed full-feed reconciliation.

## Activation / security

Set the following **on the backend only**, using the backend deployment's
secure environment/secrets store. These defaults are OFF.

```dotenv
PARTNER_API_ENABLED=false
PARTNER_API_SIMPLEDMS_ENABLED=false
PARTNER_API_SIMPLEDMS_KEY_SHA256=
PARTNER_API_PUBLIC_BASE_URL=https://carmazium.com
PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION=false
PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID=false
PARTNER_API_SIMPLEDMS_SHARE_IMAGES=false
PARTNER_API_PUBLIC_IMAGE_HOSTS=
```

Generate a unique cryptographically random secret (at least 32 bytes). Store
its lower-case SHA-256 hex digest in `PARTNER_API_SIMPLEDMS_KEY_SHA256`; supply
the raw secret to SimpleDMS through a secure channel only after agreement.
For key rotation, the environment field supports two comma-separated digests
temporarily. Remove the old digest when the rotation is complete. Disable
`PARTNER_API_SIMPLEDMS_ENABLED` to revoke only this partner and the global
flag to disable all partner feeds. Restart/redeploy the backend when changing
environment variables as required by the host.

The following fields are separately permissioned and are ALL disabled by
default:

- Registration (`PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION=true`).
- Current valid bid price (without bidder identities).
- Image URLs, restricted to explicitly allowlisted public HTTPS image
  hostnames, with no URL credentials/query tokens; for Supabase only the
  `/storage/v1/object/public/` path is accepted. Set the host allowlist
  `PARTNER_API_PUBLIC_IMAGE_HOSTS` before enabling images.

Reserved/internal prices are never shared. Any request to add reserve price,
seller location, seller contact, hidden inspection evidence, other lifecycle
states or bid placement requires a new separately reviewed change.

## Checklist before going live

1. Confirm commercial and data-sharing agreement, attribution, non-resale,
   retention and deletion obligations, and whether registration/image disclosure
   is approved. Confirm their current active buyer base.
2. Security-review this route on the backend. Confirm key handling, per-client
   throttling, public-image provenance and no sensitive data in responses/logs.
3. In staging, confirm unauthenticated, wrong-key, disabled and non-live calls
   cannot disclose inventory; run backend typecheck/tests and API contract tests.
4. With a dedicated test credential, verify pagination, full reconciliation of
   ended/withdrawn auctions, fresh prices, correct links and the required
   dealer-login/bidding flow on the original CarMazium site.
5. Monitor latency, database load, referral traffic and attributed completed
   purchases before enabling in production.

No SimpleDMS credentials have been created or exchanged by this code change.
