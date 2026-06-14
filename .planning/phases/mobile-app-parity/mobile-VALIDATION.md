---
phase: mobile-app-parity
slug: mobile-app-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase mobile-app-parity — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler only (no Jest in target app) |
| **Config file** | `tsconfig.json` in `D:\carmazium\carmazium app\carmazium app\` |
| **Quick run command** | `cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit` |
| **Full suite command** | `cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit` |
| **Estimated runtime** | ~10–20 seconds |

**Note:** The production mobile app has no Jest configuration. All visual/animation/socket behaviors require manual device verification. TypeScript checking is the only automated gate.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` — zero TypeScript errors required before next task
- **After every plan wave:** Manual device walkthrough of all screens touched in that wave
- **Before completion:** Full device verification pass (all roles, all flows, physical device for haptics)
- **Max feedback latency:** TypeScript ~20s; manual review per wave

---

## Per-Task Verification Map

| Task Area | Wave | Verification Method | Automated Gate | Manual Required |
|-----------|------|--------------------|--------------------|-----------------|
| Skeleton component extraction | 0 | TypeScript builds; Skeleton renders in HomeScreen | `tsc --noEmit` | Visual smoke check |
| Package installs (haptics, gifted-charts, gesture-handler) | 0 | Import resolves; `tsc --noEmit` clean | `tsc --noEmit` | Device smoke test |
| ChatScreen nav bug fix | 0 | TypeScript param types match navigate() call | `tsc --noEmit` | Navigate to chat from auction room |
| GlobalToastProvider socket extension | 0 | TypeScript builds; no double-connection | `tsc --noEmit` | Trigger notification while in app |
| GestureHandlerRootView in App.tsx | 0 | TypeScript builds | `tsc --noEmit` | Swipe gesture in gallery |
| AuctionDetailScreen skeleton | 1 | TypeScript; no ActivityIndicator import remaining | `tsc --noEmit` | Load auction screen on device |
| Auction countdown Reanimated pulse | 1 | TypeScript; useSharedValue usage correct | `tsc --noEmit` | Set endTime to <5 min; observe pulse |
| AuctionCompleteScreen navigation trigger | 1 | TypeScript param types; no orphan screen | `tsc --noEmit` | Win an auction (or mock auction:ended event) |
| AuctionCompleteScreen confetti + count-up | 1 | TypeScript builds; no import error | `tsc --noEmit` | Navigate to screen; observe animation |
| SellCarFlowScreen inline validation | 2 | TypeScript; no Alert.alert() for field errors | `tsc --noEmit` | Enter invalid VRM; observe red border |
| SellCarFlowScreen expo-image swap | 2 | TypeScript; Image from expo-image not react-native | `tsc --noEmit` | Upload photo; verify preview |
| DealerKYCScreen audit + wire | 2 | TypeScript; POST /dealers/kyc wired | `tsc --noEmit` | Submit KYC docs; see pending state |
| VehicleDetailScreen photo gallery | 2 | TypeScript; gesture-handler imports resolve | `tsc --noEmit` | Swipe photos; pinch-to-zoom |
| Finance "Coming Soon" label | 2 | TypeScript; no backend call from finance UI | `tsc --noEmit` | Expand finance calculator |
| DealerAnalyticsScreen gifted-charts | 3 | TypeScript; BarChart/LineChart imports resolve | `tsc --noEmit` | Open dealer analytics; charts render |
| SellerPerformanceScreen charts | 3 | TypeScript builds | `tsc --noEmit` | Open seller performance; charts render |
| SellerDashboardScreen RefreshControl | 3 | TypeScript; RefreshControl in JSX | `tsc --noEmit` | Pull to refresh on seller dashboard |
| DealerLeadsScreen "Message Lead" | 3 | TypeScript; navigate uses correct params | `tsc --noEmit` | Tap Message on lead; chat opens |
| AboutScreen + PricingScreen creation | 4 | TypeScript; screens registered in stack | `tsc --noEmit` | Tap About/Pricing in drawer |
| GlobalDrawer navigation entries updated | 4 | TypeScript; no action:'alert' for About/Pricing | `tsc --noEmit` | Open drawer; tap About; screen opens |
| Haptic feedback pass | 4 | TypeScript; expo-haptics imports resolve | `tsc --noEmit` | Physical device — feel impacts |
| Tab bar spring animation | 4 | TypeScript; Reanimated in tab bar config | `tsc --noEmit` | Switch tabs; observe scale spring |
| Pull-to-refresh standardization | 4 | TypeScript; RefreshControl on all list screens | `tsc --noEmit` | Pull on each screen |
| Typography audit — prices → JetBrains Mono | 5 | TypeScript; StyleSheet.create uses FontFamily.mono | `tsc --noEmit` | Visual review: prices in mono font |
| expo-image blurhash fallback | 5 | TypeScript; no raw RN Image in listing screens | `tsc --noEmit` | Load listing cards on slow connection |
| Zero hardcoded hex audit | 5 | TypeScript; no string literals matching #[0-9a-fA-F]{3,6} in styles | `tsc --noEmit` | Code review |

---

## Wave 0 Requirements

- [ ] `src/components/ui/Skeleton.tsx` — shared animated skeleton component
- [ ] `expo-haptics` installed and importable
- [ ] `react-native-gifted-charts` installed and importable
- [ ] `react-native-gesture-handler` installed and importable
- [ ] `GestureHandlerRootView` wrapping `NavigationContainer` in `App.tsx`
- [ ] `ChatScreen` nav bug fixed: stack name = `'Chat'`, param key = `roomId`
- [ ] `GlobalToastProvider` subscribes to `/notifications` Socket.IO (no new connection — reuse singleton)

*Wave 0 must be fully complete before Wave 1 begins — skeleton, gesture-handler, and toast are required by all subsequent waves.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Device Instructions |
|----------|------------|-------------------|
| Haptic feedback | Simulator does not trigger haptics | Physical device required; feel impacts on bid, offer, tab press |
| Socket.IO live bid feed | Requires live backend connection | Two verified dealer accounts; place competing bids |
| Anti-snipe extension | Requires auction with <3 min remaining | Set test auction endTime to now+2min; place bid; verify extension |
| Stripe payment sheet | Requires Stripe test mode device flow | Use card 4242 4242 4242 4242; complete payment sheet |
| Confetti animation | Visual only; no automated assertion | Navigate to AuctionCompleteScreen; observe full-screen confetti |
| Font rendering | Visual only; fontFamily value cannot be asserted in TypeScript | Review each screen on device for Poppins/Montserrat/JetBrains Mono |
| Skeleton shimmer animation | Visual only | Slow network or artificial delay; observe pulse shimmer |
| Pull-to-refresh tintColor | Visual only | Pull down on refreshable screens; spinner should be Colors.accent (#DC1F26) |
| Gallery pinch-to-zoom | Gesture; requires physical touch | Open VehicleDetailScreen; pinch gallery image |

---

## Validation Sign-Off

- [ ] All tasks have `tsc --noEmit` as automated verify gate
- [ ] Manual verification checklist prepared for each wave
- [ ] Wave 0 infrastructure requirements documented above
- [ ] TypeScript check runtime < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
