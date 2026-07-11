# Carmazium Mobile — Production-Readiness Audit

**Date:** 2026-07-10
**Scope:** Static code audit of `carmazium app/carmazium app` (no device access). Cross-checked against `git log -30` and current uncommitted working-tree diff in `C:\ca\carmazium`.

> **This is a point-in-time snapshot — most findings below are now fixed.** See `mobile-audit-plan.md`'s status banner (updated 2026-07-12) for a per-stage done/open breakdown, and `mobile-production-readiness-plan.md` for findings discovered after this audit was written (F1–F5, including a confirmed backend bug this audit's W8 could only flag as "unverified"). Don't treat the findings below as current without checking that banner first.

---

## 1. Executive Summary

The app is **not yet production-grade**. The two 3D-viewer performance bugs described in the task brief are genuinely fixed in the current working tree (verified below), which is good — but the audit surfaced a **new, more serious class of bug**: real seller/DVLA-sourced vehicle data (MOT status, ownership count, HPI result, finance/stolen flags) is collected in the Sell flow but never reaches buyers — `VehicleDetailScreen` shows **hardcoded fake values** ("HPI status: Clear", "Owners: 1 (Full FSH)", "MOT until: Mar 2026") on every single listing regardless of the truth. For a marketplace where people pay real money sight-unseen based on these claims, this is a trust/legal risk that outranks the performance work.

The second-most-urgent issue is a **root-caused live bug**: the `AUTH_REQUIRED` chat socket error the user observed is not a false alarm — all three Socket.IO connections (`/chat`, `/auctions`, `/notifications`) capture the Supabase access token once as a plain object at connect time; `socket.io-client`'s automatic reconnection replays that same stale object forever, so any reconnect after the ~1 hour Supabase token refresh (background/foreground, network blip, long-lived auction viewing) authenticates with an expired token and fails, repeating on every future reconnect attempt until the screen remounts.

Third: the app-wide list-rendering pattern is `ScrollView` + `.map()` with no `React.memo` anywhere in the codebase (confirmed via full-repo grep) — this is the "severe performance problem" class the user hit, and it recurs in at least 9 screens covering dealer inventory, leads, offers, bids, chat, notifications, and saved vehicles.

**Top 5 to fix first:**
1. Wire real DVLA/seller compliance data into the buyer-facing spec/history cards on `VehicleDetailScreen` (currently 100% hardcoded fake data) — `src/screens/vehicle/VehicleDetailScreen.tsx:736-800`.
2. Fix stale-token socket reconnection in `ChatContext.tsx`, `GlobalToastProvider.tsx`, `AuctionDetailScreen.tsx` — use a token-refreshing `auth` callback instead of a captured object.
3. Convert `ChatScreen`, `DealerInventoryScreen`, `DealerLeadsScreen`, `BuyerOffersScreen`, `BuyerBidsScreen`, `SavedScreen`, `NotificationsScreen`, `MyListingDashboardScreen`, `BuyerDeliveryRequestsScreen` from `ScrollView`+`.map()` to `FlatList`, and memoize list-item components.
4. Verify the 23 newly-added 3D damage-zone ids against the web repo's `VehicleDamageMapper.tsx` — the code comment in `damageZones.ts` admits they're unverified guesses, and `DamageMapViewer.tsx` will throw if the backend returns a record whose `coords` can't be resolved for an unrecognized `part`.
5. Give the dealer "Add Lead" form a real source/category picker — it currently hardcodes every manually-created lead to `source: 'walk_in'` even though the backend clearly supports `phone`, `chat`, `offer`, `listing_enquiry` too.

---

## 2. Performance Findings

### P1 — Socket.IO auth token goes stale on reconnect (root cause of the live AUTH_REQUIRED bug)
**Files:** `src/context/ChatContext.tsx:67-73`, `src/components/GlobalToastProvider.tsx:56-62`, `src/screens/vehicle/AuctionDetailScreen.tsx:271-278`

All three sockets do the equivalent of:
```ts
const token = await getAccessToken();
socket = io(`${API_URL}/chat`, { auth: { token }, reconnection: true, reconnectionAttempts: 5, ... });
```
`socket.io-client` only evaluates `auth` once, at construction, when it's a plain object (it must be a *function* to be re-evaluated per attempt). Supabase's client (`src/lib/supabase.ts:30`, `autoRefreshToken: true`) silently rotates the access token roughly hourly in the background — `user`/`isAuthenticated` don't change when that happens, so none of these `useEffect`s (deps: `[user, isAuthenticated]` / `[auctionId, currentUser]`) re-run and the socket is never told about the new token. The **next** reconnect (network blip, app backgrounded/foregrounded, a long-running auction) replays the original, now-expired token, the server emits an auth error, and after `reconnectionAttempts: 5` the socket gives up — matching exactly the "repeatedly logs `AUTH_REQUIRED` while the user is authenticated and using the app normally" symptom reported.
**Fix:** pass `auth: (cb) => getAccessToken().then(token => cb({ token }))` (function form, re-invoked on every reconnect attempt) in all three places, or call `socket.auth = { token }` immediately before each reconnect via the `'reconnect_attempt'` event.

### P2 — `ChatScreen`: unvirtualized message list + O(n²) per-message work
**File:** `src/screens/main/ChatScreen.tsx:418-515`

Messages render via `ScrollView` + `messages.map(...)` (no `FlatList`), and for every message `isLastOwnMessage` is computed with `messages.slice(idx + 1).some(...)` inside the map callback — an O(n²) scan across the whole thread on every render, triggered on every new socket message, every read-receipt, every typing-indicator toggle (each is a separate `useState`, so a typing update alone re-renders and rescans the entire message array). Long-running conversations (auction negotiation threads can run for days) will get progressively slower to type in. No item is memoized.
**Fix:** switch to `FlatList` with `inverted` + `keyExtractor`, compute "last own message" once with a `useMemo` derived from `messages` (single backward pass, not per-item slice), and memoize the message-row renderer.

### P3 — Systemic `ScrollView` + `.map()` for growable record lists, no `FlatList`, no memoization anywhere
No `React.memo` usage exists anywhere in `src/` (confirmed via repo-wide grep — the only match is an unrelated `TabNavigator.tsx` string). The following screens render a list of backend records via `ScrollView`+`.map()` instead of `FlatList`, so the entire list mounts and re-renders together regardless of scroll position, and list-row components (`VehicleCard`, `HorizontalVehicleCard`, inline row JSX) have no memoization to short-circuit re-renders from parent state changes:
- `src/screens/main/DealerInventoryScreen.tsx:437` — `filtered.map(listing => ...)`, dealer's full inventory.
- `src/screens/main/DealerLeadsScreen.tsx:610` — `filteredLeads.map(lead => ...)`.
- `src/screens/buyer/BuyerOffersScreen.tsx:662` and `src/screens/seller/SellerOffersScreen.tsx:484` — `offers.map(renderOfferCard)`, where `renderOfferCard` (defined at `BuyerOffersScreen.tsx:366`) is a plain function recreated every render, not `useCallback`.
- `src/screens/buyer/BuyerBidsScreen.tsx:335` — `bids.map(renderBidCard)`, same pattern.
- `src/screens/main/NotificationsScreen.tsx:307-311` and `src/screens/main/AlertsScreen.tsx:226-236` — grouped notification lists.
- `src/screens/main/SavedScreen.tsx:178` — watchlist, which can only grow (no eviction — see P6).
- `src/screens/sell/MyListingDashboardScreen.tsx:252` — seller's own listings.
- `src/screens/buyer/BuyerDeliveryRequestsScreen.tsx:337` — `requests.map(renderRow)`.

By contrast, `SearchScreen.tsx`, `MessagesScreen.tsx`, `SellerListingsScreen.tsx`, `SellerAuctionsScreen.tsx`, `DealerOffersScreen.tsx`, `DealerMyOffersScreen.tsx`, `DealerPurchasesScreen.tsx`, `DealerTeamScreen.tsx`, `ProfileScreen.tsx`, `PaymentHistoryScreen.tsx` and `OnboardingScreen.tsx` already use `FlatList` — so the fix pattern already exists in-repo, it just wasn't applied consistently. Note even these `FlatList` usages pass an inline `renderItem={({item}) => <Card .../>}` arrow function rather than a memoized, hoisted component, so there's a second, smaller win available there too.
**Fix:** convert the `ScrollView`+`.map()` screens to `FlatList`, wrap `VehicleCard`/`HorizontalVehicleCard`/row components in `React.memo`, and hoist/`useCallback` the `renderItem`/`renderOfferCard`/`renderBidCard` functions.

### P4 — `VehicleCard.tsx` / `HorizontalVehicleCard.tsx` not memoized; `onPress`/`onToggle` recreated per row per render
**Files:** `src/components/VehicleCard.tsx`, `src/components/HorizontalVehicleCard.tsx`, called from e.g. `src/screens/main/HomeScreen.tsx:448-454` (`onPress={() => goToListing(l)}`, `onToggle={() => toggle(l)}` defined inline inside the `.map()`)

Neither card component is wrapped in `React.memo`, and every call site passes brand-new inline closures as props, so even a `FlatList`/virtualization fix would only partially help — every row still re-renders whenever the parent screen re-renders (e.g. a watchlist toggle, a countdown tick from a sibling `LiveAuctionCard`, a socket-pushed update). This is exactly the "inline arrow functions/object literals passed as `onPress`" pattern flagged in the task brief.
**Fix:** wrap both cards in `React.memo`, and change call sites to pass stable callbacks (e.g. `onPress={handleCardPress}` where `handleCardPress` is a `useCallback` that reads `listing.id` from a ref/closure keyed by id, or pass `listing.id` and let the memoized card call a single stable `onPressListing(id)`).

### P5 — 3D damage viewer: both previously-reported bugs are confirmed fixed; one residual note
**Files:** `src/components/damage/ThreeDVehicleViewer.tsx`, `src/assets/3d/viewer.html`

Verified in the current working tree:
- The `html.replace('/*__THREE_BUNDLE__*/', () => threeBundle)` function-replacer fix is in place (`ThreeDVehicleViewer.tsx:83`) — correctly avoids the `$&`-pattern corruption bug.
- `viewer.html:94-121` now uses an analytical normal-vs-camera-direction occlusion check instead of raycasting, and `viewer.html:133` decouples zone-position updates onto a `setInterval(postZonePositions, 120)` independent of the `requestAnimationFrame` render loop. Both match the described fix and look correct.

Residual, low-severity note: `zoneScreenPos` (driven by the ~120ms `postMessage` tick) is plain `useState` in `ThreeDVehicleViewer.tsx:63`, so every tick re-renders the whole component tree including the `hotspotZones.map(...)` overlay (up to 25 exterior zones) even when most positions haven't materially changed. At ~8 ticks/sec this is unlikely to be visibly janky, but if more hotspots are added later it's worth a `useMemo`/epsilon-based skip.

### P6 — Unbounded local state growth: watchlist and chat message arrays have no windowing
**Files:** `src/screens/main/ChatScreen.tsx:115` (`messages` state), `src/store/watchlistStore.ts` (not read in full, but `SavedScreen.tsx` renders the entire `savedIds` set with no pagination)

`ChatScreen` loads the full message history for a thread once (`getChatMessages(threadId)`) with no pagination/windowing, then appends every subsequent socket message indefinitely for the life of the screen. `SavedScreen` similarly has no cap on watchlist size. Neither is a leak per se, but combined with P2/P3 (no virtualization) a long chat thread or a large watchlist will scale badly.
**Fix:** paginate message history (load-more-on-scroll-up) and virtualize both lists as noted above.

### P7 — `pushNotifications.ts` uses raw `fetch()` instead of `apiClient`, duplicating auth logic
**File:** `src/lib/pushNotifications.ts:90-99`

CLAUDE.md's convention is "all API calls go through `apiClient`... never raw `fetch()`." This file manually attaches `Authorization: Bearer <token>` via a separately-fetched `getAccessToken()` call rather than reusing `apiClient`'s built-in bearer handling. Functionally it works today, but it's a second, independent place that has to be kept in sync with any future change to how `apiClient` attaches/refreshes auth (e.g. if `apiClient` grows retry-on-401 logic, this call site won't get it).
**Fix:** route through `apiClient('/users/push-token', { method: 'POST', body: ... })` like every other endpoint call.

---

## 3. Workflow Completeness Findings

### Buyer

**W1 — `VehicleDetailScreen` shows hardcoded fake vehicle-history/spec data instead of the real DVLA/HPI data (highest severity finding in this audit)**
**Files:** `src/screens/vehicle/VehicleDetailScreen.tsx:736-800`, `src/data/listings.ts:15-59`, `src/lib/listingsApi.ts:149-190`

The "SPECIFICATION" and "VEHICLE HISTORY" cards on the listing detail screen buyers use to evaluate a car are **entirely static, hardcoded strings**, unconditional on the actual listing:
```tsx
<Text style={styles.specRowValue}>1 (Full FSH)</Text>       {/* Owners — always this */}
<Text style={styles.specRowValue}>Clear</Text>              {/* HPI status — always "Clear" */}
<Text style={styles.specRowValue}>Mar 2026</Text>            {/* MOT until — always this date */}
...
<Text style={[styles.historyValue, styles.greenText]}>None owed</Text>   {/* FINANCE */}
<Text style={[styles.historyValue, styles.greenText]}>No marker</Text>   {/* STOLEN */}
```
This isn't a wiring bug that's fixable by editing this screen alone — the underlying `CarListing` type (`src/data/listings.ts:15-59`) and its API mapper (`mapApiListingToCarListing`, `src/lib/listingsApi.ts:149`) never carry `motStatus`, `motExpiry`, `taxStatus`, `owners`, `writeOffCategory`, `stolenRecovered`, or `hasOutstandingFinance` at all, even though `SellCarFlowScreen.tsx` collects every one of these fields from the DVLA lookup and seller declarations and sends them to `/listings` (see `SellCarFlowScreen.tsx:835-878`). The data exists server-side and is simply never surfaced to buyers — instead they see fabricated "Clear"/"None owed" text on every listing, including ones with real accident history, finance, or a failed MOT. This is a real trust and potential legal-liability issue for a marketplace where people transact real money on these claims (compounded by the actual purchased HPI report flow at `VehicleDetailScreen.tsx:314-339`, which is real and correctly implemented, sitting right next to fake "always clear" copy that undercuts the reason to pay for it).
**Fix:** add the real fields to `CarListing`/`ApiListing`/the mapper, and render them (with an honest "Not disclosed" fallback) instead of the hardcoded strings.

**W2 — `rating: 4.5` is hardcoded for every listing**
**Files:** `src/lib/listingsApi.ts:175`, `src/screens/main/HomeScreen.tsx:86`

Same category of issue as W1 but lower stakes: every `VehicleCard`'s star rating badge shows a fixed `4.5` regardless of the actual seller/dealer. Minor, but visibly fake once a user notices every single car has an identical rating.

**W3 — Buyer-side damage viewer: new interior zones all render stacked on the same pixel**
**Files:** `src/components/damage/damageZones.ts:81-88`, `src/components/DamageMapViewer.tsx:99-125`

The 8 newly-added interior zones (Dashboard, Steering Wheel, Driver's/Passenger's Seat, Rear Seats, Centre Console, Headlining, Boot Interior) all share the identical placeholder `coords: { x: 50, y: 50, view: 'FRONT' }` (`damageZones.ts:81-88`) since interior zones have no real 3D position. `DamageMapViewer.tsx` (the read-only buyer-facing viewer) renders one `TouchableOpacity` pin per damage record positioned at `record.coords.x/y` with no collision handling — if a seller marks more than one interior zone as damaged, all of those pins render exactly on top of each other on the FRONT tab, indistinguishable and only the topmost tappable. A buyer looking at a car with, say, torn seats AND a cracked dashboard would see what looks like a single pin.
**Fix:** give interior zones distinct synthetic 2D coordinates (e.g. spread them along a dedicated "Interior" tab/row) instead of all sharing (50, 50).

**W4 — Unverified zone-id parity risks a runtime crash on the buyer-facing damage viewer**
**Files:** `src/components/damage/damageZones.ts:18-24` (comment), `src/components/DamageMapViewer.tsx:37,64,99-125`

The code's own comment admits: *"the ids added here for zones beyond the original 10 are best-effort guesses from the web app's visible UI labels... verify against the web repo before relying on exact string matches server-side."* That's 23 of the 33 zone ids (everything except the original front-bumper/headlight-pair/etc. set) unverified against the backend's/web app's real taxonomy. Two concrete risks: (1) `/damage/{id}/save`'s `part` field may not match what the backend or web dashboard expects for these zones, silently breaking cross-platform damage-record parity; (2) more seriously, `DamageMapViewer.tsx` does `record.coords.view` (line 37) and `record.coords.x`/`.y` (lines 108-109) with **no null-check** — if the backend can't resolve an unrecognized `part` string back to a `coords` object for the buyer-side GET `/damage/{listingId}` response, this throws and crashes the entire `VehicleDetailScreen` render for any buyer viewing a listing with that damage record.
**Fix:** verify all 23 ids against the web repo per CLAUDE.md's own instruction; in the meantime, harden `DamageMapViewer.tsx` to defensively skip/guard records with a missing or malformed `coords`.

**W5 — HPI report checkout: correctly implemented, no completeness gap found**
**File:** `src/screens/vehicle/VehicleDetailScreen.tsx:314-360, 1399-1406`

Worth calling out as a positive: this uses a hosted Stripe checkout (`/payments/hpi-checkout` → `StripeCheckoutModal`) rather than the native Payment Sheet specifically because report generation is triggered by a webhook tied to that checkout flow, with an explicit comment explaining why (a plain `/payments/intent` charge would take the buyer's money without ever running `HpiService.fetchAndSaveReport`). Polling with backoff (`for (let attempt = 0; attempt < 5; ...)`) is used to wait for the report after checkout. This is the one place in the app that correctly ties payment success to feature unlock; the fake "HPI Clear" copy elsewhere (W1) undermines it, but the checkout mechanics themselves are sound.

**Buyer offer / compare / watchlist:** no incompleteness found beyond the performance issues already listed in Section 2 (P3/P4/P6). Compare (`CompareScreen.tsx`) is bounded to 3 cars and not a virtualization concern.

### Seller / Dealer

**W6 — Dealer "Add Lead" form always hardcodes `source: 'walk_in'` — no source/category picker**
**File:** `src/screens/main/DealerLeadsScreen.tsx:70-76, 442-451`

`SOURCE_LABELS` defines 5 real lead sources the backend clearly supports (`listing_enquiry`, `chat`, `offer`, `walk_in`, `phone`), and leads generated automatically from real buyer activity correctly carry their true source. But the manual "Add Lead" form dealers use to log an in-person/phone enquiry always sends `source: 'walk_in'` regardless of what actually happened — there is no UI control to pick `phone` (or anything else) even though the label exists and is rendered elsewhere. This matches the brief's note about a "recently-requested lead-category/source field" — it's half-done: the display and backend field exist, the creation UI to set it doesn't.
**Fix:** add a source picker (reusing `SOURCE_LABELS`) to the create-lead modal.

**W7 — Damage record save failure is silently swallowed during listing publish**
**File:** `src/screens/sell/SellCarFlowScreen.tsx:882-904, 908, 917`

`saveDamageRecords(...)` ends in `.catch(() => {})` (line 903) and its result is never checked at either call site (`await saveDamageRecords(editListingId)` / `await saveDamageRecords(newListingId)`). If `/damage/{listingId}/save` fails (network blip, validation rejection from an unverified zone id per W4, etc.), the listing still publishes successfully and the user sees "Published!" with zero indication that the damage disclosure they just spent time marking up was never saved. For a field that carries legal-disclosure weight (undisclosed damage), this should not fail silently.
**Fix:** surface a distinct warning ("Listing published, but damage details couldn't be saved — edit the listing to retry") instead of swallowing the error.

**W8 — Listing-fee payment amount is computed client-side and sent to the server as-is**
**Files:** `src/screens/sell/SellCarFlowScreen.tsx:787-790`, `src/lib/paymentsApi.ts:11-16`

`triggerListingFeePayment` computes `amounts = { BASIC: 1, STANDARD: 10, PREMIUM: 25 }` on the client and POSTs `{ listingId, amount, type: 'LISTING_FEE', currency: 'gbp' }` to `/payments/intent` — the server isn't given the tier, only a number. This *may* be fine if the backend independently re-derives/validates the charge amount from the listing's `badgeTier` field before creating the Stripe PaymentIntent (which the mobile code has no visibility into, and the task brief notes the web repo isn't accessible from this machine to confirm) — but if the server trusts the client-supplied `amount` verbatim, a modified client could pay £1 and still get Premium-tier publishing. **Flagging as "verify server-side," not a confirmed bug** — could not check the backend from this repo.

**Sell Car flow (4 steps), auction free-listing behavior, publish-gated-on-payment logic:** traced end-to-end (`SellCarFlowScreen.tsx:825-990`) and found consistent — classified listings are correctly gated behind `presentPaymentSheet()` success before `/listings/{id}/publish` is called (`:953-982`), auction listings correctly skip payment entirely and publish immediately (`:919-952`), matching the `BADGES` config (`:105-138`) where only the `FREE`/`AUCTION` tier has `price: 'Free'`. No unlisted-DTO-field regressions of the 2026-07-06 kind were found in the current `/listings` payload (`:835-878`) — it does not reintroduce `declarationAcknowledged`, `damageRecords`, `priceAsking`, or `dateOfLastV5CIssued` as top-level keys.

**Dealer onboarding / KYC:** `DealerOnboardingScreen.tsx` form starts empty (a comment confirms a prior fake-prefill bug was already fixed); `DealerKYCScreen.tsx` hydration failure is silently caught (`:186`) but only affects prefill of previously-saved KYC data, not submission — acceptable degradation, not flagged as a bug.

### Account / Auth

**W9 — Supabase session likely exceeds SecureStore's 2048-byte soft limit**
**File:** `src/lib/supabase.ts:11-36`

The custom `expoSecureStoreAdapter` (lines 12-22) stores Supabase's **entire serialized session object** — access token (JWT, ~800-1200 bytes), refresh token, expiry, and the full `user` object including `app_metadata`/`user_metadata` — under a single SecureStore key. This routinely exceeds 2048 bytes, which is almost certainly the source of the "Value being stored in SecureStore is larger than 2048 bytes" warning observed live. `expo-secure-store` (`~15.0.8`, confirmed in `package.json`) does chunk oversized values rather than hard-failing, but large Keystore-backed encrypt/decrypt operations are measurably slower and historically less reliable on low-end/older Android devices — worth treating as a real risk area given the user explicitly called this out as observed in testing, not just a benign warning.
**Fix:** store only the access + refresh token strings (small) under SecureStore and keep the rest of the session (expiry, user object) in a plain `AsyncStorage`-backed adapter, or use Supabase's newer split-storage pattern if available in this SDK version.

**Auth flows (login/signup/forgot-password/verify-email), profile management:** traced `authStore.ts` end-to-end — role defaulting is deliberately hardened against a documented prior bug (stale in-memory "preview as dealer" role leaking into fresh signups, see the extensive comments at `authStore.ts:225-232, 300-304`), email-confirmation gating is correctly enforced client-side even when Supabase allows it server-side, and logout correctly destroys the backend session before Supabase sign-out to avoid stale-cookie session inheritance on shared devices (`:330-345`). No completeness gaps found here.

**Notification settings:** `NotificationSettingsScreen.tsx` correctly hydrates and persists all toggle preferences via `/users/me` PATCH; the load-failure catch (`:69`) only affects prefill of saved prefs (falls back to defaults), not saving — acceptable.

### Payments

**W10 — Stripe payment sheet wiring:** for the listing-fee flow, the amount passed to `initPaymentSheet` genuinely traces back to the tier the user picked in the UI (`badgeTier` state → `BADGES` pricing table → `triggerListingFeePayment` → `createPaymentSheet`), no mismatch found on the client side (see W8 for the one open question about server-side trust of the client amount). Auction listings correctly bypass payment. The buyer-fee deposit flow on `ChatScreen.tsx` (`handlePayDeposit`, `:303-315`) navigates to `PurchaseFlowScreen` with a fixed `buyerFee: 125` and `paymentType: 'COMMISSION'` consistently with the £125/auction-win copy shown elsewhere on the same screen (`:524-531`) — internally consistent.

---

## 4. Everything Else / Lower Priority

- **`GlobalToastProvider.tsx` notification socket** (`:39-95`) has a subtle asymmetry vs. `ChatContext`/`AuctionDetailScreen`: it guards against creating a second socket (`if (notifSocketRef.current) return;`) but shares the same stale-auth-on-reconnect issue (P1) since it's the same `auth: { token }` pattern.
- **`Apple sign-in`** (`LoginScreen.tsx:235`) and **Finance Calculator** (`VehicleDetailScreen.tsx:969-1003`) are both honestly labeled "Coming Soon" in the UI rather than silently broken — fine as-is, just noting they're incomplete by design, not bugs.
- **`PricingScreen.tsx:57,74`** lists two dealer/private-seller plan tiers as "Coming Soon" — consistent with the above, not a defect.
- Three.js/GLB assets (`three-bundle.txt` 744KB, `vehicle.glb` 2.4MB) are correctly registered as binary `assetExts` in `metro.config.js` (the working-tree diff adds `'txt'` to the list) and `app.json`'s `assetBundlePatterns: ["**/*"]` bundles them into the binary at build time — confirmed this does **not** block app startup or require a runtime network fetch; loading is correctly deferred to the `useEffect` inside `ThreeDVehicleViewer.tsx`, which only mounts on the Sell flow's Media & Damage step.
- `FlatList` usages across the app (`SearchScreen`, `MessagesScreen`, `SellerListingsScreen`, `DealerOffersScreen`, etc.) all pass an inline `renderItem={({item}) => ...}` rather than a hoisted/memoized component — a smaller version of P3/P4, listed here since virtualization already mitigates the worst of it.
- No other `WebView` usage besides the 3D damage viewer was found in `src/` — no similar per-frame-work traps elsewhere.
