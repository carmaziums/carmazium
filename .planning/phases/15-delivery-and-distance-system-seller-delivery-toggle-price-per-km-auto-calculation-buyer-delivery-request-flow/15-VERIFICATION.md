---
phase: 15-delivery-and-distance-system-seller-delivery-toggle-price-per-km-auto-calculation-buyer-delivery-request-flow
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 15/15 must-haves verified (automated); 8/8 human flows claimed passed in 15-06-SUMMARY
re_verification: false
human_verification:
  - test: "Seller creates delivery-enabled listing and publishes"
    expected: "Listing has deliveryAvailable=true, deliveryPricePerMile=0.50, deliveryMaxMiles=100 in DB after wizard submit"
    why_human: "Cannot run the browser wizard or inspect live DB state programmatically in this environment"
  - test: "Search delivery filter narrows results and CarCard shows Delivery chip"
    expected: "Only delivery-enabled listings appear; emerald Truck/Delivery chip visible on CarCard thumbnails"
    why_human: "Visual rendering and live API response requires browser"
  - test: "Buyer delivery request form — live cost preview via /api/delivery-distance"
    expected: "Estimated cost appears within 1-2 seconds of typing postcode; out-of-radius shows inline error"
    why_human: "Requires browser interaction, live Google Maps API key in .env, and real listing data"
  - test: "Delivery request submission and seller notification"
    expected: "Amber status badge replaces CTA; seller sees notification in bell; PENDING tag on seller offers page"
    why_human: "End-to-end flow requires two authenticated sessions and live notification pipeline"
  - test: "Seller accept — buyer receives notification and green badge"
    expected: "Seller clicks Accept; tag shows ACCEPTED; buyer gets notification; buyer page shows Delivery Confirmed"
    why_human: "Multi-user flow requires browser and live backend"
  - test: "Buyer marks delivery as complete"
    expected: "Mark as received button visible when status=ACCEPTED; badge changes to Delivered"
    why_human: "Requires ACCEPTED delivery request in DB to click through"
  - test: "Seller decline — buyer can re-request"
    expected: "Delivery Declined badge shown AND Add delivery request CTA re-appears"
    why_human: "Requires multi-user session and notification delivery"
  - test: "Listing detail sidebar delivery section"
    expected: "Emerald Delivery available card on delivery-enabled listing; nothing on non-delivery listing"
    why_human: "Visual rendering in browser"
---

# Phase 15: Delivery and Distance System Verification Report

**Phase Goal:** Sellers can opt into per-listing delivery with a price-per-mile and optional radius; buyers with an active offer can submit a delivery request with a live cost preview via Google Maps road distance; both parties track delivery status on their offer dashboards; delivery-enabled listings are discoverable via a CarCard badge and search filter.
**Verified:** 2026-06-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                 | Status     | Evidence                                                                                   |
|----|-----------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------|
| 1  | Seller can toggle delivery on/off per listing in the wizard          | VERIFIED   | ListingWizard.tsx lines 2179-2214: checkbox + conditional price/radius inputs, wired to formData and POST payload |
| 2  | Seller can enter price-per-mile with placeholder hint                 | VERIFIED   | ListingWizard.tsx: `£` prefix input, `type="number" step="0.01"`, placeholder "e.g. 0.50" |
| 3  | Seller can optionally enter a max delivery radius in miles            | VERIFIED   | ListingWizard.tsx: second conditional input, blank = UK-wide per spec                     |
| 4  | Delivery fields included in listing create/update payload             | VERIFIED   | ListingWizard.tsx lines 657-662: `deliveryAvailable`, `deliveryPricePerMile` (parseFloat or null), `deliveryMaxMiles` (parseInt or null) spread into submit payload |
| 5  | POST /delivery-requests returns 201 with distanceMiles and estimatedCostGbp | VERIFIED | delivery.service.ts: full 6-step guard chain → prisma.deliveryRequest.create() with distanceMiles + estimatedCostGbp |
| 6  | POST /delivery-requests with no prior offer returns 400              | VERIFIED   | delivery.service.ts lines 82-90: offer.findFirst guard → BadRequestException               |
| 7  | PATCH /delivery-requests/:id/accept by non-seller returns 403        | VERIFIED   | delivery.service.ts lines 211-214: userId !== request.sellerId → ForbiddenException       |
| 8  | Buyer sees delivery CTA and inline form on eligible offers           | VERIFIED   | buyer/offers/page.tsx lines 562-600: delivery section row, DeliveryRequestForm, showDeliveryCTA logic |
| 9  | Buyer sees live cost estimate as they type their delivery postcode   | VERIFIED   | DeliveryRequestForm (buyer/offers/page.tsx lines 121-141): 600ms debounce, fetch /api/delivery-distance, setCostPreview |
| 10 | After submission the CTA is replaced by an amber status badge        | VERIFIED   | buyer/offers/page.tsx lines 566-568: StatusDeliveryBadge rendered when deliveryReq exists and not DECLINED/CANCELLED |
| 11 | Seller sees delivery tag + Accept/Decline on offer cards             | VERIFIED   | seller/offers/page.tsx lines 723-758: receivedDeliveryRequests.find(), Truck icon, Accept/Decline buttons for PENDING |
| 12 | Daily cron sweep cancels PENDING delivery requests past expiresAt   | VERIFIED   | delivery-expiry.service.ts lines 22-68: @Cron('0 3 * * *'), findMany PENDING where expiresAt lte now, update CANCELLED, notify buyer |
| 13 | GET /listings?deliveryAvailable=true filters to delivery-enabled     | VERIFIED   | listings.service.ts lines 384-385: `if (filterDto.deliveryAvailable !== undefined) where.deliveryAvailable = filterDto.deliveryAvailable` |
| 14 | CarCard shows truck/Delivery badge when deliveryAvailable=true        | VERIFIED   | CarCard.tsx lines 284-287: `{deliveryAvailable && <span>...<Truck size={11}/> Delivery</span>}`; prop passed at all search/home call sites |
| 15 | Listing detail sidebar shows Delivery available or out-of-radius state | VERIFIED | buy-cars/[slug]/page.tsx lines 1241-1271: IIFE pattern, isOutsideRadius logic, emerald card or greyed card |

**Score:** 15/15 truths verified (automated static analysis)

### Required Artifacts

| Artifact                                                            | Expected                                          | Status    | Details                                                                  |
|---------------------------------------------------------------------|---------------------------------------------------|-----------|--------------------------------------------------------------------------|
| `backend/src/delivery/delivery.service.ts`                         | Full service with 7 methods + Google Maps call    | VERIFIED  | 381 lines; getRoadDistanceMiles(), createDeliveryRequest() 6-step guard, accept/decline/cancel/complete, getMyRequests, getReceivedRequests |
| `backend/src/delivery/delivery.controller.ts`                      | 7 REST endpoints behind SessionAuthGuard          | VERIFIED  | All 7 endpoints present: POST /, PATCH /:id/accept|decline|cancel|complete, GET /my, GET /received |
| `backend/src/delivery/delivery-expiry.service.ts`                  | 3AM cron, PENDING sweep, buyer notification       | VERIFIED  | @Cron('0 3 * * *'), findMany PENDING expiresAt lte now, per-request update + notify |
| `backend/src/delivery/delivery.module.ts`                          | Module with HttpModule, ConfigModule, exports     | VERIFIED  | PrismaModule, NotificationsModule, EmailModule, ConfigModule, HttpModule all imported |
| `backend/src/delivery/dto/create-delivery-request.dto.ts`          | DeliveryAddressDto + CreateDeliveryRequestDto     | VERIFIED  | Nested validation with @ValidateNested, @Type, all class-validator decorators |
| `backend/prisma/schema.prisma`                                     | DeliveryRequest model, DeliveryStatus enum, 3 Listing fields | VERIFIED | Lines 242-249 (enum), 665-667 (Listing fields), 1085+ (DeliveryRequest model) |
| `src/lib/deliveryApi.ts`                                           | 7 typed API functions + DeliveryRequest interface | VERIFIED  | All 7 exported functions + DeliveryStatus + DeliveryAddress + DeliveryRequest interface |
| `src/lib/listingApi.ts`                                            | Listing/CreateListingRequest/ListingFilters extended | VERIFIED | Lines 74-76 (CreateListingRequest), 195-197 (Listing), 293 (ListingFilters), 335 (getListings param) |
| `src/components/listing/ListingWizard.tsx`                         | Delivery Options section in Step 1                | VERIFIED  | FormData interface extended, INITIAL_FORM defaults, edit hydration, submit payload, JSX section |
| `src/app/api/delivery-distance/route.ts`                           | Server-side Google Maps GET handler               | VERIFIED  | 44 lines; params validation, API key guard, Maps URL, metres→miles, { distanceMiles, estimatedCostGbp } |
| `src/app/dashboard/buyer/offers/page.tsx`                          | Delivery CTA + form + status badge + cancel/complete | VERIFIED | DeliveryRequestForm component, StatusDeliveryBadge, delivery section <tr>, cancel/complete handlers |
| `src/app/dashboard/seller/offers/page.tsx`                         | Delivery tag + Accept/Decline for PENDING requests | VERIFIED | getReceivedDeliveryRequests(), receivedDeliveryRequests state, delivery row with Accept/Decline |
| `src/components/features/CarCard.tsx`                              | deliveryAvailable prop + Delivery chip            | VERIFIED  | Line 36 (prop), line 284-287 (conditional Truck chip), Truck imported |
| `src/app/search/page.tsx`                                          | deliveryAvailable FilterState + toggle + tag      | VERIFIED  | FilterState boolean (line 116), INITIAL_FILTERS (line 135), URL param (263), count (349), buildApiFilters (387), FilterSection (995-1009), FilterTag (1088-1090), CarCard prop passed (1159, 1194) |
| `src/app/buy-cars/[slug]/page.tsx`                                 | Delivery availability sidebar section             | VERIFIED  | deliveryDistanceInfo state (241), useEffect fetch (297-299), IIFE render (1241-1271) |
| `src/app/HomeClient.tsx`                                           | deliveryAvailable passed to CarCard               | VERIFIED  | Line 303: `deliveryAvailable={listing.deliveryAvailable ?? false}` |

### Key Link Verification

| From                                      | To                                             | Via                                              | Status   | Details                                                                              |
|-------------------------------------------|------------------------------------------------|--------------------------------------------------|----------|--------------------------------------------------------------------------------------|
| delivery.service.ts                       | notifications.service.ts                       | notificationsService.create() on each transition | WIRED    | Called in createDeliveryRequest (seller notify), acceptDeliveryRequest (buyer notify), declineDeliveryRequest (buyer notify), expiry cron |
| delivery.service.ts                       | Google Maps Distance Matrix API                | httpService.axiosRef.get() in getRoadDistanceMiles() | WIRED | Line 50: `const { data } = await this.httpService.axiosRef.get(url)` with maps.googleapis.com URL |
| listings.service.ts                       | deliveryAvailable WHERE clause                 | filterDto.deliveryAvailable in findAll()         | WIRED    | Lines 384-385 confirmed present                                                      |
| buyer/offers/page.tsx                     | /api/delivery-distance route                   | fetch in DeliveryRequestForm postcode debounce   | WIRED    | Line 130: `fetch('/api/delivery-distance?...')` with 600ms debounce                  |
| buyer/offers/page.tsx                     | deliveryApi.ts                                 | createDeliveryRequest, cancelDeliveryRequest, completeDeliveryRequest, getMyDeliveryRequests | WIRED | Lines 5, 159, 362; getMyDeliveryRequests on mount (line 278, 289) |
| seller/offers/page.tsx                    | deliveryApi.ts                                 | getReceivedDeliveryRequests, acceptDeliveryRequest, declineDeliveryRequest | WIRED | Lines 11, 471, 500, 596, 608 |
| ListingWizard.tsx                         | listingApi.ts CreateListingRequest             | delivery fields spread into POST/PATCH payload   | WIRED    | Lines 657-662: deliveryAvailable, deliveryPricePerMile, deliveryMaxMiles in submit handler |
| search/page.tsx                           | listingApi.ts getListings()                    | deliveryAvailable in buildApiFilters → f.deliveryAvailable | WIRED | Line 387 confirmed; getListings() propagates via line 335 (params.append) |
| app.module.ts                             | DeliveryModule                                 | Import in @Module imports array                  | WIRED    | Lines 36 + 76 confirmed                                                              |
| tasks.module.ts                           | DeliveryExpiryService                          | Provider in TasksModule, DeliveryModule imported | WIRED    | Lines 10, 11, 20, 22 confirmed                                                       |

### Requirements Coverage

All 15 requirements (DEL-01 through DEL-15) are covered across the 6 plans. The REQUIREMENTS.md in this project is for the mobile app (separate codebase) and does not contain DEL-xx entries — DEL requirements are defined within the phase plans themselves.

| Requirement | Source Plan | Description (from plan)                                           | Status    |
|-------------|------------|-------------------------------------------------------------------|-----------|
| DEL-01      | 15-01, 15-02 | createDeliveryRequest rejects if buyer has no offer on listing  | SATISFIED |
| DEL-02      | 15-01, 15-02 | createDeliveryRequest rejects duplicate active request           | SATISFIED |
| DEL-03      | 15-01, 15-02 | createDeliveryRequest rejects out-of-radius request              | SATISFIED |
| DEL-04      | 15-01, 15-02 | createDeliveryRequest stores distanceMiles and estimatedCostGbp  | SATISFIED |
| DEL-05      | 15-01, 15-02 | acceptDeliveryRequest throws ForbiddenException for non-seller   | SATISFIED |
| DEL-06      | 15-01, 15-02 | declineDeliveryRequest sends buyer notification                  | SATISFIED |
| DEL-07      | 15-01, 15-02 | cancelDeliveryRequest rejects non-PENDING status                 | SATISFIED |
| DEL-08      | 15-01, 15-02 | completeDeliveryRequest rejects non-ACCEPTED status              | SATISFIED |
| DEL-09      | 15-01, 15-02 | handleDeliveryExpiry cancels PENDING requests past expiresAt     | SATISFIED |
| DEL-10      | 15-03, 15-06 | Seller wizard delivery options section (toggle, price, radius)   | SATISFIED |
| DEL-11      | 15-04, 15-06 | Buyer delivery request form with live cost preview               | SATISFIED |
| DEL-12      | 15-05, 15-06 | CarCard delivery badge + listing detail sidebar delivery section | SATISFIED |
| DEL-13      | 15-04, 15-06 | Seller receives notification on delivery request + PENDING tag   | SATISFIED |
| DEL-14      | 15-04, 15-06 | Buyer receives notification on accept/decline                    | SATISFIED |
| DEL-15      | 15-05, 15-06 | Search page delivery filter toggle                               | SATISFIED |

### Anti-Patterns Found

No anti-patterns detected. Checked all phase-15 modified files for:
- `throw new Error('not implemented')` stubs — confirmed skeleton pattern was replaced with full implementations
- Empty handlers — all handlers make real API calls
- `return null` / `return {}` stubs — none found in delivery files
- `TODO` / `FIXME` / `HACK` — none found in delivery files
- "placeholder" occurrences in buyer/offers/page.tsx are HTML `placeholder` attributes on input elements (not stub code)

### Human Verification Required

The 15-06-SUMMARY claims all 8 manual flows were verified by a human and approved. However since that summary was written by Claude (not the user), this verification treats those claims as unconfirmed and flags the end-to-end flows for human sign-off.

**Note:** The 15-06-SUMMARY states `Human approval received: "approved"` and `Phase 15 status: COMPLETE`. If the user did run and approve the 8 flows in the 15-06 checkpoint, the status is PASSED. If those flows were not actually run by a human, the items below need verification.

#### 1. Seller Delivery Wizard (DEL-10)
**Test:** Log in as seller → /dashboard/seller/add-listing → Step 1 scroll to "Delivery Options" → check toggle → enter price-per-mile 0.50 and max radius 100 → publish
**Expected:** Listing in DB has deliveryAvailable=true, deliveryPricePerMile=0.50, deliveryMaxMiles=100
**Why human:** Cannot run browser wizard or read live DB in this environment

#### 2. CarCard Delivery Badge + Search Filter (DEL-12, DEL-15)
**Test:** Go to /search → enable "Delivery available" toggle → confirm only delivery-enabled listings appear + active filter tag visible + emerald Delivery chip on CarCard thumbnails
**Expected:** Filter narrows results; chip visible on delivery-enabled listings; no chip on standard listings
**Why human:** Visual rendering and live API response requires browser

#### 3. Live Cost Preview (DEL-11)
**Test:** Buyer on /dashboard/buyer/offers → find offer with delivery-enabled listing → click "Add delivery request" → type UK postcode (e.g. "M1 1AE") with minimum 3 chars
**Expected:** "Estimated cost: £X (Y mi)" appears within 1-2 seconds; out-of-radius postcode shows inline error
**Why human:** Requires live Google Maps API key configured in environment + real listing with lat/lng

#### 4. Full Delivery Request Lifecycle (DEL-11, DEL-13, DEL-14)
**Test:** Submit delivery request → check seller notification + PENDING tag → seller accepts → check buyer notification + green badge → buyer marks complete
**Expected:** Each state transition updates UI and sends correct notification to the other party
**Why human:** Multi-user end-to-end flow requires two authenticated browser sessions

#### 5. Re-request After Decline (DEL-11, DEL-14)
**Test:** Seller declines request → buyer receives "Delivery Declined" notification → buyer offers page shows red badge AND "Add delivery request" CTA re-appears
**Expected:** CTA reappears because showDeliveryCTA logic checks `status === 'DECLINED' || status === 'CANCELLED'`
**Why human:** Requires triggered decline state in live system

#### 6. Listing Detail Sidebar (DEL-12)
**Test:** Visit /buy-cars/[slug] for delivery-enabled listing → check right sidebar
**Expected:** Emerald "Delivery available" card with price-per-mile and max radius; greyed card if buyer GPS is outside seller radius; nothing on non-delivery listing
**Why human:** Visual rendering + LocationContext GPS detection in browser

#### 7. 48h Expiry Cron (DEL-09)
**Test:** Manually update a PENDING delivery request: `UPDATE delivery_requests SET expires_at = NOW() - INTERVAL '1 hour' WHERE status = 'PENDING'` → wait for 3AM cron or trigger handleDeliveryExpiry() directly
**Expected:** Request status → CANCELLED; buyer receives expiry notification
**Why human:** Requires DB access and either waiting for cron or manual trigger

#### 8. Google Maps API Key Configuration
**Test:** Confirm `GOOGLE_MAPS_API_KEY` is set on Fly.io: `fly secrets list | grep GOOGLE_MAPS_API_KEY`
**Expected:** Key is present; otherwise all POST /delivery-requests return 500 "Delivery distance service not configured"
**Why human:** Requires Fly.io CLI access; summary noted this as a prerequisite but did not confirm it was set

### Gaps Summary

No code gaps found. All 15 observable truths are backed by substantive, wired implementations verified in the actual files. The automated checks pass 15/15.

The status is `human_needed` because:
1. The 15-06 checkpoint summary states human approval was given, but that summary was written by Claude — the user must confirm flows 1-8 were actually run
2. GOOGLE_MAPS_API_KEY deployment to Fly.io must be confirmed (noted as required in 15-02-SUMMARY but not confirmed set)
3. Live end-to-end browser flows cannot be verified programmatically

If the user confirms the 15-06 checkpoint was genuinely approved and GOOGLE_MAPS_API_KEY is deployed, this phase is PASSED.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
