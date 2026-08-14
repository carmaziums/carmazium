# Navigation & User-Journey Parity Audit — Mobile vs Web

Scope: read-only. Web = `D:\carmazium\src\app\**` (source of truth). Mobile = `D:\carmazium\carmazium app\carmazium app\src\navigation\{RootNavigator,MainStackNavigator,TabNavigator,AuthNavigator}.tsx`, `src\components\GlobalDrawer.tsx`, `App.tsx`.

User claim under test: *"navigation — features/functionality don't support the user journey the way web does; some areas take the user to the wrong place or don't show the correct things."*

**Verdict: the claim is substantiated.** Reachability itself is mostly fine (almost every web route has a mobile screen and a way to reach it), but the *destination after an action* is where mobile diverges from web in several concrete, reproducible ways (§5), plus two genuinely dead registered routes and zero URL-based deep linking (§2, §6).

---

## 1. Route map diff (web route → mobile screen)

Method: enumerated every `D:\carmazium\src\app\**\page.tsx`; for each, searched mobile `src\navigation\MainStackNavigator.tsx` (registered screens, lines 55–124) and grepped `navigate\('X'` / `screen: 'X'` / `stackScreen: 'X'` across `src` for a reachability path. EXISTS = mobile screen exists and is reachable via at least one nav call. UNREACHABLE = mobile screen/route registered in `MainStackParamList` but no `navigate()`/drawer entry found anywhere in mobile `src`. MISSING = no mobile screen at all.

### Public / marketing

| Web route | Mobile screen | Status | Reachability proof |
|---|---|---|---|
| `/` (page.tsx) | `HomeScreen` (Tab) | EXISTS | `TabNavigator.tsx:186` |
| `/search` | `SearchScreen` (Tab) + `Search` stack route | EXISTS | `TabNavigator.tsx:187`, 9 direct `navigate('Search'...)` hits (e.g. `screens/main/HomeScreen.tsx`) |
| `/vehicle/[id]` | `VehicleDetailScreen` | EXISTS | 13 `navigate('VehicleDetail'...)` call sites |
| `/auctions` | `LiveScreen` (Tab) | EXISTS | `TabNavigator.tsx:188` |
| `/auctions/live/[id]` | `AuctionDetailScreen` (route `LiveAuctionDetailed`) | EXISTS | 9 `navigate('LiveAuctionDetailed'...)` call sites |
| `/auctions/how-it-works` | `HowItWorksScreen` | EXISTS but drawer-only | Reachable only via `GlobalDrawer.tsx:59` (`stackScreen: 'HowItWorks'`); no in-context CTA from `LiveScreen`/auction detail the way web's page is linked from `/auctions` |
| `/auctions/won/[id]` | No dedicated equivalent | MISSING as a distinct route — mobile substitutes `AuctionCompleteScreen` at the win moment and has no separate "revisit a won lot" detail screen (see §4.2) | — |
| `/compare` | `CompareScreen` | EXISTS | `GlobalDrawer.tsx:51` + `VehicleDetailScreen.tsx:661` |
| `/pricing` | `PricingScreen` | EXISTS, drawer-only | `GlobalDrawer.tsx:52` |
| `/about` | `AboutScreen` | EXISTS, drawer-only | `GlobalDrawer.tsx:58` |
| `/how-it-works` | Same `HowItWorksScreen` as `/auctions/how-it-works` (web has two separate pages) | EXISTS (merged) | mobile collapses two distinct web pages into one screen |
| `/contact` | `ContactScreen` | EXISTS, drawer-only | `GlobalDrawer.tsx:61` |
| `/services` | `ServicesScreen` | EXISTS, drawer-only | `GlobalDrawer.tsx:60` |
| `/reviews` | `ReviewsScreen` | EXISTS, drawer-only, **intentionally stubbed** | `GlobalDrawer.tsx:56` comment: "No mobile equivalent existed at all... these deliberately don't port web's fabricated testimonials" |
| `/finance` | `FinanceScreen` | EXISTS, drawer-only, **intentionally stubbed** | `GlobalDrawer.tsx:57`, same comment — deliberately doesn't port fake lenders |
| `/terms` | `TermsScreen` | EXISTS | Registered in **both** `AuthNavigator.tsx:41` and `MainStackNavigator.tsx:224`; drawer at `GlobalDrawer.tsx:64` |
| `/blog`, `/blog/[slug]`, `/blog/tag/[tag]` | none found | MISSING | No blog screen anywhere in mobile `src` |
| `/seller/[id]` | `SellerProfileScreen` | EXISTS | `MainStackNavigator.tsx:119`, `VehicleDetailScreen.tsx:1200` |
| `/buy-cars/[slug]` | Folded into `SearchScreen`/`VehicleDetailScreen` (no distinct slug-based category page) | EXISTS (merged), equivalence of category filtering not independently verified | — |

### Auth

| Web route | Mobile screen | Status |
|---|---|---|
| `/auth/login` | `LoginScreen` | EXISTS (`AuthNavigator.tsx:37`) |
| `/auth/signup` | `SignupScreen` | EXISTS (`AuthNavigator.tsx:38`) |
| `/auth/forgot-password`, `/auth/reset-password` | `ForgotPasswordScreen`, `ResetPasswordScreen` | EXISTS (`AuthNavigator.tsx:39-40`) |
| `/auth/onboarding` | `PostSignupOnboardingScreen` | EXISTS (`RootNavigator.tsx:41`, gated by `hasCompletedOnboarding`) |
| `/auth/callback` | Handled via `expo-web-browser` `openAuthSessionAsync` + Supabase listener, no dedicated screen | EXISTS (different mechanism), edge-case parity unverified |
| `/auth/accept-invite` | `AcceptInviteScreen` | EXISTS (`MainStackNavigator.tsx:299`), reachable only via 1 `navigate('AcceptInvite')` call site — presumably deep-link-driven only |
| `/auth/partners` | none found | MISSING |

### Buyer

| Web route | Mobile screen | Status |
|---|---|---|
| `/dashboard/buyer` | `SellerDashboardScreen` (unified buyer/seller, per `CONTEXT.md` §1: "buyer and seller are treated as the same unified entity") | EXISTS (merged) |
| `/dashboard/buyer/messages` | `MessagesScreen` / `ChatScreen` | EXISTS |
| `/dashboard/buyer/watchlist` | `WatchlistScreen` | EXISTS |
| `/dashboard/buyer/offers` | `BuyerOffersScreen` | EXISTS |
| `/dashboard/buyer/bids` | `BuyerBidsScreen` | EXISTS |
| `/dashboard/buyer/history` | `BuyerPurchaseHistoryScreen` | EXISTS but weak reachability — see §4.1, §5 |
| `/dashboard/buyer/settings` | `SettingsScreen` | EXISTS (shared, not buyer-specific) |
| `checkout/*` (deposit/full-payment/commission flows) | `PurchaseFlowScreen` | EXISTS but **post-payment destination diverges from web** — see §5 |

### Seller

| Web route | Mobile screen | Status |
|---|---|---|
| `/dashboard/seller` (page.tsx) | `SellerDashboardScreen` | EXISTS |
| `/dashboard/seller/listings` | `SellerListingsScreen` | EXISTS |
| `/dashboard/seller/add-listing` | `SellCarFlowScreen` | EXISTS |
| `/dashboard/seller/auctions` | `SellerAuctionsScreen` | EXISTS |
| `/dashboard/seller/offers` | `SellerOffersScreen` | EXISTS |
| `/dashboard/seller/earnings` | `EarningsScreen` | EXISTS |
| `/dashboard/seller/performance` | `SellerPerformanceScreen` | EXISTS |
| `/dashboard/seller/messages` | `MessagesScreen`/`ChatScreen` | EXISTS |
| `/dashboard/seller/settings` | `SettingsScreen` | EXISTS |

### Dealer

| Web route | Mobile screen | Status |
|---|---|---|
| `/dashboard/dealer` | `DealerProfileScreen` (rendered as the Profile tab when `role==='dealer'`, `TabNavigator.tsx:28`) | EXISTS |
| `/dashboard/dealer/add-listing` | `SellCarFlowScreen` (shared) | EXISTS |
| `/dashboard/dealer/inventory` | `DealerInventoryScreen` | EXISTS |
| `/dashboard/dealer/auctions`, `/dashboard/dealer/put-on-auction` | `SellerAuctionsScreen` (role-agnostic, reused) | EXISTS (merged) |
| `/dashboard/dealer/auctions/won` | No distinct mobile screen found | Likely gap, not fully confirmed — no `DealerAuctionsWon`-style screen or route found in `MainStackNavigator.tsx` |
| `/dashboard/dealer/crm` | `DealerLeadsScreen` | EXISTS (renamed) |
| `/dashboard/dealer/my-offers` | `DealerMyOffersScreen` | EXISTS |
| `/dashboard/dealer/offers` | `DealerOffersScreen` | EXISTS |
| `/dashboard/dealer/purchases` | `DealerPurchasesScreen` | EXISTS |
| `/dashboard/dealer/earnings` | `DealerEarningsScreen` | EXISTS but missing from drawer — see §4.4, §5 |
| `/dashboard/dealer/finance` | `DealerFinanceScreen` | EXISTS, reachable via exactly one call: `DealerProfileScreen.tsx:380` |
| `/dashboard/dealer/analytics` | `DealerAnalyticsScreen` | EXISTS, drawer-only (`GlobalDrawer.tsx:193`) |
| `/dashboard/dealer/team` | `DealerTeamScreen` | EXISTS, drawer-only (`GlobalDrawer.tsx:200`) |
| `/dashboard/dealer/wishlist` | `WatchlistScreen` (reused) | EXISTS, drawer-only (`GlobalDrawer.tsx:186`) |
| `/dashboard/dealer/settings` | `SettingsScreen` (shared) | EXISTS |

### Partner / admin roles (documented intentional gaps)

| Web route | Mobile | Status |
|---|---|---|
| `/dashboard/finance/*`, `/dashboard/insurance/*`, `/dashboard/service/*` | none | MISSING — **intentional**, per `CONTEXT.md` §8: "Partner-role dashboards... deferred by user decision — those roles use web" |
| `/dashboard/admin/*` | none | MISSING — **intentional**, `CONTEXT.md` §8: "Admin dashboard — intentional gap on mobile" |
| `/dashboard/user` (unified) | `UnifiedDashboardScreen` | EXISTS but the **stack route** is dead — see §2 |

### Shared

| Web route | Mobile screen | Status |
|---|---|---|
| `/profile` | `SettingsScreen` / `UnifiedDashboardScreen` (merged) | EXISTS (merged) |
| `checkout/success`, `checkout/cancel` | `PurchaseFlowScreen`'s inline success state | EXISTS but simplified — no distinct cancel screen; see §5 |
| `/finance` (retail finance page) | `FinanceScreen` (deliberately stubbed, see above) | EXISTS but degraded |

---

## 2. Dead & orphan routes

### Registered in `MainStackNavigator` with **zero** `navigate()` calls anywhere in mobile `src`

1. **`BuyerDashboard`** (`BuyerDashboardScreen`) — registered `MainStackNavigator.tsx:110` (type) and `:264-266` (`Stack.Screen name="BuyerDashboard"` → `BuyerDashboardScreen`). Grepped `BuyerDashboard` across all `.tsx` in `src`: the only hits are the import and the two registration lines in `MainStackNavigator.tsx` itself, plus the screen's own `export const BuyerDashboardScreen` in `screens/buyer/BuyerDashboardScreen.tsx:145`. No `navigate('BuyerDashboard')`, no `screen: 'BuyerDashboard'`, no drawer entry anywhere. **Confirmed dead route** — a fully built screen with no path in.
2. **`UnifiedDashboard`** (the route name registered in `MainStackNavigator`, distinct from the `UnifiedDashboardScreen` component) — registered `MainStackNavigator.tsx:112` (type), `:274-276` (`Stack.Screen name="UnifiedDashboard"`). The underlying `UnifiedDashboardScreen` component *is* reachable, but only because `TabNavigator.tsx:28` renders it directly as the Profile tab's component (`role === 'dealer' ? <DealerProfileScreen/> : <UnifiedDashboardScreen/>`), bypassing the stack route entirely. No `navigate('UnifiedDashboard')` or `screen: 'UnifiedDashboard'` found anywhere. **The stack-registered route itself is dead**, even though its component is used elsewhere.

### Drawer/dashboard items that route to the *same* underlying screen as another item (intentional reuse, not a bug)
- `GlobalDrawer.tsx:109` (`user-auctions` → `SellerAuctions`) and `:159` (`dealer-auctions` → `SellerAuctions`); `:117`/`:186` (`user-watchlist`/`dealer-wishlist` → `Watchlist`) — documented at `GlobalDrawer.tsx:148-160` and `:176-187` as deliberate reuse of role-agnostic screens.

### `navigate()` targets not registered in `MainStackParamList`
None found. Cross-checked every direct `navigate('X'...)` literal target found in `src` (`SellCarFlow`, `Tabs`, `VehicleDetail`, `ChatScreen`, `Search`, `Notifications`, `LiveAuctionDetailed`, `SellerAuctions`, `Main`, `Settings`, `SellerOffers`, `SellerListings`, `BuyerOffers`, `PurchaseFlow`, `DealerOffers`, `DealerKYC`, `BuyerBids`, `PaymentHistory`, `Messages`, `DealerOnboarding`, `AuctionComplete`, `Terms`, `SellerProfile`, `SellerPerformance`, `SellerDashboard`, `DealerTeam`, `DealerPurchases`, `DealerMyOffers`, `DealerLeads`, `DealerInventory`, `DealerFinance`, `DealerEarnings`, `Contact`, `Compare`, `BuyerPurchaseHistory`, `BuyerDeliveryRequests`, `AcceptInvite`, plus `Login`/`Signup`/`ForgotPassword` in the Auth stack context) against `MainStackParamList` (`MainStackNavigator.tsx:55-124`) — every one resolves to a registered name. No orphan targets found.

---

## 3. Role-gated entry points — web nav vs mobile drawer/tabs

Web's `DashboardSidebar.tsx` builds role-specific link sets:
- Buyer/seller (unified, `DashboardSidebar.tsx:103-111`): Overview, Inventory, Offers, My Offers, Watchlist, Stats, Messages, Earnings, Settings — 9 tabs, all under `/dashboard/user?tab=X` query-param routing.
- Service provider (`:124-127`), Finance partner (`:130-133`), Insurance partner (`:136-139`): 4 tabs each — Overview, domain-list, Messages, Settings.
- Admin (`:148-158`): 10 items — Overview, Accounts, Listings, Auctions, Handovers, Transactions, Analytics, Dealer KYC, All Dealers, Marketing Popup, Blog.

Mobile `GlobalDrawer.tsx`:
- `USER_ITEMS` (`:75-132`, shown for `role === 'buyer' || role === 'seller'`, gated at `:438`): Dashboard, My listings, My sent offers, Incoming offers, My auctions, Watchlist, Earnings, Performance analytics — 8 items, roughly matching web's 9 but mapped to distinct full-screen routes instead of an in-page tab switcher. `:67-74` documents this as a deliberate redesign matching web's "same unified entity" semantics. **Purchase/order history has no entry in this list** — see §4.1.
- `DEALER_ITEMS` (`:134-230`, shown for `role === 'dealer'`, gated at `:462`): 11 items, plus a "Browse as buyer" toggle (`:484-495`) with no web equivalent found in `DashboardSidebar.tsx`. **Earnings has no entry in this list** — see §4.4.
- Partner roles (service/finance/insurance) and admin: zero mobile drawer items — consistent with the documented intentional gap (`CONTEXT.md` §8), not a bug, but confirms that "some areas... don't show the correct things" is structurally true for these 4 roles by design.

**Flag — dealer "Browse as buyer" (`GlobalDrawer.tsx:483-496`)**: sets `role` to `'buyer'` via `setRole('buyer')`, a client-side preview toggle distinct from `accountRole` (the real backend role — see the comment at `GlobalDrawer.tsx:240-245`). No equivalent found in web's `DashboardSidebar.tsx`. Not necessarily wrong, but is a mobile-only divergent journey.

---

## 4. Journey traces

### 4.1 Buyer: browse → vehicle detail → make offer → accepted → chat → checkout → delivery → purchase history

**Mobile**, traced via `screens/vehicle/VehicleDetailScreen.tsx` and `AuctionDetailScreen.tsx`:
1. `HomeScreen`/`SearchScreen` → `navigate('VehicleDetail', { listing })` (13 call sites across the app).
2. Make Offer sheet opens in place on `VehicleDetailScreen` (BottomSheet, per `CONTEXT.md` §6 "Features added" — no separate screen, no navigation).
3. On offer status change, buyer sees an "Offer status chip" on `VehicleDetail` (`CONTEXT.md` §6: "COUNTERED chip is tappable → navigates to BuyerOffers"). Chat entry points at `VehicleDetailScreen.tsx:299` and `:1695`, both `navigate('ChatScreen', { threadId: room.id })`.
4. Checkout: `navigate('PurchaseFlow', {...})` — confirmed call sites are in `AuctionDetailScreen.tsx:924` and `:1433` (auction context). No `PurchaseFlow` call site was found inside `VehicleDetailScreen.tsx` itself — the retail (non-auction) direct-purchase path from a vehicle detail page was not located in this pass. UNVERIFIED whether this is a gap or intentional (web's retail flow may also be offer→accept→arrange-directly rather than a checkout button on the listing page — would need to read `D:\carmazium\src\app\vehicle\[id]\page.tsx` to confirm).
5. Post-payment: `PurchaseFlowScreen.tsx:200` → `navigate('Tabs')` (Home tab) unconditionally. **Diverges from web** — see §5, item 1.
6. Purchase history: `BuyerPurchaseHistoryScreen` exists and is registered (`MainStackNavigator.tsx:116`, `:294`), but has exactly **one** `navigate('BuyerPurchaseHistory')` call site in the entire codebase, and it is **not** in `GlobalDrawer.tsx`'s `USER_ITEMS` (`:75-132`) — that list has no "History"/"Purchases" row for buyer/seller. A buyer using the hamburger menu (the primary nav pattern for every other personal-data screen) cannot reach purchase history from there at all.

**Web**: `dashboard/buyer/history/page.tsx` exists as a route, but `DashboardSidebar.tsx`'s buyer/seller link set (`:103-111`) also has no explicit "History" tab (only Overview/Inventory/Offers/My Offers/Watchlist/Stats/Messages/Earnings/Settings) — so this may be a case where mobile's gap **mirrors** an existing web gap rather than being mobile-only regression. UNVERIFIED — would need to check `dashboard/user/page.tsx`'s tab logic (an "Overview" tab may surface recent purchases inline) before concluding this is mobile-specific.

### 4.2 Buyer: auctions list → live auction → bid → win → won-auction payment → handover

**Mobile**, traced via `AuctionDetailScreen.tsx`:
1. `LiveScreen` (Tab) → `navigate('LiveAuctionDetailed', { listing })`.
2. Bid: `placeBid()` (`AuctionDetailScreen.tsx:491`); success shows an in-place "Bid accepted — £X" flash (`:1603`, described at `:147`) — no navigation away, correct behavior for a live auction screen.
3. Win: `navigate('AuctionComplete', {...})` at `AuctionDetailScreen.tsx:371`.
4. Payment: `AuctionDetailScreen.tsx` has **two** separate `navigate('PurchaseFlow', ...)` call sites (`:924` and `:1433`) in addition to whatever `AuctionCompleteScreen` itself does post-win — suggesting two different entry points into the same payment screen (one likely from the win-moment `AuctionComplete` flow, one from re-opening a won `LiveAuctionDetailed` later to pay). Whether both pass consistent params was not cross-checked in this pass — UNVERIFIED.
5. Post-payment (commission type): `PurchaseFlowScreen.tsx:200` → `Tabs` (Home). **Web explicitly sends the user to "My Auctions"** (`/dashboard/buyer/bids` for buyers, `/dashboard/dealer/auctions/won` for dealers — `checkout/success/page.tsx:34, 198-204`) specifically to prompt the handover-proof step. This is the sharpest concrete instance of the user's complaint located in this audit: after paying the buyer fee, web deliberately routes toward the next required action; mobile returns the user to Home with no next-step signal.
6. Handover (buyer side): `BuyerDeliveryRequestsScreen` is registered (`MainStackNavigator.tsx:117`, `:295`) with exactly one `navigate()` call site found app-wide — UNVERIFIED whether it's reachable from the post-payment moment described above, or requires digging through the drawer.

### 4.3 Seller: sell CTA → listing wizard → publish → my listings → receive offer → accept → handover proof → earnings

**Mobile**, traced via `SellCarFlowScreen.tsx`:
1. Drawer "Sell Cars" → `navigate('Main', { screen: 'MyListingDashboard' })` (`GlobalDrawer.tsx:49`) — lands on the listing dashboard, not directly in the wizard; the wizard (`SellCarFlow` route) is presumably launched from a button inside `MyListingDashboardScreen` (not re-read this pass). Web's `/sell` link drops the user straight into the wizard page. UNVERIFIED how much friction this extra tap adds without reading `MyListingDashboardScreen.tsx`'s own CTA placement.
2. Publish, **classified** listing: `SellCarFlowScreen.tsx:1524-1539` — on success, `Alert.alert('Published!', ..., [{ text: 'View Listings', onPress: () => navigation?.navigate('SellerListings') }])`. Matches web's classified branch (`ListingWizard.tsx:767/852/936` → `router.push('/dashboard/seller/listings')`).
3. Publish, **auction** listing: `SellCarFlowScreen.tsx:1503-1507` — `Alert.alert('Auction Scheduled!', ..., [{ text: 'View Listings', onPress: () => navigation?.navigate('SellerListings') }])`. **Wrong relative to web.** Web's `ListingWizard.tsx:871` and `:936` explicitly branch: `router.push(payload.listingType === 'AUCTION' ? '/dashboard/seller/auctions' : '/dashboard/seller/listings')`. Mobile routes both classified and auction publishes to `SellerListings`, even though `SellerAuctions` is a distinct, already-built, already-used screen (`MainStackNavigator.tsx:262`). A seller who just scheduled an auction is sent to a screen that won't show it correctly framed as an auction. **This is a concrete, reproducible "wrong place" bug matching the user's complaint.**
4. Receive offer → `SellerOffersScreen`, reachable via `GlobalDrawer.tsx:102` ("Incoming offers"); accept-flow internals not traced this pass.
5. Handover proof: per `CONTEXT.md` §6 ("Features added"), already implemented in `SellerAuctionsScreen`'s upload flow to match web's `dashboard/seller/auctions/page.tsx` fee breakdown — cited from `CONTEXT.md:278`, not independently re-verified line-by-line in this pass.
6. Earnings: `EarningsScreen`, reachable via drawer `user-earnings` (`GlobalDrawer.tsx:118-124`).

### 4.4 Dealer: signup → KYC/onboarding → inventory → put on auction → offers/CRM leads → purchases → earnings

**Mobile**, traced via `GlobalDrawer.tsx` dealer-toggle logic (`:499-582`) and `DEALER_ITEMS`:
1. Becoming a dealer: the drawer's bottom card branches three ways (`:521-559`): verified dealer → `setRole('dealer')`; verified-but-not-currently-dealer → silent re-`POST /users/elevate` then switch; never-dealer → `navigate('Main', { screen: 'DealerOnboarding' })`; already-elevated-but-unverified → `navigate('Main', { screen: 'DealerKYC' })` (skips onboarding). Documented as a deliberate fix for a prior "KYC-forced-again" bug (comment `:505-521`) — reads as intentionally correct, not flagged as new.
2. Inventory: `DealerInventoryScreen`, drawer `dealer-inventory` (`:168-174`).
3. Put on auction: per `CONTEXT.md` §6 "Cross-listing" feature, inventory rows show a chip navigating to `SellerAuctions` for eligible ACTIVE listings — cited from `CONTEXT.md:279`, screen internals not re-read this pass.
4. Offers/CRM: `DealerLeadsScreen` (drawer `dealer-leads`, corresponds to web's `/dashboard/dealer/crm`), `DealerOffersScreen` + `DealerMyOffersScreen` (drawer `dealer-offers`/`dealer-my-offers`) — all exist and are all reachable via the drawer.
5. Purchases: `DealerPurchasesScreen`, drawer `dealer-purchases`.
6. Earnings: **`DealerEarningsScreen` is registered (`MainStackNavigator.tsx:213-217`) with exactly one `navigate('DealerEarnings')` call site app-wide, but has zero entry in `DEALER_ITEMS`** (`GlobalDrawer.tsx:134-230`). Unlike every other major dealer feature (Direct offers, My offers, Purchases, Team Management, Dealer Analytics — all present in `DEALER_ITEMS`), Earnings is absent from the hamburger menu, the primary nav surface for dealer features. **Concrete "missing for a role" finding.**

---

## 5. Post-action navigation — mutation → destination, mobile vs web

| Action | Mobile destination | Web destination | Verdict |
|---|---|---|---|
| Payment success — **COMMISSION** (auction buyer fee) | `navigate('Tabs')` → Home tab, unconditional. Single "BACK TO HOME" button, `PurchaseFlowScreen.tsx:200-202` | `wonAuctionsHref` = `/dashboard/buyer/bids` (buyer) or `/dashboard/dealer/auctions/won` (dealer) — explicit "Go to My Auctions" CTA. `D:\carmazium\src\app\checkout\success\page.tsx:34, 198-204` | **DIVERGES.** Web deliberately routes the payer toward the handover-proof step; mobile drops them on Home with no signal of what to do next. Directly matches the user's complaint. |
| Auction listing scheduled (publish) | `navigate('SellerListings')` — `SellCarFlowScreen.tsx:1506` | `router.push('/dashboard/seller/auctions')` for `listingType === 'AUCTION'` — `ListingWizard.tsx:871, 936` | **DIVERGES — confirmed bug.** Mobile sends a seller who just scheduled an auction to the classified-listings screen instead of `SellerAuctions`. |
| Listing published — classified | `navigate('SellerListings')` — `SellCarFlowScreen.tsx:1538` | `router.push('/dashboard/seller/listings')` — `ListingWizard.tsx:767/852/936` | Matches. |
| Payment success — **LISTING_FEE** (classified badge tier) | Handled inline via `SellCarFlowScreen`'s own success Alert (see row above), not `PurchaseFlowScreen` | `/dashboard/user?tab=inventory` — "View My Listings" (`checkout/success/page.tsx:185-191`) | Effectively matches for the classified case. |
| Payment success — **KYC_VERIFICATION** (dealer £1 fee) | Not traced to a specific post-payment screen in this pass — presumably handled inside `DealerKYCScreen`'s `StripeCheckoutModal` flow (per `CONTEXT.md` §7 payments section) | `/dashboard/dealer` — "Go to Dealer Dashboard" (`checkout/success/page.tsx:211-216`) | UNVERIFIED — `DealerKYCScreen.tsx` not read this pass. |
| Offer sent (buyer) | Stays on `VehicleDetailScreen` (BottomSheet closes in place), offer-status chip updates — no navigation | Not traced this pass | Plausibly reasonable (staying in context), not independently confirmed against web. |
| Listing edited (not new) | `navigation?.goBack()` — `SellCarFlowScreen.tsx:1453`, deliberately chosen over a fixed destination (comment `:1447-1452`) so it returns to whichever list screen launched the edit | Not traced this pass | Reads as a deliberate, reasonable choice; not flagged. |
| Bid placed | No navigation, in-place flash banner (`AuctionDetailScreen.tsx:1603`) | Not traced this pass | Consistent with expected live-auction UX; not flagged. |

No `navigation.reset()` calls were found anywhere in `MainStackNavigator`/`RootNavigator`/screen files searched — `RootNavigator.tsx` instead handles the auth/onboarding/main split by conditionally rendering a different top-level `Stack.Screen` (lines 33-44), which React Navigation treats as an implicit stack reset. No evidence of a back-stack trap (e.g., a payment success screen leaving the payment sheet in the back stack) was found in the files read, but the full stack depth after `PurchaseFlow` → `Tabs` was not traced with a live device, so this is UNVERIFIED rather than confirmed clean.

---

## 6. Deep links

- **`app.json`**: `scheme: "carmazium"` (line 10), registered as an Android intent filter (`android.intentFilters`, ~lines 45-60) with category `BROWSABLE`/`DEFAULT`. Confirmed this exists to receive the Stripe/Supabase OAuth-style redirect back into the app — `App.tsx`'s `StripeProvider urlScheme="carmazium"` (line 234), and `LoginScreen.tsx`/`SignupScreen.tsx`'s outbound `Linking.openURL(data.url)` calls.
- **`App.tsx`'s `<NavigationContainer>`** (lines 237-256) has **no `linking` prop** — read the full block; only `ref` and `theme` are passed, no `prefixes`/`config`.
- Consequence: **no URL-based deep-linking from web routes into mobile screens exists.** A shared link to `carmazium.com/vehicle/123`, or a Universal/App Link to the same path, has no mapping into `VehicleDetail`. The only structured deep-linking mobile has is **push-notification-driven**, via `App.tsx`'s `NOTIFICATION_SCREEN_MAP` (lines 36-47) covering `BID_PLACED`, `OUTBID`, `AUCTION_ENDING`, `AUCTION_WON`, `AUCTION_ENDED`, `OFFER_RECEIVED`, `COUNTER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `PAYOUT_FAILED` → specific screens, resolved in the notification-response handler (`App.tsx:72-120`).
- This is a real gap versus web's full URL surface (every route in §1 is a real, shareable/bookmarkable/SEO-indexed web URL), but closing it (universal links + associated-domains + intent-filter path patterns, versus a simple scheme registration) is a materially bigger lift than a navigation-destination fix, and may be a known/accepted scope boundary rather than an oversight. Flagging as a confirmed gap, but not asserting intent either way.

---

## Summary of concrete, file:line-cited findings

1. **Dead route `BuyerDashboard`** — `MainStackNavigator.tsx:264-266`, zero callers anywhere in `src`.
2. **Dead route `UnifiedDashboard`** (the stack registration, not the component) — `MainStackNavigator.tsx:274-276`, zero callers; the component is only reached via direct tab rendering (`TabNavigator.tsx:28`).
3. **Wrong destination — auction publish** — `SellCarFlowScreen.tsx:1506` sends to `SellerListings` instead of `SellerAuctions`, contradicting web's explicit branch at `ListingWizard.tsx:871/936`.
4. **Wrong destination — auction buyer-fee payment success** — `PurchaseFlowScreen.tsx:200` sends to Home (`Tabs`) unconditionally instead of web's role-aware "Go to My Auctions" (`checkout/success/page.tsx:34, 198-204`), which is specifically meant to prompt the handover-proof step.
5. **Missing drawer entry for Dealer Earnings** — `DealerEarningsScreen` registered and reachable via exactly one (non-drawer) call site, but absent from `DEALER_ITEMS` in `GlobalDrawer.tsx:134-230`, unlike every other major dealer feature.
6. **No purchase-history entry in the buyer/seller drawer** (`USER_ITEMS`, `GlobalDrawer.tsx:75-132`) — `BuyerPurchaseHistory` has only one call site app-wide, not from the drawer. May mirror a web-side gap (unverified).
7. **No URL-based deep linking** — `App.tsx`'s `NavigationContainer` has no `linking` config; only push-notification deep links exist.
8. Flagged but UNVERIFIED and worth follow-up: the direct (non-auction) retail-purchase entry point from `VehicleDetailScreen` (not located in this pass), `DealerKYCScreen`'s post-payment branch, whether web's own buyer sidebar has a history link, dealer "won auctions" list parity, and cross-consistency of the two `PurchaseFlow` entry points inside `AuctionDetailScreen.tsx` (lines 924 and 1433).
