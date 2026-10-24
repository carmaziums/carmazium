# SimpleDMS — CarMazium production field/permission configuration and acceptance matrix

**Date:** 24 October 2026. **Status:** REVIEW-READY SPECIFICATION ONLY; NO PRODUCTION PERMISSION, CREDENTIAL, FLAG OR LIVE DATA SHARING.  
**Source of truth:** production backend code (merged [PR #627](https://github.com/carmaziums/carmazium/pull/627)); unsigned 24 October Revision 4 contract, Schedule A / D. No price, seller, image or user records have been transferred by this document.

## Observed implementation and proposed explicit choice

The live NestJS endpoints are defined in \`backend/src/partner-api/simpledms.controller.ts\`:
- \`GET /partners/v1/simpledms/auctions?page=1&limit=25\` (limit 1–50)
- \`GET /partners/v1/simpledms/auctions/:id\` (UUID)
- Signed redirect & aggregate attribution are separate under \`/partners/referrals/simpledms/*\`. Do not treat the ordinary public auction URL as an attributable conversion.

The controller is protected by **all three** exact-string switches:
- \`PARTNER_API_ENABLED=true\`
- \`PARTNER_API_SIMPLEDMS_ENABLED=true\`
- \`PARTNER_API_SIMPLEDMS_PRODUCTION_APPROVED=true\`

If any is unset, partner endpoints return not-found. A separate at-least-32-character partner secret is checked against a server-held SHA-256 digest on the dedicated \`x-partner-key\` header. **All three switches and key issue MUST remain disabled until the signed/legal and joint acceptance gates are met.** Do not record keys in this document.

| Field | Schedule A decision | Backend behaviour / condition |
| --- | --- | --- |
| Auction/listing id, public vehicle description, status, dates, published starting bid, updated timestamp and link | YES | Allowed fields from explicit Prisma projection; omit reserve and private internal values |
| Eligible listings | ONLY acknowledged live auctions | Auction and listing ACTIVE, in valid time window, not deleted, and \`partnerDistributionAcceptedAt IS NOT NULL\`; no legacy backfill |
| Public vehicle photographs | YES *subject to rights*, live only | \`PARTNER_API_SIMPLEDMS_SHARE_IMAGES\` must be true **and** \`PARTNER_API_PUBLIC_IMAGE_HOSTS\` explicit host allowlist. Only HTTPS public-listings paths; never KYC/handovers/signed/private images; no historic photos or URLs |
| Registration (VRM) | YES *conditional* for protected matching | \`PARTNER_API_SIMPLEDMS_SHARE_REGISTRATION\` true only after separate matching/raw-VRM erasure and privacy acceptance |
| Current valid bid | YES *conditional* | \`PARTNER_API_SIMPLEDMS_SHARE_CURRENT_BID\` true; current auction's valid bid amount only, no bidder or reserve; bid is not confirmed sale price |
| Broad region | YES *conditional* | \`PARTNER_API_SIMPLEDMS_SHARE_REGION\` and exact \`PARTNER_API_SIMPLEDMS_ALLOWED_REGIONS\` allowlist; no postcode or full seller address |
| Signed referrals & aggregation | YES *conditional* | \`PARTNER_API_SIMPLEDMS_REFERRALS_ENABLED\`, server-controlled referral URL, separate signing secret and \`PARTNER_API_REFERRAL_BACKEND_URL\` configured; claim requires authenticated dealer and bearer session; aggregation internal/admin only |
| Seller/buyer/bidder identity, reserves, exact address, VIN, private documents, internal valuations | NO | Never returned in partner feed |
| Live car photography and vehicle-check/valuation third-party recipients | CONDITIONAL | Rights/licences, external entitlement and lawful-basis review required, regardless of owner's general approval |

## Values still to independently verify / freeze before sharing with SimpleDMS

- Production API address: configure the actual externally reachable HTTPS backend only after testing. Do not assume the website \`https://carmazium.com\` is the API origin, or that a staging Railway host is live production.
- Product page links: backend presently constructs \`/auctions/live/:id\` on an approved CarMazium host. Verify the real web/app route opens that auction without login leakage.
- Public image host may be project-specific Supabase public \`/storage/v1/object/public/listings/\`; the *host* and every sampled source item's third-party syndication rights require explicit confirmation. Existing public URLs alone are insufficient.
- Region labels: only vetted broad region names from actual structured data, not unstructured full addresses; if such field is unavailable or unverifiable, leave this field OFF during acceptance.
- Referral attribution: confirm registered dealer, bid, handover-approved purchase and aggregate impression/report definitions before claiming any completed sales attribution.
- No contract, LIA or signatory approval automatically provisions credentials or flips flags. Retain all defaults OFF and record owner and partner written go-live acceptance after an agreed test window.

## Controlled joint acceptance — do not perform with live data now

1. Before approval, denied public request returns an inert error (404) for list/detail/referrals, including wrong and absent keys. Check against the exact real API URL without trying to bypass security.
2. With separately scoped test credentials in synthetic staging, verify pagination and 2–5 minute reconciliation, withdrawal/ended removal and 15-minute stale hiding in BuySmart.
3. Confirm zero legacy NULL acknowledgements and only an active seller-acknowledged valid listing is eligible. Do not insert synthetic records into live.
4. Verify actual allowed fields *and forbidden fields*, especially user identity, reserve, VIN, private URLs or addresses, in list and detail.
5. Test photo-rights sampled public image only, image withdrawal and explicit no historical image storage. No private/third-party source photography before authority is confirmed.
6. Validate VRM protected matching and timely raw-VRM deletion in SimpleDMS, original up-to-36-month event/report clock, seven-day independent analysis, objection/correction/suppression and replay after protected recovery. Complete real source rights/Article 6 and DPIA outcome first.
7. Confirm signed referral/dealer claim reports, revoked key behaviour, rollback and agreed final field profile.
8. Directors sign one execution PDF; send production key through approved restricted secret-manager channel only after legal/provider acceptance; jointly confirm production go-live and Pilot Launch Date in writing.

**Production gate: NO-GO until these checks and required provider/privacy approvals are actually complete.** The deferred independent CarMazium backup and broader platform security programmes are being developed separately for later release (draft PRs #630 and #655) and must not be mistaken for a waiver of the specific feed protections above.
