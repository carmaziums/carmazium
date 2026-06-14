# Phase: mobile-app-parity — Research

**Researched:** 2026-06-14
**Domain:** React Native / Expo SDK 54 — Mobile Feature Parity & UI Polish
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DVLA lookup in Sell Wizard**
- Full DVLA reg plate lookup → auto-fills make, model, year, fuel type, colour
- On failure: graceful fallback to manual entry (no blocking the flow)
- Matches web wizard behavior exactly

**KYC (Identity Verification)**
- Dealer KYC only — matches web. Regular buyers/sellers have no KYC flow on mobile
- `DealerKYCScreen.tsx` exists — audit and wire it to the KYC submission endpoint

**Finance Calculator**
- UI-only / Coming Soon label
- `VehicleDetailScreen` already has `financeExpanded` state and deposit/term inputs — leave the UI, add "Coming Soon" label, do NOT wire to backend yet

**Marketing / Info screens**
- Add HowItWorks, About, and Pricing screens accessible from the app menu (drawer or profile tab)
- `HowItWorksScreen.tsx`, `ServicesScreen.tsx`, `TermsScreen.tsx` already exist — confirm accessible; add Pricing and About screens if missing

**Stripe checkout on mobile**
- ENABLED — `@stripe/stripe-react-native` (0.50.3) is already installed
- Mobile should support: £500 deposit, full purchase payment, £125 buyer auction fee
- Trigger from `PurchaseFlowScreen.tsx` and post-auction win flow
- Same backend Stripe checkout session endpoints as web

**Auction live bidding**
- Full live bidding on mobile — verified dealers can place bids
- Real-time Socket.IO bid feed (already scaffolded), anti-snipe countdown, bid amount input
- Same bid restriction as web: only verified dealers can bid; all others see the feed read-only
- `AuctionDetailScreen.tsx` needs bid input UI and bid API wiring

**Analytics charts**
- Full interactive charts for seller performance and dealer analytics
- Use `react-native-gifted-charts` (already in `node_modules` of GSD-tracked `mobile/`)
- Dealer: 6-month revenue bar chart, bid volume, lead funnel
- Seller: revenue trend line, views over time, conversion rate

**UI Quality Bar**
- Skeleton screens on ALL screens — not spinners
- Skeleton shapes must match the actual layout
- Every screen with a list/feed shows a contextual illustrated empty state
- Inline error banners with "Try again" — never full-screen crash
- No Alert.alert() for API errors
- Poppins for all headings; Montserrat for body; JetBrains Mono for all prices, timers, IDs
- `expo-haptics` (add if not installed) — light/medium/notification patterns
- Pull-to-refresh on every screen with fetched data
- `expo-image` blurhash placeholder on all car images
- Real-time inline form validation (border color, error text below field on blur)

**Animation Depth**
- Reanimated 4 for high-impact moments only
- Auction countdown red pulse when ≤5 min remain
- Bid placed green flash overlay on bid feed row
- AuctionCompleteScreen: full confetti particle burst + count-up price animation
- VehicleDetailScreen photo gallery: Reanimated spring-snap + pinch-to-zoom
- Tab bar: active icon spring-scales on selection
- GlobalToastProvider: slide-down withSpring animation

**Navigation transitions**
- React Navigation defaults for all routes
- Exception: Auction room custom fade-in entering; Win screen scale-from-center modal

### Claude's Discretion
- Exact skeleton shape dimensions per screen
- Confetti particle library choice (confetti-cannon vs custom)
- Exact haptic timing within the allowed categories
- Ordering of screens in the audit/fix sequence within each role flow
- Dealer flows: DealerAnalytics, DealerInventory, DealerLeads, DealerTeam, DealerPurchases — audit and fix wiring as part of the work; no separate decision required

### Deferred Ideas (OUT OF SCOPE)
- Vehicle compare (`CompareScreen.tsx`) — treat as Coming Soon for this phase
- Finance calculator API wiring — UI shows "Coming Soon"
- AI-powered CRM lead scoring display on `DealerLeadsScreen` — `aiScore` display deferred
- 3D vehicle viewer (`ThreeDVehicleViewer.tsx`) — defer entirely
</user_constraints>

---

## Executive Summary

The production mobile app lives at `D:\carmazium\carmazium app\carmazium app\` and is built on Expo SDK 54, React Native 0.81, React Navigation 7, Zustand, and direct-fetch `apiClient`. It is **substantially more complete than the abandoned Expo Router scaffold** tracked by STATE.md. The majority of screens exist and are API-wired; the task is targeted polish and gap-closing, not a build-from-scratch effort.

**Key findings from codebase inspection:**

1. `AuctionDetailScreen.tsx` is the most complete screen in the app — it has full Socket.IO bidding, live bid feed, anti-snipe countdown, bid input console, and win state handling. What it lacks are Reanimated animations (the countdown pulse, bid flash) and skeleton loading.

2. `SellCarFlowScreen.tsx` **does implement DVLA lookup** via `POST /dvla/lookup` through `apiClient`. The lookup is wired, populates all DVLA fields, and has a graceful fallback. This requirement is already met.

3. `react-native-gifted-charts` is **NOT in the target app's `package.json`**. The target app's `DealerAnalyticsScreen.tsx` implements charts using custom hand-rolled `View`-based sparklines and segment lines — no chart library. This is a critical finding: the context doc referenced gifted-charts being in the "GSD-tracked `mobile/`" node_modules (the abandoned scaffold), not in the production app.

4. `react-native-reanimated ~4.1.1` IS installed but no Reanimated plugin appears in `babel.config.js`. The existing Reanimated usage (`CategoryPill.tsx`, `HorizontalVehicleCard.tsx`, `PrimaryCTA.tsx`) works because `babel-preset-expo` automatically applies the Reanimated Babel plugin in SDK 54. No manual babel.config.js change is needed.

5. `expo-haptics` is NOT in `package.json`. Must be installed.

6. `@stripe/stripe-react-native` (0.50.3) is fully configured: installed, declared in `app.json` plugins with merchantIdentifier, and `StripeProvider` wraps the entire app in `App.tsx`. `PurchaseFlowScreen.tsx` and `AuctionCompleteScreen.tsx` both use `useStripe()`. Stripe checkout is functional on mobile today.

7. `GlobalToastProvider.tsx` currently only handles watchlist events (save/remove). It does NOT handle Socket.IO events, API errors, or auction events. It must be extended.

8. `GlobalDrawer.tsx` already contains navigation entries for HowItWorks, Services, and Terms. Pricing and About are handled as `Alert.alert()` callbacks — not dedicated screens. The decision requires adding proper screens for About and Pricing.

9. Missing from mobile navigation entirely: no dedicated `AboutScreen.tsx` or `PricingScreen.tsx`. These need to be created.

10. `ChatScreen` is registered in the stack with the param name `threadId` but `AuctionDetailScreen` navigates to it with `roomId`. This is a nav param mismatch bug.

**Primary recommendation:** Execute the phase as a targeted polish pass — skeleton loading, missing empty states, typography enforcement, haptics, animation moments, and the few genuine feature gaps (About/Pricing screens, extended toast system, gifted-charts installation). The core business logic is already wired.

---

## Screen Inventory & Gap Analysis

| Screen | File | Loading State | Empty State | RefreshControl | Skeleton | API Wired | Key Gaps |
|--------|------|--------------|-------------|---------------|---------|-----------|----------|
| HomeScreen | `screens/main/HomeScreen.tsx` | Yes — isLoading guard | Yes — EmptyState component | Yes | Yes — Skeleton component | Yes — 4 API calls | Blurhash on images; missing `fontFamily` audit for prices (JetBrains Mono); tab-bar spring animation |
| BuyerDashboardScreen | `screens/buyer/BuyerDashboardScreen.tsx` | Yes — loading state | Partial — dashes shown | Yes — RefreshControl | No — shows dashes | Yes — GET /dashboard/buyer | Replace dashes with skeleton; add haptic on CTA taps |
| SellerDashboardScreen | `screens/seller/SellerDashboardScreen.tsx` | Yes — loading bool | Partial — dashes | No — missing RefreshControl | No — dashes | Yes — GET /listings/stats | Add RefreshControl; skeleton; empty state for no offers |
| DealerAnalyticsScreen | `screens/main/DealerAnalyticsScreen.tsx` | Yes — ActivityIndicator | Partial | No | No | Yes — GET /dealers/analytics | Custom View-based charts only; need gifted-charts install + proper bar/line charts |
| DealerLeadsScreen | `screens/main/DealerLeadsScreen.tsx` | Yes — ActivityIndicator | Yes (detected) | Yes — RefreshControl | No | Yes — GET /dealers/leads | Skeleton; aiScore display deferred per decision; "Message Lead" flow needs chat nav |
| DealerInventoryScreen | `screens/main/DealerInventoryScreen.tsx` | Yes | Partial | Yes | No | Yes | Skeleton loading |
| DealerKYCScreen | `screens/main/DealerKYCScreen.tsx` | Unknown | Unknown | Unknown | Unknown | Needs audit | Must wire to POST /dealers/kyc; pending state after submission |
| AuctionDetailScreen | `screens/vehicle/AuctionDetailScreen.tsx` | Yes — ActivityIndicator | Yes — bid history empty | No | No — spinner | Yes — full Socket.IO + bid API | Replace spinner with skeleton; add Reanimated countdown pulse; bid flash animation; Reanimated entry animation |
| VehicleDetailScreen | `screens/vehicle/VehicleDetailScreen.tsx` | Unknown | Unknown | Unknown | Unknown | Needs audit | Photo gallery Reanimated spring-snap; pinch-to-zoom; finance "Coming Soon" label |
| SellCarFlowScreen | `screens/sell/SellCarFlowScreen.tsx` | Yes — dvlaLoading | N/A (wizard) | N/A | N/A | Yes — DVLA wired via apiClient | Inline form validation colors; real-time field border feedback; HEIC conversion for image upload |
| MessagesScreen | `screens/main/MessagesScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit required |
| ChatScreen | `screens/main/ChatScreen.tsx` | Needs audit | Needs audit | N/A | N/A | Needs audit | Nav param mismatch: registered as `threadId`, called with `roomId` — BLOCKING BUG |
| SearchScreen | `screens/main/SearchScreen.tsx` | Yes | Partial | Yes | No | Yes | Skeleton cards; blurhash images |
| LiveScreen (Auctions) | `screens/main/LiveScreen.tsx` | Yes | Partial | Yes | No | Yes — active + scheduled auctions | Skeleton; empty state for no live auctions |
| SavedScreen | `screens/main/SavedScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| ProfileScreen | `screens/main/ProfileScreen.tsx` | Needs audit | N/A | N/A | N/A | Needs audit | KYC entry point must be accessible |
| NotificationsScreen | `screens/main/NotificationsScreen.tsx` | Yes | Partial | Yes | No | Yes | Skeleton |
| AuctionCompleteScreen | `screens/main/AuctionCompleteScreen.tsx` | Yes | N/A | N/A | N/A | Yes — Stripe payment sheet | No confetti animation; no count-up animation; price display not using JetBrains Mono |
| PurchaseFlowScreen | `screens/main/PurchaseFlowScreen.tsx` | Yes | N/A | N/A | N/A | Yes — Stripe payment sheet | Already functional; audit typography |
| SellerOffersScreen | `screens/seller/SellerOffersScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| BuyerOffersScreen | `screens/buyer/BuyerOffersScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| BuyerBidsScreen | `screens/buyer/BuyerBidsScreen.tsx` | Yes | Yes | No | Yes — skeletonCard | Yes | Add RefreshControl |
| BuyerPurchaseHistoryScreen | `screens/buyer/BuyerPurchaseHistoryScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| EarningsScreen | `screens/seller/EarningsScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| SellerPerformanceScreen | `screens/seller/SellerPerformanceScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Needs gifted-charts for revenue/views charts |
| SellerListingsScreen | `screens/seller/SellerListingsScreen.tsx` | Yes | Partial | Yes | No | Yes | Skeleton |
| SellerAuctionsScreen | `screens/seller/SellerAuctionsScreen.tsx` | Yes | Partial | Yes | No | Yes | Skeleton |
| DealerOffersScreen | `screens/main/DealerOffersScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| DealerTeamScreen | `screens/main/DealerTeamScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| DealerPurchasesScreen | `screens/main/DealerPurchasesScreen.tsx` | Needs audit | Needs audit | Needs audit | Needs audit | Needs audit | Full audit |
| HowItWorksScreen | `screens/main/HowItWorksScreen.tsx` | N/A | N/A | N/A | N/A | Static | Accessible from drawer — confirmed |
| ServicesScreen | `screens/main/ServicesScreen.tsx` | N/A | N/A | N/A | N/A | Static | Accessible from drawer |
| TermsScreen | `screens/main/TermsScreen.tsx` | N/A | N/A | N/A | N/A | Static | Accessible from drawer |
| AboutScreen | MISSING | — | — | — | — | — | Must create `screens/main/AboutScreen.tsx` |
| PricingScreen | MISSING | — | — | — | — | — | Must create `screens/main/PricingScreen.tsx`; currently an Alert.alert() |
| CompareScreen | `screens/main/CompareScreen.tsx` | — | — | — | — | — | Deferred — mark Coming Soon |
| PaymentHistoryScreen | `screens/account/PaymentHistoryScreen.tsx` | Yes | Yes | Needs audit | Yes — skeletonBlock | Yes | Already has skeleton — check typography |
| UnifiedDashboardScreen | `screens/account/UnifiedDashboardScreen.tsx` | Yes | Partial | Needs audit | Yes — SkeletonBlock | Yes | Audit; check role routing |
| AlertsScreen | `screens/main/AlertsScreen.tsx` | Yes | Partial | Yes | No | Yes — GET /notifications | Add skeleton |

---

## API Wiring Audit

### Confirmed Wired (direct codebase inspection)

| Screen / Feature | Endpoint | Method | Notes |
|-----------------|----------|--------|-------|
| SellCarFlowScreen DVLA | `POST /dvla/lookup` | apiClient | Fully wired — populates all DVLA fields, fallback on error |
| SellCarFlowScreen publish | `POST /listings` | apiClient | Wired — creates listing |
| AuctionDetailScreen load | `GET /auctions/:id` via `getAuction()` | auctionApi | Wired |
| AuctionDetailScreen bid | `POST /bids` via `placeBid()` | auctionApi | Wired |
| AuctionDetailScreen socket | Socket.IO `/auctions` namespace | socket.io-client | Fully wired — join, bid:new, auction:ended, viewers, anti-snipe |
| AuctionDetailScreen chat | `POST /chat/rooms` via `createChatRoom()` | chatApi | Wired |
| AuctionCompleteScreen payment | `POST /payments/intent` via `createPaymentSheet()` | paymentsApi | Wired — Stripe Payment Sheet |
| PurchaseFlowScreen payment | `POST /payments/intent` via `createPaymentSheet()` | paymentsApi | Wired — Stripe Payment Sheet |
| BuyerDashboardScreen | `GET /dashboard/buyer` | apiClient | Wired |
| SellerDashboardScreen | `GET /listings/stats` | apiClient | Wired |
| DealerAnalyticsScreen | `GET /dealers/analytics` | apiClient | Wired — full period selector |
| DealerLeadsScreen | `GET /dealers/leads` | apiClient | Wired — paginated, status filter |
| DealerLeadsScreen status update | `PATCH /dealers/leads/:id` | apiClient | Wired |
| DealerInventoryScreen | `GET /listings/my` | apiClient | Wired |
| NotificationsScreen | `GET /notifications` | apiClient | Wired |

### Needs Investigation / Likely Incomplete

| Screen | Suspected Gap | Risk |
|--------|--------------|------|
| DealerKYCScreen | `POST /dealers/kyc` — file upload wiring unknown; pending state screen unknown | HIGH |
| ChatScreen | Nav param mismatch (`threadId` vs `roomId`); Socket.IO chat wiring unknown | HIGH |
| SellerOffersScreen | Counter-offer submit wiring (`PATCH /offers/:id/respond`) — unknown | MEDIUM |
| BuyerOffersScreen | Accept counter, withdraw offer (`PATCH /offers/:id/respond-counter`, `PATCH /offers/:id/withdraw`) | MEDIUM |
| SellerPerformanceScreen | `GET /listings/performance` — chart rendering (custom View or chart library?) | MEDIUM |
| DealerTeamScreen | `POST /dealers/staff`, `DELETE /dealers/staff/:id` — wiring unknown | MEDIUM |
| DealerPurchasesScreen | `GET /dealers/purchases` — wiring unknown | LOW |
| GlobalToastProvider | Socket.IO event subscription — NOT wired | HIGH |

### Mock / Hardcoded Data — None Found

No screens were found using hardcoded mock data arrays for primary content. All screens that display data call real API endpoints. The `CarListing` type in `src/data/listings.ts` is a TypeScript type definition used for nav params, not a mock data source.

---

## Tech Dependencies Audit

### Installed in Target App (`package.json`)

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| expo | ~54.0.0 | Installed | Production target |
| react | 19.1.0 | Installed | |
| react-native | 0.81.5 | Installed | |
| @react-navigation/native | ^7.2.5 | Installed | |
| @react-navigation/native-stack | ^7.16.0 | Installed | |
| @react-navigation/bottom-tabs | ^7.16.2 | Installed | |
| react-native-reanimated | ~4.1.1 | Installed | No babel plugin needed in SDK 54 |
| react-native-gesture-handler | Not in package.json | MISSING | Required for photo gallery pinch-to-zoom |
| zustand | ^5.0.14 | Installed | |
| socket.io-client | ^4.8.3 | Installed | |
| @stripe/stripe-react-native | 0.50.3 | Installed + configured | StripeProvider in App.tsx, plugin in app.json |
| expo-image | ~3.0.11 | Installed | Used in HomeScreen, AuctionDetailScreen, DealerLeadsScreen |
| expo-image-picker | ~17.0.11 | Installed | Used in SellCarFlowScreen |
| expo-linear-gradient | ~15.0.8 | Installed | Used across many screens |
| expo-notifications | ~0.32.17 | Installed + configured | |
| expo-haptics | NOT IN package.json | MISSING — must install | `expo install expo-haptics` |
| react-native-gifted-charts | NOT IN package.json | MISSING — must install | Context doc referenced wrong directory |
| react-native-svg | 15.12.1 | Installed | Required peer dep for gifted-charts |
| react-native-confetti-cannon | NOT IN package.json | MISSING — install or implement custom | For AuctionCompleteScreen celebration |
| expo-secure-store | ~15.0.8 | Installed | |
| expo-font | ~14.0.12 | Installed | All 4 font families loaded in App.tsx |
| @expo-google-fonts/poppins | ^0.4.1 | Installed | |
| @expo-google-fonts/montserrat | ^0.4.2 | Installed | |
| @expo-google-fonts/jetbrains-mono | ^0.4.1 | Installed | |
| lucide-react-native | ^1.17.0 | Installed | Not used — BrandIcon wraps Ionicons exclusively |
| @react-three/fiber | ^9.6.1 | Installed | Dead weight for mobile — 3D viewer deferred |
| three | ^0.184.0 | Installed | Dead weight — deferred |
| @sentry/react-native | ~7.2.0 | Installed + configured | |
| react-native-worklets | ^0.5.1 | Installed | Reanimated worklets support |
| react-native-worklets-core | ^1.6.3 | Installed | |

### App.json Plugin Verification

- `expo-font` — configured (fonts array empty, but fonts loaded via useFonts in App.tsx — correct approach)
- `expo-secure-store` — configured
- `expo-notifications` — configured with color `#DC1F26`, icon, androidMode
- `@stripe/stripe-react-native` — configured with merchantIdentifier and enableGooglePay
- `@sentry/react-native` — configured
- EAS projectId — confirmed: `f0ab914b-3433-4816-80a2-0a94e6c6a066`

### Missing Install Commands

```bash
npx expo install expo-haptics
npx expo install react-native-gifted-charts
# react-native-svg already installed (peer dep met)
# For confetti — choose one:
npx expo install react-native-confetti-cannon
# OR implement custom particle system with Reanimated (Claude's discretion)
# For photo gallery pinch/swipe:
npx expo install react-native-gesture-handler
```

---

## Reanimated & Animation Readiness

### Reanimated Configuration Status: READY (no changes needed)

`babel-preset-expo` in Expo SDK 54 automatically applies the `react-native-reanimated/plugin` Babel transform. The `babel.config.js` in the target app uses only `babel-preset-expo` — this is correct. Do NOT add the Reanimated plugin manually to `babel.config.js` as it would duplicate the transform.

Evidence: `CategoryPill.tsx`, `HorizontalVehicleCard.tsx`, and `PrimaryCTA.tsx` all import and use `useSharedValue`, `useAnimatedStyle`, and `withSpring` from `react-native-reanimated` without any manual babel config. This confirms the setup works.

### Existing Reanimated Patterns (available as reference)

**CategoryPill.tsx** — press-scale animation:
```typescript
const scale = useSharedValue(1);
const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
// Usage:
onPressIn={() => { scale.value = withSpring(0.94, { damping: 15, stiffness: 400 }); }}
onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
```

**HorizontalVehicleCard.tsx** — press-scale on full card (same pattern at 0.98 scale).

**PrimaryCTA.tsx** — CTA button scale animation (same pattern).

### Animation Gaps to Fill

| Animation | Current State | What to Add |
|-----------|--------------|-------------|
| Auction countdown pulse | Plain Text countdown only | Reanimated background color interpolation to `Colors.accentDark` when ≤5 min |
| Bid placed flash | No visual feedback | withSequence(withTiming opacity 1, withTiming opacity 0) green overlay on bid row |
| AuctionCompleteScreen celebration | No animation — plain price display | Confetti cannon + count-up animation with withTiming driving a shared value |
| VehicleDetailScreen photo gallery | FlatList horizontal scroll | Reanimated + gesture-handler spring-snap; requires `react-native-gesture-handler` install |
| Tab bar icon spring | Static icon | Tab navigator `tabBarIcon` wrapped with Reanimated scale spring |
| GlobalToastProvider slide | Uses basic Toast component — no slide | withSpring from translateY -80 to 0 |

### react-native-gesture-handler

**NOT in package.json.** Required for VehicleDetailScreen photo gallery pinch-to-zoom. Must install:
```bash
npx expo install react-native-gesture-handler
```
After installing, `GestureHandlerRootView` must wrap the NavigationContainer in App.tsx.

---

## Feature Gaps vs FEATURE_AUDIT.md

### Web Features Without Mobile Equivalent (true gaps)

| Web Feature | Web Path | Mobile Status | Action |
|------------|---------|--------------|--------|
| About page | `/about` | Alert.alert() placeholder in drawer | Create `AboutScreen.tsx` — static content |
| Pricing page | `/pricing` | Alert.alert() placeholder in drawer | Create `PricingScreen.tsx` — static content |
| HPI Report (paid check) | `/buy-cars/[slug]` | Not surfaced on VehicleDetailScreen | Add HPI check button on VehicleDetailScreen (links to payment → backend `/payments/hpi-checkout`) |
| Seller public profile | `/seller/:id` | `SellerProfileScreen.tsx` exists | Needs audit to confirm wiring |
| Finance application | `/dashboard/dealer/finance` | Not on mobile | Out of scope per CONTEXT.md |
| Auction handover proof upload | `/dashboard/seller/auctions` | `SellerAuctionsScreen.tsx` exists | Needs audit — submit handover proof `POST /auctions/:id/handover-proof` |
| AI description generation | `/dashboard/seller/add-listing` | Not in SellCarFlowScreen | Could add as optional step; not explicitly required in CONTEXT |

### Navigation Bugs Found

1. **Chat nav param mismatch**: `ChatScreen` is registered in `MainStackParamList` as `{ threadId: string }` but `AuctionDetailScreen` calls `navigation.navigate('Chat', { roomId: room.id })`. The `ChatScreen` name in the stack is `ChatScreen` but nav calls use `'Chat'`. Two separate issues — name mismatch AND param key mismatch. Both must be fixed.

2. **GlobalDrawer Pricing/About**: Currently both are `action: 'alert'` that call `Alert.alert()`. After screens are created, these must be updated to `stackScreen: 'About'` and `stackScreen: 'Pricing'`.

3. **AuctionCompleteScreen navigation**: Currently not linked from anywhere in the navigation flow. `AuctionDetailScreen` navigates to `Messages` on win. The win celebration screen needs to be triggered properly — either from `AuctionDetailScreen` on `auction:ended` when user is winner, or from a deep-link from the AUCTION_WON push notification.

---

## Validation Architecture

### Test Framework

The target production app (`D:\carmazium\carmazium app\carmazium app\`) has no test configuration files detected. The test infrastructure that exists (`jest.config.js`, `@testing-library/react-native`) is in the abandoned `mobile/` scaffold tracked by STATE.md, not in the target app.

| Property | Value |
|----------|-------|
| Framework | None configured in target app |
| Config file | None — does not exist in target app |
| Quick run command | N/A |
| Full suite command | N/A |

### What Can Be Verified (Non-Automated)

For this phase, verification is primarily manual + device testing because:
- The target app has no test infrastructure
- React Native animations and loading states require visual verification
- Socket.IO real-time behavior requires a live backend connection
- Stripe payment flows require test mode device testing

### Verifiable Behaviors by Screen

| Requirement Area | Verification Method |
|-----------------|-------------------|
| Skeleton screens on all screens | Visual inspection — load screen on slow connection or with artificial delay |
| Empty states | Test with empty account (no bids, no offers, no listings) |
| DVLA lookup | Enter a real UK VRM — verify fields populate within 3 seconds |
| Auction live bidding | Two verified dealer accounts on separate devices; place bid, observe feed |
| Anti-snipe extension | Place bid with < 3 min remaining; confirm new endTime in feed |
| Stripe payment sheet | Use Stripe test card 4242 4242 4242 4242 |
| Haptic feedback | Physical device required — simulator does not trigger haptics |
| Socket.IO connection indicator | Monitor green/red dot on AuctionDetailScreen |
| Typography enforcement | Visual review per screen — prices must be JetBrains Mono |
| Pull-to-refresh | Swipe down on data screens; confirm tintColor is `Colors.accent` |

### Wave 0 Gaps

The target app has no test infrastructure. For this phase, a Wave 0 test task would need to:
- [ ] Decide whether to add Jest to the target app (significant setup cost)
- [ ] Alternatively: accept manual QA as the validation gate for this phase

**Recommendation (Claude's discretion):** Given the visual/animation-heavy nature of this phase, accept manual QA over device as the validation gate. Automated tests for pure logic (price formatting, DVLA data mapping, bid validation rules) can be added incrementally without blocking phase delivery.

---

## Implementation Risks & Pitfalls

### Pitfall 1: react-native-gifted-charts Not in Target App

**What goes wrong:** The CONTEXT.md references gifted-charts as "already in node_modules of GSD-tracked mobile/" — but that is the abandoned Expo Router scaffold. The production target app (`carmazium app/`) does NOT have gifted-charts.

**How to avoid:** Run `npx expo install react-native-gifted-charts` inside `D:\carmazium\carmazium app\carmazium app\` before implementing any charts. `react-native-svg` (15.12.1) is already installed so the peer dependency is met.

**Warning sign:** Import errors on `DealerAnalyticsScreen` or `SellerPerformanceScreen` if charts are added without install.

### Pitfall 2: Chat Navigation Param Bug

**What goes wrong:** `AuctionDetailScreen` calls `navigation.navigate('Chat', { roomId: room.id })` but the screen is registered as `ChatScreen` with param `threadId`. This means winner post-auction chat flow is broken.

**How to avoid:** Before implementing any chat-related features, fix the stack registration (`'Chat'` → `'ChatScreen'` or rename the route) and unify the param key to `roomId` throughout.

### Pitfall 3: Reanimated 4 Breaking API Changes

**What goes wrong:** Reanimated 4 (`~4.1.1`) has API differences from Reanimated 3. Notably, `useAnimatedRef` returns a different type, `measure` is async, and `LayoutAnimation` API changed. Code copied from Stack Overflow or docs for Reanimated 3 may not work.

**How to avoid:** Use the existing patterns in `CategoryPill.tsx`, `HorizontalVehicleCard.tsx`, and `PrimaryCTA.tsx` as the definitive reference. For countdown pulse animation, use `useSharedValue` + `useAnimatedStyle` + `withRepeat(withTiming(...))`.

### Pitfall 4: expo-haptics Requires Physical Device

**What goes wrong:** `expo-haptics` calls are silently ignored on iOS Simulator and trigger errors on Android Emulator. Adding haptics without physical-device testing means uncertain behavior in production.

**How to avoid:** Wrap all haptic calls in a try-catch or use `Platform.OS === 'ios' ? Haptics.impactAsync(...) : null`. Test on physical device before final review.

### Pitfall 5: GlobalToastProvider Socket.IO Double Connection

**What goes wrong:** If `GlobalToastProvider` opens its own Socket.IO connection to `/notifications` while `AuctionDetailScreen` opens another to `/auctions`, AND the auth token is refreshed mid-session, connections can desync. The app already has Socket.IO on three namespaces.

**How to avoid:** Read from a shared `notificationsSocket` singleton (or check if `ChatContext`/`pushNotifications.ts` already manages this). Do not create a new socket connection inside GlobalToastProvider — subscribe to the existing `/notifications` socket.

### Pitfall 6: expo-image blurhash Requires Backend Support

**What goes wrong:** `expo-image` `placeholder={{blurhash: '...'}}` requires the backend to return a `blurhash` string alongside image URLs. The current `Listing.images` field is `String[]` (plain URLs only). No `blurhash` field exists in the backend response.

**How to avoid:** The CONTEXT.md says "if blurhash not available from backend, use dark placeholder `#1E1E28`". Implement as: `placeholder={{ blurhash: listing.blurhash ?? undefined }}` with `backgroundColor: '#1E1E28'` as the fallback style. This is already feasible without backend changes.

### Pitfall 7: DealerAnalyticsScreen Chart Hand-Roll vs gifted-charts Migration

**What goes wrong:** `DealerAnalyticsScreen.tsx` currently uses a hand-rolled `SparkLine` component built from `View` segments with trigonometry for line angles. Replacing this with gifted-charts `BarChart`/`LineChart` requires a complete re-render of the analytics UI, not just a library swap.

**How to avoid:** Treat this as a full screen rewrite for the chart components. The `AnalyticsData` interface in the existing screen is well-structured and maps cleanly to gifted-charts data format (`{value: number, label: string}[]`).

### Pitfall 8: SellCarFlowScreen Uses `react-native` Image (not expo-image)

**What goes wrong:** `SellCarFlowScreen.tsx` imports `Image` from `react-native` (line 5), not from `expo-image`. This means car photo thumbnails in the wizard don't get caching/blurhash benefits.

**How to avoid:** Replace the `Image` import with `expo-image`'s `Image` in `SellCarFlowScreen.tsx` specifically for the photo upload preview grid.

### Pitfall 9: AuctionCompleteScreen Navigation Trigger

**What goes wrong:** `AuctionCompleteScreen` exists but nothing currently navigates to it from `AuctionDetailScreen`. The win banner on `AuctionDetailScreen` shows "Message Seller" directly. The celebration screen is an orphan.

**How to avoid:** On `auction:ended` socket event, if `payload.winnerId === currentUser.id`, navigate to `AuctionComplete` with the win params instead of showing an in-page banner. This is the intended flow per CONTEXT.md.

### Pitfall 10: Typography Audit Scope

**What goes wrong:** The app has `FontFamily.bold` (Poppins) used as the general "strong" font across all screens, including for prices. But the decision requires prices in `FontFamily.mono` (JetBrains Mono). A global search-and-replace on price styles would be hazardous.

**How to avoid:** The fix is targeted: any `Text` that renders a `£` value must use `fontFamily: FontFamily.mono` (or `FontFamily.monoRegular`/`FontFamily.monoExtraBold` depending on weight needed). Audit each screen individually rather than bulk-replacing.

---

## Recommended Planning Approach

### Wave Structure (5 waves recommended)

**Wave 0 — Shared Infrastructure (unblocks all other waves)**
- Extract `HomeScreen.tsx` Skeleton component to `src/components/ui/Skeleton.tsx` (shared `<Skeleton w h r />`)
- Install missing packages: `expo-haptics`, `react-native-gifted-charts`, `react-native-gesture-handler`, confetti library
- Fix `ChatScreen` nav param bug (blocking all post-auction chat flows)
- Extend `GlobalToastProvider` with Socket.IO `/notifications` subscription and API error hook
- Add `GestureHandlerRootView` to `App.tsx` (required for gesture-handler)

**Wave 1 — Auction & Bidding (highest business value)**
- `AuctionDetailScreen`: Replace ActivityIndicator with skeleton; add Reanimated countdown pulse; add bid flash; trigger `AuctionCompleteScreen` on win
- `AuctionCompleteScreen`: Add confetti + count-up price animation; wire "Message Seller" correctly
- `LiveScreen`: Add skeleton loading

**Wave 2 — Sell Flow & KYC**
- `SellCarFlowScreen`: Real-time inline field validation (border color + error text); swap `Image` to `expo-image`; HEIC conversion audit
- `DealerKYCScreen`: Full audit and wire to `POST /dealers/kyc` + pending state
- `VehicleDetailScreen`: Photo gallery → Reanimated spring-snap + pinch-to-zoom; Finance "Coming Soon" label

**Wave 3 — Dashboards & Dealer Flows**
- `DealerAnalyticsScreen`: Replace hand-rolled charts with gifted-charts BarChart + LineChart
- `SellerPerformanceScreen`: Wire to `GET /listings/performance`; add gifted-charts
- `SellerDashboardScreen`: Add RefreshControl + skeleton
- `DealerLeadsScreen`: Add skeleton; wire "Message Lead" via chat room
- All remaining dealer screens: audit wiring, add skeleton + empty states

**Wave 4 — Buyer Flows, Info Screens & Polish**
- Create `AboutScreen.tsx` and `PricingScreen.tsx`; update GlobalDrawer entries
- `BuyerOffersScreen`, `BuyerBidsScreen`, `BuyerPurchaseHistoryScreen`: RefreshControl + skeleton
- Haptic feedback pass: add `expo-haptics` calls to all CTA buttons and transaction-completing actions
- Tab bar spring animation on active icon selection
- Pull-to-refresh standardisation across all remaining screens

**Wave 5 — Typography Enforcement & Image Polish**
- Full typography audit: all price `Text` → `FontFamily.mono`; all heading `Text` → `FontFamily.bold` (Poppins); all body → `FontFamily.regular` (Montserrat)
- `expo-image` blurhash fallback (`#1E1E28`) on all car image displays
- `transition={200}` prop verified on all `expo-image` instances
- Zero hardcoded hex values audit (all must use `Colors.*`)

### Screen Count Summary
- Screens that exist and are largely complete: 20+
- Screens needing moderate work (skeleton, empty state, RefreshControl): ~15
- Screens needing full audit (wiring unknown): ~8
- Missing screens to create: 2 (AboutScreen, PricingScreen)
- Navigation bugs to fix: 2 (Chat name/param mismatch, AuctionComplete trigger)
- Packages to install: 3–4 (expo-haptics, gifted-charts, gesture-handler, confetti)

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `D:\carmazium\carmazium app\carmazium app\package.json` — dependency versions
- `D:\carmazium\carmazium app\carmazium app\app.json` — plugin and Stripe configuration
- `D:\carmazium\carmazium app\carmazium app\babel.config.js` — Reanimated plugin status
- `D:\carmazium\carmazium app\carmazium app\App.tsx` — StripeProvider, font loading, auth init
- `D:\carmazium\carmazium app\carmazium app\src\navigation\MainStackNavigator.tsx` — all registered screens and param types
- `D:\carmazium\carmazium app\carmazium app\src\screens\main\HomeScreen.tsx` — Skeleton reference implementation
- `D:\carmazium\carmazium app\carmazium app\src\screens\vehicle\AuctionDetailScreen.tsx` — Socket.IO + bid implementation
- `D:\carmazium\carmazium app\carmazium app\src\screens\sell\SellCarFlowScreen.tsx` — DVLA lookup implementation
- `D:\carmazium\carmazium app\carmazium app\src\screens\main\DealerLeadsScreen.tsx` — leads API wiring
- `D:\carmazium\carmazium app\carmazium app\src\screens\main\DealerAnalyticsScreen.tsx` — hand-rolled charts
- `D:\carmazium\carmazium app\carmazium app\src\components\GlobalToastProvider.tsx` — toast system state
- `D:\carmazium\carmazium app\carmazium app\src\components\GlobalDrawer.tsx` — menu items and nav entries
- `D:\carmazium\carmazium app\carmazium app\src\screens\main\AuctionCompleteScreen.tsx` — Stripe + win screen
- `D:\carmazium\carmazium app\carmazium app\src\screens\main\PurchaseFlowScreen.tsx` — Stripe Payment Sheet
- `D:\carmazium\carmazium app\carmazium app\src\components\CategoryPill.tsx` — Reanimated reference
- `D:\carmazium\carmazium app\carmazium app\src\constants\colors.ts` — brand token definitions
- `D:\carmazium\carmazium app\carmazium app\src\constants\typography.ts` — font family definitions
- `D:\carmazium\FEATURE_AUDIT.md` — web feature reference

### Secondary (MEDIUM confidence — context docs)
- `.planning/phases/mobile-app-parity/mobile-CONTEXT.md` — locked decisions and phase scope
- `.planning/STATE.md` — historical project context (note: refers to abandoned scaffold, not target app)

---

## Metadata

**Confidence breakdown:**
- Screen inventory: HIGH — all screens directly read
- API wiring status: HIGH for confirmed screens; MEDIUM for unread screens (DealerKYCScreen, ChatScreen, etc.)
- Tech dependencies: HIGH — package.json and app.json directly inspected
- Reanimated readiness: HIGH — babel.config.js and existing usage confirmed
- Animation gaps: HIGH — existing code confirmed, gaps identified
- Navigation bugs: HIGH — stack type definitions and navigate() calls directly compared

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable stack; Expo SDK 54 is current release)
