# Phase 9: Mobile Production Parity - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring the CarMazium mobile app to full feature parity with the web app for three roles — Buyer, Seller, and Dealer — minus partner portals (Finance, Insurance, Service, Admin) which are explicitly marked "coming soon." The mobile app already has 47 screens built; the work here is wiring broken flows to real backends, completing missing features, and ensuring every user action maps to a real API call with no stubs. Partner portals (Finance, Insurance, Service Provider, Admin) are out of scope for this phase.

**Reference:** All feature specs in `D:\carmazium\FEATURE_AUDIT.md`. Backend base URL: `https://carmazium-hjoh9w.fly.dev`.

</domain>

<decisions>
## Implementation Decisions

### Phase structure
- One comprehensive phase, 4 waves executed sequentially
- Wave 1 = Sell flow (foundation — everything downstream needs listings to exist)
- Wave 2 = Stripe native payments (unlocks all monetisation)
- Wave 3 = Dealer KYC + verification gate
- Wave 4 = Missing features (HPI, handover, notifications deep-linking)

### Role scope
- Buyer: browse, save, offer, bid (view only — bidding gated to verified dealers), chat, pay
- Seller: DVLA lookup, photo upload, list, manage, respond to offers, Stripe Connect, earnings
- Dealer: KYC upload and submission, verified status gate for bidding, inventory, CRM, auctions, analytics, team management
- **Critical constraint:** Only KYC-verified dealers can place bids — enforce this gate throughout the app
- Partner portals (Finance, Insurance, Service, Admin) = excluded, keep as stubs/coming soon

### Priority order
- Sell flow FIRST — sellers must be able to list before buyers can do anything
- Payments SECOND — Stripe native SDK is required before any real-money transaction can complete
- Dealer KYC THIRD — dealer verification unlocks bidding, the auction economy depends on it
- Missing features FOURTH — HPI, handover proof, notification deep-linking

### Wave 1: Sell flow (currently broken — screens exist, backend not wired)
- DVLA lookup: wire `POST /dvla/lookup` in SellCarsScreen (plate input → auto-fill make/model/year/fuel/colour/MOT/tax)
- Photo upload: use `expo-image-picker` + `expo-image-manipulator` for HEIC→JPEG conversion with 1.5 MB cap, upload to Supabase Storage
- AI description generation: wire `POST /ai/generate-description` with vehicle data payload
- Damage analysis: wire `POST /damage/analyze` on uploaded images
- Draft save: persist wizard state via Zustand persist + AsyncStorage so user can resume
- Listing creation: `POST /listings` on final submission
- Listing publish with payment gate: `POST /listings/:id/publish` — if `requiresPayment: true`, route to Stripe listing fee payment
- Auction creation: wire `POST /auctions` from seller/dealer — `{listingId, startTime, reservePrice, startingBid, minIncrement}`, endTime = startTime + 24h

### Wave 2: Stripe native payments (currently using web redirect — must become native Payment Sheet)
- Install and configure `@stripe/stripe-react-native`
- Use `POST /payments/intent` endpoint (returns `clientSecret`, `ephemeralKey`, `customerId`, `publishableKey`) — backend already implemented
- Payment Sheet flows to implement:
  - Listing fee (BASIC £1, STANDARD £10, PREMIUM £25)
  - HPI report (£9.99) — triggered from VehicleDetail screen
  - Auction buyer fee (£125) — triggered from AuctionComplete/win screen
  - Deposit / full payment (£500 deposit or full price) — triggered from PurchaseFlow
- Seller Stripe Connect: test and wire the full hosted onboarding flow (`POST /users/stripe-connect/onboard` → `Linking.openURL` → return URL handling)

### Wave 3: Dealer KYC (screens exist but not wired)
- Wire camera/photo-library capture for 16 KYC fields (VAT proof, company reg proof, director ID, payment screenshot, etc.)
- Each document: HEIC→JPEG conversion, 1.5 MB compression, upload to Supabase Storage → get URL
- Submit: `POST /dealers/kyc` with all field values and document URLs
- Pending state screen: shown after submission, polls or shows static "under review" message
- Verified dealer gate: `DealerProfile.isVerified` must be checked before allowing bid placement — show clear "Verification required to bid" message to unverified dealers
- DealerOnboarding flow: ensure role elevation `POST /users/elevate {newRole: 'DEALER'}` is accessible

### Wave 4: Missing features
- **HPI Report on VehicleDetail**: Add "Check HPI (£9.99)" button; trigger Stripe Payment Sheet (£9.99 via `POST /payments/intent`); on payment success show `GET /hpi/listing/:id/summary` results inline
- **Handover proof upload**: After auction ends with a winner, seller sees "Upload Handover Proof" in SellerAuctionsScreen; camera/library picker → Supabase Storage → `POST /auctions/:id/handover-proof {proofUrl}`
- **Push notification deep-linking (all 10 types)**:
  - `BID_PLACED` → auction room screen
  - `OUTBID` → auction room screen
  - `AUCTION_ENDING` → auction room screen
  - `AUCTION_WON` → AuctionComplete screen
  - `AUCTION_ENDED` → auction detail
  - `OFFER_RECEIVED` → SellerOffers screen
  - `COUNTER_RECEIVED` → BuyerOffers screen
  - `OFFER_ACCEPTED` → BuyerOffers screen
  - `OFFER_REJECTED` → BuyerOffers screen
  - `PAYOUT_FAILED` → Settings/Payouts section

### What is already working (do not rebuild)
- Offer flow: buyer makes offer → seller counters → accepted → Message Seller chat (working end-to-end)
- Auth flows: login, signup, email verify, onboarding (working)
- Chat/messaging: real-time socket, optimistic send (working after recent QA fixes)
- Live auction viewing: socket connection, bid feed, countdown (viewing works; placing bids needs dealer KYC gate)
- Dashboard: unified 10-tile grid for all roles (recently rebuilt)
- Settings: Profile, Security, Payouts, Bank details (recently rebuilt to web parity)
- GlobalAIChatBot: filterCard navigation, rotating quick replies, position fix (working)
- Navigation: all 47 screens wired, tab navigator, DASHBOARD label, side panel 7-item (working)

### What is out of scope
- Partner portals: Finance, Insurance, Service Provider, Admin — keep as "Coming Soon" stubs
- Map / Near Me screen — future phase
- AI standalone search screen — GlobalAIChatBot widget covers this for now
- Vehicle Compare deep polish — CompareScreen exists; minor improvements only if time permits
- App store submission assets (icon, splash, store metadata) — separate phase after all flows work

### Claude's Discretion
- Loading skeleton design within each screen
- Exact animation/transition choices
- Error message copy (follow web app wording where possible)
- Compression quality settings (as long as under 1.5 MB cap)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/apiClient.ts`: Authenticated fetch wrapper — use for all backend calls; use raw `fetch` + `getAccessToken()` only for non-JSON responses (CSV, binary)
- `src/lib/supabase.ts`: `getAccessToken()` exported — use for raw fetch auth headers
- `src/components/BrandIcon.tsx`: All icons go through this; add new Lucide mappings here if needed
- `src/components/ui/Skeleton.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx`: Shared UI primitives — use consistently
- `src/lib/haptics.ts`: `haptics.success()`, `haptics.medium()` — use on all confirmation actions
- `expo-file-system` (v19.0.23): Already installed — use for CSV/file ops
- `expo-sharing` (v14.0.8): Newly installed — use for sharing exported files
- `expo-image-picker`: Already in project — use for photo selection in sell wizard and KYC

### Established Patterns
- State management: Zustand (`useAuthStore`) for auth, local `useState` for screen-level state
- API calls: `apiClient<T>(endpoint, options)` — always returns typed JSON; use raw fetch for non-JSON
- Navigation: `navigation.navigate('ScreenName', params)` — all screen names in `MainStackParamList`
- Chat: `ChatContext` provides `emitSendMessage`, `onNewMessage`, `refreshRooms` — use for all messaging
- Icons: `Ionicons`, `MaterialCommunityIcons` from `@/components/BrandIcon` — never import from lucide or ionicons directly
- Styling: `StyleSheet.create` + design tokens from `src/constants/colors.ts` and `src/constants/typography.ts`
- Safe area: `useSafeAreaInsets()` on every screen that has a header

### Integration Points
- Stripe: Backend `POST /payments/intent` already returns `{clientSecret, ephemeralKey, customerId, publishableKey}` — wire directly to `@stripe/stripe-react-native` `initPaymentSheet` + `presentPaymentSheet`
- Supabase Storage: Images uploaded as public URLs, stored in `images: String[]` on Listing model
- DVLA: `POST /dvla/lookup` is public (no auth required), returns `{make, model, year, colour, fuelType, motStatus, taxStatus, co2Emissions, ...}`
- KYC: `POST /dealers/kyc` takes 16 fields + document URLs — all document files must be in Supabase Storage first
- Auctions socket: `AuctionGateway` at `/auctions` namespace — `auction:join`, `bid:new`, `auction:ended` events
- Notifications socket: `/notifications` namespace — `notification:new` event carries `{type, entityType, entityId}` for deep-linking

</code_context>

<specifics>
## Specific Ideas

- Bidding gate: When an unverified dealer tries to bid, show a clear modal: "Verify your dealership to bid. Complete KYC in Settings." with a direct CTA to DealerKYCScreen
- Photo upload in sell wizard: Show per-image upload progress bars (0→100%), not just a spinner — this is a slow operation on mobile
- DVLA lookup: Auto-submit when plate reaches 7-8 characters (UK plate format) without needing a button tap
- Stripe Payment Sheet: Use the `appearance` API to match the app's dark theme (black background, red accent)
- Notification deep-link on cold start: Must handle the case where the app was closed — use `Notifications.addNotificationResponseReceivedListener` in the root layout, check navigation is ready before navigating
- Reference: web app `/dashboard/seller/add-listing` uses `ListingWizard` component — use it as the spec for all wizard fields and validation

</specifics>

<deferred>
## Deferred Ideas

- Map / Near Me screen — not in this phase; Future Phase 10
- AI standalone search screen — GlobalAIChatBot widget covers basic discovery for now; standalone screen is Phase 10
- App store submission (icon, splash, store metadata, TestFlight) — Phase 10 after all flows verified
- Partner portals (Finance, Insurance, Service Provider) — explicitly "Coming Soon"; separate milestone
- Admin mobile dashboard — out of scope for consumer app
- Vehicle Compare deep polish — minor if time; otherwise Phase 10
- Seller public profile deep polish (SellerProfileScreen) — basic version works; full review system is Phase 10

</deferred>

---

*Phase: 09-mobile-production-parity*
*Context gathered: 2026-06-20*
