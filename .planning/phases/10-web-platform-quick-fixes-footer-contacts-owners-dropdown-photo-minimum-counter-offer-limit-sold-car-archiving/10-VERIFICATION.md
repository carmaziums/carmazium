---
phase: 10-web-platform-quick-fixes-footer-contacts-owners-dropdown-photo-minimum-counter-offer-limit-sold-car-archiving
verified: 2026-06-21T00:00:00Z
status: passed
score: 21/21 must-haves verified
re_verification: false
---

# Phase 10: Web Platform Quick Fixes Verification Report

**Phase Goal:** Ship 4 targeted web-platform fixes: owners dropdown with departed sale, photo min 10 / max 100 with encouragement UX, counter-offer 5-per-side limit with lock + 48h expiry, sold car archiving (never delete, analytics fix, SOLD badge, relist action, SOLD overlay).
**Verified:** 2026-06-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DB schema contains all 6 new fields: isDepartedSale, departedRelationship on Listing; counterAttemptsBuyer, counterAttemptsSeller, counterExpiresAt, lastCounteredBy on Offer | VERIFIED | schema.prisma lines 630-631 (Listing) and 1032-1035 (Offer) |
| 2 | publishListing() rejects fewer than 10 images with 400 BadRequestException | VERIFIED | listings.service.ts lines 775-780: `if (listing.images.length < 10) throw new BadRequestException(...)` |
| 3 | Seller counter-offer limit of 5 enforced — 6th attempt returns 400 | VERIFIED | offers.service.ts line 292: `if (status === OfferResponseStatus.COUNTERED && offer.counterAttemptsSeller >= 5) throw new BadRequestException(...)` |
| 4 | Buyer can issue a re-counter via respondToCounterOffer (COUNTERED status + amount) — previously impossible | VERIFIED | offers.service.ts lines 609-629: new COUNTERED branch with buyerCounterAmount, counterAttemptsBuyer increment, $transaction wrap |
| 5 | COUNTERED offers past counterExpiresAt are auto-rejected on next interact | VERIFIED | offers.service.ts lines 273-280 (respondToOffer) and 598-605 (respondToCounterOffer): expiry check + auto-reject + 400 thrown |
| 6 | Buyer cannot open new offer after counter exhaustion and seller decision | VERIFIED | offers.service.ts lines 94-105: findFirst on counterAttemptsBuyer >= 5 + status IN [ACCEPTED, REJECTED], throws 400 |
| 7 | Push + in-app notifications sent to both buyer and seller when either side first reaches 5 counters | VERIFIED | offers.service.ts lines 317-344 (seller hits 5th) and 632-661 (buyer hits 5th): COUNTER_LIMIT_REACHED actionType, notificationsService.create + notificationsGateway.sendNotification for both parties |
| 8 | Owners dropdown renders 5 options (1/2/3/4/5+) in listing wizard | VERIFIED | ListingWizard.tsx line 1909: `['1','2','3','4','5+'].map(opt => ...)` with correct label logic |
| 9 | Owners field required — step 1 invalid until owner selected | VERIFIED | ListingWizard.tsx line 478: `formData.owners` included in baseValid condition |
| 10 | Departed sale checkbox appears below owners; relationship text field reveals when checked | VERIFIED | ListingWizard.tsx lines 1915-1928: checkbox with `isDepartedSale` id, conditional relationship input when `formData.isDepartedSale` |
| 11 | Listing detail page shows Deceased Estate badge when isDepartedSale true; shows owners count in specs table | VERIFIED | buy-cars/[slug]/page.tsx lines 542-547 (Deceased Estate purple badge) and 853-858 (Previous Owners row in specs) |
| 12 | Photo counter shows "X/10 photos — Y more required to publish" when count < 10; step blocked | VERIFIED | ListingWizard.tsx line 484: `case 2: return editId ? formData.images.length > 0 : formData.images.length >= 10`; counter at lines 1537-1557 with amber styling below 10 |
| 13 | When count >= 10: progress bar and motivational label appear; step unblocked | VERIFIED | ListingWizard.tsx line 1546: motivational label when isMinMet; green progress bar via `bg-green-500` class |
| 14 | maxImages raised to 100 and passed to ImageUpload | VERIFIED | ImageUpload.tsx line 45: `maxImages = 100`; ListingWizard.tsx line 1566: `maxImages={100}` prop |
| 15 | Editing an existing listing: photo minimum NOT enforced (editId bypass) | VERIFIED | ListingWizard.tsx line 484: `editId ? formData.images.length > 0 : ...`; edit mode label shows neutral `X/100 photos` (line 1543) |
| 16 | Offer thread shows "X counter-offers remaining" for both buyer and seller throughout negotiation | VERIFIED | user/page.tsx line 1148: `{buyerRemaining} counter-offer{...} remaining` when isBuyerTurn and !isBuyerLocked; seller/offers/page.tsx line 268: same pattern with sellerRemaining |
| 17 | Buyer can submit counter-offer via UI; locked state amber banner when limit reached | VERIFIED | user/page.tsx: handleBuyerCounter (line 1067) calls PATCH /api/offers/:id/respond-counter with {status:'COUNTERED', counterAmount}; locked amber banner at lines 1153-1160 with CountdownTimer |
| 18 | Seller locked state when counterAttemptsSeller >= 5: banner + countdown; counter input hidden | VERIFIED | seller/offers/page.tsx lines 273-279: isSellerLocked replaces counter input with amber banner "Counter limit reached — you must Accept or Decline." + CountdownTimer |
| 19 | Seller and user inventory show SOLD listings with badge; Relist action available | VERIFIED | user/page.tsx: includeSold=true line 477; SOLD badge via status color map line 633; handleRelist line 538 calls PATCH /api/listings/:id/status {status:'ACTIVE'}; dealer/inventory/page.tsx: includeSold=true line 95; SOLD badge overlay line 327-330; Relist button line 491-498 calls PATCH /listings/:id/status |
| 20 | SOLD listing detail page accessible with SOLD overlay; no 404 | VERIFIED | buy-cars/[slug]/page.tsx: pre-existing SOLD watermark (large diagonal text, lines 602-605+), "Sold" pill badge line 493-496, "Vehicle Sold" sidebar box line 718-721, no notFound() guard on SOLD status confirmed |
| 21 | Analytics includes SOLD listings; CarCard shows SOLD badge in search results | VERIFIED | dashboard.service.ts line 167: totalListings has no status filter (includes SOLD) with Phase 10 comment; admin.service.ts line 354: `prisma.listing.count()` no filter; CarCard.tsx line 191: SOLD stamp overlay when `status === 'SOLD'`; status prop passed at both call sites in search/page.tsx lines 1071, 1104 |

**Score:** 21/21 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/prisma/schema.prisma` | VERIFIED | 6 new fields present: isDepartedSale, departedRelationship, counterAttemptsBuyer, counterAttemptsSeller, counterExpiresAt, lastCounteredBy |
| `backend/prisma/migrations/phase10_counter_tracking_departed_sale.sql` | VERIFIED | File exists (manual SQL for remote Supabase deployment) |
| `backend/src/listings/dto/create-listing.dto.ts` | VERIFIED | isDepartedSale and departedRelationship present at lines 401, 407 |
| `backend/src/offers/offers.service.ts` | VERIFIED | Counter tracking, buyer re-counter, expiry check, exhaustion block, limit notifications all present |
| `backend/src/offers/offers.controller.ts` | VERIFIED | respondToCounterOffer passes dto.counterAmount to service (line 166) |
| `backend/src/listings/listings.service.ts` | VERIFIED | Photo minimum guard in publishListing at lines 775-780 |
| `src/components/listing/ListingWizard.tsx` | VERIFIED | 5-option owners, isDepartedSale checkbox/field, photo counter/progress bar, editId bypass, isDepartedSale in payload |
| `src/components/listing/ImageUpload.tsx` | VERIFIED | maxImages = 100 default at line 45 |
| `src/app/buy-cars/[slug]/page.tsx` | VERIFIED | isDepartedSale badge + owners in specs; SOLD overlay/watermark; no 404 on SOLD |
| `src/app/dashboard/user/page.tsx` | VERIFIED | counterAttemptsBuyer, isBuyerLocked, CountdownTimer, handleBuyerCounter, handleRelist, includeSold=true |
| `src/app/dashboard/seller/offers/page.tsx` | VERIFIED | counterAttemptsSeller, isSellerLocked, CountdownTimer, remaining count, locked banner |
| `src/app/dashboard/dealer/inventory/page.tsx` | VERIFIED | includeSold=true, SOLD badge via STATUS_COLORS, Relist via PATCH /status |
| `src/components/features/CarCard.tsx` | VERIFIED | status prop in CarCardProps, SOLD stamp overlay, image grayscale on SOLD, "View Sold Vehicle" button text |
| `backend/src/dashboard/dashboard.service.ts` | VERIFIED | totalListings has no status filter (includes SOLD); Phase 10 audit comments added |
| `backend/src/admin/admin.service.ts` | VERIFIED | `prisma.listing.count()` with no filter for totalListings; Phase 10 comments added |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| schema.prisma | offers.service.ts | counterAttemptsBuyer/Seller fields used in service logic | WIRED | offers.service.ts references counterAttemptsBuyer/Seller at 7 locations |
| listings.service.ts | schema.prisma | publishListing checks listing.images.length | WIRED | Line 776: `listing.images.length < 10` |
| ListingWizard.tsx | ImageUpload.tsx | maxImages={100} prop | WIRED | ListingWizard line 1566 passes maxImages={100}; ImageUpload default also 100 |
| buy-cars/[slug]/page.tsx | listing.isDepartedSale | Conditional Deceased Estate badge | WIRED | Line 543: `{listing.isDepartedSale && ...}` |
| user/page.tsx | PATCH /offers/:id/respond-counter | handleBuyerCounter fetch call | WIRED | Line 1071: `/api/offers/${offerId}/respond-counter` with {status:'COUNTERED', counterAmount} |
| seller/offers/page.tsx | counterAttemptsSeller | sellerRemaining + isSellerLocked derived | WIRED | Lines 220-221: derived from offer.counterAttemptsSeller |
| user/page.tsx | GET /listings/my?includeSold=true | getMyListings({includeSold:true}) | WIRED | Line 477: includeSold: true in InventoryTab fetch |
| dealer/inventory/page.tsx | GET /listings/my?includeSold=true | query.set("includeSold","true") | WIRED | Line 95: includeSold=true in search params |
| CarCard.tsx | listing.status | SOLD stamp overlay conditional | WIRED | Line 191: `{status === 'SOLD' && ...}`; status passed at search/page.tsx lines 1071, 1104 |

---

### Requirements Coverage

The OWNERS-xx, PHOTO-xx, COUNTER-xx, and SOLD-xx requirement IDs are web-platform requirements tracked in ROADMAP.md (Phase 10 Requirements field) and the individual phase plan frontmatter. They do not appear in REQUIREMENTS.md, which is mobile-app only. All 27 IDs are covered across the 4 plans:

| Requirement | Source Plan | Implementation Evidence |
|-------------|-------------|------------------------|
| OWNERS-01 | 10-02 | 5-option owners dropdown in ListingWizard.tsx |
| OWNERS-02 | 10-02 | owners in step 1 baseValid; step invalid until selected |
| OWNERS-03 | 10-02 | isDepartedSale checkbox + departedRelationship field in ListingWizard.tsx |
| OWNERS-04 | 10-02 | Deceased Estate badge + Previous Owners row in buy-cars/[slug]/page.tsx |
| OWNERS-05 | 10-01 | isDepartedSale + departedRelationship in create-listing.dto.ts + schema |
| PHOTO-01 | 10-02 | Photo counter "X/10 photos — Y more required to publish" in wizard step 2 |
| PHOTO-02 | 10-02 | Progress bar amber below 10, green at/above 10 |
| PHOTO-03 | 10-02 | case 2 step validation: images.length >= 10 (publish blocked) |
| PHOTO-04 | 10-01 | publishListing guard: images.length < 10 throws 400 |
| PHOTO-05 | 10-02 | maxImages={100} prop + ImageUpload default raised to 100 |
| PHOTO-06 | 10-02 | editId bypass: `editId ? images.length > 0 : images.length >= 10` |
| COUNTER-01 | 10-01 | counterAttemptsSeller >= 5 guard in respondToOffer |
| COUNTER-02 | 10-01 | counterAttemptsBuyer >= 5 guard in respondToCounterOffer |
| COUNTER-03 | 10-01 | counterAttemptsSeller increment + counterAttemptsBuyer increment on each counter |
| COUNTER-04 | 10-03 | "X counter-offers remaining" display in buyer OutgoingOffersTab |
| COUNTER-05 | 10-03 | "X counter-offers remaining" display in seller OfferRow |
| COUNTER-06 | 10-03 | Buyer counter-offer input + handleBuyerCounter; seller locked banner when isSellerLocked |
| COUNTER-07 | 10-01, 10-03 | COUNTER_LIMIT_REACHED notifications (backend); amber locked banners + CountdownTimer (UI) |
| COUNTER-08 | 10-01 | counterExpiresAt check at top of respondToOffer and respondToCounterOffer; auto-reject + 400 |
| COUNTER-09 | 10-01 | makeOffer() exhaustion block: prior offer with counterAttemptsBuyer >= 5 + ACCEPTED/REJECTED |
| SOLD-01 | 10-04 | user/page.tsx: includeSold=true; SOLD badge via status color map |
| SOLD-02 | 10-04 | dealer/inventory/page.tsx: includeSold=true; SOLD badge/stamp overlay |
| SOLD-03 | 10-04 | handleRelist in user/page.tsx: PATCH /api/listings/:id/status {status:'ACTIVE'} |
| SOLD-04 | 10-04 | dealer/inventory/page.tsx: Relist button calls PATCH /listings/:id/status {status:'ACTIVE'} |
| SOLD-05 | 10-04 | buy-cars/[slug]/page.tsx: SOLD watermark + pill badge + sidebar SOLD box; no 404 guard |
| SOLD-06 | 10-04 | CarCard.tsx: SOLD stamp overlay; status passed at both search page call sites |
| SOLD-07 | 10-04 | dashboard.service.ts + admin.service.ts: totalListings queries have no status filter (includes SOLD); Phase 10 comments confirm audit |

**All 27 requirements: SATISFIED**

Note: REQUIREMENTS.md (D:/carmazium/.planning/REQUIREMENTS.md) is a mobile app requirement document and does not contain any of the web-platform phase 10 IDs. These IDs exist solely in ROADMAP.md and the phase plan frontmatter — this is expected and not a gap.

---

### Anti-Patterns Found

No blockers or warnings found. Spot checks:

- offers.service.ts: No TODO/FIXME in counter tracking logic; all branches return real data or throw meaningful exceptions
- ListingWizard.tsx: Photo counter is a real IIFE implementation with calculated values; not a placeholder
- buy-cars/[slug]/page.tsx: SOLD overlay is a pre-existing more prominent implementation (diagonal watermark) rather than the plan's backdrop-blur div — requirement is satisfied more thoroughly than planned
- CarCard.tsx: SOLD stamp pre-existed with a red diagonal treatment; requirement satisfied
- dashboard.service.ts / admin.service.ts: Analytics queries audited and commented; no status filter on totalListings confirms SOLD is included

---

### Human Verification Required

1. **Photo counter UX flow**
   - Test: Open listing wizard, reach step 2, upload fewer than 10 photos. Confirm amber counter shows "X/10 photos — Y more required to publish" and the Next button is disabled. Upload to 10+ photos and confirm counter turns green and step advances.
   - Expected: Amber below 10, green at 10+, step blocked below minimum
   - Why human: Dynamic photo upload and step transition cannot be verified from static code

2. **Buyer re-counter end-to-end**
   - Test: As a buyer with a COUNTERED offer (seller has countered), enter an amount in the counter input and click Counter. Confirm the offer updates and both parties see the new amount.
   - Expected: PATCH /api/offers/:id/respond-counter fires with {status:'COUNTERED', counterAmount}; offer status remains COUNTERED; seller sees buyer's counter
   - Why human: Requires active offer data in the database and real-time dashboard refresh verification

3. **Counter limit lock states**
   - Test: Set counterAttemptsBuyer=5 in the DB for an active COUNTERED offer. Reload the buyer dashboard. Confirm the amber banner shows "Counter limit reached — awaiting seller's final decision." and the countdown timer is counting down.
   - Expected: Input hidden, amber banner visible, CountdownTimer showing hours remaining
   - Why human: Requires DB manipulation and real-time UI state verification

4. **Relist flow**
   - Test: Find a SOLD listing in seller inventory. Click Relist. Confirm the listing status changes to ACTIVE.
   - Expected: PATCH /api/listings/:id/status {status:'ACTIVE'} fires; listing reappears in active inventory
   - Why human: Requires SOLD listing in the database and page refresh behavior verification

5. **SOLD overlay on detail page**
   - Test: Navigate to /buy-cars/[slug] for a SOLD listing. Confirm the diagonal SOLD watermark appears on the hero image and the page does not 404.
   - Expected: Large red diagonal "SOLD" text across the image; sidebar shows "Vehicle Sold" state; no 404
   - Why human: Visual rendering and navigation cannot be verified from static code

---

## Summary

Phase 10 goal is **fully achieved**. All 4 targeted web-platform fixes are implemented end-to-end:

**Owners dropdown + departed sale:** 5-option dropdown with required validation; deceased estate checkbox with conditional relationship field; Deceased Estate badge and Previous Owners spec row on the detail page; backend DTO and schema fields in place.

**Photo minimum 10 / max 100:** Backend 400 guard in publishListing; wizard step 2 blocked below 10 (with editId bypass for edits); amber/green progress counter with motivational label; ImageUpload default and prop both set to 100.

**Counter-offer 5-per-side limit:** Backend enforces limits, expiry auto-reject, and blocks new offers after exhaustion; push + in-app notifications to both parties on limit reached; buyer UI gains a re-counter input; both dashboards show remaining count and locked amber banners with 48h countdown timers.

**Sold car archiving:** SOLD listings appear in seller and dealer inventory with badge and Relist action (correct PATCH /status endpoint); SOLD overlay on detail page; SOLD badge on CarCard in search results; analytics queries confirmed to include SOLD in total counts with Phase 10 audit comments.

One notable finding: Several SOLD-related UI elements (CarCard stamp, detail page watermark, dealer inventory flag) were pre-existing implementations that are more prominent than the plan specified. Requirements are satisfied and in some cases exceeded.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
