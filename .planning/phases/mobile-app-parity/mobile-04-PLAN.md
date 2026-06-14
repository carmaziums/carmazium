---
phase: mobile-app-parity
plan: "04"
type: execute
wave: 3
depends_on: ["01"]
files_modified:
  - "src/screens/main/DealerAnalyticsScreen.tsx"
  - "src/screens/seller/SellerPerformanceScreen.tsx"
  - "src/screens/seller/SellerDashboardScreen.tsx"
  - "src/screens/main/DealerLeadsScreen.tsx"
  - "src/screens/main/DealerInventoryScreen.tsx"
  - "src/screens/main/DealerOffersScreen.tsx"
  - "src/screens/main/DealerPurchasesScreen.tsx"
  - "src/screens/main/DealerTeamScreen.tsx"
autonomous: true
requirements: []
must_haves:
  truths:
    - "DealerAnalyticsScreen renders gifted-charts BarChart + LineChart (not hand-rolled View sparklines)"
    - "SellerPerformanceScreen renders gifted-charts line/bar charts wired to its performance data"
    - "SellerDashboardScreen has a RefreshControl (accent tint) and skeleton loading"
    - "DealerLeadsScreen has skeleton loading and its 'Message Lead' action navigates to the chat screen with route 'ChatScreen' and param threadId"
    - "All listed dealer screens show skeleton on load and an EmptyState when their list is empty"
    - "All KPI values and prices on these screens use FontFamily.mono; headings FontFamily.bold"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/screens/main/DealerAnalyticsScreen.tsx"
      provides: "Gifted-charts dealer analytics"
    - path: "src/screens/seller/SellerPerformanceScreen.tsx"
      provides: "Gifted-charts seller performance"
  key_links:
    - from: "src/screens/main/DealerLeadsScreen.tsx"
      to: "ChatScreen route"
      via: "navigate('ChatScreen', { threadId: room.id })"
---

<objective>
Wave 3 — Dashboards & dealer flows. Replace the hand-rolled analytics charts with gifted-charts on both the dealer analytics and seller performance screens, standardise skeleton + empty + refresh across the dealer/seller operational screens, and wire the "Message Lead" action through the (now-fixed) chat route.

Purpose: Dashboards are the home base each role returns to. Charts must look real, lists must load and empty gracefully, and the lead-to-chat path must work.
Output: Two charted analytics screens and a consistent dealer/seller dashboard set.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md

<interfaces>
Shared (Wave 0): Skeleton, EmptyState, ErrorBanner from src/components/ui/*, haptics from src/lib/haptics.
Charts (Wave 0 install): `import { BarChart, LineChart } from 'react-native-gifted-charts'`. Data format: `{ value: number, label: string }[]`. react-native-svg is the peer dep (already installed).
Tokens: Colors.accent='#DC1F26', Colors.accentGlow='#FF2D35', Colors.bgTertiary, Colors.glassBg, Colors.textSecondary, Colors.success, Colors.warning. FontFamily.mono for numbers/prices, FontFamily.bold for headings, FontFamily.regular for body.

DealerAnalyticsScreen facts (src/screens/main/DealerAnalyticsScreen.tsx, 1188 lines): wired to `GET /dealers/analytics` with a period selector; currently renders a hand-rolled View-based SparkLine using trigonometry. The AnalyticsData interface maps cleanly to {value,label}[]. This is a chart-component rewrite, not just a library swap — keep the data fetching, replace the chart rendering.

SellerPerformanceScreen facts (src/screens/seller/SellerPerformanceScreen.tsx): needs audit; expected `GET /listings/performance`. Add revenue trend line + views/conversion charts via gifted-charts.

DealerLeadsScreen facts (src/screens/main/DealerLeadsScreen.tsx): wired to GET /dealers/leads (paginated, status filter) + PATCH /dealers/leads/:id. Has a "Message Lead" intent. To message a lead, create/open a chat room (use createChatRoom from src/lib/chatApi like AuctionDetailScreen does) then navigate('ChatScreen' as any, { threadId: room.id }) — matching the Wave 0 fix. aiScore display is DEFERRED — do NOT add it.

Chat route (post Wave 0 fix): route name 'ChatScreen', param key threadId.
</interfaces>
</context>

<tasks>

<task type="modify">
  <name>Task 1: DealerAnalyticsScreen — gifted-charts BarChart + LineChart</name>
  <files>src/screens/main/DealerAnalyticsScreen.tsx</files>
  <action>
    Keep the existing `GET /dealers/analytics` data fetching and period selector. Replace the hand-rolled SparkLine/View-segment chart rendering with gifted-charts:
    - 6-month revenue: BarChart with data mapped to `{ value: revenue, label: monthShort }[]`. Style bars with frontColor Colors.accent, gradientColor Colors.accentGlow if used, rounded tops, hide the y-axis rules subtle. Y-axis text and any value labels in FontFamily.mono.
    - Bid volume (or views trend): LineChart with `{ value, label }[]`, color Colors.accentGlow, thickness 2, areaChart with startFillColor Colors.accent at low opacity, dataPointsColor Colors.white.
    - Lead funnel: keep as bar segments or a BarChart with the funnel counts (NEW→LOST). Use existing AnalyticsData values; guard against empty/zero with `Math.max(...values, 1)` so the chart never crashes on all-zero data.
    Add skeleton loading (Skeleton blocks shaped like the chart cards) replacing any ActivityIndicator. Add EmptyState when the analytics payload has no data. Ensure RefreshControl tintColor={Colors.accent}. All KPI tile values in FontFamily.mono.
    Use Colors.* tokens only.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Open Dealer Analytics: real bar + line charts render (not hand-rolled lines); switching the period updates the charts; skeleton shows on load; KPI numbers are mono.</manual>
  </verify>
  <done>BarChart + LineChart from gifted-charts render real data; hand-rolled SparkLine removed; skeleton + empty + accent refresh present; numbers in mono.</done>
</task>

<task type="modify">
  <name>Task 2: SellerPerformanceScreen — gifted-charts + skeleton/empty</name>
  <files>src/screens/seller/SellerPerformanceScreen.tsx</files>
  <action>
    Audit the screen and its data source (expected `GET /listings/performance`). If unwired, wire the fetch via apiClient (no backend changes). Render:
    - Revenue trend: LineChart `{ value, label }[]` (color Colors.accent, area fill low-opacity).
    - Views over time: LineChart or BarChart `{ value, label }[]`.
    - Conversion rate: a KPI tile (mono value, e.g. "12.4%") — no chart needed.
    Map the API response fields to the {value,label}[] format; guard empty arrays with a fallback EmptyState ("No performance data yet", subtitle prompting the seller to publish a listing). Add skeleton loading and RefreshControl tintColor={Colors.accent}. KPI values + axis labels in FontFamily.mono, headings FontFamily.bold. Use Colors.* tokens.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Open Seller Performance: revenue/views charts render via gifted-charts; with no data, EmptyState shows; skeleton on load; mono numbers.</manual>
  </verify>
  <done>SellerPerformanceScreen renders gifted-charts wired to performance data, with skeleton, empty state, and accent refresh.</done>
</task>

<task type="modify">
  <name>Task 3: SellerDashboard refresh/skeleton + dealer screens audit (Leads message, skeleton, empty across dealer set)</name>
  <files>src/screens/seller/SellerDashboardScreen.tsx, src/screens/main/DealerLeadsScreen.tsx, src/screens/main/DealerInventoryScreen.tsx, src/screens/main/DealerOffersScreen.tsx, src/screens/main/DealerPurchasesScreen.tsx, src/screens/main/DealerTeamScreen.tsx</files>
  <action>
    Apply a consistent pass across these screens (keep all existing API wiring intact — no backend changes):

    1) SellerDashboardScreen: Add a RefreshControl (tintColor={Colors.accent}) to the scroll/list — it is currently missing. Replace the "dashes while loading" with Skeleton tiles shaped like the KPI tiles. Add an EmptyState for the offers section when there are no offers ("No offers received", subtitle "Your listings are live — offers will appear here."). KPI values in FontFamily.mono.

    2) DealerLeadsScreen: Replace ActivityIndicator with Skeleton lead-row blocks. Confirm/keep the existing EmptyState (or add one: "No leads yet"). Wire "Message Lead": on press, createChatRoom(leadUserId, listingId?) via src/lib/chatApi, then navigation.navigate('ChatScreen' as any, { threadId: room.id }); call haptics.light() on press. Do NOT add aiScore display (deferred).

    3) DealerInventoryScreen, DealerOffersScreen, DealerPurchasesScreen, DealerTeamScreen: Audit each. Add Skeleton loading (list-shaped) replacing spinners/blanks, and an EmptyState with a contextual icon + message when the list is empty. Add a RefreshControl (tintColor={Colors.accent}) where data is fetched and one is missing. Ensure prices/counts use FontFamily.mono. Show ErrorBanner (with retry) instead of Alert.alert for any fetch failure. Keep existing actions/wiring (e.g. DealerTeam add/remove staff, lead status PATCH) untouched.

    Use Colors.*/FontFamily.* tokens only; no hardcoded hex.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>SellerDashboard pulls to refresh (accent) and shows KPI skeletons. DealerLeads "Message" opens chat. Each dealer list screen shows skeleton on load and EmptyState when empty.</manual>
  </verify>
  <done>SellerDashboard has refresh + skeleton + empty; DealerLeads messages via the fixed chat route; all four dealer list screens have skeleton + empty + accent refresh and mono numbers.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- DealerAnalytics + SellerPerformance use gifted-charts (no hand-rolled View charts remain).
- SellerDashboard has RefreshControl + skeleton.
- DealerLeads "Message Lead" uses navigate('ChatScreen', { threadId }).
- All dealer list screens: skeleton + EmptyState + accent RefreshControl; ErrorBanner on failures.
</verification>

<success_criteria>
Analytics screens show real charts, dashboards load with skeletons and refresh consistently, and leads can be messaged through the working chat route.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-04-SUMMARY.md` documenting the gifted-charts data mapping per screen and the SellerPerformance endpoint used.
</output>
