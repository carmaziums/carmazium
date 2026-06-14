---
phase: mobile-app-parity
plan: "06"
type: execute
wave: 5
depends_on: ["01"]
files_modified:
  - "src/screens/main/MessagesScreen.tsx"
  - "src/screens/main/SearchScreen.tsx"
  - "src/screens/main/SavedScreen.tsx"
  - "src/screens/main/NotificationsScreen.tsx"
  - "src/screens/main/AlertsScreen.tsx"
  - "src/screens/buyer/BuyerDashboardScreen.tsx"
  - "src/screens/seller/SellerListingsScreen.tsx"
  - "src/screens/seller/SellerAuctionsScreen.tsx"
  - "src/screens/seller/EarningsScreen.tsx"
  - "src/screens/seller/SellerOffersScreen.tsx"
autonomous: true
requirements: []
gap_closure: true
must_haves:
  truths:
    - "MessagesScreen, SearchScreen, SavedScreen, NotificationsScreen, and AlertsScreen each show shape-matched Skeleton rows on load (not spinners/dashes), an illustrated EmptyState (icon + heading + subtext + optional CTA) when their list is empty, and a RefreshControl with tintColor={Colors.accent}"
    - "SellerListingsScreen, SellerAuctionsScreen, EarningsScreen, and SellerOffersScreen each have Skeleton loading, an illustrated EmptyState, and a RefreshControl with tintColor={Colors.accent}"
    - "BuyerDashboardScreen replaces its placeholder dashes with shape-matched Skeleton tiles while loading and keeps its existing RefreshControl tinted with Colors.accent"
    - "Every Text node rendering a £ value, bid amount, earning, or vehicle ID across these 10 screens uses FontFamily.mono"
    - "All 10 screens import Skeleton and EmptyState from src/components/ui (the Wave 0 shared components) — no per-screen re-implementations"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/screens/main/MessagesScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono on any IDs/amounts"
    - path: "src/screens/main/SearchScreen.tsx"
      provides: "Skeleton result cards + EmptyState + accent RefreshControl + mono prices"
    - path: "src/screens/main/SavedScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono prices"
    - path: "src/screens/main/NotificationsScreen.tsx"
      provides: "Skeleton rows + EmptyState + accent RefreshControl"
    - path: "src/screens/main/AlertsScreen.tsx"
      provides: "Skeleton rows + EmptyState + accent RefreshControl"
    - path: "src/screens/buyer/BuyerDashboardScreen.tsx"
      provides: "Skeleton tiles replacing dashes + accent RefreshControl + mono KPI values"
    - path: "src/screens/seller/SellerListingsScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono prices"
    - path: "src/screens/seller/SellerAuctionsScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono prices"
    - path: "src/screens/seller/EarningsScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono earning values"
    - path: "src/screens/seller/SellerOffersScreen.tsx"
      provides: "Skeleton + EmptyState + accent RefreshControl + mono offer amounts"
  key_links:
    - from: "src/screens/**/*.tsx (these 10)"
      to: "src/components/ui/Skeleton.tsx and src/components/ui/EmptyState.tsx"
      via: "import { Skeleton } / { EmptyState }"
      pattern: "from ['\"].*components/ui/(Skeleton|EmptyState)"
    - from: "RefreshControl on each list/scroll"
      to: "Colors.accent"
      via: "tintColor={Colors.accent}"
      pattern: "tintColor=\\{Colors.accent\\}"
---

<objective>
Wave 5 — Coverage closure. Standardise the loading / empty / refresh / typography quality bar across the 10 data-displaying screens that no other plan in this phase touched. These were flagged "Needs audit" or "missing skeleton/RefreshControl" in RESEARCH.md's Screen Inventory but were never assigned to plans 01–05.

Purpose: Satisfy the phase's "ALL data-displaying screens" must_have. Without this plan, ~10 screens silently fail the skeleton/empty-state/RefreshControl/mono-price bar, and the phase verifier flags partial coverage.
Output: All 10 screens use the Wave 0 shared Skeleton + EmptyState, an accent-tinted RefreshControl, and JetBrains Mono on every monetary/ID value — with zero new component re-implementations.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-RESEARCH.md
@.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md

<interfaces>
Shared (Wave 0, from src/components/ui/*):
- `Skeleton` — props `{ w: number; h: number; r?: number }`. Pulse via Animated.Value opacity 0.35→0.7. backgroundColor Colors.bgTertiary. Use multiple Skeletons composed to match each screen's real row/card/tile shape — NOT a generic full-width rectangle.
- `EmptyState` — props `{ icon: keyof typeof Ionicons.glyphMap | string; title: string; subtitle?: string; ctaLabel?: string; onCtaPress?: () => void }`. Centered icon-in-circle + title (FontFamily.bold) + subtitle (FontFamily.regular) + optional accent pill CTA.

Tokens (src/constants/colors.ts): Colors.accent='#DC1F26', Colors.bgPrimary, Colors.bgTertiary='#18181E', Colors.glassBg, Colors.textPrimary, Colors.textSecondary, Colors.textMuted.
Fonts (src/constants/typography.ts): FontFamily.mono (JetBrains Mono — ALL prices/amounts/IDs), FontFamily.bold (Poppins headings), FontFamily.regular (Montserrat body).
Icons: import { Ionicons } from '@/components/BrandIcon'.

Established patterns (do NOT change):
- No TanStack Query — screens use useEffect + useState + apiClient. Keep existing API wiring intact; only add loading/empty/refresh/typography.
- StyleSheet.create only; zero hardcoded hex (use Colors.*).
- RefreshControl already present on several of these (SearchScreen, NotificationsScreen, AlertsScreen, SellerListingsScreen, SellerAuctionsScreen, BuyerDashboardScreen per research) — for those, only ensure tintColor={Colors.accent}; add a RefreshControl where missing (MessagesScreen, SavedScreen, EarningsScreen, SellerOffersScreen per their "Needs audit" status — confirm during audit).

Per-screen EmptyState seed copy (icon / title / subtitle / CTA):
- MessagesScreen: "chatbubbles-outline" / "No messages yet" / "Your conversations with buyers and sellers will appear here." / (no CTA)
- SearchScreen: "search-outline" / "No results" / "Try a different make, model, or filter." / (no CTA — clears on new search)
- SavedScreen: "heart-outline" / "Nothing saved yet" / "Tap the heart on any listing to save it here." / CTA "Browse listings" → navigate to Home/Search
- NotificationsScreen: "notifications-outline" / "You're all caught up" / "New notifications will show up here." / (no CTA)
- AlertsScreen: "alert-circle-outline" / "No alerts" / "Price drops and auction reminders will appear here." / (no CTA)
- BuyerDashboardScreen: dashboard KPIs — no list EmptyState; replace dash placeholders with Skeleton tiles only.
- SellerListingsScreen: "pricetags-outline" / "No listings yet" / "List your first vehicle to start selling." / CTA "Sell a car" → SellCarFlow
- SellerAuctionsScreen: "hammer-outline" / "No auctions yet" / "Your live and scheduled auctions will appear here." / (no CTA)
- EarningsScreen: "cash-outline" / "No earnings yet" / "Your completed sales and payouts will show here." / (no CTA)
- SellerOffersScreen: "mail-open-outline" / "No offers received" / "Offers from buyers on your listings will appear here." / (no CTA)
</interfaces>
</context>

<tasks>

<task type="modify">
  <name>Task 1: Seller screens — Skeleton, EmptyState, accent RefreshControl, mono</name>
  <files>src/screens/seller/SellerListingsScreen.tsx, src/screens/seller/SellerAuctionsScreen.tsx, src/screens/seller/EarningsScreen.tsx, src/screens/seller/SellerOffersScreen.tsx</files>
  <action>
    For each of the four seller screens (keep all existing API wiring intact — add only loading/empty/refresh/typography):
    1) Import `Skeleton` and `EmptyState` from '../../components/ui/Skeleton' and '../../components/ui/EmptyState' (use the shared Wave 0 components — do NOT re-implement a local skeleton).
    2) While `loading` is true and there is no data, render a list of shape-matched Skeleton rows/cards (e.g. 5–6 placeholder rows whose Skeleton dimensions roughly match the real listing/auction/earning/offer row layout). Replace any "Partial — dashes"/spinner placeholder per research.
    3) When the fetched list is empty (not loading, length 0), render `<EmptyState>` with the seed icon/title/subtitle/CTA from the interfaces block. Wire the SellerListings CTA to navigate to the SellCarFlow route; others have no CTA.
    4) Ensure the FlatList/ScrollView has a `RefreshControl` with `tintColor={Colors.accent}` (add one if missing — confirm against EarningsScreen and SellerOffersScreen which were "Needs audit"). Keep the existing onRefresh handler if present; if none exists, wire it to the existing fetch function.
    5) Typography: every Text rendering a £ price, earning value, payout amount, offer amount, or vehicle/listing ID must use `fontFamily: FontFamily.mono`. Headings FontFamily.bold, body FontFamily.regular.
    Use Colors.*/FontFamily.* tokens only — no hardcoded hex.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>On device: each seller screen shows skeleton rows on load, an illustrated EmptyState when empty (verify with a fresh seller account), accent-tinted pull-to-refresh, and all amounts in JetBrains Mono.</manual>
  </verify>
  <done>SellerListingsScreen, SellerAuctionsScreen, EarningsScreen, SellerOffersScreen each import the shared Skeleton + EmptyState, show skeleton on load, EmptyState when empty, an accent RefreshControl, and mono amounts. tsc clean.</done>
</task>

<task type="modify">
  <name>Task 2: Buyer dashboard — Skeleton tiles + accent RefreshControl + mono KPIs</name>
  <files>src/screens/buyer/BuyerDashboardScreen.tsx</files>
  <action>
    BuyerDashboardScreen currently shows placeholder dashes while loading and already has a RefreshControl (per research). Keep the existing GET /dashboard/buyer wiring intact.
    1) Import `Skeleton` from '../../components/ui/Skeleton'.
    2) While `loading` is true, replace the dash placeholders in the KPI/stat tiles with shape-matched Skeleton blocks (Skeleton sized to the tile value area, e.g. w≈80 h≈24). Do this for every tile/metric that currently renders a dash.
    3) Confirm the existing RefreshControl uses `tintColor={Colors.accent}`; set it if not.
    4) Typography: every KPI value, £ amount, count, and any vehicle ID Text uses `fontFamily: FontFamily.mono`. Section headings FontFamily.bold, labels/body FontFamily.regular.
    This screen is a dashboard, not a list — no EmptyState component is required (KPIs render zeros/skeletons, not an empty-list illustration).
    Use Colors.*/FontFamily.* tokens only.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>On device: BuyerDashboardScreen shows skeleton tiles (not dashes) while loading, accent-tinted pull-to-refresh, and all KPI values render in JetBrains Mono.</manual>
  </verify>
  <done>BuyerDashboardScreen replaces dashes with shared Skeleton tiles, keeps an accent RefreshControl, and renders KPI values in mono. tsc clean.</done>
</task>

<task type="modify">
  <name>Task 3: Main screens — Skeleton, EmptyState, accent RefreshControl, mono</name>
  <files>src/screens/main/MessagesScreen.tsx, src/screens/main/SearchScreen.tsx, src/screens/main/SavedScreen.tsx, src/screens/main/NotificationsScreen.tsx, src/screens/main/AlertsScreen.tsx</files>
  <action>
    For each of the five main screens (keep all existing API wiring intact — add only loading/empty/refresh/typography):
    1) Import `Skeleton` and `EmptyState` from the shared Wave 0 components (do NOT re-implement).
    2) While loading with no data, render shape-matched Skeleton rows/cards matching each screen's real layout (message rows for Messages; result cards for Search; saved-listing cards for Saved; notification/alert rows for Notifications and Alerts).
    3) When the list is empty, render `<EmptyState>` with the seed icon/title/subtitle/CTA from the interfaces block. Wire the SavedScreen CTA "Browse listings" to navigate to the Home/Search tab.
    4) Ensure the list's `RefreshControl` uses `tintColor={Colors.accent}`. SearchScreen, NotificationsScreen, AlertsScreen already have a RefreshControl (per research) — just set the tint. Add a RefreshControl to MessagesScreen and SavedScreen if missing (confirm during audit; wire to existing fetch).
    5) Typography: every £ price (SearchScreen/SavedScreen listing prices), notification amount, or vehicle ID Text uses `fontFamily: FontFamily.mono`. Headings FontFamily.bold, body FontFamily.regular.
    Use Colors.*/FontFamily.* tokens only.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>On device: each main screen shows skeleton on load, an illustrated EmptyState when empty, accent-tinted pull-to-refresh; SearchScreen/SavedScreen listing prices render in JetBrains Mono.</manual>
  </verify>
  <done>MessagesScreen, SearchScreen, SavedScreen, NotificationsScreen, AlertsScreen each import the shared Skeleton + EmptyState, show skeleton on load, EmptyState when empty, an accent RefreshControl, and mono prices/IDs. tsc clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- All 10 screens import Skeleton + EmptyState from src/components/ui (grep: no local skeleton re-implementations introduced).
- Every list/scroll RefreshControl across the 10 screens uses tintColor={Colors.accent}.
- Empty-list states render the shared EmptyState (icon + title + subtitle, CTA where specified).
- Every £/amount/ID Text on these screens uses FontFamily.mono.
</verification>

<success_criteria>
The 10 previously-unaddressed data screens (5 main, 1 buyer, 4 seller) meet the same skeleton / empty-state / accent-refresh / mono-typography quality bar as the rest of the phase. No screen in this phase is left with a spinner, dash placeholder, blank empty state, default-tinted refresh, or non-mono price. TypeScript clean.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-06-SUMMARY.md` listing each of the 10 screens with what was added (skeleton / empty / refresh / mono), and note any screen that needed a RefreshControl added vs. only re-tinted, plus any screen where the EmptyState CTA was wired to a specific route.
</output>
