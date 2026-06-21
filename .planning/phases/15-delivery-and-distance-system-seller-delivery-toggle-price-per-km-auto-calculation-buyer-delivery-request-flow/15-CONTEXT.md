# Phase 15: Delivery and Distance System - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Sellers can opt into offering delivery on a per-listing basis (toggle + price-per-mile + optional max radius). When a buyer who has already made an offer on a listing wants delivery, they submit a delivery request (full address + notes) inline within the offer thread. The system auto-calculates road distance via Google Maps Distance Matrix API and shows an estimated cost to the buyer before they confirm. The seller has 48h to accept or decline. Both parties coordinate via the existing chat thread after acceptance. Status is tracked on the offer card in both dashboards. No payments collected by the platform — cost figure is informational only.

</domain>

<decisions>
## Implementation Decisions

### Seller Delivery Setup
- **Scope:** Per-listing setting — each listing individually has delivery toggle, price-per-mile, and optional radius
- **Price structure:** Price-per-mile only (UK convention). Free-entry field with placeholder hint `e.g. £0.50 / mile`; no enforced minimum
- **Radius:** Optional max delivery radius (miles). If blank, seller delivers anywhere in the UK
- **Unit:** Price per mile (not per km — more intuitive for UK sellers; roadmap says "price-per-km" but user confirmed miles)
- **Config location:** Dedicated "Delivery Options" section/step in the add-listing wizard. Also editable when editing an existing listing
- **Out-of-radius UX:** Greyed-out sidebar section with "Delivery not available to your location" — not hidden entirely
- **Radius check:** Runs against the buyer's requested delivery address (entered at request time), NOT against their LocationContext GPS. Buyers outside their GPS radius can still request if their delivery address is within range

### Delivery Visibility (Buyer-Facing)
- **CarCard badge:** Yes — a "Delivery available" / truck icon chip on CarCard and in search results for listings with delivery enabled
- **Search filter:** Yes — "Delivery available" toggle in the search/browse filter panel
- **Sidebar cost preview:** No live cost preview before requesting. Sidebar shows "Delivery available" only. Cost is revealed on the delivery request form at request time

### Price Auto-Calculation
- **Distance method:** Real road distance via Google Maps Distance Matrix API (`GOOGLE_MAPS_API_KEY` env var required on backend)
- **Payment model:** Informational only — no payments collected by CarMazium. The estimated cost is a reference figure; buyer and seller settle directly (same as vehicle price)
- **When shown:** Live preview on the delivery request form itself — buyer enters their delivery postcode/address, sees "Estimated delivery cost: £X" calculated in real-time before confirming the request
- **Rounding:** Rounded to nearest pound (e.g. £67.30 → £67)
- **Storage:** Distance (miles) and estimated cost (£) stored permanently on the `DeliveryRequest` record at submission time. Cost does not change retroactively if seller updates their rate

### Buyer Delivery Request Flow
- **Prerequisite:** Buyer must have at least one offer on the listing (any status: PENDING, ACCEPTED, COUNTERED, DECLINED, WITHDRAWN). No offer = no delivery CTA shown
- **Entry point:** Inline within the offer thread/conversation — "Add delivery request" action appears in the offer card/thread, not as a standalone sidebar CTA
- **Request form fields:** Full address (street, city, postcode) + optional delivery notes (e.g. availability for handover)
- **Concurrent requests:** Unlimited — buyer can have delivery requests open on multiple listings simultaneously
- **Seller response window:** 48 hours to Accept or Decline
- **Re-requests:** Allowed — buyer can re-request after a decline or 48h expiry
- **Buyer cancellation:** Buyer can cancel a pending delivery request before the seller responds
- **Listing deactivated:** If listing is sold/archived while a delivery request is pending, request auto-cancels with buyer notification
- **Post-submit UI:** Status badge replaces the "Add delivery request" action on the offer card — "Delivery Requested · Awaiting confirmation". On seller accept: "Delivery Confirmed". On seller decline: action reappears (buyer can re-request)

### Notifications
- **Seller (on new delivery request):** In-app notification + email — "A buyer has requested delivery of your [Make Model] to [Postcode]. Estimated cost: £X. Accept or decline in your dashboard within 48 hours."
- **Buyer (on seller accept):** In-app + email — "Your delivery request for [Car] has been accepted! Coordinate the handover via chat."
- **Buyer (on seller decline):** In-app + email — "Your delivery request for [Car] was declined. You can re-request or contact the seller directly."
- **Buyer (48h expiry):** In-app + email — "Your delivery request for [Car] expired — the seller did not respond in time. You can re-request." Seller is NOT notified on expiry.

### Delivery Status & Lifecycle
- **States:** `PENDING` → `ACCEPTED` / `DECLINED` → `COMPLETED`
- **COMPLETED:** Buyer manually clicks "Mark as received" in their dashboard after the car is delivered
- **Post-accept coordination:** Existing chat thread between buyer and seller handles all logistics (date, time, etc.). No new scheduling system
- **Seller dashboard:** Delivery status tag on the offer card in the seller's offers/pipeline section — "Delivery: Pending / Accepted / Completed". No separate Deliveries nav section
- **Buyer dashboard:** Same — delivery status folded into the existing Offers section as a tag on the offer card. No separate Deliveries nav

### Claude's Discretion
- Exact Prisma schema field names for `DeliveryRequest` model
- Whether to lazy-check 48h expiry on load or via a cron job
- Google Maps Distance Matrix API call: whether to call from backend (server-side) or Next.js API route
- Animation / transition for out-of-radius greyed state

</decisions>

<specifics>
## Specific Ideas

- Delivery request form: live cost calculation as buyer types their postcode — feels responsive and transparent
- Offer card delivery tag: small `Truck` Lucide icon + status text inline on the offer card — minimal, doesn't overwhelm the offer price/status
- CarCard delivery chip: same style as existing fuel/mileage chips (small rounded pill) — truck icon + "Delivery" text

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/context/LocationContext.tsx` — Phase 11 built buyer geo context (browser GPS + postcode fallback, localStorage cache). Useful for pre-populating the delivery address postcode field
- `src/components/features/CarCard.tsx` — `distanceMi?: number | null` prop already defined; chip renders if provided. Add `deliveryAvailable?: boolean` prop for delivery badge alongside existing chips
- `backend/prisma/schema.prisma` — `Listing` model has `latitude Float?` / `longitude Float?` — seller location for distance origin. No delivery fields exist yet — need new schema additions
- `src/app/dashboard/buyer/offers/page.tsx` — Offers list with status badges; delivery tag and "Add delivery request" action will be added inline here
- `src/app/dashboard/seller/purchases/page.tsx` — Has `delivery_requested` pipeline status already (for a different flow); check for reuse opportunity
- `backend/src/notifications/notifications.service.ts` — Existing notification service for in-app + email; delivery notifications follow the same pattern as offer notifications

### Established Patterns
- Notification pattern: `NotificationsService.create()` for in-app + `EmailService.send()` for email — used in offers, KYC, BIN (Phase 12)
- Status badge style: `CzBadge` component + `inline-flex` pill pattern consistent across dashboard cards
- Offer thread: `chatApi.ts` + `createChatRoom()` — delivery accept auto-opens or joins existing chat room for that listing/buyer pair
- Phase 11 distance calc: Haversine formula used for display distance. Phase 15 uses Google Maps Distance Matrix API for road distance (more accurate for delivery pricing)
- API key pattern: env var on backend (`STRIPE_SECRET_KEY` → `GOOGLE_MAPS_API_KEY`); never exposed to frontend

### Integration Points
- New `DeliveryRequest` Prisma model: `listingId`, `buyerId`, `sellerId`, `offerId` (FK to offer), `deliveryAddress` (JSON: street/city/postcode), `deliveryNotes String?`, `distanceMiles Float`, `estimatedCostGbp Decimal`, `status DeliveryStatus enum`, `expiresAt DateTime`, `acceptedAt DateTime?`, `declinedAt DateTime?`, `completedAt DateTime?`
- New `Listing` fields: `deliveryAvailable Boolean @default(false)`, `deliveryPricePerMile Decimal?`, `deliveryMaxMiles Int?`
- New backend endpoint: `POST /listings/:id/delivery-request` (create), `PATCH /listings/:id/delivery-request/:reqId/accept`, `/decline`, `/cancel`, `/complete`
- Google Maps Distance Matrix: backend service call on delivery request submission — `https://maps.googleapis.com/maps/api/distancematrix/json?origins=LAT,LNG&destinations=POSTCODE&key=...`
- Add-listing wizard: new delivery section added to `src/app/dashboard/seller/add-listing/page.tsx`
- Search page filters: extend filter state with `deliveryAvailable?: boolean`

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase 15 scope

</deferred>

---

*Phase: 15-delivery-and-distance-system*
*Context gathered: 2026-06-21*
