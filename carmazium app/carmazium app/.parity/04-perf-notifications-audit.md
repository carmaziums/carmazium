# Mobile Performance & Notifications Audit

Date: 2026-08-14. Scope: `carmazium app/carmazium app/src` (mobile), `backend/src/notifications` + all backend call sites, web `src/` for parity comparison. Read-only research, no source changes made.

---

## PART A — PERFORMANCE

### P0 — Startup

**A1. Eighteen font families loaded synchronously before first paint.** [App.tsx:144-165](../App.tsx#L144) — `useFonts()` loads 6 Inter + 6 Poppins + 5 Montserrat + 3 JetBrains Mono weights (18 total `require()`s) and blocks rendering (`if (!fontsLoaded) return <AppSplashScreen />`) until every one resolves. Only a subset of these families/weights is likely used anywhere in the app (`FontFamily`/`FontSize` in `src/constants/typography.ts` should be checked against actual usage — not verified in this pass which weights are dead weight). Each unused weight is pure startup-latency cost with zero payoff.

### P1 — Sockets / re-render hazards

**A2. `AuctionDetailScreen` socket effect depends on `currentUser` by reference.** [AuctionDetailScreen.tsx:307-419](../src/screens/vehicle/AuctionDetailScreen.tsx#L307) — the `useEffect` that opens the `/auctions` socket has `[auctionId, currentUser]` as its dependency array, and the effect body fully tears down (`socket?.disconnect()`) and recreates the connection on every dependency change. If `currentUser` comes from a Zustand selector that returns a new object reference on unrelated store writes (not confirmed which selector feeds it in this file — worth checking `useAuthStore` usage here specifically), this becomes a reconnect storm on every auth-store write while the screen is mounted. Cleanup itself is correct (`socket?.disconnect()` on unmount/re-run), so this is a churn/reconnect-frequency risk, not a leak.

**A3. Whole-store Zustand subscriptions in per-row/frequently-rendered components.** `VehicleCard.tsx:52` — `const { isSaved, toggle } = useWatchlistStore();` with no selector, inside a component rendered once per card across Home/Search/Saved/Live lists (confirmed via the file's own comment about expo-image being chosen "these cards render in long scrollable lists"). Any watchlist store write (saving *any* other listing) re-renders *every* mounted `VehicleCard`, not just the one whose saved-state changed. 21 files call `useAuthStore()`/`useWatchlistStore()` with no selector (grepped: `HomeScreen`, `VehicleDetailScreen`, `AuctionDetailScreen`, `SettingsScreen`, `SavedScreen`, `LiveScreen`, `ChatScreen`, `SignupScreen`, `LoginScreen`, `UnifiedDashboardScreen`, `ChatContext.tsx`, `WishlistHeart.tsx`, `VehicleCard.tsx`, `HorizontalVehicleCard.tsx`, `GlobalToastProvider.tsx`, etc.) — most of these are screen-level (acceptable, one subscriber), but `VehicleCard.tsx`, `HorizontalVehicleCard.tsx`, and `WishlistHeart.tsx` are row-level components where this compounds across every visible row.

### P1 — List rendering

**A4. `HomeScreen` renders every horizontal rail via `.map()` inside a `ScrollView`, not `FlatList`.** [HomeScreen.tsx:498-633](../src/screens/main/HomeScreen.tsx#L498) — `liveAuctions.map(...)`, `upcomingAuctions.map(...)`, `latestListings.slice(0,8).map(...)`, `featuredListings.map(...)`, and `recentGrid.map(...)` are all rendered unvirtualized. Every card in every rail mounts regardless of scroll position; images and per-card animated values (`VehicleCard` uses `useSharedValue`) all instantiate up front. `HomeScreen.tsx` has 0 `FlatList` usages against 7 `ScrollView`s — confirmed via grep. For rails capped at 8 items this is a minor cost, but `recentGrid` is not obviously bounded — worth checking the data-fetch limit feeding it.

**A5. `DealerLeadsScreen` nested-FlatList kanban board is fragile but was deliberately engineered around a real constraint**, not a naive miss — [DealerLeadsScreen.tsx:769-1001](../src/screens/main/DealerLeadsScreen.tsx#L769): an outer horizontal `FlatList` of board columns, each containing an inner vertical `FlatList`, with an explicit code comment explaining the inner list needs `height: '100%'` to virtualize instead of expanding to full content height. `LeadRow` is correctly hoisted and `React.memo`'d with a stable `onPress` (comment cites `mobile-audit.md P3/P4`). This is the one screen in the audit that shows prior perf remediation work — noted as a positive pattern other screens should copy, not a new finding.

**A6. `NotificationsScreen`'s `FlatList` virtualizes by date-group, not by individual notification.** [NotificationsScreen.tsx:258-267](../src/screens/main/NotificationsScreen.tsx#L258) — `data={groups}` where each group's `.items` are rendered via an inner `.map()` inside `renderGroup`, so a day with 40 notifications still mounts all 40 at once (only day-groups are virtualized against each other). Low severity given realistic per-day notification volume, but the same pattern as A4/A5's nested-list problem without the compensating fix DealerLeads applied.

### P2 — Animations

**A7. Two `useNativeDriver: false` animations**, both real (not stale comments): [OnboardingScreen.tsx:136](../src/screens/onboarding/OnboardingScreen.tsx#L136) and [HeroCarousel.tsx:136](../src/components/HeroCarousel.tsx#L136). Both are one-time/low-frequency (onboarding swipe indicator, hero carousel) rather than continuous gesture-driven animation, so JS-thread cost is bounded — flagged for completeness, not urgent.

### Checked and found clean

- **Images**: every `expo-image` carousel usage checked (`ImageCarousel.tsx:59,84`, `HeroCarousel.tsx:39`) sets `contentFit="cover"` and `cachePolicy="memory-disk"` correctly. `VehicleCard.tsx`'s own comment correctly explains why `expo-image` was chosen over RN `Image` (disk+memory caching, recycling, progressive loading) — this part of the app was clearly already perf-reviewed.
- **Network**: no react-query, confirmed by design (`CLAUDE.md` states this explicitly) — there is genuinely no request de-dup/caching layer anywhere in the app; every screen refetches on its own. This is an architectural choice already documented, not a new finding, but flag it as context for any future "why is this screen slow" investigation — every focus/mount is a fresh network round trip with nothing memoized.
- **Chat socket cleanup**: `ChatContext.tsx` connects (`io(...)` at line 67) inside a `useEffect` starting at line 48, with a second effect at line 165; did not find an unpaired listener registration without matching cleanup in the portion read, and `AuctionDetailScreen`'s socket teardown (`socket?.disconnect()`) is present and correctly scoped to the effect's own local `socket` variable, not a shared ref that could be double-disconnected.

### Not verified (would need a deeper pass)

- Full FlatList audit of the remaining ~55 screens with `ScrollView`/`FlatList` usage (125 total occurrences across 58 files) — only `HomeScreen`, `SearchScreen`, `DealerLeadsScreen`, `NotificationsScreen` were read in full. `getItemLayout` usage was not found in any file grepped, meaning no list in the app pre-computes row heights — likely fine for variable-height cards, but worth a targeted check if any fixed-height list (e.g. a flat notification or chat-message list) would benefit.
- Inline `renderItem`/inline style-object prevalence across the full screen set was not exhaustively grepped — only spot-checked.
- Sequential-await vs `Promise.all` opportunities were not systematically searched across all `*Api.ts` wrapper files.

---

## PART B — NOTIFICATIONS

### P0 — Push is fully non-functional end-to-end, on both sides of the wire

Push notifications are **completely unwired**, despite the client-side code for it being fully written and looking production-ready at a glance. Three independent breaks, any one of which alone would be fatal:

**B1. `registerForPushNotifications()` is never called anywhere in the app.** It is fully implemented in [pushNotifications.ts:34-101](../src/lib/pushNotifications.ts#L34) (requests permission, creates Android channels, fetches the Expo push token, POSTs it to the backend) but a repo-wide grep for `registerForPushNotifications` outside its own definition file returns exactly one hit: `DEVELOPER_SETUP.md:178`, a doc telling a developer to call it manually. It is not called from `App.tsx`, not from `authStore`'s login/signup/`initializeAuth`, not from any screen. No device has ever registered a push token through the current app build.

**B2. Even if it were called, the backend endpoint it targets does not exist.** `pushNotifications.ts:90` POSTs to `/users/push-token`. A repo-wide grep across `backend/src` for `push-token` / `pushToken` returns zero matches outside `notifications.service.ts`'s *read* of `prefs?.expoPushToken` (`notifications.service.ts:127`) — there is no controller route, DTO, or service method anywhere in `backend/src` that writes `expoPushToken` into `user.preferences`. The field the push-send path reads (`prefs?.expoPushToken`, `notifications.service.ts:127`) can never be populated by any code path found in this backend.

**B3. Consequently, the "Push" delivery toggle in `NotificationSettingsScreen.tsx` is decorative** — it correctly persists to `preferences.notifications.push` on the backend (confirmed, `NotificationSettingsScreen.tsx:94-105`, and the backend correctly reads it at `notifications.service.ts:125`), but the gate it controls (`if (pushEnabled && !this.gateway.isUserConnected(dto.userId) && !this.isQuietHours(...))`, `notifications.service.ts:126`) can never reach the `pushToExpo` call because `expoPushToken` is always `undefined`.

**Verdict for the audit brief's direct question: push is absent in practice, not "partially wired."** The code exists and is well-structured (Expo channels, quiet-hours gating, mute-all, per-type preference gating in `notifications.service.ts` are all real and correct), but the one connective piece — persisting a token from device to database — was never built on the backend and never invoked on the client. This is likely why nobody has noticed: everything downstream of token storage works and was presumably tested via the in-app socket path (foreground), which doesn't require a push token at all.

**B4. Secondary bug, moot until B1-B3 are fixed: Android notification channel IDs don't match between backend and client.** `notifications.service.ts:197-201` (`getChannelId`) sends `channelId: 'carmazium-bids'`, `'carmazium-messages'`, or `'carmazium-default'` depending on notification type. `pushNotifications.ts:42-63` only ever registers Android channels named `'default'`, `'auctions'`, and `'offers'` via `setNotificationChannelAsync`. None of the three channel IDs the backend sends match any channel the client has created — Android's behavior when a push targets a non-existent channel varies by OS version (some silently fall back to a default channel with lost importance/sound settings, others may drop the notification). This needs fixing alongside B1/B2, not after.

**B5. No `google-services.json` / native FCM config found.** `app.json` lists the `expo-notifications` plugin (`app.json:81`) but no `google-services.json` reference and no file by that name exists in the repo (grepped both). Expo's push service can proxy through Expo's own servers without a project-level FCM key for many cases, so this alone doesn't block push, but it means there's no fallback/verification path if Expo's push service has issues, and it should be confirmed intentional rather than an oversight.

### In-app notifications (the socket/foreground path) — this part works

- **Feed**: `NotificationsScreen.tsx` calls `getNotifications()` (from `lib/notificationsApi.ts`, not read in full but referenced) which hits `GET /notifications` (`notifications.controller.ts:30-45`), correctly paginated.
- **Unread badge**: `unreadCount` computed client-side from the loaded page (`NotificationsScreen.tsx:76`); backend also exposes `GET /notifications/unread-count` (`notifications.controller.ts:47-52`) — not confirmed whether the tab-bar badge (outside this screen, not read) uses the dedicated endpoint or a separate fetch.
- **Realtime**: `NotificationsGateway` (`notifications.gateway.ts`) is a real, working Socket.IO namespace at `/notifications` with dual auth (web session cookie or mobile Bearer token via `handshake.auth.token`, lines 44-57), per-user rooms, a 5-socket-per-user cap with oldest-eviction, and reconnect catch-up (emits the 10 most recent unread on connect, line 85). This is solid and mobile-aware — but the mobile client-side socket subscription that consumes `notification:new` was not located in this pass (grep scope did not include a mobile file that opens `io(.../notifications)` — worth a follow-up grep for `/notifications` namespace connection specifically, since `NotificationsScreen.tsx` as read only does REST fetch + optimistic local state, no socket listener visible in the 372 lines read).
- **Mark-read**: works both individually (`PATCH /notifications/:id/read`, wired from `handleTap`, `NotificationsScreen.tsx:106`) and in bulk (`PATCH /notifications/read-all`, wired from `handleMarkAll`, line 186), both with correct optimistic local updates and non-blocking failure handling.

### Notification type enumeration and routing table

Backend-emitted types found via grep across `admin.service.ts`, `listings.service.ts`, `delivery.service.ts`, `tasks/auction-lifecycle.service.ts`, `payments.service.ts` (search was not fully exhaustive — `auctions.service.ts`, `offers.service.ts`, and `chat.service.ts` are referenced by code comments as notification sources — e.g. `auctions.service.ts:879-938` comment "Notify winner — persisted + push delivered via notificationsService.create()" — but their exact `type:` strings were not individually read in this pass; inferred from `App.tsx`'s `NOTIFICATION_SCREEN_MAP` and `NotificationsScreen.tsx`'s `switch` instead, both of which reference `OUTBID`, `BID_PLACED`, `AUCTION_WON`, `AUCTION_ENDED`, `OFFER_RECEIVED`, `OFFER_COUNTERED`, `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_WITHDRAWN`, `DEAL_CLOSED`, `PAYOUT_FAILED`, `MESSAGE_RECEIVED`, `COUNTER_RECEIVED`).

| Type | Backend source (confirmed) | Mobile tap routing (`NotificationsScreen.tsx`) | Correct? |
|---|---|---|---|
| `LISTING_APPROVED` | `admin.service.ts:412-420` | falls through `switch` default (no case) — informational only, no navigation | Plausible — link field points to `/buy-cars/{slug}` (a web route), mobile has no generic link-follower, so silent no-op is arguably correct but unverified against product intent |
| `LISTING_REJECTED` | `admin.service.ts:468-476` | same as above, default/no-op | Same caveat |
| `SYSTEM` | `admin.service.ts:630-638`, `payments.service.ts:69-77` (deposit-received) | default/no-op | Generic type, no-op is reasonable |
| `HANDOVER_APPROVED` | `admin.service.ts:742-748` | not in `switch` — falls to `entityType === 'AUCTION'` check first (`NotificationsScreen.tsx:118`), which fires since `entityType: 'AUCTION'` is set (`admin.service.ts:635` pattern used elsewhere; not 100% confirmed this specific call sets `entityType`) → navigates to `LiveAuctionDetailed` | Needs confirmation `entityType`/`entityId` are actually set on this call — not fully visible in the grepped excerpt |
| `REFUND_FAILED` | `admin.service.ts:900-906` | `entityType: 'AUCTION'` set explicitly (line 903) → routes to auction detail | Questionable UX (refund failure routing a user to the auction screen with no refund context) but technically "routes somewhere valid" |
| `HANDOVER_DENIED` | `admin.service.ts:945-951` | `entityType: 'AUCTION'` set (line 949) → auction detail | Same as above |
| `KYC_APPROVED` / `KYC_REJECTED` | `admin.service.ts:1236-1273` | no `entityType`/case match visible → default/no-op | Likely a gap: a dealer tapping a KYC notification lands nowhere actionable, when the obvious destination is `DealerKYCScreen` |
| `LISTING_SUBMITTED` | `listings.service.ts:111-119`, `payments.service.ts:32-40` | default/no-op | `entityType: 'Listing'` is set but `NotificationsScreen.tsx`'s entity check only special-cases `entityType === 'AUCTION'` (case-insensitively) — every other `entityType` (`Listing`, `DealerKyc`, `DELIVERY_REQUEST`) is dead weight in the payload, never used for routing |
| `DELIVERY_REQUESTED` / `DELIVERY_EXPIRED` / `DELIVERY_ACCEPTED` / `DELIVERY_DECLINED` | `delivery.service.ts:214-336` | default/no-op (no case for any `DELIVERY_*` type) | Real gap — all four carry `entityType: 'DELIVERY_REQUEST'`, which mobile never reads; tapping any delivery notification does nothing, when web presumably deep-links to the relevant offer/request |
| `AUCTION_ENDING` | `auction-lifecycle.service.ts:85-91` | `entityType: 'AUCTION'` set (line 89) → routes correctly | OK |
| `OUTBID`, `BID_PLACED`, `AUCTION_WON`, `AUCTION_ENDED` | inferred from `App.tsx` push-tap map and `NotificationsScreen.tsx` switch — not independently confirmed against `auctions.service.ts` source in this pass | routed via `entityType === 'AUCTION'` path or explicit `switch` cases | Likely OK based on both files agreeing, but the backend `type:` strings for these weren't read directly — flagged as inferred, not confirmed |
| `OFFER_RECEIVED`, `OFFER_COUNTERED` | not independently confirmed in `offers.service.ts` (not read) | role-branches correctly: dealer → `DealerOffers`, seller → `SellerOffers`, else → `BuyerOffers` (`NotificationsScreen.tsx:140-152`), with an explicit comment citing the `d2d6b9eb` "dealer notification routing" fix | **This is the one place the audit brief's named commit fix is directly visible and it looks complete for OFFER_RECEIVED/OFFER_COUNTERED** — all three roles are branched, not just dealer |
| `OFFER_ACCEPTED`, `OFFER_REJECTED`, `OFFER_WITHDRAWN` | not independently confirmed | all three → `BuyerOffers` unconditionally, no dealer/seller branch (`NotificationsScreen.tsx:154-158`) | **Likely incomplete relative to the `d2d6b9eb` fix's stated intent** — if a dealer or seller can receive an `OFFER_ACCEPTED`/`OFFER_REJECTED` notification (e.g. as the party who made an offer on someone else's listing, or as confirmation their own accept went through), routing them to `BuyerOffers` regardless of role reproduces exactly the bug class `d2d6b9eb` fixed for `OFFER_RECEIVED`/`OFFER_COUNTERED` two cases up. Not confirmed whether dealers/sellers can actually receive these three types — if they can't, this is fine as-is; this needs a backend check of `offers.service.ts` to settle. |
| `DEAL_CLOSED` | not independently confirmed | role-branches dealer vs. non-dealer (`SellerOffers`) but has no distinct buyer case — buyers land on `SellerOffers` too via the `else` branch (`NotificationsScreen.tsx:160-166`) | Possible bug — a buyer tapping `DEAL_CLOSED` navigating to `SellerOffers` (a seller-scoped data source) looks like the same class of bug `d2d6b9eb` fixed, just not caught for this type |
| `PAYOUT_FAILED` | not independently confirmed | → `Settings` | Plausible but generic |
| `MESSAGE_RECEIVED` | not independently confirmed (chat notifications presumably from `chat.service.ts`, not read) | → `ChatScreen` with `n.data.roomId`, checked before the generic switch (`NotificationsScreen.tsx:129-132`) | OK, assuming backend always sets `data.roomId` |

**Overall verdict on the `d2d6b9eb` fix**: confirmed complete for `OFFER_RECEIVED`/`OFFER_COUNTERED` (the case the commit message names), but the same role-blind pattern still exists for `OFFER_ACCEPTED`/`OFFER_REJECTED`/`OFFER_WITHDRAWN` (all hardcoded to `BuyerOffers`) and `DEAL_CLOSED` (buyer falls through to the seller-scoped screen). Whether these are live bugs depends on whether dealers/sellers/buyers can actually receive each of those notification types from the backend — that requires reading `offers.service.ts` and `auctions.service.ts` notification call sites directly, which this pass did not do. **Flagging as P1 (not confirmed P0) pending that read.**

**Also unaddressed regardless of role**: `KYC_APPROVED`/`KYC_REJECTED` and all four `DELIVERY_*` types have no tap destination at all — not a routing-to-wrong-screen bug like the dealer issue, but a routing-to-nowhere gap.

### Web parity (not independently re-verified in this pass — flagged as unverified)

Web's notification bell/routing logic (likely `NotificationBell.tsx`, referenced by comment in `NotificationsScreen.tsx:110` — "mirrors web's `NotificationBell.tsx`") was not read directly in this audit. Mobile's own code comments assert parity for the `entityType`/`entityId`-first routing strategy and explicitly account for a known web/mobile casing mismatch (`entityType: 'AUCTION'` vs. lowercase `'auction'` from `WatchlistReminderService`, handled case-insensitively at `NotificationsScreen.tsx:118`). Given time constraints this claim was not independently checked against the actual web source — recommend a follow-up diff against `src/components/*NotificationBell*` if precise copy/routing parity matters for this audit's conclusions.

### Notification preferences — backend mapping confirmed correct

`NotificationSettingsScreen.tsx`'s toggle set (`muteAll, outbid, winning, endingSoon, newLot, counterOffer, offerAccepted, offerDeclined, push, email, sms, freq, quietHours, quietStart, quietEnd`) is saved as one JSON blob to `preferences.notifications` via `PATCH /users/me` (`NotificationSettingsScreen.tsx:94-105`). Backend's `NotificationsService.TYPE_PREF_KEY` (`notifications.service.ts:31-38`) maps exactly five of those keys (`outbid`, `winning`, `endingSoon`, `counterOffer`, `offerAccepted`, `offerDeclined`) to real gating logic — this is a 1:1 field-name match, confirmed correct, not guessed. `newLot` has no corresponding backend gate (no `NEW_LOT`-type notification was found anywhere in the grepped call sites) — the toggle exists in the UI with no backend event to gate, which the mobile code doesn't flag but isn't actively wrong either (it just does nothing). `sms` is correctly disabled client-side with a "Coming soon" label and a code comment explicitly citing there's no SMS provider in the backend (`NotificationSettingsScreen.tsx:305-313`) — this one was already caught and handled honestly rather than left as a silent dead toggle.

---

## Summary ranking

| # | Finding | Rank |
|---|---|---|
| B1-B3 | Push notifications non-functional end-to-end (never registered client-side; backend endpoint doesn't exist; token field can never populate) | **P0** |
| A1 | 18 font families loaded synchronously, blocking first paint | **P0** |
| B4 | Android push channel IDs sent by backend don't match any channel registered on-device | P1 (moot until B1-B3 fixed, but must be fixed alongside) |
| A2 | `AuctionDetailScreen` socket effect keyed on `currentUser` reference — possible reconnect churn | P1 (needs confirmation of selector stability) |
| A3 | Row-level components (`VehicleCard`, `HorizontalVehicleCard`, `WishlistHeart`) subscribe to whole Zustand stores | P1 |
| Routing | `OFFER_ACCEPTED`/`REJECTED`/`WITHDRAWN` and `DEAL_CLOSED` hardcode destinations without full role-branching, same bug class as the `d2d6b9eb` fix but for different types | P1 (pending confirmation dealers/sellers can receive these types) |
| Routing | `KYC_APPROVED`/`REJECTED` and all `DELIVERY_*` types have no tap destination | P1 |
| A4 | `HomeScreen` rails rendered via `.map()` in `ScrollView`, not `FlatList` | P2 |
| A6 | `NotificationsScreen` FlatList virtualizes by day-group, not by row | P2 |
| A7 | Two `useNativeDriver: false` animations (onboarding, hero carousel) | P2 |
| B5 | No `google-services.json` found — likely fine under Expo's push proxy, unconfirmed as intentional | P2 |

## Explicitly not verified / needs follow-up

- Mobile-side socket subscriber for the `/notifications` namespace (`notification:new` listener) was not located — `NotificationsScreen.tsx` only shows REST fetch + optimistic state.
- `offers.service.ts`, `auctions.service.ts`, `chat.service.ts` notification call sites (exact `type:` strings, `entityType` fields) were not read directly — several routing conclusions above are inferred from mobile-side code rather than confirmed against backend source.
- Web's `NotificationBell.tsx` (or equivalent) was not read — parity claims in mobile's own comments were not independently verified.
- Full FlatList/ScrollView audit across all 58 screens was not performed — only 4 screens read in full.
