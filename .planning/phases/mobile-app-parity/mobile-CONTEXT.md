# Mobile App: Feature Parity & UI Polish — Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit every screen in the `carmazium app` (React Navigation, Expo SDK 54) against `FEATURE_AUDIT.md` (web feature reference), close functional gaps, and deliver production-quality UI/UX across all buyer, seller, and dealer flows.

**Target codebase:** `D:\carmazium\carmazium app\carmazium app\`
**Tech stack:** React Navigation 7, Expo SDK 54, React 19.1, React Native 0.81, StyleSheet API, Zustand, Socket.IO
**NOT in scope:** Admin dashboard (web-only), Finance/Insurance/Contractor partner dashboards (web-only), vehicle compare (deferred)

⚠️ **Scope change from PROJECT.md:** Stripe mobile checkout is now ENABLED (see Payments decision below). The original "no payments on mobile" constraint is lifted.

</domain>

<decisions>
## Implementation Decisions

### Feature Scope

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

**Vehicle Compare**
- Deferred — `CompareScreen.tsx` exists but treat as Coming Soon for this phase

### UI Quality Bar

**Loading states**
- Skeleton screens on ALL screens — not spinners
- Skeleton shapes must match the actual layout (not generic rectangles)
- Pattern: `HomeScreen.tsx`'s `Skeleton` component (pulse Animated.Value) is the reference implementation to replicate across all screens

**Empty states**
- Every screen with a list/feed shows a contextual illustrated empty state:
  - Icon (Ionicons) + heading + 1-line subtext + optional CTA button
  - Examples: "No bids yet — Browse Auctions", "No offers received — Your listings are live"
  - Not a blank screen, not plain text

**Error states**
- Inline error: banner/message with a "Try again" retry button — never a full-screen crash
- Transient errors (failed bid, failed offer): animated toast via existing `GlobalToastProvider`
- No Alert.alert() for API errors (feels dated); reserve Alert for destructive confirmations only

**Typography — strict enforcement**
- `Poppins` — all headings, section labels, KPI tile values
- `Montserrat` — body copy, list item text, descriptions
- `JetBrains Mono` — ALL prices (£xxx), countdown timers, vehicle IDs, sort codes
- Zero system font fallbacks visible on-screen
- Audit every screen; fix any `fontFamily` inconsistency

**Haptic feedback**
- `expo-haptics` (add if not installed)
- Light impact: button press (CTA taps, navigation actions)
- Medium impact: bid placed successfully, offer submitted, listing published
- Notification pattern: auction win, KYC approved

**Pull-to-refresh**
- Every screen with fetched data gets a `RefreshControl`
- Already present on some screens — standardise across ALL list/feed/dashboard screens

**Image loading**
- `expo-image` already used — enable `blurhash` placeholder on all car images
- Fade-in transition after load (`transition={200}` prop)
- No white flash or jarring pop — placeholder should be dark (`#1E1E28` tone) if blurhash not available from backend

**Form validation**
- Real-time inline validation (not submit-time):
  - Field border turns `Colors.error` (#EF4444) on invalid, `Colors.success` (#22C55E) on valid
  - Error message text appears below the field immediately on blur or keystroke
  - Applies to: offer amount input, sell wizard fields, counter-offer input, login/signup forms, bank detail fields

### Animation Depth

**Philosophy: Strategic moments only**
- Reanimated 4 for high-impact moments; React Navigation default transitions for navigation
- Do NOT add Reanimated to every screen — only the moments listed below

**Auction countdown**
- JetBrains Mono timer, updates every second
- When ≤5 minutes remain: background pulses deep red (`Colors.accentDark`), timer color intensifies to `Colors.accentGlow`, slight spring scale on each second tick
- Anti-snipe extension triggers: flash + "⚡ Time extended by 3 minutes" message

**Bid placed flash**
- Brief green flash overlay on the bid feed row when the user's bid is accepted
- Reanimated `withSequence(withTiming opacity→1, withTiming opacity→0)`

**Auction win celebration (AuctionCompleteScreen)**
- Full-screen confetti particle burst (react-native-confetti-cannon or custom particle system)
- Car hero image: neon red glow pulse animation
- Price reveals with animated count-up
- Settles to handover CTA after ~3 seconds

**Photo gallery (VehicleDetailScreen)**
- Replace current FlatList horizontal scroll with Reanimated + react-native-gesture-handler swipe
- Spring snap between photos (not inertia scroll)
- Pinch-to-zoom on full-screen tap

**Tab bar**
- Active tab icon spring-scales on selection: `withSpring(1.2)` then `withSpring(1.0)`
- Notification badge bounces when new alert arrives

**In-app real-time alerts**
- Animated toast slides down from top (via `GlobalToastProvider` — already exists)
- Slide-in: `withSpring` from `-80` to `0`
- Auto-dismisses after 4 seconds or on tap
- Notification badge on tab/menu updates instantly via Socket.IO

**Navigation transitions**
- React Navigation defaults for all routes
- Exception: Auction room uses custom fade-in entering; Win screen uses scale-from-center modal

### Claude's Discretion
- Exact skeleton shape dimensions per screen
- Confetti particle library choice (confetti-cannon vs custom)
- Exact haptic timing within the allowed categories
- Ordering of screens in the audit/fix sequence within each role flow
- Dealer flows: DealerAnalytics, DealerInventory, DealerLeads, DealerTeam, DealerPurchases — audit and fix wiring as part of the work; no separate decision required

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Colors` (`src/constants/colors.ts`): Full brand token set — bgPrimary, accent, glassBg, etc. Use everywhere, zero hardcoded hex values allowed
- `FontFamily`, `FontSize` (`src/constants/typography.ts`): Existing type scale — must be the single source of truth
- `GlassCard.tsx`: Shared glass-morphism card component — use on any card UI
- `VehicleCard.tsx` / `HorizontalVehicleCard.tsx`: Listing card components — reference for consistent card UI
- `GlobalToastProvider.tsx` / `Toast.tsx`: Existing toast system — extend for API error and real-time event toasts
- `GlobalDrawer.tsx`: App menu drawer — add HowItWorks, About, Pricing navigation here
- `Skeleton` component in `HomeScreen.tsx`: Reference skeleton pulse pattern to extract into a shared `Skeleton.tsx` component
- `apiClient.ts`: Direct fetch-based API client — all API calls go through this

### Established Patterns
- **No TanStack Query** — screens use `useEffect` + `useState` + direct `apiClient` / API lib calls. Continue this pattern.
- **StyleSheet.create()** — all styles use `StyleSheet.create`, not inline objects. No NativeWind.
- **Zustand** — `authStore` (user, session, role), `watchlistStore` (saved listings). Add stores as needed.
- **Navigation** — React Navigation Native Stack + Bottom Tabs. Stack params typed in `MainStackParamList`.
- **expo-image** — used for all car images (caching, blurhash support). Do not use `<Image>` from react-native.
- **Ionicons via BrandIcon** — all icons use `Ionicons` from `@/components/BrandIcon`. No mixing icon sets.

### Integration Points
- Backend: `https://carmazium-hjoh9w.fly.dev` (all endpoints from FEATURE_AUDIT.md Section 2)
- Auth: Supabase Bearer token → `Authorization: Bearer <token>` header on all API calls via `apiClient`
- Real-time: Socket.IO on `/auctions` (bidding), `/chat` (messages), `/notifications` (alerts)
- Stripe: `@stripe/stripe-react-native` (0.50.3) already installed — use existing backend `POST /payments/checkout-session` endpoint
- Push notifications: `expo-notifications` + `pushNotifications.ts` lib already scaffolded

</code_context>

<specifics>
## Specific Ideas

- Skeleton pattern from `HomeScreen.tsx` (Animated.Value pulse loop) should become a shared `<Skeleton w h r />` component in `src/components/ui/`
- Auction countdown pulsing red background is a specific premium moment — reference: Sotheby's live auction countdown aesthetic
- Win celebration: confetti + glow, not just a green checkmark — "make it feel like a jackpot moment"
- Tab bar spring scale: matches what apps like Robinhood and Cash App do on iOS
- Photo gallery: swipe feel should match iOS native Photos app (spring snap, not inertia)
- All prices must be `£X,XXX` format with JetBrains Mono — no exceptions, no "GBP" prefix

</specifics>

<deferred>
## Deferred Ideas

- Vehicle compare (`CompareScreen.tsx`) — polish and wire in a future phase once core flows are solid
- Finance calculator API wiring — backend endpoint exists but mobile UI shows Coming Soon for now
- AI-powered CRM lead scoring display on `DealerLeadsScreen` — backend returns `aiScore` but mobile display deferred
- 3D vehicle viewer (`ThreeDVehicleViewer.tsx`) — exists in codebase with `@react-three/fiber` but not surfaced in screens; defer

</deferred>

---

*Phase: mobile-app-parity*
*Context gathered: 2026-06-14*
