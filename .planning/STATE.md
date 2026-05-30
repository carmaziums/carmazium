---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02-buyer-seller-and-dealer-role-dashboards-02-04-PLAN.md
last_updated: "2026-05-30T12:45:00Z"
last_activity: 2026-05-30 — Phase 2 Plan 4 complete (dealer dashboard — KPI tiles, lead funnel chart, trend stats)
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 10
  completed_plans: 9
  percent: 0
---

# State: Carmazium Mobile App

## Current Position

Phase: 2 of 8 (Buyer, Seller, and Dealer Role Dashboards)
Plan: 4 of 5 complete in current phase
Status: In Progress
Last activity: 2026-05-30 — Phase 2 Plan 4 complete (dealer dashboard — KPI tiles, lead funnel chart, trend stats)

Progress: [██████░░░░] 60%

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-05-30T12:45:00Z
Stopped at: Completed 02-buyer-seller-and-dealer-role-dashboards-02-04-PLAN.md
Resume file: None
