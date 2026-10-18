# SimpleDMS production source candidate — isolated review (18 October 2026)

**Status: DRAFT, DO NOT MERGE OR DEPLOY AS A PARTNER LAUNCH.** This candidate ports the older partner API code and its existing test suite onto current CarMazium `main` without replacing current user, auction, pricing, payment, listing, DVLA or MOT code. There is no schema migration, customer data export, production credential creation or enabling operation in this PR.

## Default deny design
- Three explicit flags must be true to expose the partner routes: `PARTNER_API_ENABLED=true`, `PARTNER_API_SIMPLEDMS_ENABLED=true`, and the separate final written-release approval sentinel `PARTNER_API_SIMPLEDMS_PRODUCTION_APPROVED=true`. The last gate is never set by this PR and defaults to OFF. Even an accidentally existing partner key and the two earlier flags cannot expose the feed before the third gate is intentionally provisioned.
- Authenticated `X-Partner-Key` header with SHA-256 digest comparison; no CarMazium session, Supabase access token or admin key authorises the feed.
- Inventory and single-auction endpoints share the same eligibility filter: live ACTIVE auctions, ACTIVE AUCTION-type unwithdrawn listings and non-null `partnerDistributionAcceptedAt`. No inferred acceptance or legacy backfill.
- No seller/bidder identity, reserve, private KYC/finance or buyer contacts are selected. Registration, current valid bid, region and current-live image URLs each require specific opt-in settings.
- Public photo URL extraction only from approved HTTPS allowlisted hosts and `/storage/v1/object/public/listings/`, excluding signed/private tokens and private paths. The image host allowlist alone does **not** certify photo rights.
- Only an approved partner signing configuration enables authentic referral links. Direct auction URLs have no signing proof and must not be falsely counted as attributed referral purchases.
- Approved reports return aggregate dealer acquisitions, eligible bids and completed handovers; no user-level dealer data is shared. Report limits and time-window controls are retained.
- No feature flag, API key, secret, database mutation, live feed or production integration is activated by a repository PR.

## Exact prospective API paths (do not disclose a credential)

- `GET {CONFIRMED_BACKEND_ORIGIN}/partners/v1/simpledms/auctions?page=1&limit=25`
- `GET {CONFIRMED_BACKEND_ORIGIN}/partners/v1/simpledms/auctions/{auctionUuid}`
- `GET {CONFIRMED_BACKEND_ORIGIN}/partners/referrals/simpledms/go/{auctionUuid}?...signed referral...`
- `POST {CONFIRMED_BACKEND_ORIGIN}/partners/referrals/simpledms/claim` (authenticated dealer)
- `GET {CONFIRMED_BACKEND_ORIGIN}/partners/referrals/simpledms/report?days=90` (admin only)

**No production API hostname is asserted ready** merely from code defaults. Approve exact upstream origin, network controls, image hosts, field allowlists, referral configuration and metrics definitions in a separate jointly signed acceptance record.

## Open release checklist

- [ ] Candidate backend typecheck, tests, Docker build and protected security check PASS on the exact head SHA. Check older integration service and referral tests against current main Prisma definitions and auth.
- [ ] Complete 18 October revised unsigned agreement, SimpleDMS provider and data-recipient terms, UK GDPR legitimate-interests / purpose-compatibility and DPIA screening, seller notice and documented objection handling.
- [ ] Publish required website and actively used native disclosures; verify new listing declaration's recorded timestamp and exclude all pre-existing NULL legacy rows until a separately authorised alternative applies.
- [ ] Verify real photo public-display AND partner-syndication rights, representative image decoding/withdrawal and no historical image/URL archive.
- [ ] Verify CarMazium's own production database AND Storage independent backups with isolated restore and correction/deletion/expiry replay; do not mistake partner synthetic proof for our production recovery.
- [ ] Confirm latest security deployment image and rollback, RLS/schema role risk controls, protected signing and access/revocation tests.
- [ ] Final signature by each authorised director, mutually approved restricted secret handover, signed calendar acceptance for both live+historical, and bilateral written Pilot Launch Date. The 90-day free pilot starts only then.

**Current decision: NO-GO.** This is an engineering preparation branch, not a launch authorisation. 
