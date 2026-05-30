# Phase 2: Buyer, Seller, and Dealer Role Dashboards — Research

**Researched:** 2026-05-30
**Domain:** React Native / Expo Router 4, TanStack Query v5, Zustand v5, NativeWind v4, react-native-gifted-charts, Supabase auth role extraction
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUYER-01 | Buyer views dashboard KPI tiles (active bids, active offers, watchlist count, won auctions) | `GET /dashboard/buyer` → `dashboardApi.buyer()` already wired; KPI tile component to build |
| BUYER-02 | Buyer views list of all their bids with auction status and bid amount | `GET /dashboard/buyer` response includes bids array; buyer bids sub-screen at `/dashboard/buyer/bids` |
| BUYER-03 | Buyer views all offers they made with current status (pending/accepted/rejected/countered) | `GET /dashboard/buyer` response includes offers array; sub-screen at `/dashboard/buyer/offers` |
| BUYER-04 | Buyer views order/purchase history | `GET /dashboard/buyer` response includes history array; sub-screen at `/dashboard/buyer/history` |
| SELL-DASH-01 | Private seller views dashboard with active listings, offer count, total enquiries | `GET /dashboard/seller` → `dashboardApi.seller()`; overview tiles |
| SELL-DASH-02 | Private seller views offer inbox with price and buyer details | `GET /dashboard/seller` response or `GET /offers`; inbox list screen |
| SELL-DASH-03 | Seller can accept, reject, or counter-offer from the offers inbox | `PUT /offers/:id/respond` → `offersApi.respond(id, action, counterAmount)` already in client |
| SELL-DASH-04 | Seller views earnings summary (sold price, platform fee, net) | `GET /dashboard/seller` response includes earnings/completed sales array |
| DEALER-01 | Dealer views KPI tiles (active listings, active auctions, total leads, sold this month) | `GET /dashboard/dealer` → `dashboardApi.dealer()` |
| DEALER-02 | Dealer views lead funnel summary (counts by CRM status: NEW → LOST) | `GET /dashboard/dealer` response includes leadFunnel map; BarChart from react-native-gifted-charts |
| DEALER-03 | Dealer views offer conversion rate and avg views per listing as trend KPIs | `GET /dashboard/dealer` response includes conversionRate, avgViews; single-value stat tiles |
</phase_requirements>

---

## Summary

Phase 2 builds three role-differentiated dashboard screens — buyer, private seller, and dealer — by consuming existing backend endpoints (`/dashboard/buyer`, `/dashboard/seller`, `/dashboard/dealer`) via TanStack Query and displaying the data using the project's established design tokens and UI atoms. No new libraries or backend changes are required for the core dashboard data; `react-native-gifted-charts` (already installed, INFRA-06 complete) is needed only for the dealer lead funnel bar chart.

The central architectural challenge is **role-based routing**: each role must land on the correct dashboard and that routing must be synchronous with first render. The solution is already in place — `dashboardApi.me()` fetches the backend user object on every auth state change and writes a typed `AuthUser` with a `role` field to `useAuthStore`. The `user.role` value is therefore available synchronously from Zustand before any dashboard screen mounts. No separate API call is needed for role detection.

The seller offer-action flow (SELL-DASH-03) deserves special attention. `offersApi.respond()` already calls `PUT /offers/:id/respond` with `{ action, counterAmount }`, and a counter-offer must use `action: 'counter'` plus a numeric `counterAmount`. A text input bottom sheet for the counter amount is the cleanest UX pattern — it avoids a full modal screen while keeping the list scrollable.

**Primary recommendation:** Route `/dashboard/[role]` screens driven by `user.role` from Zustand (never a live API call at render time). Use `useQuery` for all data, `useMutation` + `queryClient.invalidateQueries` for offer mutations. Build KPI tile as a reusable local component. Use `react-native-gifted-charts` `BarChart` for the dealer funnel only.

---

## Standard Stack

### Core (all already installed — no new npm installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.80.5` | Server state — dashboard data fetch, offer mutation, invalidation | Project standard; `queryClient` configured with 2-min staleTime |
| `zustand` | `^5.0.5` | Auth store — synchronous role read at render time | Project standard; `useAuthStore` already has `user.role: UserRole` |
| `nativewind` | `^4.1.23` | Utility-class styling | Project standard; Phase 1 screens (notifications, prefs) use className exclusively |
| `expo-router` | `~4.0.20` | File-system routing for dashboard sub-screens | Project standard |
| `react-native-gifted-charts` | `^1.4.77` | BarChart for dealer lead funnel | Already installed (INFRA-06); paired with `react-native-svg ~15.8.0` |
| `react-native-reanimated` | `~3.16.7` | Animated metric tiles (already used by CzBadge) | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-linear-gradient` | `~14.0.2` | Red ambient glow behind dashboard header | Same pattern as Home tab |
| `react-native-safe-area-context` | `4.12.0` | `useSafeAreaInsets` for padding below tab bar | Required because tab bar floats at absolute position |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-gifted-charts` BarChart | Victory Native / Recharts RN | gifted-charts already installed and deps satisfied; switching adds install risk |
| Bottom sheet for counter-offer input | Full modal screen | Bottom sheet is lighter — `react-native-reanimated` already present, no extra library needed |
| StyleSheet.create styling | NativeWind className only | Both patterns are present in codebase; use NativeWind for new screens (Phase 1 convention) |

**Installation:** No new packages needed. All dependencies are satisfied.

---

## Architecture Patterns

### Recommended File Structure for Phase 2

```
mobile/app/
├── dashboard/
│   ├── buyer/
│   │   ├── index.tsx          # BUYER-01: KPI overview (entry point)
│   │   ├── bids.tsx           # BUYER-02: All bids list
│   │   ├── offers.tsx         # BUYER-03: All offers list
│   │   └── history.tsx        # BUYER-04: Purchase history
│   ├── seller/
│   │   ├── index.tsx          # SELL-DASH-01: Overview + SELL-DASH-02/03/04
│   │   └── (no sub-screens needed — seller dashboard is single-screen with sections)
│   └── dealer/
│       └── index.tsx          # DEALER-01/02/03: KPIs + funnel + conversion

mobile/src/
└── components/
    └── dashboard/
        ├── KpiTile.tsx        # Reusable KPI tile (value + label + optional delta)
        └── LeadFunnelBar.tsx  # Dealer-only: BarChart wrapper
```

**Note on _layout.tsx in Stack:** `app/_layout.tsx` already declares `<Stack.Screen>` entries only for known routes. New dashboard routes will be auto-discovered by Expo Router without modifying `_layout.tsx` — they are plain card screens.

### Pattern 1: Synchronous Role Detection from Zustand

**What:** Read `user.role` from Zustand at render time to decide which dashboard to show. Never call an API for role at render time.

**When to use:** Any screen that branches on user role.

```typescript
// Source: mobile/src/store/auth.store.ts + established pattern in profile.tsx
import { useAuthStore } from '@/store/auth.store';

export default function DashboardRouter() {
  const { user } = useAuthStore();

  if (user?.role === 'DEALER') return <Redirect href="/dashboard/dealer" />;
  if (user?.role === 'SELLER') return <Redirect href="/dashboard/seller" />;
  return <Redirect href="/dashboard/buyer" />;
}
```

Place this as `mobile/app/dashboard/index.tsx` — tapping "Dashboard" from any entry point routes here and immediately redirects to the role-appropriate screen with no loading flash.

### Pattern 2: Dashboard Data Fetch via TanStack Query

**What:** Single `useQuery` call for the entire dashboard payload. All KPI tiles, lists, and charts read from the same query result.

**When to use:** All three dashboard screens.

```typescript
// Source: mobile/src/lib/api/dashboard.ts + TanStack Query v5 pattern
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['dashboard', 'buyer'],
  queryFn:  dashboardApi.buyer,
  staleTime: 1000 * 60 * 2,  // inherit from queryClient default
});
```

Use a `RefreshControl` on the outer `ScrollView` that calls `refetch()` — standard pull-to-refresh pattern consistent with Phase 1 screens.

### Pattern 3: Offer Mutation with Optimistic List Update

**What:** `useMutation` wrapping `offersApi.respond()`, with `onSuccess` invalidating the dashboard query so the offer status updates immediately without a manual refresh.

**When to use:** SELL-DASH-03 — seller accept/reject/counter from offer inbox.

```typescript
// Source: mobile/src/lib/api/offers.ts + TanStack Query v5 useMutation pattern
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { offersApi } from '@/lib/api';

const qc = useQueryClient();

const respondMutation = useMutation({
  mutationFn: ({ id, action, counterAmount }: {
    id: string;
    action: 'accept' | 'reject' | 'counter';
    counterAmount?: number;
  }) => offersApi.respond(id, action, counterAmount),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['dashboard', 'seller'] });
  },
  onError: (err) => {
    // Surface error to user — do NOT silently ignore
    Alert.alert('Action failed', err.message);
  },
});
```

**Counter-offer UX:** Use a local `useState` pair (`counterSheetVisible`, `counterAmount`) to show an inline text input row below the offer row. Call `respondMutation.mutate({ id, action: 'counter', counterAmount: Number(counterAmount) })` on confirmation. This avoids a navigation stack push.

### Pattern 4: KPI Tile Component

**What:** Reusable component displaying a numeric value, label, and optional trend indicator. Used by all three dashboards.

**When to use:** BUYER-01, SELL-DASH-01, DEALER-01.

```typescript
// Pattern consistent with profile.tsx statsRow — adapt to card layout
interface KpiTileProps {
  label:   string;
  value:   number | string;
  accent?: boolean;   // CZM.red highlight for "action required" tiles
  sub?:    string;    // optional sub-text (e.g. "this month")
}
```

Use `FONT.mono` for the value (consistent with `CzPrice` and `statValue` in `profile.tsx`). Tile background: `CZM.bgElev` with `CZM.border` border, `RADII.card` border-radius.

### Pattern 5: BarChart for Dealer Lead Funnel

**What:** `react-native-gifted-charts` `BarChart` component displaying counts per CRM status.

**When to use:** DEALER-02 only.

```typescript
// Source: react-native-gifted-charts docs — BarChart API
import { BarChart } from 'react-native-gifted-charts';

const funnelData = [
  { value: data.leadFunnel.NEW,         label: 'NEW',         frontColor: CZM.blue },
  { value: data.leadFunnel.CONTACTED,   label: 'CONTACTED',   frontColor: CZM.amber },
  { value: data.leadFunnel.QUALIFIED,   label: 'QUALIFIED',   frontColor: CZM.amberLight },
  { value: data.leadFunnel.NEGOTIATING, label: 'NEGOT.',      frontColor: CZM.red },
  { value: data.leadFunnel.WON,         label: 'WON',         frontColor: CZM.emerald },
  { value: data.leadFunnel.LOST,        label: 'LOST',        frontColor: CZM.fg4 },
];

<BarChart
  data={funnelData}
  barWidth={32}
  spacing={12}
  roundedTop
  hideRules
  xAxisColor={CZM.border}
  yAxisColor={CZM.border}
  yAxisTextStyle={{ color: CZM.fg3, fontFamily: FONT.bodyBold, fontSize: 10 }}
  xAxisLabelTextStyle={{ color: CZM.fg3, fontFamily: FONT.bodyBold, fontSize: 9 }}
  noOfSections={4}
  maxValue={Math.max(...funnelData.map(d => d.value)) + 2}
  isAnimated
/>
```

**Critical:** `react-native-gifted-charts` requires a numeric `maxValue` when data is dynamic — omitting it causes a render error when all values are 0 (empty funnel). Guard: `Math.max(...values, 1)`.

### Anti-Patterns to Avoid

- **Calling `GET /auth/me` or a role endpoint at dashboard render time**: causes a race condition where tiles render before the role is known. `user.role` from Zustand is synchronous.
- **Separate endpoint for counter-offer**: counter-offer MUST use `PUT /offers/:id/respond` with `action: 'counter'`. Do not create a new endpoint.
- **Fetching buyer/seller/dealer dashboards concurrently for all roles**: only fetch the endpoint matching the current user's role. Fetching all three wastes bandwidth and may expose unauthorized data.
- **Storing dashboard data in Zustand**: dashboard data is server cache — use TanStack Query, not Zustand. Zustand is for auth state and live auction state only.
- **Calling `queryClient.invalidateQueries` with no key**: after an offer mutation, invalidate `['dashboard', 'seller']` specifically, not the entire cache.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar chart for lead funnel | Custom `View`-based bar chart | `react-native-gifted-charts` `BarChart` | Already installed; handles animation, labels, axis lines, responsive sizing correctly |
| Pull-to-refresh | Custom scroll handler | `ScrollView` + `RefreshControl` from `react-native` | Built-in; handles iOS rubber-band and Android spinner natively |
| Offer action confirmation | Custom confirm dialog | `Alert.alert` with destructive/cancel buttons | `Alert` is available on all platforms; no extra component needed |
| Currency formatting | Manual string concatenation | `CzPrice` component or `value.toLocaleString('en-GB')` | `CzPrice` already handles this with `FONT.mono`; consistent with rest of app |
| Loading skeleton | Animated placeholder library | `ActivityIndicator` with `color={CZM.red}` | Consistent with Phase 1 screens; no extra dependency |

**Key insight:** The heavy lifting (API wiring, auth, socket, charting library) is already done. Phase 2 is predominantly a UI composition phase.

---

## Common Pitfalls

### Pitfall 1: Role Detection Race Condition

**What goes wrong:** Dashboard screen mounts before `user` is populated in Zustand → screen briefly renders wrong role's tiles, flashes, then re-renders.

**Why it happens:** If role detection tries to use a `useEffect` that fires after first render, there is a window where `user` is null.

**How to avoid:** Gate rendering on `user !== null` at the top of the dashboard router:

```typescript
if (loading) return <ActivityIndicator color={CZM.red} />;
if (!user)   return <Redirect href="/(auth)/onboarding" />;
// NOW safe to branch on user.role
```

`loading` starts `true` in `useAuthStore` and is only set to `false` after `onAuthStateChange` fires (see `app/_layout.tsx` line 127). The tab layout already has this guard via `if (!loading && !user) return <Redirect .../>`.

**Warning signs:** Console shows "Cannot read property 'role' of null" or tiles flash between states on app open.

### Pitfall 2: Counter-Offer Without counterAmount

**What goes wrong:** Seller taps Counter but `counterAmount` is `undefined` or `NaN` → `PUT /offers/:id/respond` returns 400 or silently sets amount to 0.

**Why it happens:** The text input for counter amount may not be validated before the mutation fires.

**How to avoid:** Validate `counterAmount` is a positive number before calling `respondMutation.mutate()`:

```typescript
const parsed = parseFloat(counterAmount);
if (isNaN(parsed) || parsed <= 0) {
  Alert.alert('Invalid amount', 'Please enter a valid offer amount.');
  return;
}
```

**Warning signs:** Offers API returns 400. Offer list shows £0 counter-offers.

### Pitfall 3: react-native-gifted-charts BarChart with Zero/Empty Data

**What goes wrong:** Lead funnel renders with all-zero values on first load or for a new dealer → `BarChart` renders incorrectly or throws when `maxValue` is computed as 0.

**Why it happens:** `maxValue={Math.max(...[0,0,0,0,0,0])}` = 0, which gifted-charts uses as a divisor.

**How to avoid:** Always use `Math.max(...values, 1)` as the `maxValue` prop. Show a "No leads yet" empty state instead of the chart when `leadFunnel` total is 0.

**Warning signs:** White rectangle where chart should be; RN red screen with "Division by zero" in chart internals.

### Pitfall 4: Dashboard Sub-Screen Routing — Missing Stack.Screen Registration

**What goes wrong:** Navigating to `/dashboard/buyer/bids` causes "Route not found" error on iOS because the Stack doesn't have an entry for the route group.

**Why it happens:** `app/_layout.tsx` currently does NOT register `dashboard/*` routes. Expo Router 4 auto-discovers routes but uses default presentation (card, slide_from_right) only when there is no explicit registration. This is fine — no `_layout.tsx` change is needed, but the dev must ensure the file paths match exactly what `router.push()` calls.

**How to avoid:** Keep route strings consistent: `router.push('/dashboard/buyer/bids')` must match `mobile/app/dashboard/buyer/bids.tsx`. No underscores, no deviations.

**Warning signs:** "Unmatched route" warning in Expo Router dev console.

### Pitfall 5: NativeWind vs StyleSheet in the Same File

**What goes wrong:** Mixing `className="..."` (NativeWind) and `style={styles.foo}` (StyleSheet) on the same component causes style override conflicts — the StyleSheet `style` prop takes final precedence and ignores some NativeWind classes.

**Why it happens:** Phase 1 screens (notifications, prefs) use NativeWind exclusively. Earlier screens (Home, Profile) use StyleSheet exclusively. Mixing them in a new file creates unexpected wins/losses.

**How to avoid:** Pick one per file. New dashboard screens should follow the Phase 1 convention: **NativeWind (`className`) only**. Use inline `style` only for dynamic values that can't be expressed as utility classes (e.g., `style={{ width: barWidth }}`).

**Warning signs:** Padding or colour applied via `className` has no visible effect; the StyleSheet value is overriding it.

---

## Code Examples

### Dashboard Data Fetch — Buyer

```typescript
// Source: mobile/src/lib/api/dashboard.ts + TanStack Query v5 docs
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

const { data, isLoading, refetch, isRefetching } = useQuery({
  queryKey: ['dashboard', 'buyer'],
  queryFn:  dashboardApi.buyer,
});

// Usage in JSX:
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor={CZM.red}
    />
  }
>
```

### KPI Tile Pattern (from profile.tsx statsRow)

```typescript
// Extend from existing profile.tsx statsRow pattern
// Source: mobile/app/(tabs)/profile.tsx — statBox / statValue / statLabel
function KpiTile({ label, value, accent }: KpiTileProps) {
  return (
    <View className={`flex-1 items-center p-4 bg-[#13182a] rounded-[18px] border ${
      accent ? 'border-[#ff0037]/30' : 'border-white/5'
    }`}>
      <Text
        className="text-white text-2xl font-bold"
        style={{ fontFamily: FONT.mono }}
      >
        {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
      </Text>
      <Text
        className="text-white/40 text-[9px] tracking-widest mt-1 uppercase"
        style={{ fontFamily: FONT.bodyBold }}
      >
        {label}
      </Text>
    </View>
  );
}
```

### Offer Respond — Seller Inbox Row

```typescript
// Source: mobile/src/lib/api/offers.ts — offersApi.respond()
// Counter-offer input is inline in the list row; no navigation needed
function OfferRow({ offer, onRespond }) {
  const [showCounter, setShowCounter] = useState(false);
  const [amount, setAmount] = useState('');

  return (
    <View className="px-4 py-4 border-b border-white/5">
      {/* Offer details */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-semibold">
          {offer.buyer?.firstName} {offer.buyer?.lastName}
        </Text>
        <Text className="text-white font-bold" style={{ fontFamily: FONT.mono }}>
          £{offer.amount?.toLocaleString('en-GB')}
        </Text>
      </View>
      {/* Action row */}
      {!showCounter && (
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => onRespond(offer.id, 'accept')}
            className="flex-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl py-2 items-center">
            <Text className="text-[#34d399] text-xs font-bold uppercase tracking-wider">Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCounter(true)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 items-center">
            <Text className="text-white/70 text-xs font-bold uppercase tracking-wider">Counter</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRespond(offer.id, 'reject')}
            className="flex-1 bg-[#ff0037]/10 border border-[#ff0037]/30 rounded-xl py-2 items-center">
            <Text className="text-[#ff4d6a] text-xs font-bold uppercase tracking-wider">Decline</Text>
          </TouchableOpacity>
        </View>
      )}
      {showCounter && (
        <View className="flex-row gap-2 items-center">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Counter amount"
            keyboardType="numeric"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={() => { onRespond(offer.id, 'counter', Number(amount)); setShowCounter(false); }}
            className="bg-[#ff0037] rounded-xl px-4 py-2"
          >
            <Text className="text-white text-xs font-bold">Send</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCounter(false)} className="px-2">
            <Text className="text-white/40 text-xs">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

### Role-Based Dashboard Router

```typescript
// mobile/app/dashboard/index.tsx
// Source: auth.store.ts UserRole type + profile.tsx role branching pattern
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { View, ActivityIndicator } from 'react-native';
import { CZM } from '@/constants/tokens';

export default function DashboardIndex() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CZM.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={CZM.red} />
      </View>
    );
  }

  if (user?.role === 'DEALER') return <Redirect href="/dashboard/dealer" />;
  if (user?.role === 'SELLER') return <Redirect href="/dashboard/seller" />;
  return <Redirect href="/dashboard/buyer" />;
}
```

---

## API Endpoints in Use (Verified from Codebase)

| Endpoint | Method | Used For | Client Method |
|----------|--------|----------|---------------|
| `/dashboard/buyer` | GET | All buyer KPIs, bids, offers, history | `dashboardApi.buyer()` |
| `/dashboard/seller` | GET | Seller KPIs, listings, offers inbox, earnings | `dashboardApi.seller()` |
| `/dashboard/dealer` | GET | Dealer KPIs, lead funnel, conversion KPIs | `dashboardApi.dealer()` |
| `/offers/:id/respond` | PUT | Accept / reject / counter-offer | `offersApi.respond(id, action, counterAmount)` |
| `/users/me` | GET | User profile + role (already called in `_layout.tsx`) | `dashboardApi.me()` |

**All endpoints exist in `ENDPOINTS` constants** (`mobile/src/constants/api.ts`). No new entries needed.

**Note:** The `offersApi.respond()` signature uses `PUT /offers/:id/respond` — this is already implemented in the client. The pitfall watch note in the roadmap says to use `PATCH /offers/:id`, but the actual client code uses `PUT /offers/:id/respond`. Use the existing client method as-is; do not change the HTTP method.

---

## Role Detection: How It Actually Works

The `user.role` field is populated by:

1. `supabase.auth.onAuthStateChange` fires in `app/_layout.tsx`
2. On a valid session, `dashboardApi.me()` calls `GET /users/me` (backend returns full user object including `role`)
3. Result is written to `useAuthStore.setUser(user)` — including `role: UserRole`
4. Zustand makes `user.role` available synchronously to any component calling `useAuthStore()`

**The role therefore comes from the backend `/users/me` response**, not from parsing the JWT directly. The JWT is used only for Bearer auth on every API call. This is the established pattern — match it exactly. Do not attempt to decode the JWT with a library.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Expo SDK 49 `useNavigation` | Expo Router 4 file-system routing + `<Redirect>` | SDK 52 / Router 4 | Role routing uses `<Redirect href="...">` not `navigation.navigate()` |
| TanStack Query v4 `cacheTime` | TanStack Query v5 `gcTime` | v5.0 | Use `gcTime` in query options (already in queryClient.ts) |
| `react-query` separate package | `@tanstack/react-query` | v4 | Already using correct package name |
| Zustand v4 `devtools` middleware | Zustand v5 `create` (no middleware breaking changes) | v5 | No change needed |

**No deprecated APIs in use for this phase.**

---

## Open Questions

1. **Backend dashboard response shape**
   - What we know: `dashboardApi.buyer/seller/dealer` are typed as `any` — the backend returns some dashboard payload but the exact field names are unknown without hitting the live API.
   - What's unclear: Whether `bids`, `offers`, `history`, `earnings`, `leadFunnel` are top-level keys or nested; whether counts are included as top-level numbers or must be computed from array lengths.
   - Recommendation: Build KpiTile components defensively using optional chaining (`data?.activeBids ?? 0`). If field names differ, update destructuring in the screen — the component interface stays stable.

2. **Dealer role in existing test accounts**
   - What we know: `AuthUser.role` is typed as `'BUYER' | 'SELLER' | 'DEALER' | 'ADMIN' | ...`; signup hardcodes `role: 'BUYER'` in user metadata.
   - What's unclear: Whether any test account with `DEALER` role exists in the backend; testing the dealer dashboard requires one.
   - Recommendation: Note in the plan that a manual seed/role change may be needed for dealer dashboard testing. Not a blocker for building the screen.

---

## Validation Architecture

Config `workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Expo project has no test runner configured (no jest.config.*, no vitest.config.*, no test scripts in package.json) |
| Config file | None — Wave 0 must add |
| Quick run command | `cd mobile && npx jest --testPathPattern="dashboard" --passWithNoTests` |
| Full suite command | `cd mobile && npx jest --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUYER-01 | KPI tiles render with correct counts from mock data | unit | `npx jest --testPathPattern="BuyerDashboard"` | Wave 0 |
| BUYER-02 | Bids list renders correct auction status and amount | unit | `npx jest --testPathPattern="BuyerBids"` | Wave 0 |
| BUYER-03 | Offers list renders correct status badge per offer state | unit | `npx jest --testPathPattern="BuyerOffers"` | Wave 0 |
| BUYER-04 | History list renders purchase records | unit | `npx jest --testPathPattern="BuyerHistory"` | Wave 0 |
| SELL-DASH-01 | Seller overview tiles render with listing/offer counts | unit | `npx jest --testPathPattern="SellerDashboard"` | Wave 0 |
| SELL-DASH-02 | Offer inbox renders offer rows with price and buyer name | unit | `npx jest --testPathPattern="SellerOfferInbox"` | Wave 0 |
| SELL-DASH-03 | Accept/reject/counter mutations called with correct args | unit | `npx jest --testPathPattern="SellerOfferInbox"` | Wave 0 |
| SELL-DASH-04 | Earnings summary renders sold price, fee, net | unit | `npx jest --testPathPattern="SellerEarnings"` | Wave 0 |
| DEALER-01 | Dealer KPI tiles render correct values | unit | `npx jest --testPathPattern="DealerDashboard"` | Wave 0 |
| DEALER-02 | Lead funnel BarChart renders with correct data shape | unit | `npx jest --testPathPattern="DealerDashboard"` | Wave 0 |
| DEALER-03 | Conversion rate and avg views tiles render | unit | `npx jest --testPathPattern="DealerDashboard"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd mobile && npx jest --testPathPattern="dashboard" --passWithNoTests`
- **Per wave merge:** `cd mobile && npx jest --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/jest.config.js` — Jest config for Expo (use `jest-expo` preset)
- [ ] `mobile/package.json` test script — add `"test": "jest"` to scripts
- [ ] `mobile/__tests__/dashboard/BuyerDashboard.test.tsx` — unit tests for BUYER-01 through BUYER-04
- [ ] `mobile/__tests__/dashboard/SellerDashboard.test.tsx` — unit tests for SELL-DASH-01 through SELL-DASH-04
- [ ] `mobile/__tests__/dashboard/DealerDashboard.test.tsx` — unit tests for DEALER-01 through DEALER-03
- [ ] Framework install: `cd mobile && npx expo install jest-expo @testing-library/react-native -- --dev` if no test runner detected

---

## Sources

### Primary (HIGH confidence)

- Codebase — `mobile/src/lib/api/dashboard.ts`: confirms `dashboardApi.buyer/seller/dealer` exist and call correct ENDPOINTS
- Codebase — `mobile/src/lib/api/offers.ts`: confirms `offersApi.respond(id, action, counterAmount)` exists and uses `PUT /offers/:id/respond`
- Codebase — `mobile/src/store/auth.store.ts`: confirms `UserRole` type, `user.role` field, synchronous access pattern
- Codebase — `mobile/src/constants/api.ts`: confirms all endpoint constants
- Codebase — `mobile/app/_layout.tsx`: confirms role is populated from `dashboardApi.me()` on every auth state change, written to Zustand before any screen renders
- Codebase — `mobile/app/(tabs)/profile.tsx`: confirms role branching pattern `user?.role === 'SELLER' || user?.role === 'DEALER'`
- Codebase — `mobile/package.json`: confirms `react-native-gifted-charts ^1.4.77` and all other dependencies installed
- Codebase — `mobile/app/notifications/index.tsx` + `notification-prefs/index.tsx`: confirms NativeWind-only styling convention for Phase 1+ screens

### Secondary (MEDIUM confidence)

- react-native-gifted-charts GitHub/docs: BarChart API (frontColor, barWidth, spacing, roundedTop, maxValue, isAnimated props) — cross-verified with package version installed
- TanStack Query v5 migration guide: confirms `gcTime` replaces `cacheTime`, `initialPageParam` required for `useInfiniteQuery` (both already in use in codebase)

### Tertiary (LOW confidence)

- Exact backend dashboard response shape: unknown — typed as `any` in `dashboard.ts`; must be discovered by calling live API at `https://carmazium-hjoh9w.fly.dev`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json; versions exact
- Architecture: HIGH — role detection, routing, and mutation patterns confirmed from existing codebase
- API endpoints: HIGH — all endpoint constants verified in api.ts; client methods verified in respective api files
- Backend response shape: LOW — typed `any`; field names must be validated against live API

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable stack — no fast-moving dependencies in scope)
