---
phase: mobile-app-parity
plan: "04"
subsystem: mobile-screens
tags: [charts, gifted-charts, skeleton, empty-state, refresh-control, dealer-flows, seller-dashboard, leads-chat]
dependency_graph:
  requires: ["mobile-app-parity-01"]
  provides: ["dealer-analytics-charts", "seller-performance-charts", "dealer-screens-polish"]
  affects: ["DealerAnalyticsScreen", "SellerPerformanceScreen", "SellerDashboardScreen", "DealerLeadsScreen", "DealerInventoryScreen", "DealerOffersScreen", "DealerPurchasesScreen", "DealerTeamScreen"]
tech_stack:
  added: []
  patterns: ["gifted-charts data mapping helpers", "buildRevenueData/buildViewsData fallback arrays", "RefreshControl tintColor=Colors.accent pattern", "Skeleton component replacing ActivityIndicator across dealer screens"]
key_files:
  created: []
  modified:
    - "carmazium app/carmazium app/src/screens/main/DealerAnalyticsScreen.tsx"
    - "carmazium app/carmazium app/src/screens/seller/SellerPerformanceScreen.tsx"
    - "carmazium app/carmazium app/src/screens/seller/SellerDashboardScreen.tsx"
    - "carmazium app/carmazium app/src/screens/main/DealerLeadsScreen.tsx"
    - "carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx"
    - "carmazium app/carmazium app/src/screens/main/DealerOffersScreen.tsx"
    - "carmazium app/carmazium app/src/screens/main/DealerPurchasesScreen.tsx"
    - "carmazium app/carmazium app/src/screens/main/DealerTeamScreen.tsx"
decisions:
  - "SellerPerformanceScreen buildRevenueData/buildViewsData fall back to single-point arrays from totals when backend returns no trend arrays, avoiding chart crashes"
  - "Message Lead button only renders when lead.buyerId is present; graceful no-op Alert when absent"
  - "DealerLeads skeleton uses 4x Skeleton lead-row blocks (84px h, SCREEN_WIDTH-32 w) matching lead card dimensions"
  - "aiScore display on DealerLeadsScreen remains deferred per plan"
  - "SellerDashboard stat values now render via Skeleton blocks during loading (not dash placeholders)"
metrics:
  duration: "~11 minutes"
  completed_date: "2026-06-14"
  tasks: 3
  files_modified: 8
---

# Phase mobile-app-parity Plan 04: Dashboards & Dealer Flows Summary

**One-liner:** Replaced hand-rolled View sparklines with gifted-charts BarChart+LineChart on dealer analytics and seller performance, standardised Skeleton/EmptyState/RefreshControl across all dealer/seller operational screens, and wired Message Lead through createChatRoom to the fixed ChatScreen route.

## Tasks Completed

### Task 1: DealerAnalyticsScreen — gifted-charts BarChart + LineChart

The DealerAnalyticsScreen was already modified with gifted-charts in the current working tree (from Wave 3 preparation). The changes were committed:

- Hand-rolled `SparkLine` (trigonometric View segments) removed
- `BarChart` from `react-native-gifted-charts` renders 6-month revenue with `frontColor: Colors.accent` on latest bar
- `LineChart` renders units-sold trend with `areaChart`, `startFillColor: Colors.accent`, `dataPointsColor: Colors.white`
- Lead Funnel `BarChart` with per-stage `frontColor` values (blue NEW → red WON)
- `AnalyticsSkeleton`: card-shaped Skeleton blocks (160px hero + 2×2 half-card grid + 120px funnel block)
- `EmptyState` when `analytics` payload has no data
- `RefreshControl` tintColor=Colors.accent on the main ScrollView
- All KPI tile values: `FontFamily.mono`; headings: `FontFamily.bold`

**Gifted-charts data mapping for DealerAnalyticsScreen:**
- `toBarData`: `revenueTrend.slice(-6)` → `{ value: p.revenue, label: monthLabel(p.month), frontColor }`
- `toLineData`: `revenueTrend` → `{ value: p.unitsSold, label: monthLabel(p.month) }`
- `toLeadBarData`: `LeadFunnel` keys → `{ value, label, frontColor }` with per-stage colors

**Commit:** `119192f8`

---

### Task 2: SellerPerformanceScreen — gifted-charts + skeleton/empty/refresh

**SellerPerformance endpoint used:** `GET /listings/performance` (already wired)

**API response fields mapped:**
- `totalRevenue` → KPI tile (FontFamily.mono)
- `totalViews` → KPI tile (FontFamily.mono)
- `totalListings` → KPI tile (FontFamily.mono)
- `conversionRate` → KPI tile, formatted as `toFixed(1)%`
- `revenueTrend?: Array<{ month, revenue }>` → `LineChart` (color: Colors.accent, area fill)
- `viewsTrend?: Array<{ month, views }>` → `BarChart` (frontColor: Colors.accentGlow)
- `recentListingViews` → fallback for views BarChart when `viewsTrend` absent

**Gifted-charts data mapping for SellerPerformanceScreen:**
- `buildRevenueData`: `revenueTrend` → `{ value: p.revenue, label: monthLabel }[]`; fallback to `[{ value: totalRevenue, label: 'Total' }]`
- `buildViewsData`: `viewsTrend` → `{ value, label, frontColor: Colors.accentGlow }[]`; fallback to `recentListingViews` sliced to 8; final fallback to `[{ value: totalViews }]`
- Both guarded with `Math.max(value, 0)` for zero-crash safety

**Changes:**
- Hand-rolled horizontal bar segments in `renderViewsChart()` removed
- Shared `Skeleton` component: `PerformanceSkeleton` with 2×2 KPI grid + 2 chart placeholders
- Shared `EmptyState` component: "No performance data yet" with subtitle prompting listing publication
- `RefreshControl` tintColor=Colors.accent added; `refreshing` state added; `fetchData` accepts `isRefresh` flag
- Conversion rate rendered as KPI tile (not a chart — per plan)

**Commit:** `9fad2ea3`

---

### Task 3: SellerDashboard refresh/skeleton + dealer screens audit

**SellerDashboardScreen:**
- `RefreshControl` (tintColor=Colors.accent) added to main ScrollView — was missing
- `fetchData` extracted from `useEffect` closure to be callable from refresh handler
- Stats row (Views/Saves/Offers) now renders 3×Skeleton tiles during loading, replacing dash `–` placeholders
- KPI stat values already used `FontFamily.mono` — confirmed

**DealerLeadsScreen — Message Lead wired:**
- Added `buyerId?: string` and `listingId?: string` to `Lead` interface
- `mapApiLead` extracts `l.buyerId || l.buyer?.id` and `l.listing?.id || l.listingId`
- `LeadDetail` gains `navigation` prop and `handleMessageLead` handler
- `handleMessageLead`: calls `haptics.light()`, `createChatRoom(lead.buyerId, lead.listingId)`, then `navigation.navigate('ChatScreen' as any, { threadId: room.id })`
- ActivityIndicator skeleton replaced with 4×Skeleton lead-row blocks (84px height)
- "Message Lead" button renders only when `lead.buyerId` is present
- `aiScore` display: DEFERRED (not added)

**DealerInventoryScreen:**
- ActivityIndicator replaced with 4×Skeleton listing-row blocks (76px height)
- EmptyState added for filtered-list-empty case (contextual message per active filter)
- ErrorBanner shown on fetch failure with retry callback
- `fetchError` state added; `setFetchError(true)` on catch
- RefreshControl tintColor=Colors.accent (was `"#DC1F26"` hardcoded — now using token)
- `listingPrice` style: changed from `FontFamily.bold` to `FontFamily.mono`

**DealerOffersScreen:**
- `renderSkeleton()` updated to use shared Skeleton component (3×offer-shaped blocks, 110px)
- `renderEmptyState()` updated to use shared EmptyState component
- RefreshControl added to FlatList (tintColor=Colors.accent)
- ErrorBanner shown on fetch failure
- `refreshing` state added; `fetchData` accepts `isRefresh` flag

**DealerPurchasesScreen:**
- `renderSkeletons()` updated to use shared Skeleton component (3×purchase-shaped blocks, 90px)
- `renderEmptyState()` updated to use shared EmptyState component
- RefreshControl added to FlatList (tintColor=Colors.accent)
- ErrorBanner shown on fetch failure
- `refreshing` state added; `fetchData` accepts `isRefresh` flag

**DealerTeamScreen:**
- ActivityIndicator loading block replaced with 3×Skeleton staff-card blocks (72px height)
- `renderEmpty()` updated to use shared EmptyState component
- RefreshControl added to FlatList (tintColor=Colors.accent)
- `refreshing` state added; `fetchStaff` accepts `isRefresh` flag
- `summaryCount` style gained `fontFamily: FontFamily.mono`

**Commit:** `03e200b2`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] ErrorBanner on fetch failure across dealer list screens**
- **Found during:** Task 3 audit
- **Issue:** DealerInventoryScreen, DealerOffersScreen, DealerPurchasesScreen had silent catch blocks with no user feedback on network failure
- **Fix:** Added `fetchError` state + `ErrorBanner` component (with retry) as first branch in conditional render
- **Files modified:** DealerInventoryScreen.tsx, DealerOffersScreen.tsx, DealerPurchasesScreen.tsx
- **Commit:** 03e200b2

**2. [Rule 1 - Bug] DealerInventoryScreen hardcoded accent hex in RefreshControl**
- **Found during:** Task 3
- **Issue:** `tintColor="#DC1F26"` used raw hex instead of `Colors.accent` token
- **Fix:** Changed to `tintColor={Colors.accent}`
- **Commit:** 03e200b2

**3. [Rule 1 - Bug] DealerInventoryScreen listingPrice used FontFamily.bold instead of FontFamily.mono**
- **Found during:** Task 3 mono audit
- **Issue:** `listingPrice` style used `FontFamily.bold` for a price value
- **Fix:** Changed to `FontFamily.mono`
- **Commit:** 03e200b2

## Self-Check: PASSED

All 8 modified files confirmed on disk. All 3 task commits confirmed in git log:
- `119192f8` — DealerAnalyticsScreen gifted-charts
- `9fad2ea3` — SellerPerformanceScreen gifted-charts
- `03e200b2` — dashboards + dealer screens batch
- `npx tsc --noEmit` passes with zero errors
