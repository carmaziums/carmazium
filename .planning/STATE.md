---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 09-mobile-production-parity-09-03-PLAN.md
last_updated: "2026-06-20T00:45:00.863Z"
last_activity: "2026-06-20 — 09-mobile-production-parity Plan 3 complete (KYC document capture, isVerified authStore all 3 auth paths, bid gate with Alert+navigate in AuctionDetailScreen)"
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 14
  completed_plans: 12
  percent: 85
---

# State: Carmazium Mobile App

## Current Position

Phase: 09-mobile-production-parity (Mobile Production Parity)
Plan: 3 of 4 complete
Status: In Progress
Last activity: 2026-06-20 — 09-mobile-production-parity Plan 3 complete (KYC document capture, isVerified authStore all 3 auth paths, bid gate with Alert+navigate in AuctionDetailScreen)

Progress: [█████████░] 85%

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** A verified, premium car marketplace where buying and selling is transparent, fast, and cinematic — whether on web or mobile.
**Current focus:** Phase 2 — Buyer, Seller, and Dealer Role Dashboards

## Accumulated Context

### What's Built (Scaffold — complete)

- Expo 52 + Expo Router 4 + NativeWind + TanStack Query + Zustand + Socket.IO + Supabase auth
- Design tokens, API client (8 services), Socket.IO client (3 namespaces: /auctions, /chat, /notifications)
- UI atoms: CzButton, CzBadge, CzChip, CzPrice, CzEyebrow, CzScreen, CzTabBar
- Auth screens (Onboarding, Login, Signup), Tab screens (Home, Search, Live, Saved, Profile)
- Detail screens (Vehicle Detail, Auction Room, Messages Inbox, Conversation)

### Phase 2 Wave 0 — Complete

- Jest test infrastructure: jest.config.js with jest-expo preset, @/ alias, transformIgnorePatterns
- KpiTile: numeric (toLocaleString en-GB) / string value display, accent border variant, sub-label
- LeadFunnelBar: BarChart wrapper with Math.max(...values, 1) zero-crash guard, "No leads yet" empty state
- app/dashboard/index.tsx: role-based router (DEALER/SELLER/BUYER) reading Zustand synchronously

### Phase 2 Plan 2 — Complete (Buyer Dashboard)

- app/dashboard/buyer/index.tsx: overview with 4 KPI tiles (activeBids, activeOffers, watchlistCount, wonAuctions), pull-to-refresh, quick nav links
- app/dashboard/buyer/bids.tsx: bids list with CzBadge auction status (ACTIVE/WON/OUTBID/ENDED)
- app/dashboard/buyer/offers.tsx: offers list with CzBadge offer status (PENDING/ACCEPTED/REJECTED/COUNTERED)
- app/dashboard/buyer/history.tsx: purchase history with defensive field fallback (history|purchases|orders) and en-GB date formatting
- All 4 screens share queryKey ['dashboard', 'buyer'] for cache sync; 10 unit tests green

### Phase 2 Plan 3 — Complete (Seller Dashboard)

- app/dashboard/seller/index.tsx: single ScrollView with overview KpiTiles, offer inbox, earnings summary
- OfferRow: inline counter-offer TextInput, parseFloat > 0 validation, isPending guard
- useMutation wraps offersApi.respond, invalidates ['dashboard','seller'] on success
- 12 unit tests green (SELL-DASH-01 through SELL-DASH-04 verified)

### Phase 2 Plan 4 — Complete (Dealer Dashboard)

- app/dashboard/dealer/index.tsx: ScrollView with 4 KpiTiles, LeadFunnelBar, trend stats (conversion rate, avg views)
- Defensive funnel build with nullish coalescing on every LeadFunnel key
- conversionRate formatted as (rate * 100).toFixed(1)+'%'
- 8 unit tests green (DEALER-01, DEALER-02, DEALER-03 verified)
- Pattern established: mock @/lib/api/dashboard in tests to break AsyncStorage/Supabase native module chain

### Architecture Decisions Locked

- Auth: Supabase Bearer token → backend SessionAuthGuard (dual-mode, no backend changes needed)
- API base: https://carmazium-hjoh9w.fly.dev
- Real-time: socket.io-client on /auctions, /chat, /notifications namespaces
- State: Zustand (auth + auction live state), TanStack Query (server cache)
- No payments: platform is communication-only, never trigger financial transactions
- Testing: @testing-library/react-native v12.9.0 (not v13+) — React 18.3.1 compatibility
- Babel: nativewind and reanimated plugins skipped in BABEL_ENV=test to avoid missing worklets dep

### 09-mobile-production-parity Plan 01 — Complete

- src/lib/storageHelper.ts: uploadToStorage (ArrayBuffer, eliminates 0-byte Android bug) + convertAndCompress (HEIC→JPEG quality loop <1.2 MB)
- src/lib/sellWizardStore.ts: Zustand persist store backed by AsyncStorage; partialize excludes clearDraft/updateDraft; onFinishHydration for hydration-safe resume
- SellCarFlowScreen.tsx: handlePlateChange auto-triggers DVLA at 7-8 alphanumeric chars; ArrayBuffer upload with per-image progress bars (0→50→100%); draft persistence with resume Alert; POST /listings + POST /auctions on final submit; clearDraft + haptics.success on success
- Critical: expo-file-system/legacy import required in SDK 54 for EncodingType + readAsStringAsync

### 09-mobile-production-parity Plan 02 — Complete

- SellCarFlowScreen.tsx: triggerListingFeePayment() with dark Stripe Payment Sheet (appearance.colors); gates POST /listings/:id/publish for all classified tiers (BASIC £1 / STANDARD £10 / PREMIUM £25); user cancel shows "draft saved" Alert; auction tier publishes without listing fee
- VehicleDetailScreen.tsx: handleHpiCheck() replaces free handleViewHpiReport; Stripe Payment Sheet (£9.99) before fetching HPI data; results rendered inline (hpiInlineCard) with stolen/finance/writeOff/mileageAnomaly fields; ErrorBanner on failure; "View Full Report" opens existing modal
- EarningsScreen.tsx: Stripe Connect CTA added — POST /users/stripe-connect/onboard → Linking.openURL(res.url); payoutsCard section with ActivityIndicator + ErrorBanner; expo-file-system/legacy import fixed (SDK 54 bug)
- AuctionCompleteScreen.tsx: buyer fee (£125) was already fully implemented — no changes needed

### 09-mobile-production-parity Plan 03 — Complete

- authStore.ts: User interface adds isVerified?: boolean; UserProfileResponse adds dealerProfile?.isVerified; all 3 auth paths (initializeAuth, login, signup) populate isVerified from profile.dealerProfile?.isVerified ?? false; login path also fixed missing isAddressVerified
- DealerKYCScreen.tsx: expo-image-picker + expo-document-picker added; docUrls/docUploading state; handleDocumentCapture() for 9 fields (4 image: drivingLicenceFront/Back, paymentScreenshot, directorSelfie; 5 pdf: vatCertificate, companyRegistration, memorandumOfAssociation, articlesOfAssociation, proofOfAddress); upload path kyc/{userId}/{field}-{ts}.{ext} in kyc-documents bucket; POST /dealers/kyc payload spreads docUrls
- AuctionDetailScreen.tsx: role pulled from useAuthStore alongside currentUser; handleBid gates on role !== 'dealer' (setBidError) then !isVerified (Alert with Go to Verification CTA navigating to 'DealerKYC'); bid UI remains visible; quickBidBtnText style key added (pre-existing TS2551 fixed)

### Architecture Decisions Locked

- **expo-file-system/legacy import:** SDK 54 moved EncodingType and readAsStringAsync to /legacy subpath; main export throws at runtime for these. All file reading must import from expo-file-system/legacy.
- Auth: Supabase Bearer token → backend SessionAuthGuard (dual-mode, no backend changes needed)
- API base: https://carmazium-hjoh9w.fly.dev
- Real-time: socket.io-client on /auctions, /chat, /notifications namespaces
- State: Zustand (auth + auction live state), TanStack Query (server cache)
- No payments: platform is communication-only, never trigger financial transactions
- Testing: @testing-library/react-native v12.9.0 (not v13+) — React 18.3.1 compatibility
- Babel: nativewind and reanimated plugins skipped in BABEL_ENV=test to avoid missing worklets dep

### Pending Todos

None yet.

### Blockers/Concerns

Pre-existing TS errors in GlobalDrawer.tsx (role property), DealerInventoryScreen.tsx (blob url) — deferred, out of scope.
EarningsScreen.tsx expo-file-system/legacy import fixed in Plan 02.
AuctionDetailScreen.tsx quickBidBtnText style key fixed in Plan 03.

### mobile-app-parity Plan 1 — Complete

- src/components/ui/Skeleton.tsx: shared pulse skeleton (Animated.Value 0.35→0.7, Colors.bgTertiary)
- src/components/ui/EmptyState.tsx: icon circle (96x96 glassBg) + title + subtitle + optional CTA pill
- src/components/ui/ErrorBanner.tsx: horizontal row with AlertCircle + message + "Try again" CTA
- src/lib/haptics.ts: Platform-guarded wrapper for expo-haptics (light/medium/success)
- expo-haptics, react-native-gifted-charts, react-native-gesture-handler, react-native-confetti-cannon installed
- App.tsx: GestureHandlerRootView as outermost wrapper; gesture-handler import first
- AuctionDetailScreen.tsx: fixed navigate('Chat',{roomId}) → navigate('ChatScreen',{threadId}) at two sites
- GlobalToastProvider.tsx: singleton /notifications Socket.IO subscription, shows toast on notification:new/notification events

### mobile-app-parity Plan 2 — Complete

- AuctionDetailScreen.tsx: AuctionDetailSkeleton (hero+title+bid rows), countdown Reanimated pulse (interpolateColor bgTertiary→accentDark), bid flash green overlay (withSequence), winner navigation on auction:ended (haptics.success + navigate AuctionComplete with full params), FontFamily.mono on all prices/countdowns
- AuctionCompleteScreen.tsx: ConfettiCannon (150 particles, autoStart, brand colors), requestAnimationFrame count-up (ease-out-quad, 1400ms) to hammerPrice, haptics.success on mount, FontFamily.mono on hammerPrice/summaryValue/summaryTotalValue, Stripe logic untouched
- LiveScreen.tsx: Skeleton auction card stack (image+stats+button) during loading, EmptyState (flame-outline, CTA to Browse listings) when no live auctions, RefreshControl tintColor=Colors.accent, statsPrice/digitText/timerColon use FontFamily.mono
- EarningsScreen.tsx: Added missing skeletonRowWrap/skeletonRowContent/skeletonRowRight style keys (TS fix)
- SellCarFlowScreen.tsx: Replaced invalid placeholder={{ backgroundColor }} with placeholderContentFit (TS fix)

### mobile-app-parity Plan 3 — Complete

- SellCarFlowScreen.tsx: Added step1HasErrors() gating step 1 continue button (mileage+title touched-invalid); expo-image + inline validation already implemented in Plan 02; DVLA untouched
- DealerKYCScreen.tsx: KYC submission wired to POST /dealers/kyc (already wired); replaced Alert.alert success with haptics.success() + PendingView; pending view shows when status is PENDING/UNDER_REVIEW; inline ErrorBanner replaces Alert.alert API error; skeleton-style loading rows on initial load
- VehicleDetailScreen.tsx: FlatList gallery replaced with Reanimated.View strip + Gesture.Pan spring-snap (damping:20, stiffness:200, 30% threshold); page dots + mono photo counter; fullscreen Modal with Gesture.Simultaneous(Pinch, Pan), scale clamped 1-4, springs back below 1; finance section labeled Coming Soon with no API calls, interactive rows made inert Views

### mobile-app-parity Plan 4 — Complete

- DealerAnalyticsScreen.tsx: Hand-rolled SparkLine removed; BarChart (revenue, 6-month) + LineChart (units sold trend) + LeadFunnel BarChart via react-native-gifted-charts; toBarData/toLineData/toLeadBarData helpers with Math.max zero-crash guards; AnalyticsSkeleton + EmptyState + RefreshControl
- SellerPerformanceScreen.tsx: Hand-rolled View bar segments removed; LineChart (revenue trend) + BarChart (views over time); buildRevenueData/buildViewsData fallback to single-point arrays from totals; shared Skeleton (PerformanceSkeleton) + EmptyState + RefreshControl; GET /listings/performance endpoint
- SellerDashboardScreen.tsx: RefreshControl added (was missing); stat row shows 3×Skeleton tiles during loading (not dash placeholders); fetchData extracted from useEffect for refresh support
- DealerLeadsScreen.tsx: ActivityIndicator → 4×Skeleton lead-row blocks; Message Lead wired via createChatRoom(buyerId, listingId) → navigate('ChatScreen', {threadId}); haptics.light() on press; buyerId+listingId in Lead interface; aiScore display deferred
- DealerInventoryScreen.tsx: ActivityIndicator → 4×Skeleton; EmptyState for empty filtered list; ErrorBanner on fetch failure; RefreshControl accent token; listingPrice uses FontFamily.mono
- DealerOffersScreen.tsx: Shared Skeleton component for loading; shared EmptyState; RefreshControl accent; ErrorBanner on fetch failure
- DealerPurchasesScreen.tsx: Shared Skeleton; shared EmptyState; RefreshControl accent; ErrorBanner on fetch failure
- DealerTeamScreen.tsx: ActivityIndicator → 3×Skeleton; shared EmptyState; RefreshControl accent; summaryCount uses FontFamily.mono

### mobile-app-parity Plan 6 — Complete

- EarningsScreen: RefreshControl with tintColor=Colors.accent added to ScrollView; shared Skeleton replaces plain-View loading in summary card
- SellerOffersScreen: shared Skeleton+EmptyState (mail-open-outline) added; refreshing state + RefreshControl with accent tint added (was missing)
- BuyerDashboardScreen: shared Skeleton import added; KpiCard skeletonValue/skeletonDelta plain Views replaced with Skeleton(w=80,h=28) and Skeleton(w=56,h=10); RefreshControl already accent-tinted
- MessagesScreen: shared Skeleton shape-matched rows shown during isLoading; shared EmptyState (chatbubbles-outline); RefreshControl added wrapping refreshRooms()
- SearchScreen: Skeleton result-card rows replace ActivityIndicator on load; shared EmptyState (search-outline) replaces emoji empty state; RefreshControl already accent-tinted
- SavedScreen: shared Skeleton grid cards replace ActivityIndicator; shared EmptyState (heart-outline) with "Browse listings" CTA; RefreshControl added; cardPrice+listPrice switched to FontFamily.mono
- NotificationsScreen: shape-matched Skeleton rows replace plain-View skeleton; shared EmptyState (notifications-outline); RefreshControl already accent-tinted
- AlertsScreen: Skeleton rows replace ActivityIndicator; shared EmptyState (alert-circle-outline); RefreshControl already accent-tinted
- SellerListingsScreen + SellerAuctionsScreen: already fully compliant from Plan 05 — no changes needed
- tsc --noEmit passes with zero errors

### mobile-app-parity Plan 5 — Complete

- AboutScreen.tsx + PricingScreen.tsx: Static info screens with brand styling registered in MainStackNavigator; GlobalDrawer wired to stackScreen (no more Alert.alert stubs for About/Pricing)
- BuyerOffersScreen.tsx: RefreshControl (accent), ErrorBanner, haptics.medium on withdraw/counter actions
- BuyerBidsScreen.tsx: RefreshControl (accent), ErrorBanner, skeleton rows, EmptyState with CTA
- BuyerPurchaseHistoryScreen.tsx: RefreshControl (accent), ErrorBanner, useCallback-based fetchData
- PrimaryCTA.tsx: haptics.light() fires on pressIn — every CTA across app gives immediate tap haptic
- TabNavigator.tsx: AnimatedTabIcon component with Reanimated withSequence(withSpring(1.2), withSpring(1.0)) on tab focus
- VehicleCard.tsx: imageContainer gets backgroundColor Colors.bgTertiary (dark placeholder, no white flash); priceText → FontFamily.mono
- HorizontalVehicleCard.tsx: imageContainer hardcoded #18181E replaced with Colors.bgTertiary token; priceText → FontFamily.mono
- SellerAuctionsScreen.tsx + SellerListingsScreen.tsx: ActivityIndicator replaced with Skeleton rows + shared EmptyState component

## Session Continuity

Last session: 2026-06-20T00:45:00.854Z
Stopped at: Completed 09-mobile-production-parity-09-03-PLAN.md
Resume file: None
