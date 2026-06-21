# CarMazium Feature & Flow Audit

**Generated:** 2026-06-14  
**Auditor:** Senior Technical Audit (Claude Sonnet 4.6)  
**Scope:** Full-stack codebase — Next.js 14 frontend (`D:\carmazium\src\`) + NestJS backend (`D:\carmazium\backend\src\`)

---

## Table of Contents

1. [Route Inventory](#section-1-route-inventory)
2. [Backend API Endpoints](#section-2-backend-api-endpoints)
3. [Feature Inventory](#section-3-feature-inventory)
4. [User Flows](#section-4-user-flows)
5. [Data Models](#section-5-data-models)
6. [Integrations & External Services](#section-6-integrations--external-services)
7. [Known Gaps, Stubs & Issues](#section-7-known-gaps-stubs--issues)

---

## SECTION 1: Route Inventory

All routes discovered in `D:\carmazium\src\app\`.

### Public / Marketing Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/` | Public | Home page — featured listings, hero, email capture, AI search entry | `HomeClient.tsx`, featured listings ISR-fetched (revalidate 300s) |
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
| `/search` | Public | Search & browse listings with filters | Layout wrapper; likely `SearchClient` |
| `/buy-cars/[slug]` | Public | Single listing detail page | Listing fetched by slug |
| `/seller/[id]` | Public | Public seller profile — stats, listings, reviews | `SellersService.getPublicProfile` |

### Auction Pages

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/auctions` | Public | Auction listings browse (live + scheduled) | Layout wrapper |
| `/auctions/live/[id]` | Public (bid requires auth) | Full real-time auction room — live bid feed, countdown, anti-snipe, winner banner | Socket.io `/auctions` namespace, `CountdownTimer`, `useAuth`, `getAuction`, `placeBid` |

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
| `/dashboard/user` | Logged-in | Generic user dashboard page | — |

### Dashboard — Seller

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/seller` | Seller | Seller overview with KPI stats | `getSellerStats`, `DashboardSidebar` |
| `/dashboard/seller/listings` | Seller | My listings table with status management | `GET /listings/my` |
| `/dashboard/seller/add-listing` | Seller | Multi-step listing wizard | `ListingWizard` component |
| `/dashboard/seller/auctions` | Seller | Seller's auction list with management | `GET /auctions/my/list` |
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
| `/dashboard/buyer/offers` | Buyer | Buyer's submitted offers | `GET /offers/my` |
| `/dashboard/buyer/messages` | Buyer | Chat rooms | Chat WebSocket |
| `/dashboard/buyer/history` | Buyer | Purchase history | — |
| `/dashboard/buyer/settings` | Buyer | Profile settings | `PATCH /users/me` |

### Dashboard — Dealer

| URL Path | Auth | What It Renders | Key Components |
|---|---|---|---|
| `/dashboard/dealer` | Dealer | Dealer overview KPIs + recent leads | `GET /dealers/stats`, `GET /dealers/leads` |
| `/dashboard/dealer/inventory` | Dealer | Full inventory list | `GET /listings/my` |
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
| POST | `/listings` | SessionAuthGuard | Create a new listing (DRAFT) | Body: CreateListingDto (full vehicle data) → Listing |
| GET | `/listings` | None | Browse/search listings with filters and pagination | Query: `minPrice, maxPrice, make, year, fuelType, transmission, bodyType, condition, page, limit` |
| GET | `/listings/featured` | None | Get up to 8 featured (boosted) listings | → Listing[] |
| GET | `/listings/my` | SessionAuthGuard | Current user's own listings | Query: `page, limit` |
| GET | `/listings/stats` | SessionAuthGuard | Seller dashboard stats (total, active, sold, views) | → stats object |
| GET | `/listings/performance` | SessionAuthGuard | Seller performance analytics (revenue, views, conversion, per-listing) | → performance object |
| GET | `/listings/earnings` | SessionAuthGuard | Earnings history (sales records) | Query: `page, limit` → `{sales, totalRevenue, totalSales}` |
| GET | `/listings/earnings/export` | SessionAuthGuard | Export earnings as CSV download | → CSV file |
| GET | `/listings/:slug` | None | Get listing by URL slug | → Listing (with auction, bids, seller) |
| PATCH | `/listings/:id` | SessionAuthGuard | Update listing (ownership required) | Body: UpdateListingDto |
| POST | `/listings/:id/publish` | SessionAuthGuard | Publish DRAFT → ACTIVE (verifies LISTING_FEE paid) | → `{activated: bool, requiresPayment?: bool}` |
| PATCH | `/listings/:id/status` | SessionAuthGuard | Update listing status (DRAFT/ACTIVE/WITHDRAWN) | Body: `{status}` |
| PATCH | `/listings/:id/sold` | SessionAuthGuard | Record sale + mark SOLD | Body: RecordSaleDto `{soldPrice, buyerId?, buyerName?, buyerEmail?}` |
| DELETE | `/listings/:id` | SessionAuthGuard | Soft-delete listing | → Listing with `deletedAt` set |

### Auctions Module — `GET/POST/PATCH/DELETE /auctions/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| GET | `/auctions/active` | None | All ACTIVE (live) auctions | → Auction[] |
| GET | `/auctions/scheduled` | None | All SCHEDULED (upcoming) auctions | Query: `page, limit` |
| GET | `/auctions/my/list` | SessionAuthGuard | Current user's auctions | Query: `page, limit` |
| GET | `/auctions/:id` | None | Full auction detail (bids, listing, winner) | → Auction with nested data |
| POST | `/auctions` | SessionAuthGuard | Create auction for owned listing | Body: `{listingId, startTime, reservePrice, startingBid, minIncrement}` → endTime = startTime + 24h |
| PATCH | `/auctions/:id` | SessionAuthGuard | Update SCHEDULED auction parameters | Body: UpdateAuctionDto |
| PATCH | `/auctions/:id/cancel` | SessionAuthGuard | Cancel a SCHEDULED auction | → Auction |
| DELETE | `/auctions/:id` | SessionAuthGuard | Soft-delete a SCHEDULED auction | → Auction |
| POST | `/auctions/:id/handover-proof` | SessionAuthGuard | Submit handover proof URL (seller, post-auction) | Body: `{proofUrl}` — triggers £100 bonus pending admin approval |

**Note:** Swagger doc comments say `endTime = startTime + 5 hours` but actual code constant is `AUCTION_DURATION_MS = 24 * 60 * 60 * 1000` (24 hours).

### Bids Module — `GET/POST /bids/*`

| Method | Path | Guard | Description | Key I/O |
|---|---|---|---|---|
| POST | `/bids` | SessionAuthGuard | Place a bid | Body: `{listingId, amount}` — validates auction ACTIVE, amount > highest + increment, **only verified dealers can bid** |
| GET | `/bids/my` | SessionAuthGuard | Current user's bids | Query: `page, limit` |
| GET | `/bids/stats` | SessionAuthGuard | Buyer dashboard bid statistics | → stats |
| GET | `/bids/listing/:listingId` | None | All bids for a listing | → Bid[] ordered by amount desc |

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
| GET | `/offers/buyer-action-count` | SessionAuthGuard | Count of countered offers awaiting buyer | → `{count}` |
| PATCH | `/offers/:id/withdraw` | SessionAuthGuard | Withdraw a pending offer (buyer) | → Offer |
| PATCH | `/offers/:id/respond-counter` | SessionAuthGuard | Accept/reject a counter-offer (buyer) | Body: `{status}` |
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
| AI | `POST /ai/chat` | None | AI assistant chat (OpenAI) |
| AI | `POST /ai/generate-description` | SessionAuthGuard | Generate listing description using AI |
| Damage | `POST /damage/analyze` | SessionAuthGuard | AI damage analysis on image URLs |
| Damage | `POST /damage/:listingId/save` | SessionAuthGuard | Save detected damage records |
| Damage | `GET /damage/:listingId` | SessionAuthGuard | Get damage records for listing |
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
Multi-step `ListingWizard` component handles all listing creation. Creates a DRAFT listing. Supports all vehicle types (CAR/HGV/MOTORCYCLE). Includes DVLA VRM lookup, AI description generation, image upload to Supabase Storage, video URL embeds (YouTube/Instagram/Facebook/X), damage analysis, condition/compliance fields (ULEZ, Euro standard, CO2), write-off category, legal declarations.  
Files: `src/components/listing/ListingWizard`, `src/app/dashboard/seller/add-listing/page.tsx`  
Dependencies: DVLA VES API, OpenAI (description generation), Supabase Storage.

**Publish Listing (Payment Gate)**  
`POST /listings/:id/publish` checks that a LISTING_FEE Transaction with status COMPLETED exists for the listing. Returns `{requiresPayment: true}` if not paid — frontend routes to checkout. On Stripe webhook confirmation, Transaction marked COMPLETED, listing publish succeeds → `status = ACTIVE`.  
Files: `backend/src/listings/listings.service.ts`

**Edit / Soft-Delete Listing**  
`PATCH /listings/:id` for updates (ownership required). `DELETE /listings/:id` sets `deletedAt`. `PATCH /listings/:id/status` for manual status transitions.

**Badge Tiers**  
`badgeTier` field: `FREE`, `BASIC`, `STANDARD`, `PREMIUM`. FREE = no payment required. BASIC = £1, STANDARD = £10, PREMIUM = £25.

**Banner Labels**  
`bannerLabel` field on Listing — custom ribbon string (e.g. "Price Drop", "Just Arrived"). Rendered on listing cards.

**Images & Video**  
Images stored as URL arrays in Supabase Storage. Video URLs (YouTube, Instagram, Facebook, X) stored as `videoUrls String[]`. YouTube auto-embedded; others shown as links.

**Damage Records**  
AI analysis via `POST /damage/analyze` (GPT-4 Vision on uploaded image URLs) → save via `POST /damage/:listingId/save`. `DamageRecord` table stores part, type, size, coordinates, source image URL.

---

### 3. Search & Browse

**Listing Search & Filters**  
`GET /listings` accepts: `minPrice, maxPrice, make, model, year, fuelType, transmission, bodyType, condition, vehicleType, location, page, limit`.

**AI-Powered Natural Language Search**  
`POST /ai/search` — user submits plain language query (e.g. "family SUV under £15k petrol automatic"), OpenAI returns structured filter params + friendly explanation text. No auth required.

**Vehicle Comparison**  
`/compare` — up to 3 vehicles side-by-side with spec highlighting. Frontend-only feature using existing listing endpoints.

**Watchlist**  
Full CRUD at `/watchlist/*`. `WatchlistItem` with unique constraint `[userId, listingId]`.

**HPI Report (Paid)**  
Buyer pays £9.99 → Stripe checkout → webhook → `HpiService.fetchAndSaveReport` via OneAutoAPI → `HpiReport` table. Summary at `GET /hpi/listing/:id/summary`. Raw data at `GET /hpi/listing/:id`.

**DVLA VRM Lookup**  
`POST /dvla/lookup` — public, no auth. Returns: make, model, colour, fuel, MOT status, tax status, CO2, registration date. Used in listing wizard to auto-populate fields.

---

### 4. Auctions

**Create Auction**  
Seller calls `POST /auctions` with `{listingId, startTime, reservePrice, startingBid, minIncrement}`. Server computes `endTime = startTime + 24 hours`. Listing type auto-converts to `AUCTION`. One auction per listing (DB unique constraint on `listingId`).

**Auction Lifecycle (CRON)**  
`AuctionLifecycleService` at `backend/src/tasks/auction-lifecycle.service.ts` runs every minute via `@Cron('* * * * *')`:
1. Activates SCHEDULED → ACTIVE when `startTime` passes
2. Sends `AUCTION_ENDING` notifications to all bidders when ≤ 5 minutes remain (once per lifecycle cycle)
3. Closes ACTIVE → ENDED when `endTime` passes: sets `winnerId`, `winningBidAmount`, emits `auction:ended` Socket.io event, creates winner/ended notifications, sends winner email

**Live Bidding**  
`POST /bids` places bid (HTTP). Validates: auction ACTIVE, amount > highest + `minIncrement`, bidder is a KYC-verified dealer. On success, `AuctionGateway` emits `bid:new` to all room subscribers.

**Anti-Snipe Extension**  
Bid placed within 3 minutes of `endTime` → `endTime` extended by 3 minutes. Updated in DB. `bid:new` payload includes `newEndTime`. Frontend `CountdownTimer` re-syncs.

**Real-Time Viewer Count**  
`AuctionGateway` tracks connected clients per auction room. Emits `auction:viewers {count}` on join/disconnect.

**Winner & Post-Auction Flow**  
Highest bidder (if bid ≥ reserve) becomes winner. Frontend shows winner banner on `/auctions/live/[id]` with "Pay £125 Fee" button and (disabled) "Message Seller" button until fee paid.

**Auction Management (Seller)**  
PATCH (update), cancel, and soft-delete only available while auction is SCHEDULED. Once ACTIVE or ENDED, no seller cancellation.

---

### 5. Offers & Negotiations

**Make Offer**  
Buyer submits offer on a classified listing. Includes optional `amountMin`/`amountMax` range, optional `message`. Validated against listing's `priceMin`/`priceMax` if set. Seller notified via notification + WebSocket.

**Counter-Offer Negotiation**  
Full negotiation ledger: seller counters → `sellerCounterAmount`, `status = COUNTERED` → buyer receives `COUNTER_RECEIVED` notification → buyer accepts/rejects via `PATCH /offers/:id/respond-counter`.

**Accept/Auto-Reject Flow**  
When seller accepts one offer, all competing PENDING offers on the same listing are auto-rejected. Listing status → `OFFER_ACCEPTED`.

**Withdraw Offer**  
Buyer can withdraw any PENDING offer via `PATCH /offers/:id/withdraw`.

---

### 6. Chat & Messaging

**Chat Rooms**  
`ChatRoom` with unique constraint `[initiatorId, participantId]` — one room per user pair. `POST /chat/rooms` is idempotent (findOrCreate). Optional `listingId` for context.

**Real-Time Messaging**  
Socket.io namespace `/chat`. Clients join with `chat:join {roomId}`. Messages broadcast as `chat:message`. HTTP fallback `POST /chat/rooms/:id/messages`. Redis adapter enables multi-pod WebSocket scaling.

**Unread Count & Mark-Read**  
`GET /chat/unread` → total unread. `PATCH /chat/rooms/:id/read` marks messages read.

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

### 9. KYC / Identity Verification (Dealer)

**Dealer KYC Submission**  
Dealers complete 16-field KYC at `/dashboard/dealer/settings` → `POST /dealers/kyc`. Includes company house name, VAT proof URL, company registration proof URL, director ID proof URL, payment screenshot URL, Google reviews link, registered address, trading address.  
Files: `backend/src/dealers/dealers.controller.ts`

**Admin KYC Review**  
`GET /admin/dealers/kyc-pending` → `/dashboard/admin/dealer-verification`. Field-by-field review with per-field `{status: KycStatus, note}` stored in `documentStatuses` JSONB. `PATCH /admin/dealers/kyc/:id/review` updates review decisions. On APPROVED: `DealerProfile.isVerified = true` → dealer can bid.  
Files: `src/app/dashboard/admin/dealer-verification/page.tsx`

**Address Verification (OTP)**  
`POST /users/me/address-verification/start` sends OTP email. `POST /users/me/address-verification/confirm` validates code. Sets `user.isAddressVerified = true`. `AddressVerification` table tracks attempts and expiry.

---

### 10. Dealer Features

**Dealer Dashboard**  
KPI stats (inventory, active listings, revenue, leads). Recent leads preview.  
Files: `src/app/dashboard/dealer/page.tsx`, `backend/src/dealers/dealers.service.ts`

**CRM (Lead Management)**  
Kanban board with 6 pipeline stages: `NEW → CONTACTED → QUALIFIED → NEGOTIATING → WON → LOST`. Create leads, update status, assign to staff members. Source tracking (direct/chat/walk-in/referral/online-ad/phone).  
Files: `src/app/dashboard/dealer/crm/page.tsx`

**Dealer Analytics**  
Date range filter (7d/30d/90d/custom). Charts: Revenue area, Lead funnel, Offer status donut, Inventory aging.  
Files: `src/app/dashboard/dealer/analytics/page.tsx`

**Team Management (Staff RBAC)**  
Dealer ADMIN invites staff by email with role (ADMIN/SALES_AGENT/FINANCE_MANAGER). Invite email sent with token. Staff accepts at `/auth/accept-invite`. Staff can be deactivated (not deleted).  
Files: `src/app/dashboard/dealer/team/page.tsx`

---

### 11. Finance & Insurance Partners

**Finance Partner Dashboard**  
Finance partners see incoming applications from buyers. Approve/reject/complete. Status: `PENDING → APPROVED/REJECTED/COMPLETED`.  
Files: `src/app/dashboard/finance/page.tsx`

**Insurance Partner Dashboard**  
Insurance partners see incoming quote requests. Status: `PENDING → QUOTED/ACCEPTED/EXPIRED/REJECTED`.  
Files: `src/app/dashboard/insurance/page.tsx`

**Partner API Key** — `PartnerProfile.apiKey` field exists in schema but no API-key auth middleware is implemented. Currently inert.

---

### 12. Contractor / Service Provider Flows

**Contractor Dashboard**  
Jobs in PENDING/ACCEPTED/IN_PROGRESS/COMPLETED/CANCELLED states. Stats: pending, active, completed, total earnings.  
Files: `src/app/dashboard/service/page.tsx`

**Service Request Lifecycle**  
Buyer creates `ServiceRequest` targeting a `ContractorProfile.id`. Contractor updates status. `quotedPrice` and `acceptedPrice` tracked separately. No frontend page found for buyers to create service requests — likely accessed from listing detail page.

---

### 13. Notifications

**In-App (Real-Time)**  
`NotificationsGateway` at Socket.io namespace `/notifications`. Authenticated clients subscribe on login. Events pushed: `BID_PLACED`, `OUTBID`, `AUCTION_ENDING` (5-min warning), `AUCTION_WON`, `AUCTION_ENDED`, `OFFER_RECEIVED`, `COUNTER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `PAYOUT_FAILED`.

**Notification Model**  
`entityType`, `entityId`, `actionType` fields enable deep-linking from notification to specific entity in frontend.

**Email Notifications**  
Resend-backed `EmailService` sends: email verification, auction winner notification, dealer staff invite.

---

### 14. Admin Panel

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

### 15. Dashboard Summary (Role-Specific)

| Role | Primary Dashboard | Key Data |
|---|---|---|
| BUYER | `/dashboard/buyer` | Bid count, watchlist count, active offers |
| SELLER | `/dashboard/seller` | Total listings, active, sold, views, earnings |
| DEALER | `/dashboard/dealer` | Inventory count, leads, revenue, analytics |
| CONTRACTOR | `/dashboard/service` | Job stats, pending/active/completed |
| FINANCE_PARTNER | `/dashboard/finance` | Application count, pending, approved |
| INSURANCE_PARTNER | `/dashboard/insurance` | Quote count, pending, accepted |
| ADMIN | `/dashboard/admin` | Platform-wide stats: users, listings, revenue |

---

### 16. Public Marketing

**Home Page**  
Server component with ISR (revalidate 300s). `HomeClient.tsx` renders: hero section, AI search widget, featured car carousel (up to 8 boosted listings), email capture ("Auctions Coming Soon" widget), static content sections.

**Seller Public Profile**  
`/seller/[id]` — name, profile image, stats (total sales, reliability score, response rate), recent listings, reviews.

**AI Price Estimation**  
`MarketPriceData` and `PriceEstimateCache` models exist in schema with full confidence scoring, source tracking, and expiry TTL. No API endpoint exposes this to frontend. Feature present in data layer only.

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
3. Seller completes wizard (details, pricing, images uploaded to Supabase Storage, video URLs, damage, legal declarations, badge tier selection)
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
2. Fills: `startTime, reservePrice, startingBid, minIncrement` → `POST /auctions` → `endTime = startTime + 24h`, `status = 'SCHEDULED'`, listing `type → 'AUCTION'`
3. `AuctionLifecycleService` CRON (every 60s): `startTime` passes → `status → 'ACTIVE'` → `AuctionGateway.broadcastAuctionStart()`
4. Verified dealers visit `/auctions/live/:id` → Socket.io connects to `/auctions` namespace → `auction:join {auctionId}` → joined to room `auction:{id}`
5. Server emits `auction:viewers {count}` to room
6. Dealer bids: amount > (currentHighest + minIncrement) → `POST /bids {listingId, amount}`
7. Backend validates dealer + KYC → creates Bid → checks anti-snipe:
   - If `endTime - now ≤ 3 minutes` → `endTime += 3 minutes` (updated in DB)
8. `AuctionGateway.broadcastBid()` emits `bid:new {amount, bidderInitials, timestamp, newEndTime?}` to entire room
9. Previous highest bidder receives `OUTBID` notification
10. With ≤ 5 minutes left: CRON sends `AUCTION_ENDING` notifications to all bidders who placed bids
11. `endTime` passes: CRON calls `AuctionsService.closeAuction()`:
    - `status → 'ENDED'`
    - `winnerId = highestBid.bidderId`
    - `winningBidAmount = highestBid.amount` (if ≥ reservePrice, otherwise no winner)
12. `AuctionGateway.broadcastAuctionEnd()` emits `auction:ended {winnerId, winningBidAmount, reserveMet}`
13. `AUCTION_WON` notification to winner + winner email; `AUCTION_ENDED` to all other bidders

---

### Flow 5: Auction Winner Pays £125 Fee → Chat Unlocked

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

### Flow 6: Seller Payout — Handover Proof → Admin Approval → £100 Transfer

1. Auction ends with winner. Seller visits `/dashboard/seller/auctions`
2. Ended auction shows "Upload Handover Proof" button
3. Seller uploads proof image to Supabase Storage → gets URL → `POST /auctions/:id/handover-proof {proofUrl}`
4. Backend validates: auction ENDED, winner exists, proof not already submitted → sets `handoverProofUrl`, `handoverSubmittedAt`
5. Admin sees item in `/dashboard/admin/handovers` (ENDED auctions with proofUrl but `sellerBonusReleased = false`)
6. Admin views proof image, confirms handover → clicks "Approve"
7. Context-aware confirm dialog appears (shows payment path: Stripe/Bank/None)
8. `POST /admin/handovers/:id/approve`
9. **Path A — Stripe:** Seller has `stripeConnectAccountId` + `stripeConnectOnboardingComplete = true` → `stripe.transfers.create({amount: 10000, currency: 'gbp', destination: accountId})` → `stripePayoutTransferId` stored, `sellerBonusReleased = true`, `sellerBonusReleasedAt = now`
10. **Path B — Stripe failure:** Transfer throws exception → `stripePayoutError` stored → `PAYOUT_FAILED` notification pushed to all ADMIN users with link to handovers page
11. **Path C — Bank only:** No Stripe account, has bank details → admin sees sort code/account number in UI → admin manually transfers £100 → no system confirmation mechanism
12. **Path D — Neither:** Admin receives UI warning, no payout possible until seller adds payment method

Files: `backend/src/admin/admin.service.ts` (approveHandover), `backend/src/payments/payments.service.ts` (issueSellerPayout)

---

### Flow 7: Stripe Connect Onboarding (Seller)

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

### Flow 8: Buyer Makes Offer → Seller Counters → Buyer Accepts

1. Buyer on `/buy-cars/[slug]` → fills offer amount → `POST /offers {listingId, amount, message?}` → Offer created `status = 'PENDING'`
2. Seller receives `OFFER_RECEIVED` notification → visits `/dashboard/seller/offers`
3. Seller sees offer → clicks "Counter" → enters counter amount → `PATCH /offers/:id/respond {status: 'COUNTERED', counterAmount: X}`
4. `offer.status → 'COUNTERED'`, `offer.sellerCounterAmount = X`; buyer receives `COUNTER_RECEIVED` notification
5. Buyer visits `/dashboard/buyer/offers` → sees counter → clicks "Accept" → `PATCH /offers/:id/respond-counter {status: 'ACCEPTED'}`
6. `offer.status → 'ACCEPTED'`, `offer.finalAmount = sellerCounterAmount`; seller receives `OFFER_ACCEPTED` notification
7. All other PENDING offers on listing auto-rejected: `status → 'REJECTED'`
8. `listing.status → 'OFFER_ACCEPTED'`
9. Seller manually records sale: `PATCH /listings/:id/sold {soldPrice, buyerName, buyerEmail}`

---

### Flow 9: Boost a Listing → Featured on Homepage

1. Seller in `/dashboard/seller/listings` → kebab menu on listing → "Boost Listing"
2. `POST /featured-boost/:listingId` → ownership validated → creates FeaturedBoost (`isActive = false`) → creates Stripe Checkout (£25) → returns `{url}`
3. Seller pays on Stripe → redirects to success URL
4. Stripe webhook `checkout.session.completed` → identifies boost by `metadata.boostId` → `FeaturedBoost.isActive = true`, `listing.isFeatured = true`, `listing.featuredUntil = now + 7 days`
5. Listing appears in `GET /listings/featured` response → shown in homepage carousel
6. `FeaturedBoostExpiryService` CRON finds `featuredUntil < now` + `isActive = true` → sets `listing.isFeatured = false`, `FeaturedBoost.isActive = false`

---

### Flow 10: Dealer Invites Staff Member

1. Dealer ADMIN at `/dashboard/dealer/team` → fills invite email + role (SALES_AGENT/FINANCE_MANAGER) → `POST /dealers/staff {email, role}`
2. Backend creates `DealerInvite {email, token, expiresAt, role, dealerProfileId}`, sends invite email via Resend with accept link `https://carmazium.com/auth/accept-invite?token=TOKEN`
3. Staff member receives email → clicks link → `/auth/accept-invite?token=TOKEN`
4. If not logged in: redirects to login first
5. `POST /dealers/invites/accept {token}` → validates token not expired → creates `DealerStaff {userId, dealerProfileId, role, isActive: true}`
6. Staff member now has access to dealer dashboard

---

### Flow 11: Finance Application Flow

1. Buyer on listing detail page → clicks "Apply for Finance" (finance option shown if finance partners exist)
2. `POST /finance/apply {listingId, amount, term, income, ...}` → `FinanceApplication` created `status = 'PENDING'`
3. Finance partner at `/dashboard/finance` sees new application → `GET /finance/partner`
4. Finance partner reviews → `PATCH /finance/:id/status {status: 'APPROVED', apr: X, term: Y, monthlyPayment: Z}` → buyer notified
5. Buyer accepts terms → status → `COMPLETED`

---

### Flow 12: Admin Bans a User

1. Admin at `/dashboard/admin/users` → finds user → kebab menu → "Ban User"
2. Confirm dialog: "Ban [name]? They will no longer be able to log in."
3. `PATCH /admin/users/:id/ban` → `user.deletedAt = now`
4. User's existing sessions are NOT invalidated immediately (session-kill not implemented)
5. On user's next request, if session middleware checks `deletedAt`, access is blocked; otherwise user remains active until 7-day cookie expiry
6. Admin sees user row highlighted in red with "BANNED" status badge
7. Unban: `PATCH /admin/users/:id/unban` → `user.deletedAt = null`

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

#### `SellerProfile` (`seller_profiles`)

| Field | Type | Notes |
|---|---|---|
| `userId` | String | Unique FK → User |
| `reliabilityScore` | Float | Weighted 0–5.0 |
| `totalSales` | Int | Default 0 |
| `totalListings` | Int | Default 0 |
| `responseRate` | Float | 0–100 |
| `avgResponseHours` | Float? | |

#### `SellerReview` (`seller_reviews`)

| Field | Type | Notes |
|---|---|---|
| `sellerId` | String | FK → SellerProfile.id |
| `reviewerId` | String | FK → User |
| `listingId` | String? | |
| `rating` | Int | 1–5 |
| `comment` | String? | |
| Unique | `[sellerId, reviewerId, listingId]` | One review per buyer per listing |

#### `DealerProfile` (`dealer_profiles`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `userId` | String | No | Unique FK |
| `companyName` | String | No | |
| `vatNumber` | String | No | Unique |
| `registrationNumber` | String | Yes | |
| `businessAddress` | String | Yes | |
| `logo` | String | Yes | URL |
| `description` | String | Yes | |
| `phone` | String | Yes | |
| `website` | String | Yes | |
| `openingHours` | Json | Yes | `{"mon":"9-5",...}` |
| `isVerified` | Boolean | No | Default false |
| `verificationDate` | DateTime | Yes | |
| `deletedAt` | DateTime | Yes | |

#### `DealerKyc` (`dealer_kycs`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `dealerProfileId` | String | No | Unique FK |
| `companyHouseName` | String | No | |
| `representativeName` | String | No | |
| `representativePosition` | String | No | |
| `vatNumber` | String | No | |
| `vatProof` | String | Yes | URL |
| `companyRegistrationNumber` | String | No | |
| `companyRegistrationProof` | String | Yes | URL |
| `personOfSignificantControl` | String | No | |
| `directorName` | String | No | |
| `directorIdProof` | String | Yes | URL |
| `businessWebsite` | String | No | |
| `businessRegisteredAddress` | String | No | |
| `tradingAddress` | String | Yes | |
| `googleReviewsLink` | String | Yes | |
| `paymentReference` | String | No | |
| `paymentScreenshot` | String | Yes | URL |
| `status` | KycStatus | No | Default PENDING |
| `documentStatuses` | Json | Yes | Per-field `{status, note}` map |
| `submittedAt` | DateTime | No | |
| `reviewedAt` | DateTime | Yes | |

#### `DealerInvite` (`dealer_invites`)

| Field | Type | Notes |
|---|---|---|
| `email` | String | |
| `dealerProfileId` | String | FK |
| `role` | DealerRole | Default SALES_AGENT |
| `token` | String | Unique |
| `expiresAt` | DateTime | |

#### `DealerStaff` (`dealer_staff`)

| Field | Type | Notes |
|---|---|---|
| `userId` | String | FK → User; Unique `[userId, dealerProfileId]` |
| `dealerProfileId` | String | FK |
| `role` | DealerRole | Default SALES_AGENT |
| `isActive` | Boolean | Default true |

#### `Lead` (`leads`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `dealerProfileId` | String | No | FK |
| `listingId` | String | Yes | |
| `assignedToId` | String | Yes | FK → User (staff agent) |
| `buyerName` | String | No | |
| `buyerEmail` | String | Yes | |
| `buyerPhone` | String | Yes | |
| `status` | LeadStatus | No | Default NEW |
| `source` | String | Yes | listing_enquiry/chat/offer/walk_in/phone |
| `notes` | String | Yes | |

#### `ContractorProfile` (`contractor_profiles`)

| Field | Type | Notes |
|---|---|---|
| `userId` | String | Unique FK |
| `serviceTypes` | String[] | e.g. ["Detailing", "Mechanic"] |
| `rating` | Float | Default 0 |
| `totalReviews` | Int | Default 0 |
| `serviceArea` | String? | |
| `certifications` | String[] | |

#### `PartnerProfile` (`partner_profiles`)

| Field | Type | Notes |
|---|---|---|
| `financeUserId` | String? | Unique FK |
| `insuranceUserId` | String? | Unique FK |
| `partnerType` | UserRole | FINANCE_PARTNER or INSURANCE_PARTNER |
| `companyName` | String | |
| `apiKey` | String | Unique (currently inert) |
| `callbackUrl` | String? | Currently inert |
| `isActive` | Boolean | Default true |

#### `Vehicle` (`vehicles`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `vin` | String | Yes | Unique |
| `vrm` | String | Yes | Unique |
| `make, model, year` | Various | No | |
| `fuelType` | FuelType | Yes | |
| `transmission` | TransmissionType | Yes | |
| `mileage, color, bodyType, doors, seats, engineSize, bhp` | Various | Yes | |
| `features` | Json | Yes | String[] |
| `metadata` | Json | Yes | Flexible specs |

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
| `deletedAt` | DateTime | Yes | |

#### `HpiReport` (`hpi_reports`)

| Field | Type | Notes |
|---|---|---|
| `listingId` | String | Unique FK |
| `vrm` | String | |
| `data` | Json | Full OneAutoAPI raw response |
| `isClear` | Boolean | |
| `purchasedAt` | DateTime | |
| `transactionId` | String? | |

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
| `deletedAt` | DateTime | Yes | |

#### `Bid` (`bids`)

| Field | Type | Notes |
|---|---|---|
| `listingId` | String | FK |
| `bidderId` | String | FK → User |
| `amount` | Decimal(12,2) | |
| `timestamp` | DateTime | Default now |
| `deletedAt` | DateTime? | |

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
| `sellerCounterAmount, buyerCounterAmount` | Decimal | Yes | Negotiation tracking |
| `counterAmount` | Decimal | Yes | Legacy field (keep for backwards compat) |

#### `ServiceRequest` (`service_requests`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `contractorId` | String | No | FK → ContractorProfile |
| `requesterId` | String | No | FK → User |
| `listingId` | String | Yes | |
| `serviceType` | String | No | |
| `status` | ServiceStatus | No | Default PENDING |
| `quotedPrice, acceptedPrice` | Decimal | Yes | |
| `scheduledDate, completedDate` | DateTime | Yes | |

#### `Transaction` (`transactions`)

| Field | Type | Notes |
|---|---|---|
| `listingId` | String | FK |
| `userId` | String | FK |
| `amount` | Decimal(12,2) | |
| `type` | TransactionType | |
| `status` | TransactionStatus | Default PENDING |
| `stripePaymentId` | String? | Unique (Stripe session or payment ID) |
| `description` | String? | |

#### `ChatRoom` (`chat_rooms`)

| Field | Type | Notes |
|---|---|---|
| `initiatorId` | String | FK → User |
| `participantId` | String | FK → User |
| `listingId` | String? | Context |
| Unique | `[initiatorId, participantId]` | One room per pair |

#### `Message` (`messages`)

| Field | Type | Notes |
|---|---|---|
| `chatRoomId` | String | FK |
| `senderId` | String | FK → User |
| `content` | String | Text only |
| `isRead` | Boolean | Default false |

#### `Notification` (`notifications`)

| Field | Type | Notes |
|---|---|---|
| `userId` | String | FK |
| `type` | String | BID_PLACED, AUCTION_WON, etc. |
| `title` | String | |
| `message` | String | |
| `data` | Json? | Contextual IDs |
| `entityType` | String? | LISTING, OFFER, AUCTION |
| `entityId` | String? | UUID for deep-link |
| `actionType` | String? | COUNTER_RECEIVED, etc. |
| `isRead` | Boolean | Default false |

#### `AnalyticsEvent` (`analytics_events`)

| Field | Type | Notes |
|---|---|---|
| `type` | String | page_view, search, listing_view, filter_apply, login_wall_hit, enquiry |
| `payload` | Json | Default `{}` |
| `sessionId` | String? | |
| `userId` | String? | FK (nullable — anonymous events) |

#### `EmailCapture` (`email_captures`)

| Field | Type | Notes |
|---|---|---|
| `email` | String | Unique |
| `source` | String | auctions_coming_soon / newsletter / mazium_widget |

#### `FeaturedBoost` (`featured_boosts`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `listingId` | String | No | FK |
| `sellerId` | String | No | FK |
| `stripeSessionId` | String | Yes | Unique |
| `stripePaymentId` | String | Yes | Unique |
| `amountPaid` | Decimal | No | Default 25.00 |
| `boostedAt` | DateTime | No | |
| `expiresAt` | DateTime | No | boostedAt + 7 days |
| `isActive` | Boolean | No | Default false (set true by webhook) |
| `bypassed` | Boolean | No | Default false (admin override) |

#### `MarketPriceData` (`market_price_data`)

| Field | Type | Notes |
|---|---|---|
| `source` | String | AUTOTRADER / MOTORS / GUMTREE / CARGURUS / CARWOW / PULSECARS |
| `make, model, year` | Various | |
| `variant, mileage, price` | Various | |
| `fuelType, transmission, bodyType, location, sellerType, sourceUrl` | String? | |
| `scrapedAt` | DateTime | |

#### `PriceEstimateCache` (`price_estimate_cache`)

| Field | Type | Notes |
|---|---|---|
| `make, model, year, mileage` | Various | Part of unique composite key |
| `fuelType, transmission, condition, location` | String? | |
| `estimateLow, estimateMid, estimateHigh` | Decimal | |
| `comparables` | Int | Market listings used |
| `confidence` | Float | 0.0–1.0 |
| `expiresAt` | DateTime | 24–48h TTL |

#### `Sale` (`sales`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `listingId` | String | No | Unique FK |
| `sellerId` | String | No | FK |
| `buyerId` | String | Yes | FK; null for private/offline buyers |
| `buyerName, buyerEmail` | String | Yes | For offline buyers |
| `soldPrice` | Decimal(12,2) | No | |
| `purchaseStatus` | PurchaseStatus | No | Default AWAITING_CONFIRMATION |

#### `DamageRecord` (`damage_records`)

| Field | Type | Notes |
|---|---|---|
| `listingId` | String | FK |
| `part` | String | e.g. "Front Bumper" |
| `type` | String | e.g. "Scratch" |
| `size` | String | e.g. "0-5cm" |
| `coords` | Json | `{x, y, view: 'FRONT'/'SIDE'/'REAR'/'TOP'}` |
| `imageUrl` | String? | Source image URL |

#### `AddressVerification` (`address_verifications`)

| Field | Type | Notes |
|---|---|---|
| `userId` | String | FK |
| `address` | String | |
| `codeHash` | String | bcrypt-hashed OTP |
| `expiresAt` | DateTime | |
| `attempts` | Int | Default 0 |
| `consumedAt` | DateTime? | |

#### `Session` (`sessions`)

Managed by connect-pg-simple. Fields: `sid` (PK VarChar), `sess` (Json), `expire` (Timestamp).

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
| **Features** | Natural language vehicle search (`/ai/search`), AI assistant chat (`/ai/chat`), listing description generation (`/ai/generate-description`), damage image analysis (`/damage/analyze` via GPT-4 Vision) |
| **Files** | `backend/src/ai/ai.service.ts`, `backend/src/damage/damage.service.ts` |
| **Env vars** | `OPENAI_API_KEY` |

### DVLA VES API

| Aspect | Detail |
|---|---|
| **Purpose** | UK vehicle registration lookups |
| **Used for** | VRM lookup in listing wizard — returns make, model, colour, fuel type, MOT status, tax status, CO2, month of first registration |
| **Files** | `backend/src/dvla/dvla.service.ts` |
| **Env vars** | `DVLA_API_KEY` |

### OneAutoAPI (HPI Check)

| Aspect | Detail |
|---|---|
| **Purpose** | UK vehicle history / HPI report provider |
| **Used for** | Full HPI check after £9.99 payment. Returns finance outstanding, stolen status, write-off categories |
| **Files** | `backend/src/hpi/hpi.service.ts` |
| **Env vars** | Likely `ONEAUTOAPI_KEY` (verify in `hpi.service.ts`) |

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
| **Config** | `backend/fly.toml` (assumed) |

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
- **Problem:** Regular buyers (BUYER role) cannot bid at all. The live auction UI at `src/app/auctions/live/[id]/page.tsx` renders a bid form for all logged-in users, but the backend rejects any bid from a non-DEALER or unverified DEALER.
- **Impact:** If the product intends regular buyer bidding, this is a blocking defect. If dealer-only auctions are intentional, the frontend must surface this restriction (e.g., "Only verified dealers can bid — apply for dealer account").
- **Fix approach:** Either remove the dealer check to allow all authenticated users to bid, or add role-aware messaging in the auction page UI.

**Issue 2: Auction Duration Mismatch**

- **File:** `backend/src/auctions/auctions.service.ts`
- **Code:** `const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000` — 24 hours
- **Swagger doc says:** "5 hours"
- **Impact:** Marketing copy, seller expectations, and mobile app may display incorrect auction durations.
- **Fix approach:** Decide on canonical duration, update constant + Swagger doc + UI copy to match.

**Issue 3: Handover Deny — Buyer Refund Not Automated**

- **Endpoint:** `POST /admin/handovers/:auctionId/deny` exists in controller
- **Problem:** No programmatic Stripe refund call found in `AdminService.denyHandover`. The £125 buyer fee paid at checkout is not automatically refunded to the buyer when admin denies a handover.
- **Impact:** Denied handovers require manual admin intervention for refund. Buyer is not reimbursed automatically.
- **Fix approach:** Add `stripe.refunds.create({payment_intent: auction.buyerFeeTransactionId})` in `denyHandover()`.

**Issue 4: Ban Does Not Invalidate Active Sessions**

- **Files:** `backend/src/admin/admin.service.ts` (banUser), session validation middleware
- **Problem:** Setting `user.deletedAt` does not destroy existing `sid` sessions in the `sessions` table. Banned users retain session cookies valid for up to 7 days.
- **Impact:** Banned users can continue API requests until cookie expires.
- **Fix approach:** On ban, query `sessions` table for all sessions matching `userId` and delete them, or add `deletedAt` check in `SessionAuthGuard.validateSession`.

---

### Security Issues

**Issue 5: Analytics Endpoints Publicly Accessible**

- **File:** `backend/src/analytics/analytics.controller.ts`
- **Endpoints:** `GET /analytics/summary`, `GET /analytics/events`, `GET /analytics/emails`
- **Code comment:** `// TODO: Add admin auth guard when ready`
- **Problem:** Anyone without authentication can read the full list of captured email leads (`email_captures` table) and all platform analytics events.
- **Impact:** Email lead list (names, emails of prospective buyers) is publicly readable. Potential GDPR issue.
- **Fix approach:** Add `@UseGuards(SessionAuthGuard, RolesGuard)` + `@Roles('ADMIN')` decorators immediately.

**Issue 6: Bank Sort Code Shown in Plaintext in Admin Table**

- **File:** `src/app/dashboard/admin/users/page.tsx` lines 209–210
- **Code:** `<div>Sort: {u.bankSortCode} · ****{u.bankAccountNumber.slice(-4)}</div>`
- **Problem:** Bank sort code is shown in full in the admin user management table. Account number is masked (last 4 only), but sort code is not masked.
- **Impact:** Minor — admin-only view, but any unauthorized access to admin account exposes full sort codes of all sellers.
- **Fix approach:** Mask sort code as `**-**-{last2}` or show on demand only.

---

### Partially Implemented Features

**Issue 7: AI Price Estimation — Data Layer Only**

- **Models:** `MarketPriceData`, `PriceEstimateCache` fully defined in schema
- **Problem:** No controller, service method, or API endpoint exposes price estimation. `PriceEstimateCache` has confidence scoring, comparables count, low/mid/high ranges — all infrastructure but no consumer.
- **Impact:** Price estimation is invisible to users and mobile team.
- **Fix approach:** Create `GET /listings/:id/price-estimate` or `POST /price-estimate {make, model, year, mileage}` backed by `PriceEstimateCache`.

**Issue 8: PurchaseStatus Has No Management Endpoint**

- **Models:** `Sale.purchaseStatus` enum: `AWAITING_CONFIRMATION, REVIEWING_DOCS, CHECKS_COMPLETE, DELIVERY_REQUESTED`
- **Problem:** No API endpoint updates `Sale.purchaseStatus`. The dealer purchases page at `/dashboard/dealer/purchases` cannot manage post-sale document pipeline.
- **Impact:** Post-sale dealer flow (document review, delivery coordination) is non-functional.
- **Fix approach:** Add `PATCH /sales/:id/status {purchaseStatus}` endpoint.

**Issue 9: No Bulk Listing Import for Dealers**

- **Problem:** Dealers add vehicles one at a time using the same `ListingWizard` as individual sellers. No batch import (CSV/JSON/API) endpoint exists.
- **Impact:** High friction for dealers with large inventory.
- **Fix approach:** `POST /listings/bulk` accepting an array of CreateListingDto objects, with a separate CSV upload parser endpoint.

**Issue 10: Partner API Key Authentication Not Implemented**

- **Schema:** `PartnerProfile.apiKey` (unique) and `PartnerProfile.callbackUrl` defined
- **Problem:** No API-key guard middleware implemented. Finance and insurance partners use the same session cookie auth as regular users. `callbackUrl` is never called by any outbound webhook.
- **Impact:** Partner programmatic integration (the implied use case for `apiKey` + `callbackUrl`) is impossible.
- **Fix approach:** Create `ApiKeyAuthGuard` that checks `Authorization: Bearer {apiKey}` against `PartnerProfile.apiKey`. Implement outbound webhook calls to `callbackUrl` on status changes.

**Issue 11: Contractor KYC / Vetting Not Implemented**

- **Problem:** Any user with `CONTRACTOR` role can immediately accept service requests. No KYC, certification verification, or vetting process for contractors exists (unlike dealer KYC which is comprehensive).
- **Impact:** No vetting of service providers before they interact with car buyers.
- **Fix approach:** Create `ContractorKyc` model + submission/review flow mirroring `DealerKyc`.

---

### Dead Code / Unreachable Routes

**Issue 12: `/dashboard/user` Is Unreachable**

- **File:** `src/app/dashboard/user/page.tsx`
- **Problem:** The `/dashboard` router redirects based on role to role-specific dashboards (`/dashboard/buyer`, `/dashboard/seller`, etc.). No role routes to `/dashboard/user`. This page is unreachable in normal navigation.
- **Fix approach:** Either remove the page or assign it as the default for BUYER role.

---

### Data Model Inconsistencies

**Issue 13: `badgeTier` Default "FREE" vs Payment Enum**

- **Listing schema:** `badgeTier String @default("FREE")`
- **Payment endpoint:** `POST /payments/listing-checkout` body expects `badgeTier: 'BASIC' | 'STANDARD' | 'PREMIUM'`
- **Problem:** The `badgeTier` field is a plain string (not a Prisma enum). "FREE" tier bypasses the payment check in `listings.service.ts`. No migration path defined if tier names change.
- **Fix approach:** Convert `badgeTier` to a Prisma enum `ListingBadgeTier { FREE, BASIC, STANDARD, PREMIUM }` for type safety.

**Issue 14: Offer `counterAmount` Legacy Field**

- **Schema comment:** "Keep this for backwards compatibility if needed, or remove it later."
- **Problem:** Both `counterAmount` (legacy) and `sellerCounterAmount`/`buyerCounterAmount` (new structured fields) coexist. Mobile team building offer UI must determine which fields are canonical.
- **Canonical fields:** `sellerCounterAmount` for seller counter, `buyerCounterAmount` for buyer counter, `finalAmount` for accepted price.
- **Fix approach:** Remove `counterAmount` in a migration after confirming no active queries depend on it.

---

### Missing Test Coverage

**Issue 15: Core Business Logic Untested**

- **Test files found:** `backend/src/bids/bids.service.spec.ts`, `backend/src/listings/listings.controller.spec.ts`, `backend/src/listings/listings.service.spec.ts`, `backend/src/offers/offers.service.spec.ts`
- **No tests for:** `AuctionsService`, `AuctionLifecycleService` (cron), `PaymentsService`, `AdminService` (handover/payout), `AuthService`, `UsersService`
- **Highest risk untested areas:**
  - `AuctionLifecycleService.closeAuction()` — winner selection, notification dispatch
  - `AdminService.approveHandover()` — payout idempotency guard, Stripe transfer
  - `PaymentsService.processWebhook()` — all webhook event branches
  - `BidsService.create()` — anti-snipe logic, dealer verification check
- **Fix approach:** Add unit tests with Prisma mocked for all service methods in the above files. Add integration tests for webhook handler with Stripe test mode events.

---

### Open TODOs in Code

| File | Line | TODO | Risk |
|---|---|---|---|
| `backend/src/analytics/analytics.controller.ts` | ~25 | `// TODO: Add admin auth guard when ready` | HIGH — open data leak |
| `backend/src/finance/finance.controller.ts` | 62, 84 | `// @ts-ignore - Prisma types might need refresh` | MEDIUM — type safety suppressed |
| `backend/src/insurance/insurance.controller.ts` | 62, 84 | `// @ts-ignore - Prisma types might need refresh` | MEDIUM — type safety suppressed |
| `backend/src/service-requests/service-requests.controller.ts` | 49, 67, 91, 132 | `// @ts-ignore` | MEDIUM — type safety suppressed |

---

*End of Feature Audit — CarMazium — 2026-06-14*
