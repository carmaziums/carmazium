# CarMazium Feature & Flow Audit

**Generated:** 2026-06-27 (updated from 2026-06-14 baseline)  
**Auditor:** Senior Technical Audit (Claude Sonnet 4.6)  
**Scope:** Full-stack codebase — Next.js 14 frontend (`D:\carmazium\src\`) + NestJS backend (`D:\carmazium\backend\src\`)  
**Delta note:** Sections marked `[NEW]` were added or substantially expanded in this update.

**Addendum added 2026-08-05:** Sections 8 and 9 below are a later pass — a mobile app inventory (never covered by the original audit) and a line-by-line comparison against the client's signed quotation, for a scope/billing discussion. Sections 1–7 above are the original 2026-06-27 web-only audit and have **not** been re-verified line-by-line against the current codebase; ~222 commits have landed since (see §9.1), so some details in the web sections may be stale. Section 9 accounts for the drift at a feature level rather than re-auditing every route/endpoint.

**Addendum added 2026-08-10:** Section 10 is a mobile-parity-focused punch list of backend/web changes from 2026-07-27 through today, written as development shifts toward the mobile app. Not a re-audit — see §10.5.

---

## Table of Contents

1. [Route Inventory](#section-1-route-inventory)
2. [Backend API Endpoints](#section-2-backend-api-endpoints)
3. [Feature Inventory](#section-3-feature-inventory)
4. [User Flows](#section-4-user-flows)
5. [Data Models](#section-5-data-models)
6. [Integrations & External Services](#section-6-integrations--external-services)
7. [Known Gaps, Stubs & Issues](#section-7-known-gaps-stubs--issues)
8. [Mobile App Feature Inventory (2026-08-05)](#section-8-mobile-app-feature-inventory)
9. [Quotation Scope Comparison (2026-08-05)](#section-9-quotation-scope-comparison)
10. [Recent Backend & Platform Additions (2026-08-10)](#section-10-recent-backend--platform-additions)

---

## SECTION 1: Route Inventory

All routes discovered in `D:\carmazium\src\app\`.

### Public / Marketing Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/` | Public | Home page — featured listings, hero, email capture, AI search entry, MaziumWidget floating chat | `HomeClient.tsx`, featured listings ISR-fetched (revalidate 300s) |
| `/about` | Public | About CarMazium static page | Layout wrapper |
| `/how-it-works` | Public | How it works static page | Layout wrapper |
| `/pricing` | Public | Pricing tiers static page | Layout wrapper |
| `/sell` | Public | Sell your car landing page | Layout wrapper |
| `/finance` | Public | Finance partner info page | Layout wrapper |
| `/services` | Public | Service providers info page | Layout wrapper |
| `/reviews` | Public | Reviews/testimonials page | Layout wrapper |
| `/contact` | Public | Contact form page | Layout wrapper |
| `/terms` | Public | Terms and conditions | — |
| `/compare` | Public | Vehicle comparison tool — up to 3 cars side-by-side | `getListings`, `getListingBySlug`, framer-motion |

### Vehicle Discovery Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/search` | Public | Search & browse listings with filters — 20+ filter dimensions including delivery, features multi-select, dual-range sliders | `DualRangeSlider`, `BODY_TYPE_ICONS`, `CAR_MAKES`, `getModelsForMake`, `LocationContext` |
| `/buy-cars/[slug]` | Public | Full listing detail — gallery, 3D damage viewer, specs, finance calculator, HPI modal, offer modal, delivery badge, BIN button | `ThreeDVehicleViewer`, `FinanceCalculator`, `HpiReportModal`, `OfferModal`, `LocationContext` |
| `/vehicle/[id]` | Public | **[NEW]** Alternative listing detail route by ID (slug-less). Same feature set as `/buy-cars/[slug]` plus `EnquireModal` component | `EnquireModal`, `ChatContext` |
| `/seller/[id]` | Public | Public seller profile — stats, listings, reviews | `SellersService.getPublicProfile` |

### Auction Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/auctions` | Public | Auction listings browse (live + scheduled) | Layout wrapper |
| `/auctions/live/[id]` | Public (bid requires auth) | Full real-time auction room — live bid feed, countdown, anti-snipe, BIN button, seller accept-bid, cancel-bid window, winner banner, 3D vehicle viewer, damage records | Socket.io `/auctions`, `CountdownTimer`, `ThreeDVehicleViewer`, BIN state machine |

### Auth Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/auth/login` | Public | Email + password login via Supabase | Calls `POST /auth/supabase-session` |
| `/auth/signup` | Public | Registration form | Stashes `pending_verification_email` in sessionStorage |
| `/auth/onboarding` | Post-signup | Email verify → location → preferences multi-step onboarding | Supabase `email_confirmed_at` check; `updateProfile` |
| `/auth/callback` | Post-email-verify | Supabase OAuth callback handler | Redirects to `/auth/onboarding` |
| `/auth/forgot-password` | Public | Password reset request | Supabase |
| `/auth/reset-password` | Logged-in | New password form | `POST /auth/reset-password` |
| `/auth/partners` | Public | Partner signup/info page | — |
| `/auth/accept-invite` | Public | Dealer staff invite acceptance (token in URL) | `POST /dealers/invites/accept` |

### Checkout Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/checkout` | Logged-in | Checkout page — deposit (£500), full payment, or auction buyer fee (£125) | `createCheckoutSession`, query params `listing_id` + `mode` |
| `/checkout/success` | Logged-in | Stripe checkout success redirect | Reads `session_id` from query |
| `/checkout/cancel` | Logged-in | Stripe checkout cancel redirect | Reads `listing_id` from query |

### Dashboard — Shared

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard` | Logged-in | Role-router: redirects to appropriate dashboard | `DashboardSidebar` |
| `/dashboard/user` | Logged-in | Generic user dashboard page (unreachable — see Section 7 Issue 12) | — |

### Dashboard — Seller

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/seller` | Seller | Seller overview with KPI stats | `getSellerStats`, `DashboardSidebar` |
| `/dashboard/seller/listings` | Seller | My listings table with status management + Import from URL button + Bulk CSV import button | `ListingWizard`, `ImportListingModal`, `BulkImportModal` |
| `/dashboard/seller/add-listing` | Seller | Multi-step listing wizard | `ListingWizard` component |
| `/dashboard/seller/auctions` | Seller | Seller's auction list with management, handover proof upload | `GET /auctions/my/list` |
| `/dashboard/seller/offers` | Seller | Received offers — accept/reject/counter | `GET /offers/received` |
| `/dashboard/seller/messages` | Seller | Chat rooms | Chat WebSocket |
| `/dashboard/seller/earnings` | Seller | Sales history, revenue, CSV export | `GET /listings/earnings`, `GET /listings/earnings/export` |
| `/dashboard/seller/performance` | Seller | Analytics: revenue chart, views, conversion | `GET /listings/performance` |
| `/dashboard/seller/settings` | Seller | Profile, Stripe Connect onboarding, bank details fallback | `POST /users/stripe-connect/onboard`, `PATCH /users/me/bank-details` |

### Dashboard — Buyer

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/buyer` | Buyer | Buyer overview — bids, watchlist, offers | `GET /dashboard/buyer` |
| `/dashboard/buyer/bids` | Buyer | My bids table with auction status and chat links | `GET /bids/my` |
| `/dashboard/buyer/watchlist` | Buyer | Saved listings | `GET /watchlist` |
| `/dashboard/buyer/offers` | Buyer | Buyer's submitted offers + counter-offer response | `GET /offers/my` |
| `/dashboard/buyer/messages` | Buyer | Chat rooms | Chat WebSocket |
| `/dashboard/buyer/history` | Buyer | Purchase history | — |
| `/dashboard/buyer/settings` | Buyer | Profile settings | `PATCH /users/me` |

### Dashboard — Dealer

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/dealer` | Dealer | Dealer overview KPIs + recent leads | `GET /dealers/stats`, `GET /dealers/leads` |
| `/dashboard/dealer/inventory` | Dealer | Full inventory list + Import from URL + Bulk CSV import | `ImportListingModal`, `BulkImportModal` |
| `/dashboard/dealer/add-listing` | Dealer | Listing wizard (same as seller) | `ListingWizard` |
| `/dashboard/dealer/auctions` | Dealer | Dealer's auctions | `GET /auctions/my/list` |
| `/dashboard/dealer/analytics` | Dealer | Revenue, leads funnel, offer donut, inventory aging charts | `GET /dealers/analytics` with date range |
| `/dashboard/dealer/crm` | Dealer | Kanban CRM board — 6 pipeline stages | `GET /dealers/leads`, drag-based status updates |
| `/dashboard/dealer/offers` | Dealer | Received offers across all listings | `GET /offers/received` |
| `/dashboard/dealer/my-offers` | Dealer | Offers submitted by dealer as buyer | `GET /offers/my` |
| `/dashboard/dealer/messages` | Dealer | Chat rooms | Chat WebSocket |
| `/dashboard/dealer/purchases` | Dealer | Vehicles purchased by this dealer | `GET /dealers/purchases` |
| `/dashboard/dealer/earnings` | Dealer | Earnings/revenue | `GET /listings/earnings` |
| `/dashboard/dealer/finance` | Dealer | Finance applications (dealer as buyer requesting finance) | `GET /finance/my` |
| `/dashboard/dealer/team` | Dealer | Staff management — invite, roles, deactivate | `GET /dealers/staff`, `POST /dealers/staff` |
| `/dashboard/dealer/settings` | Dealer | Dealer profile + KYC submission | `PATCH /users/dealer-profile`, `POST /dealers/kyc` |

### Dashboard — Admin

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/admin` | Admin | Platform stats overview | `GET /admin/stats` |
| `/dashboard/admin/analytics` | Admin | Monthly users/listings/revenue bar charts (6 months) | `GET /admin/analytics` |
| `/dashboard/admin/users` | Admin | User management — role, ban, lock, payout method column | `GET /admin/users`, `PATCH /admin/users/:id/*` |
| `/dashboard/admin/listings` | Admin | All listings including drafts/deleted | `GET /admin/listings` |
| `/dashboard/admin/auctions` | Admin | All auctions overview | `GET /admin/auctions` |
| `/dashboard/admin/handovers` | Admin | Pending handover proofs — approve/deny with payout logic | `GET /admin/handovers/pending`, `POST /admin/handovers/:id/approve` |
| `/dashboard/admin/transactions` | Admin | All platform transactions | `GET /admin/transactions` |
| `/dashboard/admin/dealer-verification` | Admin | Dealer KYC field-by-field review UI | `GET /admin/dealers/kyc-pending`, `PATCH /admin/dealers/kyc/:id/review` |
| `/admin/analytics` | Admin | **[NEW — separate route]** Same analytics as dashboard variant | Discovered in file tree |

### Dashboard — Finance Partner

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/finance` | Finance Partner | Finance applications dashboard — approve/reject | `GET /finance/partner` |
| `/dashboard/finance/applications` | Finance Partner | Applications list | — |
| `/dashboard/finance/messages` | Finance Partner | Chat rooms | — |
| `/dashboard/finance/settings` | Finance Partner | Profile settings | — |

### Dashboard — Insurance Partner

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/insurance` | Insurance Partner | Insurance quotes dashboard — quote/approve/reject | `GET /insurance/partner` |
| `/dashboard/insurance/quotes` | Insurance Partner | Quotes list | — |
| `/dashboard/insurance/messages` | Insurance Partner | Chat rooms | — |
| `/dashboard/insurance/settings` | Insurance Partner | Profile settings | — |

### Dashboard — Contractor / Service Provider

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/service` | Contractor | Service jobs dashboard — pending/active/completed | `GET /service-requests/contractor` |
| `/dashboard/service/jobs` | Contractor | Jobs list | `GET /service-requests/contractor` |
| `/dashboard/service/messages` | Contractor | Chat rooms | — |
| `/dashboard/service/settings` | Contractor | Profile settings | — |

### Profile

| URL Path | Auth | What It Renders |
|---|---|---|
| `/profile` | Logged-in | Current user's own profile page |

### Next.js API Routes

| URL Path | Method | Auth | Description |
|---|---|---|---|
| `/api/delivery-distance` | GET | None | **[NEW]** Google Maps Distance Matrix proxy — calculates distance in miles between listing lat/lng and buyer postcode |

---

## SECTION 2: Backend API Endpoints

Base URL: `https://carmazium-hjoh9w.fly.dev` (production). Swagger at `/api`.

### Auth Module — `POST/GET /auth/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/auth/register` | None | Register new user + auto-login session | Body: `{email, password, firstName, lastName}` → sets `req.session.userId` |
| POST | `/auth/login` | None | Email+password login → set session cookie | Body: `{email, password}` → `{success, data: user}` |
| POST | `/auth/logout` | None | Destroy session, clear `sid` cookie | → `{success: true}` |
| GET | `/auth/me` | SessionAuthGuard | Get current user from session | → `{success, data: user}` |
| POST | `/auth/supabase-session` | None | Accept Supabase JWT → create backend session (primary auth bridge) | Body: `{token}` → sets session, returns user |
| POST | `/auth/reset-password` | SessionAuthGuard | Reset password for authenticated user | Body: `{currentPassword, newPassword}` |
| POST | `/auth/send-verification` | None | Send/resend email verification via Resend | Body: `{email, redirectTo}` |

### Users Module — `GET/PATCH/POST /users/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| GET | `/users/me` | SessionAuthGuard | Get full user profile | → user object |
| PATCH | `/users/me` | SessionAuthGuard | Update profile fields (name, phone, image, location, preferences) | Body: partial user fields |
| POST | `/users/elevate` | SessionAuthGuard | Request role change (e.g. BUYER → SELLER) | Body: `{newRole}` |
| PATCH | `/users/dealer-profile` | SessionAuthGuard | Update DealerProfile fields (companyName, etc.) | Body: dealer fields |
| POST | `/users/me/address-verification/start` | SessionAuthGuard | Start address verification — sends OTP email | Body: `{address}` |
| POST | `/users/me/address-verification/confirm` | SessionAuthGuard | Confirm address with OTP code | Body: `{code}` |
| POST | `/users/sync` | None | Sync/upsert user from Supabase (used by frontend on login) | Body: `{email, supabaseId, ...}` |
| POST | `/users/stripe-connect/onboard` | SessionAuthGuard | Create Stripe Connect Express onboarding link | Body: `{returnUrl, refreshUrl}` → `{url}` |
| PATCH | `/users/me/bank-details` | SessionAuthGuard | Save bank account details for manual payout fallback | Body: `{bankAccountName, bankSortCode, bankAccountNumber, payoutPreference}` |
| GET | `/users/stripe-connect/status` | SessionAuthGuard | Get Stripe Connect onboarding status | → `{accountId, detailsSubmitted, chargesEnabled, ...}` |

### Listings Module — `GET/POST/PATCH/DELETE /listings/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/listings` | SessionAuthGuard | Create a new listing (DRAFT) | Body: CreateListingDto (full vehicle data incl. delivery fields, isDepartedSale) → Listing |
| GET | `/listings` | None | Browse/search listings with filters and pagination | Query: 20+ params (see filter list below) |
| GET | `/listings/featured` | None | Get up to 8 featured (boosted) listings | → Listing[] |
| GET | `/listings/my` | SessionAuthGuard | Current user's own listings | Query: `page, limit, includeSold` |
| GET | `/listings/stats` | SessionAuthGuard | Seller dashboard stats (total, active, sold, views) | → stats object |
| GET | `/listings/performance` | SessionAuthGuard | Seller performance analytics (revenue, views, conversion, per-listing) | → performance object |
| GET | `/listings/earnings` | SessionAuthGuard | Earnings history (sales records) | Query: `page, limit` → `{sales, totalRevenue, totalSales}` |
| GET | `/listings/earnings/export` | SessionAuthGuard | Export earnings as CSV download | → CSV file |
| GET | `/listings/:slug` | None | Get listing by URL slug | → Listing (with auction, bids, seller) |
| PATCH | `/listings/:id` | SessionAuthGuard | Update listing (ownership required) | Body: UpdateListingDto |
| POST | `/listings/:id/publish` | SessionAuthGuard | Publish DRAFT → ACTIVE (verifies LISTING_FEE paid) | → `{activated: bool, requiresPayment?: bool}` |
| PATCH | `/listings/:id/status` | SessionAuthGuard | Update listing status (DRAFT/ACTIVE/WITHDRAWN) | Body: `{status}` |
| PATCH | `/listings/:id/sold` | SessionAuthGuard | Record sale + mark SOLD | Body: `{soldPrice, buyerId?, buyerName?, buyerEmail?, buyerPostcode?}` |
| DELETE | `/listings/:id` | SessionAuthGuard | Soft-delete listing | → Listing with `deletedAt` set |
| POST | `/listings/:id/also-list-retail` | **[NEW]** SessionAuthGuard | Dual-channel: creates a linked CLASSIFIED listing from an AUCTION listing | Body: `{price, badgeTier}` → `{linkedListingId}` |
| POST | `/listings/:id/also-auction` | **[NEW]** SessionAuthGuard | Dual-channel: creates a linked AUCTION from a CLASSIFIED listing | Body: `{startTime, reservePrice, startingBid, minIncrement?, buyItNowPrice?}` → `{linkedListingId, auctionId}` |
| POST | `/listings/preview-import` | **[NEW]** SessionAuthGuard | Scrape listing from external platform URL | Body: `{url}` → ScrapedListingPreview (make, model, year, price, images...) |
| POST | `/listings/import-from-url` | **[NEW]** SessionAuthGuard | Create listing from external URL after preview | Body: `{url, price, vrm, title?, badgeTier?}` → Listing (DRAFT) |

**Filter parameters for `GET /listings`:**

`minPrice, maxPrice, make, model, minYear, maxYear, year, minMileage, maxMileage, fuelType, fuelTypes (comma-sep), transmission, transmissions (comma-sep), features (comma-sep), bodyType, color, minDoors, minSeats, conditions (comma-sep), condition, ulezCompliant, euroStandard, vehicleType, minBhp, maxBhp, sellerType, location, listingType, sortBy, search, page, limit, deliveryAvailable`

### Auctions Module — `GET/POST/PATCH/DELETE /auctions/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| GET | `/auctions/active` | None | All ACTIVE (live) auctions | → Auction[] |
| GET | `/auctions/scheduled` | None | All SCHEDULED (upcoming) auctions | Query: `page, limit` |
| GET | `/auctions/my/list` | SessionAuthGuard | Current user's auctions | Query: `page, limit` |
| GET | `/auctions/:id` | None | Full auction detail (bids, listing, winner, BIN fields) | → Auction with nested data |
| POST | `/auctions` | SessionAuthGuard | Create auction for owned listing | Body: `{listingId, startTime, reservePrice, startingBid, minIncrement, buyItNowPrice?}` → endTime = startTime + 24h |
| PATCH | `/auctions/:id` | SessionAuthGuard | Update SCHEDULED auction parameters | Body: UpdateAuctionDto |
| PATCH | `/auctions/:id/cancel` | SessionAuthGuard | Cancel a SCHEDULED auction | → Auction |
| DELETE | `/auctions/:id` | SessionAuthGuard | Soft-delete a SCHEDULED auction | → Auction |
| POST | `/auctions/:id/handover-proof` | SessionAuthGuard | Submit handover proof URL (seller, post-auction) | Body: `{proofUrl}` — triggers £100 bonus pending admin approval |
| POST | `/auctions/:id/close` | **[NEW]** SessionAuthGuard | Seller: close auction early | → `{closed: true}` — determines winner from current bids |
| POST | `/auctions/:id/accept-bid` | **[NEW]** SessionAuthGuard | Seller: accept a specific bid early, ending auction | Body: `{bidId}` |
| POST | `/auctions/:id/bin-trigger` | **[NEW]** None/Auth | Buyer: trigger Buy It Now — emits `bin:pending` to room | → void; sets `buyItNowPendingBuyerId` + `buyItNowPendingAt` |
| POST | `/auctions/:id/bin-confirm` | **[NEW]** SessionAuthGuard | Seller: confirm BIN offer — closes auction with that buyer as winner | → void |
| POST | `/auctions/:id/bin-decline` | **[NEW]** SessionAuthGuard | Seller: decline BIN offer — clears pending state, auction continues | → void |

**Note:** Frontend comment in `CreateAuctionRequest` says "endTime = startTime + 6h" — actual server constant is `AUCTION_DURATION_MS = 24 * 60 * 60 * 1000` (24 hours). This is a code comment bug.

### Bids Module — `GET/POST/PATCH /bids/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/bids` | SessionAuthGuard | Place a bid | Body: `{listingId, amount}` — validates auction ACTIVE, amount > highest + increment, **only verified dealers can bid** |
| GET | `/bids/my` | SessionAuthGuard | Current user's bids | Query: `page, limit` |
| GET | `/bids/stats` | SessionAuthGuard | Buyer dashboard bid statistics | → stats |
| GET | `/bids/listing/:listingId` | None | All bids for a listing | → Bid[] ordered by amount desc |
| PATCH | `/bids/:bidId/cancel` | **[NEW]** SessionAuthGuard | Cancel own most-recent bid within 2-minute window | → void; emits `bid:cancelled` to room |

**Important restriction:** `BidsService.create` at `backend/src/bids/bids.service.ts` lines 60–63 checks `if (!dealerProfile?.isVerified)` and throws `ForbiddenException('Only verified dealers can bid on auctions')`. Regular buyers and unverified dealers **cannot bid**.

### Chat Module — `GET/POST/PATCH /chat/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| GET | `/chat/rooms` | SessionAuthGuard | Get current user's chat rooms with last message | → ChatRoom[] |
| POST | `/chat/rooms` | SessionAuthGuard | Create or find existing chat room | Body: `{participantId, listingId?}` |
| GET | `/chat/rooms/:id` | SessionAuthGuard | Get specific chat room | → ChatRoom |
| GET | `/chat/rooms/:id/messages` | SessionAuthGuard | Get paginated messages for a room | Query: `page, limit` |
| POST | `/chat/rooms/:id/messages` | SessionAuthGuard | Send message (HTTP fallback for WebSocket) | Body: `{content}` |
| PATCH | `/chat/rooms/:id/read` | SessionAuthGuard | Mark room's messages as read | → `{markedCount}` |
| GET | `/chat/unread` | SessionAuthGuard | Get total unread message count | → `{count}` |

**WebSocket:** Socket.io namespace `/chat` via `ChatGateway`. Events: `chat:join`, `chat:message`, `chat:typing`.

### Offers Module — `GET/POST/PATCH /offers/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/offers` | SessionAuthGuard | Make an offer on a listing | Body: `{listingId, amount, amountMin?, amountMax?, message?}` |
| GET | `/offers/my` | SessionAuthGuard | Buyer's submitted offers | → Offer[] |
| GET | `/offers/my/:listingId` | SessionAuthGuard | Buyer's latest offer for a specific listing | → Offer \| null |
| GET | `/offers/listing/:listingId` | SessionAuthGuard | All offers on a listing (seller only) | → Offer[] |
| PATCH | `/offers/:id/respond` | SessionAuthGuard | Accept/reject/counter offer (seller) | Body: `{status, counterAmount?}` — ACCEPTED auto-rejects competing offers |
| GET | `/offers/pending-count` | SessionAuthGuard | Count of pending offers across seller's listings | → `{count}` |
| GET | `/offers/buyer-action-count` | SessionAuthGuard | Count of countered offers awaiting buyer response | → `{count}` |
| PATCH | `/offers/:id/withdraw` | SessionAuthGuard | Withdraw a pending offer (buyer) | → Offer |
| PATCH | `/offers/:id/respond-counter` | SessionAuthGuard | Accept/reject/counter a counter-offer (buyer or seller) | Body: `{status, counterAmount?}` |
| GET | `/offers/received` | SessionAuthGuard | All offers received by seller/dealer | → Offer[] with buyer+listing details |

### Payments Module — `GET/POST /payments/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/payments/checkout` | SessionAuthGuard | Create Stripe Checkout Session (generic) | Body: `{listingId, amount, type, currency}` → `{url}` |
| POST | `/payments/intent` | SessionAuthGuard | Create Payment Sheet intent for React Native | Body: `{listingId, amount, type, currency}` → `{clientSecret, ephemeralKey, customerId, publishableKey}` |
| POST | `/payments/hpi-checkout` | SessionAuthGuard | Create Stripe Checkout for HPI Report (£9.99) | Body: `{vrm, listingId}` → `{url}` |
| POST | `/payments/listing-checkout` | SessionAuthGuard | Create Stripe Checkout for Listing Fee (£1/£10/£25 by tier) | Body: `{badgeTier, listingId}` → `{url}` |
| GET | `/payments/session-status/:sessionId` | SessionAuthGuard | Get Stripe session status | → Stripe session |
| GET | `/payments/history` | SessionAuthGuard | User's payment history | → Transaction[] |
| POST | `/payments/webhook` | None (raw body) | Stripe webhook handler | Processes: `checkout.session.completed`, `account.updated` |

**Fee structure (hardcoded in `backend/src/payments/payments.service.ts`):**
- HPI Report: £9.99
- Listing BASIC: £1.00, STANDARD: £10.00, PREMIUM: £25.00
- Featured Boost: £25.00
- Auction Buyer Fee: £125 (£100 seller bonus + £25 platform)

### Delivery Module — `GET/PATCH/POST /delivery-requests/*` [NEW]

All routes guarded by `SessionAuthGuard`.

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/delivery-requests` | SessionAuthGuard | Buyer: create delivery request (requires existing offer on listing) |
| PATCH | `/delivery-requests/:id/accept` | SessionAuthGuard | Seller: accept pending delivery request |
| PATCH | `/delivery-requests/:id/decline` | SessionAuthGuard | Seller: decline pending delivery request |
| PATCH | `/delivery-requests/:id/cancel` | SessionAuthGuard | Buyer: cancel pending delivery request |
| PATCH | `/delivery-requests/:id/complete` | SessionAuthGuard | Buyer: mark accepted delivery as complete |
| GET | `/delivery-requests/my` | SessionAuthGuard | Buyer: all delivery requests submitted |
| GET | `/delivery-requests/received` | SessionAuthGuard | Seller: all delivery requests received |

**Validation:** `createDeliveryRequest` checks listing has `deliveryAvailable=true`, buyer has existing offer, no duplicate active request, and distance ≤ `listing.deliveryMaxMiles`. Distance calculated server-side via Google Maps Distance Matrix API.

### Admin Module — `GET/POST/PATCH/DELETE /admin/*`

All routes guarded by `SessionAuthGuard + RolesGuard(ADMIN)`.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | Paginated user list with Stripe/bank payout status |
| PATCH | `/admin/users/:id/role` | Change user role |
| PATCH | `/admin/users/:id/verify` | Verify user (email/dealer) |
| PATCH | `/admin/users/:id/ban` | Soft-delete (ban) user |
| PATCH | `/admin/users/:id/unban` | Clear `deletedAt` |
| PATCH | `/admin/users/:id/lock` | Lock account 24h (`lockoutUntil`) |
| PATCH | `/admin/users/:id/unlock` | Clear lockout |
| GET | `/admin/listings` | All listings including soft-deleted |
| DELETE | `/admin/listings/:id` | Force soft-delete listing |
| GET | `/admin/auctions` | All auctions paginated |
| GET | `/admin/handovers/pending` | Auctions with submitted handover proof awaiting review |
| POST | `/admin/handovers/:auctionId/approve` | Approve handover → triggers £100 Stripe transfer to seller |
| POST | `/admin/handovers/:auctionId/deny` | Deny handover (refund buyer £100 logic — partially implemented) |
| GET | `/admin/transactions` | All platform transactions |
| GET | `/admin/stats` | Platform-wide stats |
| GET | `/admin/analytics` | Monthly analytics (last 6 months) |
| GET | `/admin/dealers/kyc-pending` | Pending/rejected dealer KYC applications |
| PATCH | `/admin/dealers/kyc/:id/review` | Field-by-field KYC review with per-field statuses and notes |

### Dealers Module — `GET/POST/PATCH/DELETE /dealers/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/dealers/stats` | SessionAuthGuard | Dealer dashboard KPIs |
| GET | `/dealers/analytics` | SessionAuthGuard | Analytics with date range (7d/30d/90d/custom) |
| GET | `/dealers/leads` | SessionAuthGuard | CRM leads, filterable by status, paginated |
| POST | `/dealers/leads` | SessionAuthGuard | Create a new lead |
| PATCH | `/dealers/leads/:id` | SessionAuthGuard | Update lead status/assignment |
| GET | `/dealers/staff` | SessionAuthGuard | List dealership staff |
| POST | `/dealers/staff` | SessionAuthGuard | Invite staff member (sends invite email) |
| DELETE | `/dealers/staff/:id` | SessionAuthGuard | Deactivate staff member |
| POST | `/dealers/invites/accept` | SessionAuthGuard | Accept staff invite by token |
| GET | `/dealers/purchases` | SessionAuthGuard | Vehicles purchased by this dealer |
| GET | `/dealers/kyc` | SessionAuthGuard | Current dealer's KYC status |
| POST | `/dealers/kyc` | SessionAuthGuard | Submit/update KYC documents |

### Notifications Module — `GET/PATCH /notifications/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/notifications` | SessionAuthGuard | Paginated notifications for current user |
| GET | `/notifications/unread-count` | SessionAuthGuard | Unread notification count |
| PATCH | `/notifications/read-all` | SessionAuthGuard | Mark all as read |
| PATCH | `/notifications/:id/read` | SessionAuthGuard | Mark single notification as read |

**WebSocket:** `NotificationsGateway` — Socket.io namespace `/notifications`. Real-time push for: `BID_PLACED`, `OUTBID`, `AUCTION_ENDING`, `AUCTION_WON`, `AUCTION_ENDED`, `OFFER_RECEIVED`, `COUNTER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `PAYOUT_FAILED`.

### Sellers Module — `GET/POST /sellers/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/sellers/:userId` | None | Public seller profile with stats and review summary |
| GET | `/sellers/:userId/listings` | None | Active listings by this seller (paginated) |
| GET | `/sellers/:sellerProfileId/reviews` | None | Paginated reviews for a SellerProfile |
| POST | `/sellers/reviews` | SessionAuthGuard | Submit seller review (buyer → seller) |

### Featured Boost Module — `GET/POST /featured-boost/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/featured-boost/:listingId` | SessionAuthGuard | Boost listing → returns Stripe checkout URL |
| GET | `/featured-boost/my` | SessionAuthGuard | Seller's boost history |
| GET | `/featured-boost/status/:listingId` | SessionAuthGuard | Get boost status for a listing |

### Watchlist Module — `GET/POST/DELETE /watchlist/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/watchlist` | SessionAuthGuard | User's watchlisted listings |
| POST | `/watchlist/:listingId` | SessionAuthGuard | Add to watchlist |
| DELETE | `/watchlist/:listingId` | SessionAuthGuard | Remove from watchlist |
| GET | `/watchlist/check/:listingId` | SessionAuthGuard | Check if listing is in watchlist |
| GET | `/watchlist/count` | SessionAuthGuard | Watchlist item count |

### Finance Module — `GET/POST/PATCH /finance/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/finance/apply` | SessionAuthGuard | Submit finance application |
| GET | `/finance/my` | SessionAuthGuard | Buyer's own finance applications |
| GET | `/finance/partner` | SessionAuthGuard | Finance partner's incoming applications |
| PATCH | `/finance/:id/status` | SessionAuthGuard (Partner) | Update application status |

### Insurance Module — `GET/POST/PATCH /insurance/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/insurance/quote` | SessionAuthGuard | Request insurance quote |
| GET | `/insurance/my` | SessionAuthGuard | User's insurance quotes |
| GET | `/insurance/partner` | SessionAuthGuard (Partner) | Partner's incoming quote requests |
| PATCH | `/insurance/:id/status` | SessionAuthGuard (Partner) | Update quote status |

### Service Requests Module — `GET/POST/PATCH /service-requests/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/service-requests` | SessionAuthGuard | Create service request |
| GET | `/service-requests/my` | SessionAuthGuard | Requests made by current user |
| GET | `/service-requests/contractor` | SessionAuthGuard | Jobs assigned to contractor |
| GET | `/service-requests/contractor/stats` | SessionAuthGuard | Contractor dashboard statistics |
| PATCH | `/service-requests/:id/status` | SessionAuthGuard (Contractor) | Update service status |

### Transactions Module — `GET /transactions/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/transactions/my` | SessionAuthGuard | Current user's transactions (paginated) |
| GET | `/transactions/stats` | SessionAuthGuard | Earnings summary (available, pending, YTD) |

### Dashboard Module — `GET /dashboard/*`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/dashboard/unified` | SessionAuthGuard | Buyer + Seller combined dashboard data |
| GET | `/dashboard/buyer` | SessionAuthGuard | Buyer dashboard data |
| GET | `/dashboard/seller` | SessionAuthGuard | Seller dashboard data |
| GET | `/dashboard/dealer` | SessionAuthGuard + DEALER | Dealer dashboard data |
| GET | `/dashboard/contractor` | SessionAuthGuard + CONTRACTOR | Contractor dashboard data |
| GET | `/dashboard/finance` | SessionAuthGuard + FINANCE_PARTNER | Finance partner dashboard data |
| GET | `/dashboard/insurance` | SessionAuthGuard + INSURANCE_PARTNER | Insurance partner dashboard data |
| GET | `/dashboard/admin` | SessionAuthGuard + ADMIN | Admin dashboard data |

### Other Controllers

| Controller | Path | Auth | Description |
|---|---|---|---|
| DVLA | `POST /dvla/lookup` | None | UK VRM lookup via DVLA VES API — returns make, model, MOT status, tax, CO2 etc. |
| HPI | `GET /hpi/listing/:id` | SessionAuthGuard | Raw HPI report for a listing |
| HPI | `GET /hpi/listing/:id/summary` | SessionAuthGuard | Parsed HPI report summary |
| AI | `POST /ai/search` | None | AI-powered natural language vehicle search (OpenAI) |
| AI | `POST /ai/chat` | None | AI assistant chat (OpenAI) — used by MaziumWidget |
| AI | `POST /ai/generate-description` | SessionAuthGuard | Generate listing description using AI |
| Damage | `POST /damage/analyze` | SessionAuthGuard | AI damage analysis on image URLs |
| Damage | `POST /damage/:listingId/save` | SessionAuthGuard | Save detected damage records |
| Damage | `GET /damage/:listingId` | SessionAuthGuard | Get damage records for listing (also called publicly for listing detail page trust display) |
| Analytics | `POST /analytics/event` | None | Track analytics event |
| Analytics | `POST /analytics/email` | None | Capture email lead |
| Analytics | `GET /analytics/summary` | **None — OPEN** | Analytics summary (no auth guard — see Section 7) |
| Analytics | `GET /analytics/events` | **None — OPEN** | Analytics event list (no auth guard — see Section 7) |
| Analytics | `GET /analytics/emails` | **None — OPEN** | Email leads list (no auth guard — see Section 7) |
| Health | `GET /health` | None | Health check endpoint |

---

## SECTION 3: Feature Inventory

### 1. Authentication & Accounts

**User Registration, Login, Logout**  
Dual-track auth — Supabase handles email verification and JWT issuance; backend maintains its own session via express-session + PostgreSQL `sessions` table. Frontend calls `POST /auth/supabase-session` after any Supabase auth event to exchange the Supabase JWT for a backend session cookie (`sid`). Cookie: 7-day maxAge, httpOnly, `sameSite=none` in production, `secure` in production.  
Files: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx`, `src/app/auth/callback/page.tsx`  
Dependencies: Supabase Auth, express-session, connect-pg-simple, Resend.

**Email Verification**  
After registration, user is routed to `/auth/onboarding` (step: `verify`). `POST /auth/send-verification` sends custom branded email via Resend (bypasses Supabase's rate-limited mailer). Email confirmed via Supabase `email_confirmed_at` check on next onboarding render.  
Files: `src/app/auth/onboarding/page.tsx`, `backend/src/email/email.service.ts`

**Password Reset**  
Supabase-managed forgot-password at `/auth/forgot-password`. Authenticated in-session reset at `POST /auth/reset-password`.

**Role Elevation**  
Users start as `BUYER`. Role change via `POST /users/elevate`. Dealer role requires separate KYC after elevation.  
Files: `backend/src/users/users.controller.ts`

**Account Security (Lockout)**  
`loginAttempts` and `lockoutUntil` fields on User model. Admin can lock (24h) or unlock via admin panel. Admin-initiated only — no automatic lockout on failed login attempts wired in AuthService.

---

### 2. Listings

**Create Listing (Wizard)**  
Multi-step `ListingWizard` component handles all listing creation. Creates a DRAFT listing. Supports all vehicle types (CAR/HGV/MOTORCYCLE). Includes DVLA VRM lookup, AI description generation, image upload to Supabase Storage, video URL embeds (YouTube/Instagram/Facebook/X), damage analysis, condition/compliance fields (ULEZ, Euro standard, CO2), write-off category, legal declarations, delivery options, deceased estate flag.  
Files: `src/components/listing/ListingWizard.tsx`, `src/app/dashboard/seller/add-listing/page.tsx`  
Dependencies: DVLA VES API, OpenAI (description generation), Supabase Storage.

**Publish Listing (Payment Gate)**  
`POST /listings/:id/publish` checks that a LISTING_FEE Transaction with status COMPLETED exists for the listing. Returns `{requiresPayment: true}` if not paid — frontend routes to checkout. On Stripe webhook confirmation, Transaction marked COMPLETED, listing publish succeeds → `status = ACTIVE`.  
Files: `backend/src/listings/listings.service.ts`

**Edit / Soft-Delete Listing**  
`PATCH /listings/:id` for updates (ownership required). `DELETE /listings/:id` sets `deletedAt`. `PATCH /listings/:id/status` for manual status transitions.

**Badge Tiers**  
`badgeTier` field: `FREE`, `BASIC`, `STANDARD`, `PREMIUM`. FREE = no payment required. BASIC = £1 (listed on CarMazium, buyer enquiries, standard visibility). STANDARD = £10 (verified badge, priority search, VIN report). PREMIUM = £25 (featured homepage 28 days, HPI check, top of search).

**Banner Labels**  
`bannerLabel` field on Listing — custom ribbon string (e.g. "Price Drop", "Just Arrived"). Rendered on listing cards.

**Images & Video**  
Images stored as URL arrays in Supabase Storage. Video URLs (YouTube, Instagram, Facebook, X) stored as `videoUrls String[]`. YouTube auto-embedded; others shown as links.

**Damage Records**  
AI analysis via `POST /damage/analyze` (GPT-4 Vision on uploaded image URLs) → save via `POST /damage/:listingId/save`. `DamageRecord` table stores part, type, size, coordinates, source image URL. Publicly visible on listing detail page to build buyer trust.

**3D Damage Viewer** [NEW]  
`ThreeDVehicleViewer` component renders an interactive WebGL 3D vehicle model with clickable damage zones. Zones are highlighted based on `DamageRecord.part` values. User clicks a zone → damage detail list highlights that zone. Falls back gracefully (via `ThreeDErrorBoundary`) to plain list on devices without WebGL. Available on both the listing detail page (`/buy-cars/[slug]`) and the live auction page (`/auctions/live/[id]`).  
Files: `src/components/listing/ThreeDVehicleViewer.tsx`, `src/components/listing/ThreeDErrorBoundary.tsx`, `src/components/listing/VehicleDamageMapper.tsx`

**Deceased Estate Sale** [NEW]  
`isDepartedSale` and `departedRelationship` fields on Listing. Wizard allows marking a listing as a deceased estate sale with the relationship to the deceased (e.g. "son", "executor"). Badge shown on listing detail page as purple "Deceased Estate · Listed by {relationship}".  
Files: `src/app/buy-cars/[slug]/page.tsx:609–615`, `src/lib/listingApi.ts`

**Dual-Channel Listings** [NEW]  
A single vehicle can be listed simultaneously as a classified AND an active auction. Two mechanisms:
- `POST /listings/:id/also-list-retail` — from an AUCTION listing, creates a linked CLASSIFIED sister listing
- `POST /listings/:id/also-auction` — from a CLASSIFIED listing, creates a linked AUCTION  

The `linkedListingId` field connects the two. Listing detail page shows a banner "Also in Live Auction" (or vice versa) linking to the other channel. When reserve is met in auction, the BIN/retail banner disappears on the classified side.  
Files: `src/lib/listingApi.ts:1168–1190`, `backend/src/listings/listings.controller.ts:354–390`

**Listing Import from URL (External Platforms)** [NEW]  
3-step `ImportListingModal` allows importing from AutoTrader, CarGurus, and CarWow URLs:
1. Paste URL → `POST /listings/preview-import` → scraped preview (make, model, year, mileage, fuel, images, etc.)
2. Review extracted data, edit title/price/VRM
3. `POST /listings/import-from-url` → creates DRAFT listing → tier selection → Stripe checkout

`importedFromUrl` and `importedSource` stored on Listing. Badge shown on detail page with "See on AutoTrader/CarGurus/CarWow" link.  
Files: `src/components/features/ImportListingModal.tsx`, `src/lib/listingApi.ts:1241–1285`

**Bulk CSV Import (Dealer)** [NEW]  
`BulkImportModal` component for dealers — CSV upload with columns `vrm, price, mileage, images`. For each row: DVLA VRM lookup → auto-populate make/model/fuel → `createListing()`. Progress bar with current/total count. Error log for failed rows. RFC-4180 compliant CSV parser with quoted field support.  
Files: `src/components/dealer/BulkImportModal.tsx`

**Delivery Offering** [NEW]  
Sellers can mark listings as delivery-available in the wizard: `deliveryAvailable`, `deliveryPricePerMile`, `deliveryMaxMiles`. On the listing detail page:
- Distance from buyer's postcode calculated via Next.js route `/api/delivery-distance` (Google Maps Distance Matrix API)
- Tiered delivery fee displayed: ≤10 miles = £30; 10–30 miles = £30 + (d-10)×£2; >30 miles = £70 + (d-30)×£1.50 (all ex-VAT, shown with 20% VAT added)
- Shows "Out of delivery radius" if buyer's postcode is beyond `deliveryMaxMiles`
- Search filter `deliveryAvailable=true` available on `/search`
- Full backend: `DeliveryRequest` entity, `DeliveryController`, `DeliveryService` (server-side distance calc via Google Maps)

Files: `src/lib/deliveryApi.ts`, `src/app/api/delivery-distance/route.ts`, `backend/src/delivery/`

---

### 3. Search & Browse

**Listing Search & Filters**  
`GET /listings` accepts 20+ filter dimensions including dual-range year/mileage/BHP, multi-select fuel types and transmissions, multi-select conditions, features array, ULEZ compliance, delivery filter, seller type, sort order, and text search.

**Search Page UI**  
`/search` uses `DualRangeSlider` for price/year/mileage/BHP ranges. Body type selector with SVG icons (`BODY_TYPE_ICONS`). Make/model cascading selects using `CAR_MAKES` and `getModelsForMake`. Popular features checklist with 18 presets (Air Conditioning, Sat Nav, Apple CarPlay, etc.). Distance from user shown on listing cards using `LocationContext`.  
Files: `src/app/search/page.tsx`

**AI-Powered Natural Language Search**  
`POST /ai/search` — user submits plain language query (e.g. "family SUV under £15k petrol automatic"), OpenAI returns structured filter params + friendly explanation text. No auth required.

**MaziumWidget (AI Chat Assistant)** [NEW]  
Floating chat widget on homepage powered by `POST /ai/chat`. Provides car-buying advice, natural language search, and generates filter cards that redirect to `/search`. Includes 12 quick-reply chips (SUVs, Under £15k, Diesel, Electric, ULEZ, etc.). Client-side only (no SSR).  
Files: `src/components/features/MaziumWidget.tsx`, `src/components/features/MaziumWidgetLoader.tsx`

**Vehicle Comparison**  
`/compare` — up to 3 vehicles side-by-side with spec highlighting. Frontend-only feature using existing listing endpoints. `CompareContext` manages the comparison state globally; "Compare" button appears on listing cards and detail pages.  
Files: `src/app/compare/page.tsx`, `src/context/CompareContext.tsx`

**Watchlist**  
Full CRUD at `/watchlist/*`. `WatchlistItem` with unique constraint `[userId, listingId]`.

**HPI Report (Paid)**  
Buyer pays £9.99 → Stripe checkout → webhook → `HpiService.fetchAndSaveReport` via OneAutoAPI → `HpiReport` table. Summary at `GET /hpi/listing/:id/summary`. Raw data at `GET /hpi/listing/:id`. Triggered from `HpiReportModal` on listing detail page.

**DVLA VRM Lookup**  
`POST /dvla/lookup` — public, no auth. Returns: make, model, colour, fuel, MOT status, tax status, CO2, registration date. Used in listing wizard and bulk CSV import to auto-populate fields.

**Location-Based Distance** [NEW]  
`LocationContext` (`src/context/LocationContext.tsx`) stores user's coordinates (lat/lng/postcode) via browser Geolocation API or postcode entry. `haversineDistanceMiles()` utility in `src/lib/distance.ts` computes great-circle distance. Distance shown on listing cards in search results and on listing detail page as "X miles away". Also used to validate delivery radius eligibility.

**Finance Calculator** [NEW]  
On-page finance calculator on listing detail (`/buy-cars/[slug]`, `/vehicle/[id]`). Adjustable deposit (default 10%), loan term (default 48 months), APR slider (9%–49%, default 19%). Shows monthly payment using standard amortization formula. Client-side only — illustrative only, not connected to any finance application.  
Files: `src/components/features/FinanceCalculator.tsx`

---

### 4. Auctions

**Create Auction**  
Seller calls `POST /auctions` with `{listingId, startTime, reservePrice, startingBid, minIncrement, buyItNowPrice?}`. Server computes `endTime = startTime + 24 hours`. Listing type auto-converts to `AUCTION`. One auction per listing (DB unique constraint on `listingId`). Tolerates start times up to 60s in the past (clock skew).

**Auction Lifecycle (CRON)**  
`AuctionLifecycleService` at `backend/src/tasks/auction-lifecycle.service.ts` runs every minute via `@Cron('* * * * *')`:
1. Activates SCHEDULED → ACTIVE when `startTime` passes; emits `auction:started`
2. Sends `AUCTION_ENDING` notifications to all bidders when ≤ 5 minutes remain (once per cycle)
3. Closes ACTIVE → ENDED when `endTime` passes: sets `winnerId`, `winningBidAmount`, emits `auction:ended` Socket.io event, creates winner/ended notifications, sends winner email

**Live Bidding**  
`POST /bids` places bid (HTTP). Validates: auction ACTIVE, amount > highest + `minIncrement`, bidder is a KYC-verified dealer. On success, `AuctionGateway` emits `bid:new` to all room subscribers including `bidId` for cancel-window tracking.

**Anti-Snipe Extension**  
Bid placed within 3 minutes of `endTime` → `endTime` extended by 3 minutes. Updated in DB. `bid:new` payload includes `newEndTime`. Frontend `CountdownTimer` re-syncs. Frontend schedules a single `setTimeout` to fire exactly at the 3-minute mark (not polling).

**Cancel Bid (2-minute window)** [NEW]  
After placing a bid, the bidder has a 120-second window to cancel it. `PATCH /bids/:bidId/cancel` — validates window not expired and bid is still the highest. On cancel: emits `bid:cancelled {auctionId, bidId}` to room. Frontend shows countdown and "Cancel" button that disappears when window expires or user is outbid.  
Files: `src/app/auctions/live/[id]/page.tsx:336–346`, `backend/src/bids/`

**Seller Accept Bid Early** [NEW]  
Seller can end an active auction by accepting a specific bid: `POST /auctions/:id/accept-bid {bidId}`. Closes the auction with that bid's amount and bidder as winner (regardless of endTime). Seller sees "Accept" action on each bid row in the bid feed on the live auction page.  
Files: `src/app/auctions/live/[id]/page.tsx:299–312`, `backend/src/auctions/auctions.controller.ts:138`

**Seller Close Auction Early** [NEW]  
`POST /auctions/:id/close` — closes auction immediately. Winner determined from current highest bid (if ≥ reserve). Different from accept-bid: no specific bid targeted; uses current highest bid at closure time.  
Files: `backend/src/auctions/auctions.controller.ts:125`

**Buy It Now (BIN)** [NEW]  
Optional `buyItNowPrice` set at auction creation. Only shown if reserve not yet met. Full state machine:
1. Buyer clicks "Buy Now" on listing detail OR live auction page → `POST /auctions/:id/bin-trigger` → `buyItNowPendingBuyerId` set → `bin:pending` event emitted to room
2. Seller sees BIN pending notification → "Confirm" or "Decline"
3. Confirm: `POST /auctions/:id/bin-confirm` → auction closed with BIN buyer as winner, BIN price as amount
4. Decline: `POST /auctions/:id/bin-decline` → `buyItNowPendingBuyerId` cleared, auction continues
5. Seller must confirm within 24 hours; if BIN goes pending, bidding pauses (reserve considered met to hide BIN button)

BIN button shows on both listing detail page (for `AUCTION` type with active auction) and live auction room. Socket event `bin:pending` updates all room clients.  
Files: `src/lib/auctionApi.ts:218–232`, `src/app/buy-cars/[slug]/page.tsx:1243–1260`, `src/app/auctions/live/[id]/page.tsx:322–334`

**Real-Time Viewer Count**  
`AuctionGateway` tracks connected clients per auction room. Emits `auction:viewers {count}` on join/disconnect.

**Winner & Post-Auction Flow**  
Highest bidder (if bid ≥ reserve) becomes winner. Frontend shows winner banner on `/auctions/live/[id]` with "Pay £125 Fee" button and (disabled) "Message Seller" button until fee paid.

**Auction Management (Seller)**  
PATCH (update), cancel, and soft-delete only available while auction is SCHEDULED. Once ACTIVE, seller can only accept bid early or close early. Once ENDED, no modifications.

---

### 5. Offers & Negotiations

**Make Offer**  
Buyer submits offer on a classified listing. Includes optional `amountMin`/`amountMax` range, optional `message`. Minimum offer = 70% of asking price (frontend validation). Seller notified via notification + WebSocket.

**Counter-Offer Negotiation (Enhanced)** [NEW additions]  
Full multi-round negotiation ledger. Both seller and buyer can counter:
- Seller counters: `PATCH /offers/:id/respond {status: 'COUNTERED', counterAmount}` → `sellerCounterAmount`, `status = COUNTERED`
- Buyer accepts/rejects/counters back: `PATCH /offers/:id/respond-counter {status, counterAmount?}` → buyer can also counter with new amount
- Additional tracking: `counterAttemptsBuyer`, `counterAttemptsSeller`, `counterExpiresAt`, `lastCounteredBy` fields on Offer
- Seller receives `COUNTER_RECEIVED` notification; buyer receives same for seller counter

**Accept/Auto-Reject Flow**  
When seller accepts one offer, all competing PENDING offers on the same listing are auto-rejected. Listing status → `OFFER_ACCEPTED`.

**Withdraw Offer**  
Buyer can withdraw any PENDING offer via `PATCH /offers/:id/withdraw`.

**Offer Status Display on Listing Page**  
`OfferStatusChip` renders context-aware status for buyer/seller/public: buyer sees own offer status, seller sees "offer awaiting your response", public sees neutrally-worded current offer status. URL param `?editOffer=true` auto-opens offer modal.

---

### 6. Chat & Messaging

**Chat Rooms**  
`ChatRoom` with unique constraint `[initiatorId, participantId]` — one room per user pair. `POST /chat/rooms` is idempotent (findOrCreate). Optional `listingId` for context.

**Real-Time Messaging**  
Socket.io namespace `/chat`. Clients join with `chat:join {roomId}`. Messages broadcast as `chat:message`. HTTP fallback `POST /chat/rooms/:id/messages`. Redis adapter enables multi-pod WebSocket scaling.

**Unread Count & Mark-Read**  
`GET /chat/unread` → total unread. `PATCH /chat/rooms/:id/read` marks messages read.

**Enquire Modal** [NEW]  
`EnquireModal` component on `/vehicle/[id]` route — provides a structured enquiry form before creating a chat room. Distinct from the simple "Enquire" button on `/buy-cars/[slug]` which directly creates a room.  
Files: `src/components/listing/EnquireModal.tsx`

**Limitations:** Text-only. No file/image attachments. No message deletion.

---

### 7. Payments (Stripe Checkout)

**Listing Fee Payment**  
`POST /payments/listing-checkout` → Stripe Checkout with tier pricing. Webhook marks LISTING_FEE transaction COMPLETED → listing publish succeeds.

**Featured Boost Payment**  
`POST /featured-boost/:listingId` → Stripe (£25). Webhook activates boost (`listing.isFeatured = true`, `featuredUntil = +7 days`). Cron job in `backend/src/tasks/featured-boost-expiry.service.ts` expires boosts.

**HPI Report Payment**  
`POST /payments/hpi-checkout` → Stripe (£9.99). Webhook triggers HPI report fetch.

**Deposit / Full Payment**  
`POST /payments/checkout` with type `DEPOSIT` (£500) or `FULL_PAYMENT`. General classified-car payment flow.

**Auction Buyer Fee**  
`POST /payments/checkout` with type `COMMISSION` (£125). Webhook sets `auction.buyerFeePaid = true`, unlocking chat with seller.

**React Native Payment Sheet**  
`POST /payments/intent` returns `{clientSecret, ephemeralKey, customerId, publishableKey}` for Stripe's native SDK. Backend endpoint is fully implemented. Not used by current web frontend.

---

### 8. Seller Payouts (Stripe Connect)

**Stripe Connect Express Onboarding**  
Seller in `/dashboard/seller/settings` → "Connect with Stripe" → `POST /users/stripe-connect/onboard` → backend creates/retrieves Express account → returns one-time `accountLinks` URL → seller completes Stripe's hosted KYC flow → Stripe sends `account.updated` webhook → `stripeConnectOnboardingComplete = true` set (gated on `details_submitted`).  
Files: `backend/src/users/users.service.ts`, `src/app/dashboard/seller/settings/page.tsx`

**Automated Payout on Handover Approval**  
`POST /admin/handovers/:id/approve` → idempotency check (`sellerBonusReleased`) → `PaymentsService.issueSellerPayout()` → `stripe.transfers.create({amount: 10000, currency: 'gbp', destination: connectAccountId})` → records `stripePayoutTransferId`. On failure: stores `stripePayoutError`, pushes `PAYOUT_FAILED` notification to all admins.  
Files: `backend/src/admin/admin.service.ts` (approveHandover method)

**Bank Details Fallback**  
`PATCH /users/me/bank-details` saves `bankAccountName`, `bankSortCode`, `bankAccountNumber`. Admin panel displays (sort code + last 4 of account number masked) in handover table. Admin manually transfers £100. No automated bank transfer.

---

### 9. Delivery System [NEW]

Full end-to-end delivery request flow post-offer acceptance.

**Listing Delivery Setup**  
Sellers configure `deliveryAvailable`, `deliveryPricePerMile`, and `deliveryMaxMiles` in the listing wizard.

**Distance Calculation**  
- Frontend: Next.js API route `/api/delivery-distance` proxies Google Maps Distance Matrix API, returning `distanceMiles` and `estimatedCostGbp`
- Backend: `DeliveryService.createDeliveryRequest()` also calls Google Maps server-side to validate distance ≤ `deliveryMaxMiles`

**Delivery Fee Formula (frontend display):**
- ≤10 miles: £30 base
- 11–30 miles: £30 + (miles − 10) × £2
- >30 miles: £70 + (miles − 30) × £1.50
- All ex-VAT; displayed inc-VAT (×1.2)

**Delivery Request Lifecycle**  
`PENDING → ACCEPTED / DECLINED / CANCELLED / COMPLETED`  
- Buyer creates: `POST /delivery-requests` (requires existing offer on listing; validates no duplicate active request)
- Seller accepts: `PATCH /delivery-requests/:id/accept`
- Seller declines: `PATCH /delivery-requests/:id/decline` (buyer notified)
- Buyer cancels: `PATCH /delivery-requests/:id/cancel`
- Buyer marks complete: `PATCH /delivery-requests/:id/complete`

**UI Integration**  
- Listing detail sidebar shows delivery availability, fee estimate, and "Outside your radius" message
- No dedicated delivery dashboard page exists yet — requests managed via API only

Files: `src/lib/deliveryApi.ts`, `src/app/api/delivery-distance/route.ts`, `backend/src/delivery/`

---

### 10. KYC / Identity Verification (Dealer)

**Dealer KYC Submission**  
Dealers complete 16-field KYC at `/dashboard/dealer/settings` → `POST /dealers/kyc`. Includes company house name, VAT proof URL, company registration proof URL, director ID proof URL, payment screenshot URL, Google reviews link, registered address, trading address.  
Files: `backend/src/dealers/dealers.controller.ts`

**Admin KYC Review**  
`GET /admin/dealers/kyc-pending` → `/dashboard/admin/dealer-verification`. Field-by-field review with per-field `{status: KycStatus, note}` stored in `documentStatuses` JSONB. `PATCH /admin/dealers/kyc/:id/review` updates review decisions. On APPROVED: `DealerProfile.isVerified = true` → dealer can bid.  
Files: `src/app/dashboard/admin/dealer-verification/page.tsx`

**Address Verification (OTP)**  
`POST /users/me/address-verification/start` sends OTP email. `POST /users/me/address-verification/confirm` validates code. Sets `user.isAddressVerified = true`. `AddressVerification` table tracks attempts and expiry.

---

### 11. Dealer Features

**Dealer Dashboard**  
KPI stats (inventory, active listings, revenue, leads). Recent leads preview.

**CRM (Lead Management)**  
Kanban board with 6 pipeline stages: `NEW → CONTACTED → QUALIFIED → NEGOTIATING → WON → LOST`. Create leads, update status, assign to staff members. Source tracking (direct/chat/walk-in/referral/online-ad/phone).

**Dealer Analytics**  
Date range filter (7d/30d/90d/custom). Charts: Revenue area (`RevenueAreaChart`), Lead funnel (`LeadFunnelChart`), Lead source (`LeadSourceChart`), Offer status donut (`OfferDonutChart`), Inventory aging (`InventoryAgingChart`), Bid volume (`BidVolumeChart`), Sales by type (`SalesByTypeChart`), Top models (`TopModelsChart`), Customer area (`CustomerAreaTable`), Salesperson (`SalespersonTable`), Movers (`MoversList`).  
Files: `src/components/dealer/`

**Team Management (Staff RBAC)**  
Dealer ADMIN invites staff by email with role (ADMIN/SALES_AGENT/FINANCE_MANAGER). Invite email sent with token. Staff accepts at `/auth/accept-invite`. Staff can be deactivated (not deleted).

**Bulk CSV Import** [NEW — see Section 3 Listings]

**Import from External URL** [NEW — see Section 3 Listings]

---

### 12. Finance & Insurance Partners

**Finance Partner Dashboard**  
Finance partners see incoming applications from buyers. Approve/reject/complete. Status: `PENDING → APPROVED/REJECTED/COMPLETED`.

**Insurance Partner Dashboard**  
Insurance partners see incoming quote requests. Status: `PENDING → QUOTED/ACCEPTED/EXPIRED/REJECTED`.

**Partner API Key** — `PartnerProfile.apiKey` field exists in schema but no API-key auth middleware is implemented. Currently inert.

---

### 13. Contractor / Service Provider Flows

**Contractor Dashboard**  
Jobs in PENDING/ACCEPTED/IN_PROGRESS/COMPLETED/CANCELLED states. Stats: pending, active, completed, total earnings.

**Service Request Lifecycle**  
Buyer creates `ServiceRequest` targeting a `ContractorProfile.id`. Contractor updates status. `quotedPrice` and `acceptedPrice` tracked separately. No frontend page found for buyers to create service requests — likely accessed from listing detail page.

---

### 14. Notifications

**In-App (Real-Time)**  
`NotificationsGateway` at Socket.io namespace `/notifications`. Authenticated clients subscribe on login. Events pushed: `BID_PLACED`, `OUTBID`, `AUCTION_ENDING` (5-min warning), `AUCTION_WON`, `AUCTION_ENDED`, `OFFER_RECEIVED`, `COUNTER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `PAYOUT_FAILED`.

**Notification Model**  
`entityType`, `entityId`, `actionType` fields enable deep-linking from notification to specific entity in frontend.

**Email Notifications**  
Resend-backed `EmailService` sends: email verification, auction winner notification, dealer staff invite.

**Auction Socket Events** [NEW — complete list]  
Live auction page subscribes to: `bid:new`, `auction:ended`, `auction:started`, `auction:viewers`, `bin:pending`, `bid:cancelled`.

---

### 15. Admin Panel

**User Management**  
Paginated table. Columns: name, email, role (editable inline), status (ACTIVE/LOCKED/BANNED), payout method (Stripe/Bank/Not set), joined date. Actions: change role, verify, ban/unban, lock/unlock. Bank sort code shown masked (`****XXXX` for account number). Sort code shown in full.

**Listing Moderation**  
All listings including soft-deleted. Force delete.

**Handover Approval**  
Pending handovers list. Proof image link. Context-aware approval dialog: shows Stripe path vs bank transfer path vs neither. Approve triggers automated payout or flags for manual transfer.

**Dealer KYC Review**  
16-field field-by-field review. Document images in lightbox. Per-field APPROVED/REJECTED + notes. Overall APPROVED/REJECTED.

**Platform Analytics**  
Monthly bar charts: users joined, listings created, revenue. Last 6 months.

---

### 16. Dashboard Summary (Role-Specific)

| Role | Primary Dashboard | Key Data |
|---|---|---|
| BUYER | `/dashboard/buyer` | Bid count, watchlist count, active offers, countered offers pending |
| SELLER | `/dashboard/seller` | Total listings, active, sold, views, earnings |
| DEALER | `/dashboard/dealer` | Inventory count, leads, revenue, analytics |
| CONTRACTOR | `/dashboard/service` | Job stats, pending/active/completed |
| FINANCE_PARTNER | `/dashboard/finance` | Application count, pending, approved |
| INSURANCE_PARTNER | `/dashboard/insurance` | Quote count, pending, accepted |
| ADMIN | `/dashboard/admin` | Platform-wide stats: users, listings, revenue |

---

### 17. Public Marketing

**Home Page**  
Server component with ISR (revalidate 300s). `HomeClient.tsx` renders: hero section, AI search widget, MaziumWidget floating chat, featured car carousel (up to 8 boosted listings), email capture ("Auctions Coming Soon" widget), browse by body type, discover section, testimonials section.

**Seller Public Profile**  
`/seller/[id]` — name, profile image, stats (total sales, reliability score, response rate), recent listings, reviews.

**AI Price Estimation**  
`MarketPriceData` and `PriceEstimateCache` models exist in schema with full confidence scoring, source tracking, and expiry TTL. No API endpoint exposes this to frontend. Feature present in data layer only.

**SEO**  
`VehicleJsonLd` component emits schema.org JSON-LD for vehicle listings. `sitemap.ts` and `robots.ts` configured. `PageViewTracker` component posts analytics events on route change.

---

## SECTION 4: User Flows

### Flow 1: New User Signup → Email Verify → Role Selection → Dashboard

1. User visits `/auth/signup`, submits form (email, password, firstName, lastName)
2. Frontend calls Supabase `auth.signUp()` → Supabase creates auth record
3. Frontend stashes email in `sessionStorage['pending_verification_email']`
4. Frontend calls `POST /users/sync` to upsert User record in backend DB
5. Frontend calls `POST /auth/send-verification` with `{email, redirectTo: '/auth/callback?redirect_to=/auth/onboarding'}` → Resend sends branded verification email
6. User clicks email link → Supabase processes confirmation → redirects to `/auth/callback`
7. `/auth/callback` reads Supabase session, calls `POST /auth/supabase-session` with JWT → backend validates JWT via `SUPABASE_JWT_SECRET`, upserts User, calls `req.session.regenerate()`, sets session `{userId, userRole}` → `sid` cookie issued
8. Redirected to `/auth/onboarding` (step: `verify`)
9. Onboarding checks `user.email_confirmed_at` — if confirmed, advances to step `location`
10. User enters location → `PATCH /users/me {location}` — session cache updated
11. User selects body type preferences, fuel preferences, budget range → `PATCH /users/me {preferences: {...}}`
12. Step `done` → redirect to `/dashboard` → role check → redirect to `/dashboard/buyer`

**API calls:** `POST /users/sync`, `POST /auth/send-verification`, `POST /auth/supabase-session`, `PATCH /users/me` (x2)

---

### Flow 2: Seller Creates Listing → Publishes → Goes Live

1. Seller navigates to `/dashboard/seller/add-listing`
2. `ListingWizard` step 1: enters VRM → `POST /dvla/lookup` → auto-fills make/model/fuel/MOT/tax/CO2
3. Seller completes wizard (details, pricing, images uploaded to Supabase Storage, video URLs, damage, delivery options, deceased estate flag, legal declarations, badge tier selection)
4. On submit: `POST /listings` → Listing created with `status = 'DRAFT'` → returns `{id, slug}`
5. Wizard triggers listing checkout: `POST /payments/listing-checkout {badgeTier, listingId}` → Stripe Checkout URL
6. Seller redirected to Stripe → completes payment
7. Stripe redirects to `/checkout/success?session_id=cs_...`
8. Stripe sends `checkout.session.completed` webhook → backend finds Transaction by `stripeSessionId` → sets `status = 'COMPLETED'`, `type = 'LISTING_FEE'`
9. Frontend/seller clicks "Publish" → `POST /listings/:id/publish` → backend confirms Transaction exists with COMPLETED status → `listing.status = 'ACTIVE'` → returns `{activated: true}`
10. Listing appears in `GET /listings` search results

**State changes:** Listing: `DRAFT → ACTIVE`, Transaction: `PENDING → COMPLETED`  
**FREE tier path:** `badgeTier = 'FREE'` → no payment required → `POST /listings/:id/publish` succeeds immediately

---

### Flow 3: Dealer Onboards → KYC → Gets Verified → Can Bid

1. User registers → defaults to BUYER role
2. User calls `POST /users/elevate {newRole: 'DEALER'}` → role changed to DEALER
3. DealerProfile auto-created in DB
4. Dealer navigates to `/dashboard/dealer/settings` → fills KYC form with company details + document uploads (to Supabase Storage)
5. `POST /dealers/kyc` → `DealerKyc` record created with `status = 'PENDING'`
6. Admin at `/dashboard/admin/dealer-verification` → `GET /admin/dealers/kyc-pending` → sees new application
7. Admin opens application → views each document URL in lightbox → makes per-field decisions
8. `PATCH /admin/dealers/kyc/:id/review {decisions: {...}, overallStatus: 'APPROVED'}` → `DealerKyc.documentStatuses` updated → `DealerProfile.isVerified = true`
9. Dealer can now call `POST /bids {listingId, amount}` without `ForbiddenException`

---

### Flow 4: Auction Lifecycle — Create → Live → Anti-Snipe → End → Winner

1. Seller (verified) with ACTIVE listing → `/dashboard/seller/auctions` → "Create Auction"
2. Fills: `startTime, reservePrice, startingBid, minIncrement, buyItNowPrice?` → `POST /auctions` → `endTime = startTime + 24h`, `status = 'SCHEDULED'`, listing `type → 'AUCTION'`
3. `AuctionLifecycleService` CRON (every 60s): `startTime` passes → `status → 'ACTIVE'` → `AuctionGateway.broadcastAuctionStart()` → emits `auction:started`
4. Verified dealers visit `/auctions/live/:id` → Socket.io connects to `/auctions` namespace → `auction:join {auctionId}` → joined to room `auction:{id}`
5. Server emits `auction:viewers {count}` to room
6. Dealer bids: amount > (currentHighest + minIncrement) → `POST /bids {listingId, amount}`
7. Backend validates dealer + KYC → creates Bid → checks anti-snipe:
   - If `endTime - now ≤ 3 minutes` → `endTime += 3 minutes` (updated in DB)
8. `AuctionGateway.broadcastBid()` emits `bid:new {amount, bidderInitials, timestamp, bidId, newEndTime?}` to entire room
9. Bidder receives 120-second cancel window — can call `PATCH /bids/:bidId/cancel` within that window
10. Previous highest bidder receives `OUTBID` notification
11. With ≤ 5 minutes left: CRON sends `AUCTION_ENDING` notifications to all bidders
12. `endTime` passes: CRON calls `AuctionsService.closeAuction()`:
    - `status → 'ENDED'`
    - `winnerId = highestBid.bidderId`
    - `winningBidAmount = highestBid.amount` (if ≥ reservePrice, otherwise no winner)
13. `AuctionGateway.broadcastAuctionEnd()` emits `auction:ended {winnerId, winningBidAmount, reserveMet}`
14. `AUCTION_WON` notification to winner + winner email; `AUCTION_ENDED` to all other bidders

---

### Flow 5: Buy It Now (BIN) [NEW]

1. Buyer on listing detail page or live auction page sees "Buy Now — £X,XXX" panel (only if BIN price set AND reserve not yet met)
2. Buyer clicks "Buy Now" → `POST /auctions/:id/bin-trigger` → `auction.buyItNowPendingBuyerId = buyer.id`, `auction.buyItNowPendingAt = now`
3. Socket.io emits `bin:pending {auctionId, buyerId}` to all room clients — bidding effectively pauses
4. Seller sees BIN pending notification on live auction page: "Buyer wants to buy now — Confirm or Decline within 24h"
5. **Path A — Seller Confirms:** `POST /auctions/:id/bin-confirm` → auction closed with winner = BIN buyer, winningBidAmount = BIN price → `auction:ended` emitted
6. **Path B — Seller Declines:** `POST /auctions/:id/bin-decline` → `buyItNowPendingBuyerId = null` → BIN button reappears for all buyers, auction continues

---

### Flow 6: Auction Winner Pays £125 Fee → Chat Unlocked

1. Winner sees "You won!" banner on `/auctions/live/:id` after `auction:ended` event
2. Banner shows "Pay £125 Fee" button → links to `/checkout?listing_id={listingId}&mode=auction_fee`
3. Checkout page shows: £125 total (£100 seller bonus + £25 platform)
4. User clicks "Checkout" → `POST /payments/checkout {listingId, amount: 125, type: 'COMMISSION'}` → `{url}` → Stripe redirect
5. User pays → Stripe redirects to `/checkout/success`
6. Stripe sends `checkout.session.completed` webhook → backend identifies type `COMMISSION`, finds associated Auction by `listingId` → `auction.buyerFeePaid = true`
7. Winner returns to `/auctions/live/:id` — "Message Seller" button is now enabled (was `disabled={!auction.buyerFeePaid}`)
8. Winner clicks → `createChatRoom(sellerId, listingId)` → `POST /chat/rooms {participantId: sellerId, listingId}` → creates/finds ChatRoom
9. Redirect to `/dashboard/buyer/messages?room={chatRoomId}`

**State changes:** `auction.buyerFeePaid: false → true`, ChatRoom record created

---

### Flow 7: Seller Payout — Handover Proof → Admin Approval → £100 Transfer

1. Auction ends with winner. Seller visits `/dashboard/seller/auctions`
2. Ended auction shows "Upload Handover Proof" button
3. Seller uploads proof image to Supabase Storage → gets URL → `POST /auctions/:id/handover-proof {proofUrl}`
4. Backend validates: auction ENDED, winner exists, proof not already submitted → sets `handoverProofUrl`, `handoverSubmittedAt`
5. Admin sees item in `/dashboard/admin/handovers` (ENDED auctions with proofUrl but `sellerBonusReleased = false`)
6. Admin views proof image, confirms handover → clicks "Approve"
7. Context-aware confirm dialog appears (shows payment path: Stripe/Bank/None)
8. `POST /admin/handovers/:id/approve`
9. **Path A — Stripe:** Seller has `stripeConnectAccountId` + `stripeConnectOnboardingComplete = true` → `stripe.transfers.create({amount: 10000, currency: 'gbp', destination: accountId})` → `stripePayoutTransferId` stored, `sellerBonusReleased = true`, `sellerBonusReleasedAt = now`
10. **Path B — Stripe failure:** Transfer throws exception → `stripePayoutError` stored → `PAYOUT_FAILED` notification pushed to all ADMIN users
11. **Path C — Bank only:** No Stripe account, has bank details → admin sees sort code/account number in UI → admin manually transfers £100
12. **Path D — Neither:** Admin receives UI warning, no payout possible until seller adds payment method

---

### Flow 8: Import Listing from External URL [NEW]

1. Seller/Dealer in inventory page → "Import Listing" button → `ImportListingModal` opens
2. Step 1: Paste URL from AutoTrader, CarGurus, or CarWow → `POST /listings/preview-import {url}` → returns scraped preview data
3. Step 2: Review extracted specs (read-only), edit title/price/VRM as needed → "Save & Choose Plan"
4. `POST /listings/import-from-url {url, price, vrm, title}` → creates DRAFT Listing with `importedFromUrl` and `importedSource` set
5. Step 3: Plan selection (BASIC/STANDARD/PREMIUM) → `PATCH /listings/:id {badgeTier}` updates as user changes selection
6. "Activate for £X" → `POST /payments/listing-checkout {listingId, badgeTier}` → Stripe Checkout redirect
7. OR "Do it later" → closes modal, listing saved in inventory as DRAFT
8. On listing detail page: badge shows "See on AutoTrader/CarGurus/CarWow" linking to `importedFromUrl`

---

### Flow 9: Bulk CSV Import (Dealer) [NEW]

1. Dealer in inventory page → "Bulk Import" button → `BulkImportModal` opens
2. Dealer downloads CSV template or prepares file with columns: `vrm, price, mileage, images` (pipe-separated image URLs)
3. Uploads CSV → RFC-4180 parser extracts rows
4. For each row: `POST /dvla/lookup {vrm}` → auto-fills make/model/fuel/year/colour → `POST /listings {vrm, price, mileage, make, model, ...}` → creates DRAFT listing
5. Progress bar shows `current / total` with error log for failed rows
6. On complete: dealer's inventory list refreshes

---

### Flow 10: Buyer Requests Delivery [NEW]

1. Buyer makes offer on a delivery-enabled listing → offer is accepted
2. On listing detail page, delivery section shows "Delivery available — £X est." with buyer's postcode queried against seller's lat/lng via `/api/delivery-distance`
3. Buyer fills delivery address (street, city, postcode) + optional notes → `POST /delivery-requests {listingId, deliveryAddress, deliveryNotes?}`
4. Backend validates: listing has `deliveryAvailable`, buyer has offer, no active duplicate, distance ≤ `deliveryMaxMiles` → creates DeliveryRequest `status = PENDING`, sets `expiresAt`
5. Seller sees pending delivery request → `PATCH /delivery-requests/:id/accept` or `/decline`
6. On accept: `status = ACCEPTED`, buyer notified
7. After delivery: buyer marks complete → `PATCH /delivery-requests/:id/complete` → `status = COMPLETED`
8. Alternate: buyer cancels before acceptance → `PATCH /delivery-requests/:id/cancel`

---

### Flow 11: Offer Negotiation — Counter-Counter (Full Multi-Round)

1. Buyer on `/buy-cars/[slug]` → fills offer amount (min 70% of asking price) → `POST /offers {listingId, amount, message?}` → Offer `status = 'PENDING'`
2. Seller receives `OFFER_RECEIVED` notification → visits `/dashboard/seller/offers`
3. Seller sees offer → clicks "Counter" → enters counter amount → `PATCH /offers/:id/respond {status: 'COUNTERED', counterAmount: X}`
4. `offer.status → 'COUNTERED'`, `offer.sellerCounterAmount = X`, `offer.lastCounteredBy = 'SELLER'`; buyer receives `COUNTER_RECEIVED` notification
5. Buyer visits `/dashboard/buyer/offers` → can Accept, Reject, or Counter-back with new amount: `PATCH /offers/:id/respond-counter {status: 'COUNTERED', counterAmount: Y}`
6. If buyer counters: `offer.buyerCounterAmount = Y`, `offer.lastCounteredBy = 'BUYER'`, `counterAttemptsBuyer++`; seller receives notification
7. Negotiation continues until accept/reject/expiry
8. Accepted path: `offer.status → 'ACCEPTED'`, `offer.finalAmount = last accepted amount`; all other PENDING offers on listing auto-rejected; `listing.status → 'OFFER_ACCEPTED'`
9. Seller manually records sale: `PATCH /listings/:id/sold {soldPrice, buyerName?, buyerEmail?, buyerPostcode?}`

---

### Flow 12: Seller Payout Setup → Stripe Connect Onboarding

1. Seller at `/dashboard/seller/settings` → sees "Connect with Stripe" card
2. `GET /users/stripe-connect/status` called on page load → if `detailsSubmitted = false` → shows onboarding button
3. Seller clicks → `POST /users/stripe-connect/onboard {returnUrl, refreshUrl}`:
   - If no `stripeConnectAccountId` → `stripe.accounts.create({type: 'express', country: 'GB', capabilities: {card_payments, transfers}})` → `user.stripeConnectAccountId = newId`
   - `stripe.accountLinks.create({account: id, type: 'account_onboarding', ...})` → returns onboarding URL
4. Frontend `window.location.href = url` (Stripe's hosted Express flow)
5. Seller completes identity, bank account, business details on Stripe
6. Stripe redirects to `returnUrl` (`/dashboard/seller/settings?stripe_connect=return`)
7. Frontend detects query param → calls `getStripeConnectStatus()` → shows updated UI
8. Stripe also sends `account.updated` webhook → `paymentsService.handleAccountUpdated(account)` → `user.stripeConnectOnboardingComplete = account.details_submitted`

---

### Flow 13: Admin Bans a User

1. Admin at `/dashboard/admin/users` → finds user → kebab menu → "Ban User"
2. Confirm dialog: "Ban [name]? They will no longer be able to log in."
3. `PATCH /admin/users/:id/ban` → `user.deletedAt = now`
4. User's existing sessions are NOT invalidated immediately (session-kill not implemented)
5. On user's next request, if session middleware checks `deletedAt`, access is blocked; otherwise user remains active until 7-day cookie expiry
6. Unban: `PATCH /admin/users/:id/unban` → `user.deletedAt = null`

---

### Flow 14: Boost a Listing → Featured on Homepage

1. Seller in `/dashboard/seller/listings` → kebab menu on listing → "Boost Listing"
2. `POST /featured-boost/:listingId` → ownership validated → creates FeaturedBoost (`isActive = false`) → creates Stripe Checkout (£25) → returns `{url}`
3. Seller pays on Stripe → redirects to success URL
4. Stripe webhook `checkout.session.completed` → identifies boost by `metadata.boostId` → `FeaturedBoost.isActive = true`, `listing.isFeatured = true`, `listing.featuredUntil = now + 7 days`
5. Listing appears in `GET /listings/featured` response → shown in homepage carousel
6. `FeaturedBoostExpiryService` CRON finds `featuredUntil < now` + `isActive = true` → sets `listing.isFeatured = false`, `FeaturedBoost.isActive = false`

---

## SECTION 5: Data Models

All models from `D:\carmazium\backend\prisma\schema.prisma`.

### Enums

| Enum | Values |
|---|---|
| `UserRole` | `ADMIN, BUYER, SELLER, DEALER, CONTRACTOR, FINANCE_PARTNER, INSURANCE_PARTNER` |
| `FuelType` | `PETROL, DIESEL, HYBRID, ELECTRIC, LPG, PLUGIN_HYBRID, HYDROGEN_CELL` |
| `TransmissionType` | `MANUAL, AUTOMATIC, CVT, SEMI_AUTOMATIC` |
| `ListingType` | `AUCTION, CLASSIFIED` |
| `VehicleType` | `CAR, HGV, MOTORCYCLE` |
| `ListingStatus` | `DRAFT, ACTIVE, OFFER_ACCEPTED, SOLD, WITHDRAWN` |
| `OfferStatus` | `PENDING, ACCEPTED, REJECTED, WITHDRAWN, COUNTERED` |
| `ServiceStatus` | `PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED` |
| `TransactionType` | `DEPOSIT, FULL_PAYMENT, COMMISSION, REFUND, HPI_REPORT, LISTING_FEE, BOOST` |
| `TransactionStatus` | `PENDING, COMPLETED, FAILED, REFUNDED` |
| `FinanceApplicationStatus` | `PENDING, APPROVED, REJECTED, COMPLETED` |
| `InsuranceQuoteStatus` | `PENDING, QUOTED, ACCEPTED, EXPIRED, REJECTED` |
| `BodyType` | `SEDAN, SUV, HATCHBACK, COUPE, CONVERTIBLE, ESTATE, CROSSOVER, SPORTS_CAR, MINIVAN, PICKUP_TRUCK, STATION_WAGON, MPV, VAN` |
| `VehicleCondition` | `EXCELLENT, GOOD, FAIR, POOR, CAT_S, CAT_N, CAT_C, CAT_D` |
| `WriteOffCategory` | `NONE, CAT_S, CAT_N, CAT_A, CAT_B` |
| `EuroStandard` | `EURO_4, EURO_5, EURO_6, EURO_6D` |
| `DealerRole` | `ADMIN, SALES_AGENT, FINANCE_MANAGER` |
| `LeadStatus` | `NEW, CONTACTED, QUALIFIED, NEGOTIATING, WON, LOST` |
| `AuctionStatus` | `SCHEDULED, ACTIVE, ENDED, CANCELLED` |
| `KycStatus` | `PENDING, APPROVED, REJECTED` |
| `PurchaseStatus` | `AWAITING_CONFIRMATION, REVIEWING_DOCS, CHECKS_COMPLETE, DELIVERY_REQUESTED` |
| `DeliveryStatus` | **[NEW]** `PENDING, ACCEPTED, DECLINED, COMPLETED, CANCELLED` |

### Models

#### `User` (`users` table)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | String (UUID) | No | PK |
| `email` | String | No | Unique |
| `passwordHash` | String | No | bcrypt |
| `role` | UserRole | No | Default BUYER |
| `firstName` | String | Yes | |
| `lastName` | String | Yes | |
| `phone` | String | Yes | |
| `profileImage` | String | Yes | Supabase Storage URL |
| `isEmailVerified` | Boolean | No | Default false |
| `isPhoneVerified` | Boolean | No | Default false |
| `isAddressVerified` | Boolean | No | Default false |
| `addressVerifiedAt` | DateTime | Yes | |
| `loginAttempts` | Int | No | Default 0 |
| `lockoutUntil` | DateTime | Yes | Admin-set |
| `stripeCustomerId` | String | Yes | Unique |
| `stripeConnectAccountId` | String | Yes | Unique |
| `stripeConnectOnboardingComplete` | Boolean | No | Default false |
| `bankAccountName` | String | Yes | Manual payout fallback |
| `bankSortCode` | String | Yes | Manual payout fallback |
| `bankAccountNumber` | String | Yes | Manual payout fallback |
| `payoutPreference` | String | Yes | Default "STRIPE" |
| `notifyOnSale` | Boolean | No | Default true |
| `showPublicProfile` | Boolean | No | Default true |
| `location` | String | Yes | |
| `preferences` | Json | Yes | Buyer preferences (bodyTypes, fuels, budget) |
| `createdAt` | DateTime | No | |
| `updatedAt` | DateTime | No | |
| `deletedAt` | DateTime | Yes | Soft-delete / ban flag |

#### `Listing` (`listings`) — Primary commerce model

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `vehicleId` | String | Yes | FK → Vehicle |
| `sellerId` | String | Yes | FK → User |
| `type` | ListingType | No | Default CLASSIFIED |
| `status` | ListingStatus | No | Default DRAFT |
| `title` | String | No | |
| `description` | String | Yes | AI-generated or manual |
| `price` | Decimal(12,2) | No | |
| `images` | String[] | No | Supabase Storage URLs |
| `videoUrls` | String[] | No | Embed URLs |
| `slug` | String | No | Unique, SEO-friendly |
| `viewCount` | Int | No | Default 0 |
| `vehicleType` | VehicleType | No | Default CAR |
| `make, model, year, mileage, vrm, fuelType, transmission, color, doors, seats, engineSize, bhp, bodyType` | Various | Yes | Denormalized |
| `features` | Json | Yes | |
| `location, latitude, longitude` | Various | Yes | |
| `vin` | String | Yes | |
| `condition` | VehicleCondition | Yes | |
| `ulezCompliant` | Boolean | Yes | |
| `euroStandard` | EuroStandard | Yes | |
| `co2Emissions` | Int | Yes | g/km |
| `motStatus, taxStatus, motExpiryDate, taxDueDate` | String | Yes | DVLA-populated |
| `markedForExport` | Boolean | Yes | |
| `monthOfFirstRegistration, wheelplan, typeApproval` | String | Yes | |
| `isFeatured` | Boolean | No | Default false |
| `featuredUntil` | DateTime | Yes | |
| `badgeTier` | String | No | Default "FREE" |
| `priceMin, priceMax` | Decimal(12,2) | Yes | Offer range bounds |
| `stolenRecovered, hasOutstandingFinance, isLegalRegisteredKeeper` | Boolean | Yes | Declarations |
| `writeOffCategory` | WriteOffCategory | Yes | Default NONE |
| `variant, driveType, numberOfKeys, serviceHistory` | String | Yes | |
| `owners` | Int | Yes | Number of previous owners |
| `torqueNm, topSpeedMph, zeroTo60Mph, combinedMpg, extraUrbanMpg` | Various | Yes | Performance specs |
| `bannerLabel` | String | Yes | Ribbon text |
| `isImported` | Boolean | No | Default false |
| `isDepartedSale` | Boolean | Yes | **[NEW]** Deceased estate listing flag |
| `departedRelationship` | String | Yes | **[NEW]** Relationship to deceased (e.g. "son", "executor") |
| `deliveryAvailable` | Boolean | Yes | **[NEW]** Seller offers delivery |
| `deliveryPricePerMile` | Decimal | Yes | **[NEW]** Per-mile charge ex-VAT |
| `deliveryMaxMiles` | Int | Yes | **[NEW]** Maximum delivery radius in miles |
| `importedFromUrl` | String | Yes | **[NEW]** Original listing URL (AutoTrader/CarGurus/CarWow) |
| `importedSource` | String | Yes | **[NEW]** Platform identifier: AUTOTRADER, CARGURUS, CARWOW |
| `linkedListingId` | String | Yes | **[NEW]** FK to sister listing (dual-channel) |
| `deletedAt` | DateTime | Yes | |

#### `Auction` (`auctions`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `listingId` | String | No | Unique FK |
| `startTime` | DateTime | No | |
| `endTime` | DateTime | No | startTime + 24h; extended by anti-snipe |
| `reservePrice` | Decimal(12,2) | No | |
| `startingBid` | Decimal(12,2) | No | |
| `minIncrement` | Decimal(12,2) | No | |
| `status` | AuctionStatus | No | Default SCHEDULED |
| `winnerId` | String | Yes | FK → User |
| `winningBidAmount` | Decimal(12,2) | Yes | |
| `buyerFeePaid` | Boolean | No | Default false |
| `buyerFeeTransactionId` | String | Yes | |
| `handoverProofUrl` | String | Yes | |
| `handoverSubmittedAt` | DateTime | Yes | |
| `sellerBonusReleased` | Boolean | No | Default false (idempotency gate) |
| `sellerBonusReleasedAt` | DateTime | Yes | |
| `stripePayoutTransferId` | String | Yes | |
| `stripePayoutError` | String | Yes | |
| `buyItNowPrice` | Decimal(12,2) | Yes | **[NEW]** Optional BIN price |
| `buyItNowPendingBuyerId` | String | Yes | **[NEW]** Set when buyer triggers BIN |
| `buyItNowPendingAt` | DateTime | Yes | **[NEW]** When BIN was triggered (24h expiry) |
| `deletedAt` | DateTime | Yes | |

#### `Offer` (`offers`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `listingId` | String | No | FK |
| `buyerId` | String | No | FK → User |
| `sellerId` | String | Yes | FK → User |
| `amount` | Decimal(12,2) | No | Current/initial offer |
| `amountMin, amountMax` | Decimal | Yes | Buyer's stated range |
| `status` | OfferStatus | No | Default PENDING |
| `message` | String | Yes | |
| `initialAmount, finalAmount` | Decimal | Yes | Ledger |
| `sellerCounterAmount` | Decimal | Yes | Seller's counter value |
| `buyerCounterAmount` | Decimal | Yes | **[NEW]** Buyer's counter value |
| `counterAmount` | Decimal | Yes | Legacy field (backwards compat — see Issue 14) |
| `counterAttemptsBuyer` | Int | Yes | **[NEW]** Number of times buyer has countered |
| `counterAttemptsSeller` | Int | Yes | **[NEW]** Number of times seller has countered |
| `counterExpiresAt` | DateTime | Yes | **[NEW]** Counter offer expiry |
| `lastCounteredBy` | String | Yes | **[NEW]** 'BUYER' or 'SELLER' |

#### `DeliveryRequest` (`delivery_requests`) [NEW]

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | String (UUID) | No | PK |
| `listingId` | String | No | FK |
| `offerId` | String | No | FK → Offer |
| `buyerId` | String | No | FK → User |
| `sellerId` | String | No | FK → User |
| `deliveryAddress` | Json | No | `{street, city, postcode}` |
| `deliveryNotes` | String | Yes | |
| `distanceMiles` | Float | No | Calculated server-side |
| `estimatedCostGbp` | Float | No | Calculated server-side |
| `status` | DeliveryStatus | No | Default PENDING |
| `expiresAt` | DateTime | No | Request expiry |
| `acceptedAt` | DateTime | Yes | |
| `declinedAt` | DateTime | Yes | |
| `cancelledAt` | DateTime | Yes | |
| `completedAt` | DateTime | Yes | |
| `createdAt` | DateTime | No | |
| `updatedAt` | DateTime | No | |

#### `Sale` (`sales`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `listingId` | String | No | Unique FK |
| `sellerId` | String | No | FK |
| `buyerId` | String | Yes | FK; null for private/offline buyers |
| `buyerName, buyerEmail` | String | Yes | For offline buyers |
| `buyerPostcode` | String | Yes | **[NEW]** Buyer's postcode (analytics/delivery) |
| `soldPrice` | Decimal(12,2) | No | |
| `purchaseStatus` | PurchaseStatus | No | Default AWAITING_CONFIRMATION |

#### Other models (unchanged from baseline)

`SellerProfile`, `SellerReview`, `DealerProfile`, `DealerKyc`, `DealerInvite`, `DealerStaff`, `Lead`, `ContractorProfile`, `PartnerProfile`, `Vehicle`, `Bid`, `HpiReport`, `ChatRoom`, `Message`, `Notification`, `AnalyticsEvent`, `EmailCapture`, `FeaturedBoost`, `MarketPriceData`, `PriceEstimateCache`, `DamageRecord`, `AddressVerification`, `Transaction`, `ServiceRequest`, `Session` — see baseline audit for field-level detail.

---

## SECTION 6: Integrations & External Services

### Supabase

| Aspect | Detail |
|---|---|
| **Purpose** | Auth provider + PostgreSQL host + file storage |
| **Auth usage** | Email/password signup, email verification, JWT issuance. Frontend bridges to backend session via `POST /auth/supabase-session` |
| **Storage** | Vehicle images, KYC documents, handover proof images stored in Supabase Storage buckets |
| **Database** | Primary PostgreSQL database |
| **Files** | `src/lib/supabase.ts`, `backend/src/auth/auth.service.ts` |
| **Env vars** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` |

### Stripe

| Aspect | Detail |
|---|---|
| **Purpose** | Payment processing + seller payouts via Stripe Connect |
| **Checkout** | Listing fee, boost, HPI report, auction buyer fee, deposits, full payment |
| **Connect** | Express accounts for seller payouts. `stripe.transfers.create` moves £100 to seller on handover approval |
| **Webhook events** | `checkout.session.completed` (updates transactions, activates features), `account.updated` (updates onboarding status) |
| **Mobile SDK** | `POST /payments/intent` returns Payment Sheet data for React Native native SDK |
| **Files** | `backend/src/payments/payments.service.ts`, `backend/src/users/users.service.ts` |
| **Env vars** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on frontend) |

### Resend

| Aspect | Detail |
|---|---|
| **Purpose** | Transactional email |
| **Used for** | Email verification, auction winner notification, dealer staff invitations |
| **Template** | Branded dark-theme HTML template in `backend/src/email/email.service.ts` |
| **Files** | `backend/src/email/email.service.ts` |
| **Env vars** | `RESEND_API_KEY`, `EMAIL_FROM` |

### OpenAI

| Aspect | Detail |
|---|---|
| **Purpose** | AI-powered product features |
| **Features** | Natural language vehicle search (`/ai/search`), AI assistant chat (`/ai/chat`) used by MaziumWidget, listing description generation (`/ai/generate-description`), damage image analysis (`/damage/analyze` via GPT-4 Vision) |
| **Files** | `backend/src/ai/ai.service.ts`, `backend/src/damage/damage.service.ts` |
| **Env vars** | `OPENAI_API_KEY` |

### DVLA VES API

| Aspect | Detail |
|---|---|
| **Purpose** | UK vehicle registration lookups |
| **Used for** | VRM lookup in listing wizard, bulk CSV import — returns make, model, colour, fuel type, MOT status, tax status, CO2, month of first registration |
| **Files** | `backend/src/dvla/dvla.service.ts`, `src/lib/dvlaApi.ts` |
| **Env vars** | `DVLA_API_KEY` |

### OneAutoAPI (HPI Check)

| Aspect | Detail |
|---|---|
| **Purpose** | UK vehicle history / HPI report provider |
| **Used for** | Full HPI check after £9.99 payment. Returns finance outstanding, stolen status, write-off categories |
| **Files** | `backend/src/hpi/hpi.service.ts` |
| **Env vars** | Likely `ONEAUTOAPI_KEY` (verify in `hpi.service.ts`) |

### Google Maps [NEW]

| Aspect | Detail |
|---|---|
| **Purpose** | Distance Matrix API for delivery distance calculations |
| **Used for** | Frontend `/api/delivery-distance` Next.js route and backend `DeliveryService` both call Google Maps to compute driving distance in miles between listing origin and buyer destination |
| **Files** | `src/app/api/delivery-distance/route.ts`, `backend/src/delivery/delivery.service.ts` |
| **Env vars** | `GOOGLE_MAPS_API_KEY` (frontend Next.js env), backend env key TBD |

### Redis

| Aspect | Detail |
|---|---|
| **Purpose** | Socket.io multi-instance adapter |
| **Used for** | Ensures bid broadcasts and notifications reach all connected clients across multiple NestJS pods |
| **Files** | `backend/src/core/adapters/redis-io.adapter.ts` |
| **Env vars** | `REDIS_URL` |

### Fly.io (Backend Hosting)

| Aspect | Detail |
|---|---|
| **Platform** | NestJS backend deployed on Fly.io |
| **URL** | `https://carmazium-hjoh9w.fly.dev` |
| **Port** | `process.env.PORT ?? 8080` |
| **Config** | `backend/fly.toml` |

### Vercel (Frontend Hosting)

| Aspect | Detail |
|---|---|
| **Platform** | Next.js 14 App Router |
| **ISR** | Featured listings revalidated every 300s |
| **Env vars** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

### Infrastructure Middleware

| Service | Purpose | Config Location |
|---|---|---|
| express-session | Server-side session management | `backend/src/main.ts` |
| connect-pg-simple | PostgreSQL session store | `backend/src/main.ts` — table `sessions` |
| Helmet | HTTP security headers | `backend/src/main.ts` |
| Raw body middleware | Stripe webhook signature verification | `backend/src/main.ts` — applies to `/payments/webhook` only |

---

## SECTION 7: Known Gaps, Stubs & Issues

### Critical Bugs / Logic Issues

**Issue 1: Bidding Restricted to Verified Dealers Only**

- **File:** `backend/src/bids/bids.service.ts` lines 60–63
- **Code:** `if (!dealerProfile?.isVerified) throw new ForbiddenException('Only verified dealers can bid on auctions')`
- **Problem:** Regular buyers (BUYER role) cannot bid at all. The live auction UI renders a bid form for all logged-in users, but the backend rejects any bid from a non-DEALER or unverified DEALER.
- **Impact:** If the product intends regular buyer bidding, this is a blocking defect.
- **Fix approach:** Either remove the dealer check to allow all authenticated users to bid, or add role-aware messaging in the auction page UI.

**Issue 2: Auction Duration Comment Mismatch**

- **File:** `backend/src/auctions/auctions.service.ts` line 18, `src/lib/auctionApi.ts` line 97 comment
- **Code constant:** `AUCTION_DURATION_MS = 24 * 60 * 60 * 1000` — 24 hours
- **Frontend comment says:** "endTime is always startTime + 6h server-side" (in `CreateAuctionRequest` JSDoc)
- **Swagger doc says:** "5 hours"
- **Impact:** Mobile app and marketing copy may display incorrect auction durations.
- **Fix approach:** Decide on canonical duration, update constant + both comment locations + Swagger doc + UI copy.

**Issue 3: Handover Deny — Buyer Refund Not Automated**

- **Endpoint:** `POST /admin/handovers/:auctionId/deny` exists in controller
- **Problem:** No programmatic Stripe refund call found in `AdminService.denyHandover`. The £125 buyer fee is not automatically refunded.
- **Fix approach:** Add `stripe.refunds.create({payment_intent: auction.buyerFeeTransactionId})` in `denyHandover()`.

**Issue 4: Ban Does Not Invalidate Active Sessions**

- **Problem:** Setting `user.deletedAt` does not destroy existing `sid` sessions. Banned users retain session cookies valid for up to 7 days.
- **Fix approach:** On ban, delete all sessions for this userId from the `sessions` table, or add `deletedAt` check in `SessionAuthGuard.validateSession`.

---

### Security Issues

**Issue 5: Analytics Endpoints Publicly Accessible**

- **File:** `backend/src/analytics/analytics.controller.ts`
- **Endpoints:** `GET /analytics/summary`, `GET /analytics/events`, `GET /analytics/emails`
- **Code comment:** `// TODO: Add admin auth guard when ready`
- **Problem:** Anyone can read the full list of captured email leads (`email_captures` table) and all platform analytics events without authentication.
- **Impact:** Email lead list is publicly readable. Potential GDPR issue.
- **Fix approach:** Add `@UseGuards(SessionAuthGuard, RolesGuard)` + `@Roles('ADMIN')` decorators immediately.

**Issue 6: Bank Sort Code Shown in Plaintext in Admin Table**

- **File:** `src/app/dashboard/admin/users/page.tsx` lines 209–210
- **Code:** `<div>Sort: {u.bankSortCode} · ****{u.bankAccountNumber.slice(-4)}</div>`
- **Problem:** Bank sort code shown in full in admin UI (only account number is masked).
- **Fix approach:** Mask sort code as `**-**-{last2}` or show on demand only.

---

### Partially Implemented Features

**Issue 7: AI Price Estimation — Data Layer Only**

- **Models:** `MarketPriceData`, `PriceEstimateCache` fully defined in schema
- **Problem:** No controller, service method, or API endpoint exposes price estimation.
- **Fix approach:** Create `GET /listings/:id/price-estimate` or `POST /price-estimate {make, model, year, mileage}` backed by `PriceEstimateCache`.

**Issue 8: PurchaseStatus Has No Management Endpoint**

- **Models:** `Sale.purchaseStatus` enum: `AWAITING_CONFIRMATION, REVIEWING_DOCS, CHECKS_COMPLETE, DELIVERY_REQUESTED`
- **Problem:** No API endpoint updates `Sale.purchaseStatus`. Dealer purchases page cannot manage post-sale document pipeline.
- **Fix approach:** Add `PATCH /sales/:id/status {purchaseStatus}` endpoint.

**Issue 9: Partner API Key Authentication Not Implemented**

- **Schema:** `PartnerProfile.apiKey` (unique) and `PartnerProfile.callbackUrl` defined
- **Problem:** No API-key guard middleware. Partners use session cookie auth. `callbackUrl` is never called.
- **Fix approach:** Create `ApiKeyAuthGuard`. Implement outbound webhook calls to `callbackUrl` on status changes.

**Issue 10: Contractor KYC / Vetting Not Implemented**

- **Problem:** Any user with `CONTRACTOR` role can immediately accept service requests. No KYC or vetting.
- **Fix approach:** Create `ContractorKyc` model + submission/review flow mirroring `DealerKyc`.

**Issue 11: BIN Confirmation — No Dashboard UI for Sellers**

- **Problem:** Seller can confirm/decline BIN from the live auction page, but no dashboard notification or dedicated page shows pending BIN requests. Sellers must be watching the live auction room to see a BIN request.
- **Impact:** BIN requests that come in while seller is offline will be missed until they open the live auction room.
- **Fix approach:** Add BIN pending notifications via `NotificationsGateway`; add BIN pending state to auction management dashboard.

**Issue 12: Delivery Requests — No Buyer/Seller Dashboard UI**

- **Problem:** Full `DeliveryController` and `DeliveryService` are implemented. `deliveryApi.ts` has all client functions. But no dashboard page surfaces delivery request management to buyers or sellers.
- **Impact:** Delivery requests can only be managed via direct API calls; there is no UI.
- **Fix approach:** Add delivery tab to buyer dashboard (showing submitted requests + status) and to seller offers/listings page (showing incoming requests per listing).

---

### Dead Code / Unreachable Routes

**Issue 13: `/dashboard/user` Is Unreachable**

- **File:** `src/app/dashboard/user/page.tsx`
- **Problem:** The `/dashboard` router redirects based on role to role-specific dashboards. No role routes to `/dashboard/user`. This page is unreachable in normal navigation.
- **Fix approach:** Either remove the page or assign it as the default for BUYER role.

---

### Data Model Inconsistencies

**Issue 14: `badgeTier` Default "FREE" vs Payment Enum**

- **Listing schema:** `badgeTier String @default("FREE")`
- **Payment endpoint:** `POST /payments/listing-checkout` body expects `badgeTier: 'BASIC' | 'STANDARD' | 'PREMIUM'`
- **Problem:** The `badgeTier` field is a plain string (not a Prisma enum). No migration path defined if tier names change.
- **Fix approach:** Convert `badgeTier` to a Prisma enum `ListingBadgeTier { FREE, BASIC, STANDARD, PREMIUM }` for type safety.

**Issue 15: Offer `counterAmount` Legacy Field**

- **Schema comment:** "Keep this for backwards compatibility if needed, or remove it later."
- **Problem:** Both `counterAmount` (legacy) and `sellerCounterAmount`/`buyerCounterAmount` (new structured fields) coexist. Mobile team building offer UI must use canonical fields.
- **Canonical fields:** `sellerCounterAmount` for seller counter, `buyerCounterAmount` for buyer counter, `finalAmount` for accepted price.
- **Fix approach:** Remove `counterAmount` in a migration after confirming no active queries depend on it.

---

### Missing Test Coverage

**Issue 16: Core Business Logic Untested**

- **Test files found:** `backend/src/bids/bids.service.spec.ts`, `backend/src/listings/listings.controller.spec.ts`, `backend/src/listings/listings.service.spec.ts`, `backend/src/offers/offers.service.spec.ts`, `backend/src/auctions/auctions.service.spec.ts`, `backend/src/delivery/delivery.service.spec.ts`
- **No tests for:** `AuctionLifecycleService` (cron), `PaymentsService`, `AdminService` (handover/payout), `AuthService`, `UsersService`
- **Highest risk untested areas:**
  - `AuctionLifecycleService.closeAuction()` — winner selection, notification dispatch
  - `AdminService.approveHandover()` — payout idempotency guard, Stripe transfer
  - `PaymentsService.processWebhook()` — all webhook event branches
  - BIN state machine: trigger → confirm/decline → auction close

---

### Open TODOs in Code

| File | Line | TODO | Risk |
|---|---|---|---|
| `backend/src/analytics/analytics.controller.ts` | ~25 | `// TODO: Add admin auth guard when ready` | HIGH — open data leak |
| `backend/src/finance/finance.controller.ts` | 62, 84 | `// @ts-ignore - Prisma types might need refresh` | MEDIUM — type safety suppressed |
| `backend/src/insurance/insurance.controller.ts` | 62, 84 | `// @ts-ignore - Prisma types might need refresh` | MEDIUM — type safety suppressed |
| `backend/src/service-requests/service-requests.controller.ts` | 49, 67, 91, 132 | `// @ts-ignore` | MEDIUM — type safety suppressed |
| `src/lib/auctionApi.ts` | 97 | JSDoc says "endTime = startTime + 6h" | MEDIUM — incorrect documentation |

---

## Mobile Parity Gap Summary

Features present on **web only** (not yet confirmed on mobile):

| Feature | Web Location | Mobile Status |
|---|---|---|
| Buy It Now (BIN) auction flow | `/auctions/live/[id]`, `/buy-cars/[slug]` | Not confirmed |
| Cancel Bid (2-min window) | Live auction page | Not confirmed |
| Accept Bid Early / Close Auction Early | Live auction page (seller) | Not confirmed |
| Listing Import from URL (AutoTrader/CarGurus/CarWow) | Inventory dashboard | Not confirmed |
| Bulk CSV Import | Inventory dashboard | Not confirmed |
| Dual-Channel Listings (also-list-retail / also-auction) | Dashboard | Not confirmed |
| Delivery System (request, track, manage) | Listing detail + backend | Not confirmed |
| Deceased Estate Sale flag | Listing wizard + detail | Not confirmed |
| 3D Vehicle Viewer (WebGL damage zones) | Listing detail + auction room | Not confirmed |
| Finance Calculator (on-page) | Listing detail | Not confirmed |
| MaziumWidget AI Chat | Homepage | Not confirmed |
| Vehicle Comparison (up to 3) | `/compare` + `CompareContext` | Not confirmed |
| Seller Review system | Public seller profile | Not confirmed |
| Dealer CRM (Kanban board) | Dealer dashboard | Not confirmed |
| Dealer Analytics (11 chart types) | Dealer dashboard | Not confirmed |
| Dealer Team Management (invite staff) | Dealer dashboard | Not confirmed |
| Dealer Bulk CSV Import | Dealer inventory | Not confirmed |
| Multi-round counter-offer (buyer can counter back) | Offer dashboards | Not confirmed |
| Delivery filter in search | `/search` | Not confirmed |
| Address Verification (OTP) | User settings | Not confirmed |
| Admin handover approval UI | Admin dashboard | Not confirmed |
| Admin KYC review UI | Admin dashboard | Not confirmed |
| Stripe Connect onboarding (seller) | Seller settings | Not confirmed |
| Featured boost (£25, 7-day) | Listing management | Not confirmed |
| Finance/Insurance partner dashboards | Partner dashboards | Not confirmed |
| Contractor/Service provider dashboards | Contractor dashboards | Not confirmed |

---

*End of original Feature Audit — CarMazium — 2026-06-27*

---

## SECTION 8: Mobile App Feature Inventory (2026-08-05)

The original audit above covers the web app only. There is a second, complete codebase at `carmazium app/carmazium app/` — a React Native / Expo application — that was never inventoried. It matters directly for §9: the signed quotation's Exclusions (§9 of the quotation, "Native mobile applications") explicitly carve mobile out of the PKR 200,000 scope.

**Scale:** 136 TypeScript/TSX source files, 57 screens, a full navigation stack (auth, main tab, dealer-specific), its own API client layer mirroring the web's (`listingsApi`, `auctionApi`, `financeApi`, `deliveryApi`, `paymentsApi`, `notificationsApi`, `chatApi` via Supabase), Zustand stores (`authStore`, `watchlistStore`), a 3D WebGL damage viewer ported into a WebView, Stripe payment sheet integration, push notifications, and its own EAS build/release tooling (`scripts/release-android.mjs`, Android release-signing config, Gradle memory-limit plugin) — i.e. this is not a thin wrapper, it's a parallel native client hitting the same backend.

**Commit volume:** of the ~222 commits since the 2026-06-27 web audit, **115 are mobile-specific** (`feat(mobile)` ×51, `fix(mobile)` ×50, `refactor(mobile)` ×5, `docs(mobile)` ×9) — over half of all recent development effort. This app did not exist in any form the quotation could have anticipated it at the scale it's reached.

### 8.1 Screens by area

| Area | Screens |
|---|---|
| Onboarding & Auth | `SplashScreen`, `OnboardingScreen`, `LoginScreen`, `SignupScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `VerifyEmailScreen`, `PostSignupOnboardingScreen`, `AcceptInviteScreen` |
| Browse & Discover | `HomeScreen`, `SearchScreen`, `VehicleDetailScreen`, `CompareScreen`, `SavedScreen`, `WatchlistScreen`, `ReviewsScreen` |
| Auctions | `LiveScreen`, `AuctionDetailScreen`, `AuctionCompleteScreen`, `BuyerBidsScreen` |
| Buying & Purchases | `BuyerDashboardScreen`, `BuyerOffersScreen`, `BuyerPurchaseHistoryScreen`, `BuyerDeliveryRequestsScreen`, `PurchaseFlowScreen`, `PaymentHistoryScreen` |
| Selling (private) | `SellCarFlowScreen`, `MyListingDashboardScreen`, `SellerDashboardScreen`, `SellerListingsScreen`, `SellerAuctionsScreen`, `SellerOffersScreen`, `SellerPerformanceScreen`, `SellerProfileScreen`, `EarningsScreen` |
| Dealer | `DealerOnboardingScreen`, `DealerKYCScreen`, `DealerProfileScreen`, `DealerInventoryScreen`, `DealerAnalyticsScreen`, `DealerEarningsScreen`, `DealerFinanceScreen`, `DealerLeadsScreen` (CRM), `DealerOffersScreen`, `DealerMyOffersScreen`, `DealerPurchasesScreen`, `DealerTeamScreen` |
| Chat & Notifications | `ChatScreen`, `MessagesScreen`, `NotificationsScreen`, `NotificationSettingsScreen` |
| Finance / Services | `FinanceScreen`, `ServicesScreen` |
| Account, Settings & Static | `SettingsScreen`, `AboutScreen`, `ContactScreen`, `HowItWorksScreen`, `PricingScreen`, `TermsScreen`, `UnifiedDashboardScreen` |

Every buyer, private-seller, and dealer flow that exists on web (auctions, offers, chat, delivery requests, KYC, CRM, analytics, team management, earnings, payments) has a native counterpart here. This is effectively the full platform, rebuilt a second time for iOS/Android.

---

## SECTION 9: Quotation Scope Comparison (2026-08-05)

Comparison basis: `PROJECT QUOTATION — Carmazium Platform Rebuild`, PKR 200,000, 8-week timeline, 5 phases, provided by the user. Everything below is checked against the actual codebase as of this commit, not against the older 2026-06-27 audit text.

### 9.1 Context

- The quotation covers an **8-week** build.
- The repo's first commit is 2026-01-20; the latest is today. That's **~6.5 months** and **1,035 commits** total — roughly 3.5x the quoted timeframe.
- 222 of those commits landed after the last internal audit (2026-06-27) alone.

### 9.2 Phase-by-phase: quoted vs. delivered

**Phase 1 — Core Marketplace (quoted: Weeks 1–2, PKR 60,000)**

| Quoted item | Status | Notes |
|---|---|---|
| User authentication & role management (Buyer, Seller, Admin) | ✅ Delivered, far exceeded | 7 roles exist: `ADMIN, BUYER, SELLER, DEALER, CONTRACTOR, FINANCE_PARTNER, INSURANCE_PARTNER` — 4 roles beyond what was quoted, each with its own dashboard |
| Vehicle listing creation and management | ✅ Delivered, far exceeded | Wizard-based creation, DVLA VES auto-fill, HPI history checks, URL import/scraping (AutoTrader/CarGurus/CarWow), bulk CSV import, dual-channel listing (list as retail *and* auction simultaneously), admin approval queue before going live |
| Media uploads (images/videos) | ✅ Delivered | Images + video URLs, Supabase Storage-backed |
| Search and filtering | ✅ Delivered, exceeded | Location/postcode + distance radius, delivery filter, AI natural-language search (see Phase 4) |
| Core UI foundations and responsive layouts | ✅ Delivered, exceeded | Full light/dark theme system added sitewide, not just responsive layout |

**Phase 2 — Real-Time Auction System (quoted: Weeks 3–4, PKR 60,000)**

| Quoted item | Status | Notes |
|---|---|---|
| Live auction engine | ✅ Delivered | |
| Real-time bidding via WebSockets | ✅ Delivered | `AuctionGateway` (Socket.IO) |
| Redis-based concurrency handling | ✅ Delivered | `ioredis` + `@socket.io/redis-adapter` in `backend/package.json`, used for cross-instance bid broadcast |
| Anti-sniping logic | ✅ Delivered | |
| Auction-focused UX (timers, bid feedback, live updates) | ✅ Delivered, exceeded | Also: Buy It Now, cancel-bid window, auction results modal, dealer-specific won-auction dashboard, seller self-rating/digest, auction promo/marketing box |

**Phase 3 — Payments & Escrow (quoted: Week 5 – mid Week 6, part of PKR 80,000)**

| Quoted item | Status | Notes |
|---|---|---|
| Stripe Connect marketplace integration | ✅ Delivered | Express onboarding for sellers |
| Escrow logic (pre-authorization, capture, refunds) | ⚠️ **Not what was quoted** | See §9.6 below — the platform does not escrow the vehicle sale price at all. Stripe charges are immediate-capture, one-off fees (listing fee, £125 auction buyer fee, £9.99 HPI, £25 featured boost). The vehicle payment itself is explicitly **off-platform** — the app's own UI states *"Payment will not be made on our platform"* and *"All transactions are arranged directly between buyer and seller."* |
| Seller payouts and platform fee handling | ✅ Delivered, but scoped differently | Not a payout of sale proceeds — a fixed £100 "seller bonus" via Stripe Connect transfer, released after admin approves handover proof |
| Secure payment UI and checkout experience | ✅ Delivered | |

**Phase 4 — AI Assistant "Mazium 2.0" (quoted: mid Week 6 – Week 7, part of PKR 80,000)**

| Quoted item | Status | Notes |
|---|---|---|
| AI-based vehicle valuation suggestions | ❌ **Not delivered** | `MarketPriceData` / `PriceEstimateCache` models exist in the schema but no controller/endpoint exposes them. Confirmed still true as of today — no `price-estimate` route anywhere in `backend/src`. |
| Natural language search | ✅ Delivered | `POST /ai/search` |
| AI-powered vehicle comparisons | ⚠️ **Partially — not actually AI** | `/compare` is a real, working feature (compare up to 3 cars) but it's a manual spec-table comparison; no AI/OpenAI call in `src/app/compare/page.tsx` |
| Conversational UX integration | ✅ Delivered | `POST /ai/chat` + sitewide "Mazium AI" chat widget |
| *(bonus, not quoted)* AI listing-description generation | ✅ Extra | `POST /ai/generate-description` |

**Phase 5 — Communication & Admin (quoted: Week 8, part of PKR 80,000)**

| Quoted item | Status | Notes |
|---|---|---|
| Buyer–seller real-time chat | ✅ Delivered | Socket.IO `ChatGateway` |
| Admin dashboard | ✅ Delivered, far exceeded | Users, listings, auctions, transactions, handovers, payouts, KYC review, marketing popup management, site analytics |
| User verification and moderation | ✅ Delivered, far exceeded | Structured per-field KYC review (not just a yes/no verify toggle), plus a full listing-approval queue (pending/rejected, reject-with-reason, now inline-editable — see today's change) that the quotation never mentions as a concept |
| Basic financial and activity reporting | ✅ Delivered, exceeded | Branded letterhead PDF receipts, CSV earnings export, per-role earnings dashboards |
| Final UI polish and launch preparation | ✅ Delivered | Production domain cutover to carmazium.com, SEO metadata/sitemap/JSON-LD, GA4, Search Console verification |

### 9.3 Entire feature verticals with no basis in the quotation

These aren't extensions of a quoted item — they're categories of functionality the quotation never mentions in any form:

- **Three additional user roles / business verticals**: Dealer (with its own CRM/Kanban lead board, analytics with 11 chart types, team/staff invites, bulk import, dedicated onboarding+KYC), Finance Partner (loan application review), Insurance Partner (quote handling), Contractor/Service Provider (service job requests + messaging). The quotation scoped **3 roles**: Buyer, Seller, Admin.
- **Offers & negotiation system** — make-offer, counter-offer, multi-round back-and-forth, offer status tracking across every dashboard. Entirely separate mechanism from "auctions," never mentioned.
- **Buy It Now (BIN)** on auctions — instant-purchase price alongside bidding.
- **Delivery system** — buyer requests delivery, price-per-mile quoting, dealer/seller delivery-request management, delivery filter in search.
- **Vehicle history / compliance integrations** — DVLA VES API (auto-fills MOT/tax/registration data) and OneAutoAPI HPI checks (paid, £9.99) — not in the quotation's integrations list at all (§4 lists only PostgreSQL, Redis, S3, Stripe Connect, OpenAI).
- **3D WebGL vehicle damage viewer**, ported to both web and mobile (via WebView), with auto-computed exterior grading from damage records.
- **Featured/Boost listings** — paid (£25/7-day) promotional placement, its own cron-based expiry job.
- **Watchlist / Wishlist**, with reminder notifications.
- **Seller review/rating system**.
- **Notification system** — in-app + push, a `NotificationsGateway`, and granular per-type user preferences (not mentioned in quotation at all).
- **Google Maps / geocoding** — location-based search, distance sorting/filtering.
- **Admin-manageable marketing popup system**.
- **Email template system** — transactional emails via Resend for verification, listing approval/rejection, offer alerts, etc.
- **Full SEO infrastructure** — sitemap generation, JSON-LD structured data, robots.ts, OpenGraph metadata, Search Console + GA4 wiring. The quotation's only related line is "Server-side rendering for SEO" as an architecture note, not a deliverable.
- **The entire native mobile app** — see §8. This one is explicit: the quotation's own Exclusions section (§9) lists "Native mobile applications" as *not included*.

### 9.4 Explicit exclusions delivered anyway

The quotation's §9 "Exclusions" lists six items as **not included** in the PKR 200,000. Two were built regardless:

| Excluded item (quotation §9) | Actual status |
|---|---|
| Native mobile applications | Built in full — 57-screen React Native/Expo app, full platform parity (§8) |
| Advanced analytics dashboards | Built — Admin Analytics page, Dealer Analytics (11 chart types), Google Analytics 4 integration |

The other four exclusions (cloud/API costs, branding/logo redesign, post-launch maintenance) appear to have been respected as billed separately or not applicable — nothing in the repo suggests otherwise, though that's a billing question outside what the code can answer.

### 9.5 Architecture: quoted vs. actual

| Quoted (§4) | Actual |
|---|---|
| Backend hosted on **AWS** | Hosted on **Fly.io** (`carmazium-hjoh9w.fly.dev`) — no `aws-sdk` dependency anywhere in `backend/package.json` |
| Media storage on **AWS S3** | **Supabase Storage** |
| — | Frontend on **Vercel**, as quoted |
| — | Auth/DB on **Supabase** (Postgres + auth) — quotation only lists generic "PostgreSQL," doesn't name Supabase specifically, but this is consistent with the DB layer being delivered as promised, just via a managed provider instead of self-hosted |

Not a scope gap — Fly.io/Supabase deliver the same capability the quotation promised (a hosted Postgres+real-time backend), just via a different, and typically cheaper, provider than AWS. Flagged here only because it's a factual difference from the named tech stack.

### 9.6 Where delivery falls short of the letter of the quotation

For balance — not everything skews in the "delivered more than quoted" direction:

1. **Vehicle-sale escrow was never built.** The quotation's Phase 3 and Deliverables (§8) both promise "secure escrow-based payment flow" / "Escrow logic (pre-authorization, capture, refunds)." What exists is a fee-collection system (listing fees, auction buyer fee, HPI fee, boost fee) plus a fixed seller payout bonus — the actual car purchase price is never touched by the platform; it's arranged directly between buyer and seller off-platform, which the app tells users outright. Whether this was a deliberate, mutually agreed pivot (e.g. for money-transmission licensing reasons) isn't something the code can confirm — worth checking your own email/Slack history with the client for that context before raising it.
2. **AI vehicle valuation was never exposed**, despite the data models existing for it.
3. **"AI-powered vehicle comparisons" is a manual comparison table**, not AI-driven.

### 9.7 Bottom line

Almost every phase in the quotation was delivered at or beyond its literal scope, several times over in places (roles, admin tooling, auctions, moderation). Two items were promised and not delivered as described (true payment escrow, AI valuation), and one was delivered in a materially different form than its name suggests (AI comparisons). Set against that: an entire second native application (57 screens, ~115 commits, over half of all recent development time) and an advanced analytics suite were built despite being **named exclusions** in the signed quotation, plus a long list of unscoped feature verticals in §9.3 — any one of which (dealer CRM, delivery system, offers/negotiation, HPI/DVLA integrations, review system, notification infrastructure) would typically be its own line item in a quote this size.

*End of Feature Audit addendum — CarMazium — 2026-08-05*

---

## SECTION 10: Recent Backend & Platform Additions (2026-08-10)

**Addendum added 2026-08-10.** Development focus is shifting to the mobile app, which runs against this same backend (`https://carmazium-hjoh9w.fly.dev`). This section exists to hand the mobile side a clean punch list of everything backend/web-side that's changed since the last real pass over this doc (§8/§9, 2026-08-05) plus the ~10 days before that — 24 commits touching `backend/src` between 2026-07-27 and 2026-08-10. Each item is tagged for whether mobile needs to act on it.

**Legend:** 🔵 Mobile action needed (behavior mobile should replicate or a new endpoint it can call) · ⚪ Web/admin-only, no mobile action.

### 10.1 New backend modules & endpoints

**Blog module** (`backend/src/blog/`) — new, full CRUD ⚪ *web-only, no mobile screen needed*
| Method | Route | Notes |
|---|---|---|
| GET | `/blog` | Public, published-only, paginated. Accepts `?tag=` filter. |
| GET | `/blog/:slug/related` | Related posts by tag overlap, falls back to most recent |
| GET | `/blog/:slug` | Public single post |
| GET | `/blog/admin/all` | Admin-guarded, all statuses |
| GET | `/blog/admin/:id` | Admin-guarded, single post any status |
| POST / PATCH / DELETE | `/blog` , `/blog/:id` | Admin-guarded CRUD |

New `BlogPost` model + `BlogPostStatus` enum (DRAFT/PUBLISHED) in `schema.prisma`. Homepage's fake "Automotive Insights" cards are now real, admin-authored, SEO'd content. Purely a content/marketing surface — not part of the transactional flows mobile mirrors.

**Admin** — 🔵/⚪ mixed
- `GET /admin/listings/:id` — new, full single-listing detail (any status) for the admin edit modal. Admin-only, no mobile relevance.
- `admin.service.ts updateListing()` gate relaxed from `PENDING_REVIEW || REJECTED` to "anything except SOLD" — admins can now edit live listings and live auctions' vehicle details (not auction schedule/pricing once live). Admin-side only; doesn't change what mobile can do, but if mobile ever polls a listing for display, expect edits to land on already-ACTIVE listings now, not just pending ones.

**Payments** — 🔵 *mobile action needed if it renders a Purchase/receipt confirmation from session status*
- `PaymentsService.getSessionStatus()` now also returns `amountTotal` and `currency` (previously only `status`, `paymentStatus`, `customerEmail`, `metadata`). Added to support real-value Meta Pixel `Purchase` events on web's checkout-success page — if mobile's own checkout-confirmation screen calls the same endpoint and wants to show/track the actual amount, it's now available without a second round-trip.

### 10.2 Business-logic / gating changes — mobile should match these

These are backend behavior changes, not just new UI. Mobile hits the same endpoints, so most of this is automatic — but any screen that assumes the *old* behavior (or shows copy contradicted by the new behavior) needs a check.

- 🔵 **Auctions now require admin review before going live, full stop.** Previously an auction's `Listing` correctly entered `PENDING_REVIEW`, but nothing stopped the auction itself from scheduling and going live via the activation cron while the listing sat unreviewed — a real gap, not intentional. Now: `GET /auctions` active/scheduled lists filter on `listing.status === 'ACTIVE'`, and the activation cron only flips `SCHEDULED → ACTIVE` when the listing has cleared review. This applies whether a seller creates a brand-new auction listing *or* puts an already-ACTIVE retail listing up for auction directly — both now force the listing back to `PENDING_REVIEW`. **If mobile's sell/auction flow shows any "your auction is now scheduled/live" confirmation immediately on submit, that copy needs to account for the review step** — same as web's wizard now does. Auctions already scheduled/active before 2026-08-10 were deliberately left untouched (explicit product decision, not a partial fix).
- 🔵 **Unpaid auction wins auto-revert after 72h.** New `Auction.wonAt` field + hourly cron: if the £125 buyer fee isn't paid within 72h of winning, the auction cancels, the listing goes back to `ACTIVE`, and both parties are notified. Mobile's won-auctions screen should reflect `CANCELLED` state and not assume a win is permanent until the fee is paid.
- 🔵 **Payout-status fields split further.** `sellerBonusReleased` means "handover approved," never "money moved" — that was already true, but two more states were added: `stripeRefundError` (buyer-fee refund failed on handover denial — needs manual admin action) and `manualPayoutConfirmedAt` (admin manually confirms a bank transfer outside Stripe, for the case where `stripePayoutTransferId` will never populate). Any mobile screen claiming a payout "is complete" should check the same combination web now does — `sellerBonusReleased` alone is not sufficient and never was, but it's now more clearly wrong to treat it that way.
- 🔵 **`GET .../offers` received-offers response now includes the listing's current status.** This was filed specifically because mobile's dealer offers screen was offering "Mark as Sold" on an already-sold listing (via another offer or a prior sale) — the backend always correctly rejected the second sale, but the button shouldn't have been offered at all. Confirm mobile actually reads this new field and hides the action.
- 🔵 **Chat `otherUser` is now reliably populated on every room-returning endpoint**, including `findOrCreateRoom` (the "message seller" entry point), not just `getUserRooms`. If mobile has any defensive `room?.otherUser?.id` guard worked around a previous crash here, the underlying data gap is now fixed at the source — the guard is still fine to keep, just no longer load-bearing.
- 🔵 **Verification email fix** — `/auth/send-verification` now actually fires (was silently CSRF-blocked) and uses a magiclink-type Supabase link instead of a signup-type one (which required a password and always failed for already-created users). If mobile has its own email-verification call, confirm it's hitting a working path — this was broken for every new web signup until 2026-07-30, so any shared assumption about "verification emails just work" should be re-checked.
- 🔵 **New mandatory `postcode` field on `User`**, alongside the existing `location`. Web now requires both at onboarding, dashboard settings, and buyer settings, with a one-time backfill popup for existing accounts missing either. If mobile's own onboarding/profile screens collect `location` but not `postcode`, that's a data gap worth closing for delivery-radius / distance-search accuracy across platforms.
- 🔵 **Seller phone/email on auction pages stay gated until the viewer has won *and paid* the buyer fee** — this was already the intended behavior but had a real leak (available on login alone); fixed server-side in both the live-auction detail and won-auctions queries. If mobile calls the same endpoints (it should), this is automatic — just don't build a client-side-only gate that duplicates this, the server is the actual enforcement point.

### 10.3 Web/admin-only — no mobile action needed

Included for completeness, explicitly flagged so nobody spends mobile time chasing these: Meta Pixel Lead/Purchase analytics (web ad-tracking only), admin panel drill-down views + PDF export (admin dashboard is web-only by design, per §8 partner-role note), auction buyer-fee checkout page redesign (cosmetic web-only layout change, same underlying payment flow), admin "Platform Revenue" KPI calc fix (admin-only reporting), blog CMS (§10.1).

### 10.4 Mobile Parity Gap Summary — additions since the 2026-06-27 table

New rows for the original Mobile Parity Gap Summary table (above, pre-§8): the following shipped on web since that table was written and haven't been confirmed on mobile. Same "Not confirmed" caveat applies — nobody has audited the mobile codebase against these specifically.

| Feature | Web Location | Mobile Status |
|---|---|---|
| Blog / content system | `/blog`, `/blog/[slug]` | N/A by design — web-only content surface |
| 72h auto-revert on unpaid auction win | Backend cron + won-auctions UI | Not confirmed — see §10.2 |
| Mandatory postcode field at onboarding | Onboarding, dashboard settings | Not confirmed — see §10.2 |
| Admin full-edit on live listings/auctions | Admin dashboard | N/A — admin is web-only |
| Meta Pixel Lead/Purchase tracking | Sitewide + checkout | N/A — web analytics only |

### 10.5 A note on this doc's own currency

Sections 1–7 above were last verified line-by-line on 2026-06-27 and are now roughly 6 weeks and ~250 commits stale on the **web** side specifically — treat route/endpoint details there as directional, not authoritative, without a fresh grep. This §10 addendum is scoped narrowly to backend changes with mobile-parity relevance; it is not a re-audit of the whole web app.

*End of Feature Audit addendum — CarMazium — 2026-08-10*
