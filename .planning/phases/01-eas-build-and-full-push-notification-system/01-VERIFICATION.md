---
phase: 01-eas-build-and-full-push-notification-system
verified: 2026-05-30T00:00:00Z
status: gaps_found
score: 10/16 requirements verified
re_verification: false
gaps:
  - truth: "User receives a push notification when outbid in a live auction"
    status: failed
    reason: "No OUTBID notification exists anywhere in the backend. bids.service.ts does not import NotificationsService and does not call notificationsService.create(). The word 'OUTBID' does not appear in any backend file."
    artifacts:
      - path: "backend/src/bids/bids.service.ts"
        issue: "No NotificationsService dependency, no outbid notification sent to previous highest bidder"
    missing:
      - "Inject NotificationsService into BidsService"
      - "After a new bid is accepted, fetch the previous highest bidder and call notificationsService.create({ type: 'OUTBID', userId: previousBidder.id, title: 'You have been outbid', link: '/auction/[id]' })"

  - truth: "User receives a push notification when their auction wins (persisted + Expo push for offline)"
    status: failed
    reason: "auctions.service.ts calls notificationsGateway.sendNotification() directly for AUCTION_WON and AUCTION_ENDED events, bypassing notificationsService.create(). This means: (1) notifications are not persisted to the database, (2) they do not appear in the notifications inbox, (3) offline users do not receive Expo push notifications."
    artifacts:
      - path: "backend/src/auctions/auctions.service.ts"
        issue: "Lines 436, 447, 489 call notificationsGateway.sendNotification() directly. Must use notificationsService.create() to get persistence + Expo push delivery."
    missing:
      - "Replace notificationsGateway.sendNotification() calls in notifyAuctionEnd() with notificationsService.create()"
      - "Same fix needed for the HANDOVER_APPROVED/HANDOVER_DENIED notifications in admin.service.ts (lines 202, 245) — these already call notificationsService.create() correctly, so only the auction-win path needs fixing"
      - "Inject NotificationsService into AuctionsService (currently only NotificationsGateway is injected)"

  - truth: "Real-time socket bridge delivers notifications to the mobile app"
    status: failed
    reason: "Auth mechanism mismatch: notifications.gateway.ts authenticates via req.session.userId (cookie-based session), but the mobile getNotifSocket() sends auth: { token } (Supabase JWT). The gateway will always read userId as undefined and immediately disconnect the mobile client."
    artifacts:
      - path: "backend/src/notifications/notifications.gateway.ts"
        issue: "Line 45: const userId = req?.session?.userId — expects server-side session cookie, never populated by mobile WebSocket connections"
      - path: "mobile/src/lib/socket/index.ts"
        issue: "Line 40: auth: { token } — sends Supabase JWT bearer token, not a session cookie"
    missing:
      - "Gateway handleConnection() must read the JWT from client.handshake.auth.token, verify it via Supabase (supabase.auth.getUser(token)), and extract userId from the Supabase user object"
      - "Example fix: const token = client.handshake.auth?.token; const { data } = await supabase.auth.getUser(token); const userId = data.user?.id;"

  - truth: "Developer can install a dev build on a physical device (EAS projectId configured)"
    status: failed
    reason: "app.json extra.eas.projectId is still set to the placeholder string 'REPLACE_WITH_REAL_PROJECT_ID_FROM_EAS_DASHBOARD'. usePushNotifications.ts has a guard that detects this and returns null, blocking all push token registration. The developer must run eas build:configure to obtain a real project ID."
    artifacts:
      - path: "mobile/app.json"
        issue: "Line 69: projectId is 'REPLACE_WITH_REAL_PROJECT_ID_FROM_EAS_DASHBOARD' — placeholder not replaced"
    missing:
      - "Run: cd mobile && eas build:configure (or create project at expo.dev and copy the project ID)"
      - "Replace the placeholder value in mobile/app.json extra.eas.projectId"
      - "This is a developer action, not a code change — mark as human_needed"

human_verification:
  - test: "Run eas build --profile development and install on a physical Android or iOS device"
    expected: "Build completes successfully, installs via QR code or direct link, and the Expo dev client launches on the device"
    why_human: "Requires EAS credentials, Apple/Google developer accounts, and a physical device. Cannot verify programmatically."
  - test: "With real EAS projectId in app.json, open app on physical device after login — check that an Expo push token appears in console and is saved to the user record in the database"
    expected: "Console logs '[Push] Token: ExponentPushToken[...]' and '[Push] Token saved to backend'. Database user.preferences.expoPushToken is populated."
    why_human: "Requires physical device (Device.isDevice guard returns false on simulator), real EAS projectId, and database inspection."
  - test: "Place a bid on an auction from Device A, verify Device B (the outbid user) receives a push notification"
    expected: "Device B shows a notification banner titled 'You have been outbid' with a deep-link to the auction"
    why_human: "Requires two physical devices, a live auction, and the OUTBID gap to be fixed first."
  - test: "Close the app completely on a device, then have another user place a bid that outbids them — verify Expo push notification arrives"
    expected: "System-level push notification appears on the device lock screen with correct title, body, and deep-links on tap to the auction screen"
    why_human: "Background/killed state push delivery requires physical device and Expo push infrastructure."
---

# Phase 1: EAS Build and Full Push Notification System — Verification Report

**Phase Goal:** Developer can install a dev build on a physical device, notifications are registered with the backend, and every notification event type (outbid, offer, message, auction win, KYC) is delivered and deep-links correctly.
**Verified:** 2026-05-30
**Status:** gaps_found — 4 blockers preventing goal achievement
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Developer can configure and run EAS dev build | ? HUMAN NEEDED | eas.json + app.json structure correct; projectId is a placeholder — developer action required |
| 2 | App registers push token with backend on login | PARTIAL | Code is complete and wired; blocked by projectId placeholder (returns null before token request) |
| 3 | Android notification channels created at startup | VERIFIED | _layout.tsx lines 47-67: 3 channels at module level |
| 4 | notification-icon.png exists and is referenced | VERIFIED | File exists at mobile/assets/notification-icon.png; app.json line 47 references it |
| 5 | User receives outbid notification | FAILED | No OUTBID notification in bids.service.ts or anywhere in the backend |
| 6 | User receives offer notification | VERIFIED | offers.service.ts lines 116-121: OFFER_RECEIVED via notificationsService.create() with link |
| 7 | User receives offer response notification | VERIFIED | offers.service.ts lines 324-362: OFFER_ACCEPTED/OFFER_REJECTED/OFFER_COUNTERED via notificationsService.create() |
| 8 | User receives auction win notification (persisted + push) | FAILED | auctions.service.ts calls notificationsGateway.sendNotification() directly — not persisted, no Expo push for offline |
| 9 | User receives chat message notification | VERIFIED | chat.service.ts line 216: MESSAGE_RECEIVED via notificationsService.create() — correct path |
| 10 | User receives KYC notification | VERIFIED | admin.service.ts lines 476, 505: KYC_APPROVED/KYC_REJECTED via notificationsService.create() with link |
| 11 | Tapping notification deep-links to correct screen | PARTIAL | Warm-start and cold-start routing implemented; socket bridge broken (auth mismatch blocks foreground delivery) |
| 12 | Socket bridge delivers real-time notifications | FAILED | Gateway reads req.session.userId (always undefined for mobile); mobile sends JWT token in auth handshake |
| 13 | Notifications inbox lists all activity | VERIFIED | notifications/index.tsx: paginated useInfiniteQuery, unread dot, mark-read, deep-link tap |
| 14 | Notifications marked as read when viewed | VERIFIED | markReadMutation on row tap + markAllRead button; wired to backend PATCH endpoints |
| 15 | User can configure notification preferences | VERIFIED | notification-prefs/index.tsx: 4 category switches, saved via SecureStore |
| 16 | User can set quiet hours | VERIFIED | Quiet hours toggle + inline HH:MM time editor; isQuietHours() used in useNotifSocket |

**Score:** 10/16 truths verified (4 failed, 2 partial/human-needed)

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `mobile/eas.json` | VERIFIED | developmentClient: true, distribution: internal |
| `mobile/app.json` | PARTIAL | Structure correct; extra.eas.projectId is placeholder string |
| `mobile/assets/notification-icon.png` | VERIFIED | File exists |
| `mobile/package.json` (expo-notifications, expo-device) | VERIFIED | expo-notifications ~0.29.14, expo-device ~6.0.2 present |
| `mobile/app/_layout.tsx` | VERIFIED | Channels, auth+token registration, warm/cold deep-link, useNotifSocket() |
| `mobile/src/store/notification.store.ts` | VERIFIED | Zustand store with pendingDeepLink, addNotification, markRead, markAllRead |
| `mobile/src/lib/notifications.ts` | VERIFIED | scheduleLocalNotification, prefs helpers, isQuietHours, getNotificationCategory |
| `mobile/src/hooks/usePushNotifications.ts` | VERIFIED | Device guard, permission request, PATCH to /users/me |
| `mobile/src/hooks/useNotifSocket.ts` | VERIFIED (code) | Logic correct; blocked at runtime by socket auth mismatch |
| `mobile/src/lib/socket/index.ts` | PARTIAL | getNotifSocket() sends JWT token; gateway expects session cookie |
| `mobile/app/(tabs)/_layout.tsx` | VERIFIED | pendingDeepLink consumed after navigator mounts |
| `mobile/app/notifications/index.tsx` | VERIFIED | Paginated inbox, mark-read, deep-link tap, empty state |
| `mobile/app/notification-prefs/index.tsx` | VERIFIED | 4 toggles + quiet hours + time editor |
| `mobile/src/constants/api.ts` | VERIFIED | All 4 notification endpoints defined |
| `mobile/src/lib/api/notifications.ts` | VERIFIED | fetchPage, markRead, markAllRead, getUnreadCount |
| `backend/src/notifications/notifications.service.ts` | VERIFIED | create() with DB persist + socket + Expo push; pushToExpo() + getChannelId() |
| `backend/src/notifications/notifications.gateway.ts` | PARTIAL | isUserConnected() present; handleConnection() uses wrong auth (session vs JWT) |
| `backend/src/users/users.service.ts` | VERIFIED | updateProfile() shallow-merges preferences correctly |
| `backend/package.json` (expo-server-sdk) | VERIFIED | expo-server-sdk ^6.1.0 present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_layout.tsx` | `usePushNotifications.ts` | `registerForPushNotificationsAsync()` import | WIRED | Called in auth state change callback |
| `_layout.tsx` | `/users/me` PATCH | `apiRequest(ENDPOINTS.USERS_ME)` in hook | WIRED | Token saved to backend on login |
| `_layout.tsx` | `useNotifSocket` | `useNotifSocket()` call | WIRED | Called at root layout level |
| `_layout.tsx` | `notification.store` | `setPendingDeepLink` | WIRED | Cold-start path stores link in Zustand |
| `(tabs)/_layout.tsx` | router | `router.push(pendingDeepLink)` | WIRED | Consumed once tab navigator mounts |
| `useNotifSocket` | `socket/index.ts` | `getNotifSocket()` | WIRED | Import resolves to `src/lib/socket/index.ts` |
| `useNotifSocket` | `notification.store` | `addNotification()` | WIRED | Called on `notification:new` event |
| `useNotifSocket` | `scheduleLocalNotification` | direct call after prefs check | WIRED | Foreground banner delivery |
| Mobile socket | Backend gateway `/notifications` | `auth: { token }` (JWT) | NOT WIRED | Gateway reads `req.session.userId` — always undefined for mobile connections; immediate disconnect |
| `bids.service.ts` | `NotificationsService` | `create({ type: 'OUTBID' })` | NOT WIRED | No import or call exists |
| `auctions.service.ts` | `NotificationsService` | `create({ type: 'AUCTION_WON' })` | NOT WIRED | Uses `notificationsGateway.sendNotification()` directly — bypasses persistence and Expo push |
| `notifications/index.tsx` | `notificationsApi.fetchPage` | `useInfiniteQuery` | WIRED | Paginated API calls |
| `notifications/index.tsx` | `notificationsApi.markRead` | `useMutation` on row tap | WIRED | |
| Backend `create()` | Expo push | `pushToExpo()` when `!isUserConnected()` | WIRED | Correct conditional delivery |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| INFRA-01 | EAS dev build installable on physical device | HUMAN NEEDED | Configuration in place; projectId placeholder blocks actual build |
| INFRA-02 | App registers push token in user preferences | PARTIAL | Code correct; runtime-blocked by projectId placeholder |
| INFRA-03 | Android notification channel at startup | VERIFIED | _layout.tsx module-level: 3 channels |
| INFRA-04 | notification-icon.png exists and referenced | VERIFIED | File present; app.json plugin config references it |
| INFRA-05 | extra.eas.projectId configured | FAILED | Placeholder value not replaced; developer action required |
| INFRA-06 | gifted-charts + react-native-svg installed | VERIFIED | package.json: react-native-gifted-charts ^1.4.77, react-native-svg ~15.8.0 |
| PUSH-01 | Outbid notification (foreground + background) | FAILED | No OUTBID notification in backend; bids.service.ts has no NotificationsService |
| PUSH-02 | New offer notification | VERIFIED | offers.service.ts: OFFER_RECEIVED with link /dashboard/seller/offers |
| PUSH-03 | Offer accepted/rejected/countered notification | VERIFIED | offers.service.ts: OFFER_ACCEPTED, OFFER_REJECTED via notificationsService.create() |
| PUSH-04 | Auction win notification + chat room created | FAILED | AUCTION_WON sent via gateway directly — not persisted, no Expo push for offline users |
| PUSH-05 | Chat message notification when backgrounded | VERIFIED | chat.service.ts: MESSAGE_RECEIVED via notificationsService.create() |
| PUSH-06 | Deep-link on notification tap | PARTIAL | Routing code correct; socket bridge broken (auth mismatch prevents foreground delivery) |
| PUSH-07 | Notifications inbox screen | VERIFIED | Full paginated screen with error/empty states |
| PUSH-08 | Mark as read when viewed | VERIFIED | Per-notification and bulk mark-read wired |
| PUSH-09 | Notification preferences by category | VERIFIED | 4 toggles persisted to SecureStore |
| PUSH-10 | Quiet hours suppression | VERIFIED | isQuietHours() used in useNotifSocket; inline time editor |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mobile/app.json` | 69 | `"REPLACE_WITH_REAL_PROJECT_ID_FROM_EAS_DASHBOARD"` | BLOCKER | getExpoPushTokenAsync() is never called; all push registration silently returns null |
| `backend/src/auctions/auctions.service.ts` | 436, 447, 489 | `notificationsGateway.sendNotification()` called directly | BLOCKER | Auction win/end notifications not persisted to DB; offline users get no Expo push |
| `backend/src/notifications/notifications.gateway.ts` | 45 | `req?.session?.userId` for WebSocket auth | BLOCKER | Mobile clients always disconnected; real-time delivery never works |
| `backend/src/bids/bids.service.ts` | entire file | No OUTBID notification | BLOCKER | PUSH-01 entirely unimplemented |

---

## Human Verification Required

### 1. EAS Dev Build on Physical Device

**Test:** Run `cd mobile && eas build:configure`, replace the projectId placeholder, then run `eas build --profile development` and install via QR code on a physical Android or iOS device.
**Expected:** Build succeeds and installs. Expo dev client launches. After login, console shows `[Push] Token: ExponentPushToken[...]` and `[Push] Token saved to backend`.
**Why human:** Requires EAS account credentials, Apple/Google developer accounts, and a physical device.

### 2. End-to-End Push Notification Delivery (Background)

**Test:** After the socket auth mismatch gap is fixed — log into the app on a physical device, background the app, trigger an offer from another account. Verify that an Expo push notification arrives on the device lock screen.
**Expected:** System notification appears with correct title, body. Tapping it opens the app to the correct screen.
**Why human:** Background push requires physical device and the Expo push infrastructure (EAS projectId must be real).

### 3. Notifications Inbox Scroll and Load More

**Test:** Create more than 20 notifications for a test user. Open the notifications inbox and scroll to the bottom.
**Expected:** Additional notifications load (infinite scroll pagination works).
**Why human:** Requires backend test data generation and UI interaction.

---

## Gaps Summary

Four blockers prevent the phase goal from being achieved:

**Gap 1 — Missing OUTBID notification (PUSH-01):** The `bids.service.ts` never notifies the previous highest bidder that they were outbid. This is the most impactful missing feature — every bid placed silently displaces the previous bidder with no notification. Fix: inject `NotificationsService` into `BidsService`, fetch the previous highest bidder before creating the new bid, and call `notificationsService.create()`.

**Gap 2 — Auction win notifications bypass the persistence layer (PUSH-04):** `auctions.service.ts` calls `notificationsGateway.sendNotification()` directly for `AUCTION_WON` and `AUCTION_ENDED`. This skips `notificationsService.create()`, so these notifications are never stored in the database (do not appear in the inbox) and offline users never receive Expo push notifications. Fix: change these calls to go through `notificationsService.create()`.

**Gap 3 — Socket auth mismatch (PUSH-06, PUSH-01 foreground path):** The notifications gateway authenticates via `req.session.userId` (express-session cookie), which is never populated by WebSocket connections from the React Native app. The mobile client sends a Supabase JWT in the Socket.IO `auth` handshake. Every mobile socket connection is immediately disconnected. Fix: read `client.handshake.auth.token`, verify it with `supabase.auth.getUser(token)`, and extract userId from the result.

**Gap 4 — EAS projectId placeholder (INFRA-01, INFRA-02, INFRA-05):** This is a developer action item, not a code bug. The `usePushNotifications.ts` guard correctly detects the placeholder and returns null — no push tokens will ever be registered until the real project ID is inserted. This blocks end-to-end testing of all push notification flows on physical devices.

Gaps 1–3 are code defects. Gap 4 is a configuration action that the developer must perform before testing.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
