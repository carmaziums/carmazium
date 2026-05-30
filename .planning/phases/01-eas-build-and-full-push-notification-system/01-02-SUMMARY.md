---
plan: "01-02"
status: complete
completed: 2026-05-30
---

# Plan 01-02 Summary: Backend Push Delivery

## What Was Built

Added server-side Expo push notification delivery to the NestJS backend, fixed the gateway circular dependency, and patched the preferences merge bug in UsersService.

## Key Files Modified

- **`backend/src/notifications/notifications.gateway.ts`**
  - Added `isUserConnected(userId: string): boolean` — reads the existing `connectedUsers` Map to check active socket presence
  - Fixed circular dependency: constructor now uses `@Inject(forwardRef(() => NotificationsService))`

- **`backend/src/notifications/notifications.service.ts`**
  - Injected `NotificationsGateway` via `@Inject(forwardRef(() => NotificationsGateway))` (both sides of circular dep now use forwardRef)
  - Added `expo-server-sdk` import (`Expo`, `ExpoPushMessage`, `ExpoPushTicket`)
  - Updated `create()`: now calls `notificationsGateway.sendNotification()` for foreground socket delivery, then conditionally calls `pushToExpo()` for offline users
  - Added `pushToExpo()` private method — validates token, builds `ExpoPushMessage`, sends via `expo.sendPushNotificationsAsync()`
  - Added `getChannelId()` private helper — maps notification type to `carmazium-bids`, `carmazium-messages`, or `carmazium-default`

- **`backend/src/users/users.service.ts`**
  - Fixed preferences full-replace bug: now shallow-merges `{ ...existing.preferences, ...data.preferences }` so partial PATCH (e.g. just `expoPushToken`) preserves other keys

- **`backend/package.json`** — `expo-server-sdk@^6.1.0` added

## Deviations

None. All tasks executed exactly as planned. `notifications.module.ts` was intentionally left unchanged — same-module circular deps resolve with constructor-level `forwardRef` alone.

## Self-Check

- [x] `isUserConnected()` in `notifications.gateway.ts`
- [x] `forwardRef` on both sides of the circular dependency
- [x] `pushToExpo()` in `notifications.service.ts`
- [x] `create()` calls both socket emit and conditional Expo push
- [x] `getChannelId()` returns correct channel per notification type
- [x] `users.service.ts` shallow-merges preferences
- [x] `expo-server-sdk` in `backend/package.json`

## Commit

`c2de8f1a` — feat(phase-1): backend push delivery — Expo SDK, isUserConnected, pushToExpo, preferences merge fix
