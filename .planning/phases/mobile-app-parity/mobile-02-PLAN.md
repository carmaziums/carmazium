---
phase: mobile-app-parity
plan: "02"
type: execute
wave: 1
depends_on: ["01"]
files_modified:
  - "src/screens/vehicle/AuctionDetailScreen.tsx"
  - "src/screens/main/AuctionCompleteScreen.tsx"
  - "src/screens/main/LiveScreen.tsx"
autonomous: true
requirements: []
must_haves:
  truths:
    - "AuctionDetailScreen shows a layout-matching skeleton on load instead of a centered ActivityIndicator"
    - "Auction countdown background pulses red (Colors.accentDark) and timer color intensifies when <=5 minutes remain"
    - "A green flash overlay plays on the bid feed when the user's bid is accepted"
    - "On auction:ended, if the current user is the winner, the app navigates to AuctionComplete with win params (no in-page win banner as the primary path)"
    - "AuctionCompleteScreen plays a confetti burst and an animated count-up on the hammer price"
    - "All prices and countdowns on these screens use FontFamily.mono"
    - "LiveScreen shows a skeleton on load and an illustrated EmptyState when there are no live auctions"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/screens/main/AuctionCompleteScreen.tsx"
      provides: "Auction win celebration with confetti + count-up"
  key_links:
    - from: "src/screens/vehicle/AuctionDetailScreen.tsx"
      to: "AuctionComplete route"
      via: "navigate('AuctionComplete', winParams) on auction:ended when winnerId === currentUser.id"
---

<objective>
Wave 1 — Auction & bidding polish, the highest-business-value flow. Add skeleton loading and the countdown red-pulse + bid-flash animations to AuctionDetailScreen, route winners to AuctionCompleteScreen on auction end, and turn the win screen into a celebration (confetti + price count-up). Add skeleton + empty state to LiveScreen.

Purpose: The live auction is the signature experience. It must feel premium under load and reward winning with a jackpot moment.
Output: Polished AuctionDetailScreen, celebratory AuctionCompleteScreen, and a properly-loading LiveScreen.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md

<interfaces>
Shared components from Wave 0:
- `import { Skeleton } from '../../components/ui/Skeleton'` (props w, h, r?)
- `import { EmptyState } from '../../components/ui/EmptyState'`
- `import { haptics } from '../../lib/haptics'` (haptics.light/medium/success)

Reanimated 4 patterns (use these — do NOT copy Reanimated 3 snippets from the web):
- Press scale: CategoryPill.tsx — `const scale = useSharedValue(1); const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));`
- For repeating pulse: `useSharedValue(0)` + `useAnimatedStyle` with `interpolateColor(v.value, [0,1], [Colors.bgTertiary, Colors.accentDark])`; drive with `v.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)`.

AuctionDetailScreen current state (src/screens/vehicle/AuctionDetailScreen.tsx, 1010 lines):
- Loading guard renders `<ActivityIndicator color="#DC1F26" size="large" />` (~line 277). Replace with skeleton.
- Socket on '/auctions' namespace (~line 144). 'bid:new' handler ~line 162. 'auction:ended' handler ~line 181 sets status ENDED and stores winnerId/winningBidAmount but does NOT navigate.
- `userWon` boolean computed ~line 247: `endedPayload?.winnerId === currentUser?.id || (auction?.winnerId && auction.winnerId === currentUser?.id)`.
- endTime state (Date | null); isActive when auction.status === 'ACTIVE'.
- placeBid(auction.listingId, parsed) called ~line 230.
- anti-snipe toast/bar already implemented (~lines 303, 520) — leave intact.

AuctionComplete route params (MainStackParamList): { listingId, auctionId, hammerPrice, buyerFee?, bidCount?, lotNumber?, listingTitle, listingImage?, paymentDeadline? }.

AuctionCompleteScreen current state (907 lines): uses useStripe() + createPaymentSheet (Stripe wired, leave intact). Renders `<Text style={styles.hammerPrice}>{fmt(hammerPrice)}</Text>` (~line 433). hammerPrice style uses FontFamily.black (~line 622). No confetti, no count-up today.

Confetti: use the library installed in Wave 0 (see SUMMARY for exact choice). If react-native-confetti-cannon was used: `import ConfettiCannon from 'react-native-confetti-cannon'` and fire on mount.
</interfaces>
</context>

<tasks>

<task type="modify">
  <name>Task 1: AuctionDetailScreen — skeleton + countdown red-pulse + bid flash + winner navigation</name>
  <files>src/screens/vehicle/AuctionDetailScreen.tsx</files>
  <action>
    1) Skeleton loading: Replace the centered `<ActivityIndicator color="#DC1F26" size="large" />` loading branch (~line 277) with a layout-matching skeleton — a hero image block (Skeleton w=full h=240 r=0), then 2-3 stacked Skeleton bars for title/price (w=200 h=28, w=140 h=20), and a few bid-row skeletons. Import { Skeleton } from '../../components/ui/Skeleton'.

    2) Countdown red-pulse: Wrap the live countdown timer container in a Reanimated Animated.View. Add `const pulse = useSharedValue(0)`. In a useEffect that depends on remaining time + auction.status === 'ACTIVE', when remaining <= 5 minutes start `pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)`; otherwise `cancelAnimation(pulse); pulse.value = 0`. Animated style: backgroundColor interpolateColor(pulse.value, [0,1], [Colors.bgTertiary, Colors.accentDark]). Also intensify the timer text color toward Colors.accentGlow when <=5 min (can be a simple conditional style, not animated). Ensure the timer text uses FontFamily.mono.

    3) Bid flash: Add a Reanimated shared value `bidFlash = useSharedValue(0)`. In the existing 'bid:new' socket handler (~line 162), when the incoming bid's bidderId === currentUser.id, run `bidFlash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 400 }))`. Render an absolutely-positioned Animated.View overlay on the top bid-feed row with backgroundColor Colors.success and `opacity: bidFlash.value * 0.35` via useAnimatedStyle. Also call haptics.medium() on a successful own bid.

    4) Winner navigation: In the 'auction:ended' handler (~line 181), AFTER updating state, check if the current user is the winner (`payload.winnerId === currentUser?.id`). If so, call `navigation.navigate('AuctionComplete' as any, { listingId: auction.listingId, auctionId: auction.id, hammerPrice: payload.winningBidAmount ?? bidAmount, buyerFee: 125, bidCount: <existing bid count if available>, listingTitle: <derive from auction.listing>, listingImage: <first image>, lotNumber: <if available>, paymentDeadline: <if backend provides> })` and call haptics.success(). Keep the existing in-page ended UI as a fallback for non-winners (sellers/observers). Do not remove the seller "Message Seller" path.

    5) Typography: audit every £ value and the countdown in this screen — ensure FontFamily.mono. Do not bulk-replace FontFamily.bold globally; only price/countdown/ID Text nodes.

    Use Colors.* tokens throughout (Colors.accentDark, Colors.accentGlow, Colors.bgTertiary, Colors.success). No hardcoded hex.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Load an auction: skeleton shows. Set endTime to now+4min: background pulses red, timer turns accentGlow, mono font. Place own bid: green flash + haptic. Mock auction:ended with winnerId=self: navigates to AuctionComplete.</manual>
  </verify>
  <done>ActivityIndicator removed from loading branch; countdown pulses red and uses mono when <=5min; own-bid green flash + haptic fires; winner is routed to AuctionComplete on auction:ended.</done>
</task>

<task type="modify">
  <name>Task 2: AuctionCompleteScreen — confetti burst + count-up price + mono typography</name>
  <files>src/screens/main/AuctionCompleteScreen.tsx</files>
  <action>
    1) Confetti: On mount (useEffect once), fire a confetti burst using the Wave 0 library. If react-native-confetti-cannon: render `<ConfettiCannon count={150} origin={{ x: SCREEN_WIDTH / 2, y: -20 }} fadeOut autoStart explosionSpeed={350} fallSpeed={2800} colors={[Colors.accent, Colors.accentGlow, Colors.white, '#F59E0B']} />` absolutely positioned, pointerEvents="none". If the library failed to install in Wave 0, implement a lightweight Reanimated particle burst (8-12 Animated.Views animating translateY + opacity outward) — keep it simple. Also call haptics.success() on mount.

    2) Count-up price: Replace the static `<Text style={styles.hammerPrice}>{fmt(hammerPrice)}</Text>` with an animated count-up. Use a Reanimated shared value `count = useSharedValue(0)` driven `count.value = withTiming(hammerPrice, { duration: 1400 })` on mount, and a useDerivedValue/useAnimatedReaction to setState a displayed integer (or use a simpler Animated.Value + listener if Reanimated text-driving is awkward in v4 — display rounded count via React state updated from the listener). Format the displayed value through the existing `fmt()` helper. Ensure the hammerPrice style uses FontFamily.mono (currently FontFamily.black). The animation should settle on the true hammerPrice within ~1.4s, then the handover CTA remains.

    3) Typography: ensure all £ values (hammerPrice, buyerFee, summaryValue, summaryTotalValue) use FontFamily.mono. Headings stay FontFamily.bold. Leave the Stripe payment sheet logic (useStripe, createPaymentSheet) completely untouched.

    Use Colors.* tokens. Keep '#F59E0B' (warning/gold) only where it already exists as an accent for confetti; prefer Colors.warning if substituting.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Navigate to AuctionComplete (or via Task 1 win flow): confetti bursts, price counts up to hammer value, success haptic fires, price renders in JetBrains Mono. Stripe pay button still opens the payment sheet.</manual>
  </verify>
  <done>Confetti fires on mount; hammer price counts up and renders in FontFamily.mono; Stripe flow unchanged.</done>
</task>

<task type="modify">
  <name>Task 3: LiveScreen — skeleton loading + empty state</name>
  <files>src/screens/main/LiveScreen.tsx</files>
  <action>
    Audit LiveScreen's loading and empty handling.
    1) Replace any spinner/blank loading state with a column of auction-card-shaped Skeletons (import { Skeleton } from '../../components/ui/Skeleton'); shape them to match the actual live-auction card (image block + title bar + price/countdown bar).
    2) When the loaded list of active + scheduled auctions is empty, render `<EmptyState icon="flame-outline" title="No live auctions right now" subtitle="Check back soon — new lots go live throughout the day." ctaLabel="Browse listings" onCtaPress={() => navigation.navigate('Tabs', { screen: 'Search' })} />`. Import { EmptyState } from '../../components/ui/EmptyState'.
    3) Confirm a RefreshControl exists with tintColor={Colors.accent}; if missing, add it. Ensure any price/countdown text uses FontFamily.mono.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Open Live tab on slow network: skeleton cards show. With no live auctions: illustrated empty state shows. Pull down: accent-tinted refresh spinner.</manual>
  </verify>
  <done>LiveScreen shows skeleton cards on load, an EmptyState when no auctions, and an accent-tinted RefreshControl.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- No ActivityIndicator in AuctionDetailScreen loading branch.
- Countdown pulse + bid flash + winner navigation implemented.
- AuctionCompleteScreen fires confetti + count-up; prices in mono.
- LiveScreen has skeleton + EmptyState + accent RefreshControl.
</verification>

<success_criteria>
The live auction flow loads with skeletons, animates the countdown under 5 minutes, flashes on own bids, routes winners to a celebratory completion screen, and uses mono typography for all prices/timers.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-02-SUMMARY.md` documenting the winner-navigation param mapping and the confetti/count-up approach used.
</output>
