---
plan: "01-03"
status: complete
completed: 2026-05-30
---

# Plan 01-03 Summary: Push Token Registration + Notification Infrastructure

## What Was Built

Complete mobile-side push notification pipeline — store, lib helpers, two hooks, and both app layouts updated.

## Key Files Created/Modified

- **`mobile/src/store/notification.store.ts`** — Zustand store: `unreadCount`, `notifications[]`, `pendingDeepLink`. Actions: `addNotification`, `markRead`, `markAllRead`, `setPendingDeepLink`, `clearPendingDeepLink`.

- **`mobile/src/lib/notifications.ts`** — Notification helpers: `scheduleLocalNotification()` (with both `categoryIdentifier` iOS + `android.channelId` for Android 8+), `getNotificationPreferences()`, `saveNotificationPreferences()`, `isQuietHours()`, `getNotificationCategory()`, `DEFAULT_PREFS`.

- **`mobile/src/hooks/usePushNotifications.ts`** — `registerForPushNotificationsAsync()`: `Device.isDevice` guard, permission request, EAS projectId check, `getExpoPushTokenAsync()`, PATCH to `/users/me` preferences.

- **`mobile/src/hooks/useNotifSocket.ts`** — `useNotifSocket()` hook: subscribes to `notification:new` on `/notifications` socket, updates Zustand store, checks prefs/quiet hours before calling `scheduleLocalNotification()`.

- **`mobile/app/_layout.tsx`** — Added: module-level `setNotificationHandler` + 3 Android channels (`carmazium-default`, `carmazium-bids`, `carmazium-messages`). Auth callback calls `registerForPushNotificationsAsync()` and sets up `addPushTokenListener` with `tokenSubRef` cleanup. Separate `useEffect` for warm-start (`addNotificationResponseReceivedListener`) and cold-start (`getLastNotificationResponseAsync` → `setPendingDeepLink`). Calls `useNotifSocket()`. Added `notifications/index` and `notification-prefs/index` Stack routes.

- **`mobile/app/(tabs)/_layout.tsx`** — Added `useEffect` that reads `pendingDeepLink` from Zustand and calls `router.push()` once tab navigator is mounted — solves cold-start deep-link race condition.

- **`mobile/package.json`** — Added `expo-device@~6.0.2`.

## Self-Check

- [x] Android notification channels at module level (before component)
- [x] `registerForPushNotificationsAsync()` called after auth session confirmed
- [x] `tokenSubRef` pattern prevents stale token-rotation listeners on re-auth
- [x] Cold-start deep link via Zustand `pendingDeepLink` → consumed by tab navigator
- [x] `scheduleLocalNotification` passes `android: { channelId }` for Android 8+
- [x] `expo-device` in package.json

## Commit

`3c818340` — feat(phase-1): mobile push pipeline — store, notifications lib, hooks, deep-link routing, Android channels
