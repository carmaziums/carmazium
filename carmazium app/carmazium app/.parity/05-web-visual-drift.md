# Web -> Mobile UI/UX Drift Audit (since 2026-06-01)

Method: `git log --since=2026-06-01 --oneline -- src` (full list retrieved, ~230 commits),
`git show --stat <sha> -- src` and full diffs for each mobile-relevant commit, cross-checked
against `carmazium app\carmazium app\src\screens\**` and `components\**`.
Admin dashboard, blog/SEO, analytics pixels (Meta/GA/TikTok/GoogleAds), RSS/sitemap commits
excluded per instructions (e.g. `05bca767`, `31cadbd5`, `b0bf2c9b`, `d42b8fb3`, `dd80bfc6`,
`d217e214`, `eb8d324b`, `1af30718`, `76b58ddf`, all `feat(admin)`/`fix(admin)` commits, `f7a8cee4` SEO metadata).

---

## Verified findings

### 1. Live-auction Seller tab: phone/email/location/business-address/website — MISSING on mobile
- Web (`05cfe7e4`, gated further by `25869c5d`, `8f54f6e9`): `src/app/auctions/live/[id]/page.tsx` L1282-1335 renders `BlurredPhone`, `BlurredEmail`, location, `businessAddress`, and `website` in the Seller tab, gated: phone only unlocks once the viewer has **won the auction and paid the buyer fee** (not just logged in) — see `25869c5d` commit message and `BlurredPhone.tsx` changes.
- Mobile: `carmazium app\carmazium app\src\screens\vehicle\AuctionDetailScreen.tsx` — the `'seller'` tab (L1330-1357) only renders seller name/avatar/initials and a "chat opens on win" message. No phone, email, location, business address, or website field exists anywhere in the file (confirmed via grep for `phone|email|business|website` — zero matches beyond the seller-name concat).
- Status: **MISSING** (not wrongly-exposed — mobile shows nothing at all, so no privacy risk, just a capability gap).
- Fix: add the gated fields to the Seller tab, mirroring `VehicleDetailScreen.tsx` L354-367's pattern of calling `/sellers/{id}/phone` for phone; the auction endpoint (`GET /auctions/:id`) already returns these fields server-side per `05cfe7e4`/`25869c5d`, so mobile can just read `auction.listing.seller.{phone,email,phoneAvailable,emailAvailable}` + `dealerProfile.{businessAddress,website}` and add `BlurredPhone`/`BlurredEmail`-equivalent RN components.
- Rank: **P1**.

### 2. "Call Seller" button on won-auction list — MISSING on mobile
- Web (`05cfe7e4`, `732ef238`): `src/app/dashboard/dealer/auctions/won/page.tsx` — full-width green "Call Seller" button added below the £125 fee button; also fixed dealer-vs-private phone field mismatch (`seller.phone` vs `dealerProfile.phone`).
- Mobile buyer side: `carmazium app\carmazium app\src\screens\buyer\BuyerBidsScreen.tsx` L403-420 (`wonCtaRow`) has "Pay Fee" and "Chat with Seller" buttons but no "Call Seller" button.
- Mobile dealer side: `carmazium app\carmazium app\src\screens\seller\SellerAuctionsScreen.tsx` `renderWonCard` (L1011-1058) is read-only and taps through to `VehicleDetailScreen`, which does correctly resolve phone via the gated `/sellers/{id}/phone` endpoint (so the dealer-phone-field-mismatch bug from `732ef238` does NOT reproduce on mobile — confirmed at `VehicleDetailScreen.tsx` L354-367, it hits a dedicated endpoint rather than reading `seller.phone` directly).
- Status: **PARTIAL** — dealer path is safe (delegates to a screen that already gates correctly); buyer path (`BuyerBidsScreen`) is missing the direct call CTA that web added.
- Fix: add a "Call Seller" `TouchableOpacity` next to "Chat with Seller" in `BuyerBidsScreen.tsx`'s `wonCtaRow`, fetching phone via the same `/sellers/{id}/phone` pattern used in `VehicleDetailScreen.tsx`.
- Rank: **P1** (buyer-side gap), not P0 (no incorrect data shown).

### 3. Auction filter panel (Buy-Cars-parity sidebar) — MISSING on mobile
- Web (`5a99b5d0`): `src/app/auctions/page.tsx` (+956/-155 lines) ported the full Buy Cars filter sidebar onto `/auctions` — model, year, mileage, transmission, colour, doors, seats, engine size, CO2, condition, ULEZ/Euro compliance, BHP, features, location+distance, seller type, delivery, import status, vehicle-category toggle. Previously auctions only had 5 filters (make, body type, fuel type, price, sort).
- Mobile: `carmazium app\carmazium app\src\screens\main\LiveScreen.tsx` has only a text-query filter (`matchesQuery` on make/model, L185-186) — grep for filter-related identifiers returns 8 hits vs. 76 in `SearchScreen.tsx` (mobile's Buy-Cars-equivalent, which does have the rich filter set).
- Status: **MISSING**.
- Fix: port `SearchScreen.tsx`'s filter UI/state (bottom-sheet or modal filter panel) into `LiveScreen.tsx`, reusing the same filter-option constants/components.
- Rank: **P1**.

### 4. Auction buyer-fee checkout redesign — largely PRESENT, cosmetic gaps only
- Web (`66c4a18d`): `src/app/checkout/page.tsx` redesigned to single-column with a 3-step progress indicator (Auction Won / Secure Checkout / Next Steps), vehicle card with winning bid + auction reference, "what this fee covers" trust row, refund-policy callout, order summary.
- Mobile: `carmazium app\carmazium app\src\screens\main\AuctionCompleteScreen.tsx` already has its own dedicated native flow (confetti, Stripe PaymentSheet via `createPaymentSheet`, non-refundable footer note at L609) predating this web redesign — it's a different, arguably more native-appropriate implementation, not a straight port target.
- Status: **PRESENT** (functionally equivalent, non-identical visual treatment — acceptable given native paradigms differ from web checkout).
- Rank: **P2** (cosmetic only, no action required unless client wants pixel parity).

### 5. Admin-manageable marketing popup — MISSING on mobile
- Web (`ff95a0f7`): `src/components/features/MarketingPopup.tsx`, `src/lib/marketingApi.ts`, admin page at `src/app/dashboard/admin/marketing-popup/page.tsx`. Popup shows sitewide, image/copy/toggle controlled by admin.
- Mobile: no `MarketingPopup` component or `marketingApi` file anywhere in `carmazium app\carmazium app\src` (grep for `MarketingPopup|marketing-popup|marketingApi` across the whole mobile `src/` returns zero matches).
- Status: **MISSING**.
- Rank: **P2** (marketing/promo feature, not core UX; no correctness or safety implication).

### 6. Sell page: Auction card ordered first — PRESENT on mobile
- Web (`9aa27434`): `ListingWizard.tsx` reordered so Auction method card appears before Retail/Classified.
- Mobile: `carmazium app\carmazium app\src\screens\sell\SellCarFlowScreen.tsx` `BADGES` array (L126-155) already lists the `FREE`/Auction tier first, before `BASIC`/`STANDARD`/`PREMIUM` (Classified tiers).
- Status: **PRESENT**.
- Rank: N/A.

### 7. Signup "Select Role" force-a-choice / no default-to-buyer — architecturally not applicable to mobile
- Web (`9aa27434`, `23920aa5`): signup page adds a "Select Role" dropdown (User/Dealer/etc.) that must be explicitly chosen, no longer silently defaulting to Buyer.
- Mobile: `carmazium app\carmazium app\src\screens\auth\SignupScreen.tsx` has no role field at all (grep for `role|Role|BUYER|DEALER` returns nothing) — `signup(email, password, name)` call at L95 takes no role argument. Mobile's onboarding instead routes dealer upgrade through a separate later screen (`DealerOnboardingScreen.tsx`), i.e. a fundamentally different signup architecture (signup-then-upgrade vs. web's signup-with-role-choice).
- Status: **UNVERIFIED whether this is an intentional pre-existing architecture split** — could not confirm from this audit alone whether mobile's default post-signup role is BUYER server-side (same class of bug web just fixed) or whether the separate DealerOnboardingScreen flow makes the distinction moot. Flagging for direct verification against backend `/auth/signup` default role handling.
- Rank: **P1** if mobile signup silently defaults new accounts to BUYER role with no user choice (same defect web fixed in `23920aa5`) — needs a look at `authStore.signup()` / backend default. Otherwise **P2/N/A**.

### 8. How It Works redesign (`7ee31c40`, `8f54f6e9`, `55a41ba4`) — content/copy only, PRESENT in spirit
- Mobile: `carmazium app\carmazium app\src\screens\main\HowItWorksScreen.tsx` exists as a native screen; not a line-by-line visual port of the web receipt-ledger redesign (expected — native screens don't mirror web DOM/CSS 1:1).
- Status: **PRESENT** (native equivalent exists; did not diff exact copy/step content — out of scope for a UI/UX-drift check beyond confirming the screen exists and is reachable).
- Rank: **P2**.

### 9. Terms page rebuild (`8f54f6e9`, 83-section full terms doc) — PRESENT
- Mobile: `carmazium app\carmazium app\src\screens\main\TermsScreen.tsx` exists.
- Status: **PRESENT** (did not diff full legal text section-by-section — recommend a follow-up text-content check since legal terms mismatches carry their own risk, but that is a content/legal-compliance audit, not a UI/UX one).
- Rank: **P2 / flag for legal-content follow-up, not UI/UX**.

### 10. `vehicle/[id]` seller phone gating (`732ef238`, `25869c5d`) — PRESENT and correct on mobile
- Mobile `VehicleDetailScreen.tsx` L354-367 already fetches phone via the dedicated `/sellers/{id}/phone` gated endpoint (win+paid-fee / login gating enforced server-side), matching the web fix's intent. No email is shown on mobile at all (grep confirms), so mobile is strictly more conservative than web here, not less — no P0.
- Status: **PRESENT**.
- Rank: N/A.

### 11. `cb1e178a` (perf: vehicle-page double-fetch, dashboard login waterfall) — not applicable to mobile
- Pure Next.js server/client fetch-dedup perf fix specific to Next's `generateMetadata()`/SSR model. Mobile has no equivalent SSR double-fetch pattern (native screens fetch once via `apiClient` in `useEffect`). Not portable, not a gap.
- Rank: N/A.

---

## Summary ranking

| # | Item | Rank | Status |
|---|------|------|--------|
| 1 | Live-auction Seller tab contact info (phone/email/location/business/website) | **P1** | MISSING |
| 2 | "Call Seller" button on buyer's won-auction list | **P1** | PARTIAL (buyer side missing) |
| 3 | Auction filter panel (Buy-Cars parity) | **P1** | MISSING |
| 7 | Signup role default (needs backend verification) | **P1 (conditional)** | UNVERIFIED |
| 4 | Auction checkout redesign | P2 | PRESENT (native equivalent) |
| 5 | Admin-manageable marketing popup | P2 | MISSING |
| 8 | How It Works redesign content | P2 | PRESENT (not diffed line-by-line) |
| 9 | Terms page full text | P2 / legal follow-up | PRESENT (not diffed) |
| 6 | Sell page auction-card-first | N/A | PRESENT |
| 10 | Vehicle detail phone gating | N/A | PRESENT (correct, stricter than web) |
| 11 | cb1e178a perf fix | N/A | Not applicable to mobile architecture |

**No P0s found.** Mobile never shows seller contact data that web deliberately gates — in every gating-related commit checked (`732ef238`, `05cfe7e4`, `25869c5d`, `8f54f6e9`), mobile is either already correctly gated (`VehicleDetailScreen.tsx`) or simply omits the field entirely (`AuctionDetailScreen.tsx` Seller tab, `BuyerBidsScreen.tsx`), which is a capability gap (P1) rather than a safety regression.
