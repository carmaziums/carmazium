# Phase 1: EAS Build and Full Push Notification System — Research

**Researched:** 2026-05-30
**Domain:** EAS Build (Expo SDK 52), expo-notifications ~0.29, expo-server-sdk v6, Expo Router 4 deep linking
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Developer can run EAS build with development profile and install on physical device | EAS Build setup (eas.json, eas build --profile development), expo-dev-client |
| INFRA-02 | App registers for Expo push notifications and stores device token in user preferences on backend | registerForPushNotificationsAsync hook, PATCH /users/me with preferences.expoPushToken |
| INFRA-03 | Android notification channel created at app startup | setNotificationChannelAsync in _layout.tsx before any other notification call |
| INFRA-04 | notification-icon.png (96×96 white-on-transparent) exists and is referenced in app.json | Asset creation + app.json expo-notifications plugin config already references it |
| INFRA-05 | extra.eas.projectId is configured in app.json | eas project:init / eas build:configure populates projectId; required for getExpoPushTokenAsync |
| INFRA-06 | react-native-gifted-charts and react-native-svg installed and working | npx expo install react-native-gifted-charts react-native-svg |
| PUSH-01 | Push notification when outbid in live auction (foreground + background) | Dual-delivery: Socket.IO foreground + Expo Push API background |
| PUSH-02 | Push notification when new offer made on a listing | Backend NotificationsService.create() calls pushToExpo() after DB write |
| PUSH-03 | Push notification when offer accepted/rejected/countered | Same backend push path, different type/link |
| PUSH-04 | Push notification when auction won and chat room created | Same backend push path, link points to /messages/[roomId] |
| PUSH-05 | Push notification for new chat message while backgrounded | Socket.IO /chat namespace event triggers Expo push from backend |
| PUSH-06 | Tapping notification deep-links to correct screen | addNotificationResponseReceivedListener + router.push(data.link) with routerReady guard |
| PUSH-07 | Notification inbox listing all activity alerts | GET /notifications (paginated), existing dashboardApi.notifications() |
| PUSH-08 | Notifications marked as read when viewed | PATCH /notifications/:id/read, PATCH /notifications/read-all |
| PUSH-09 | Notification preferences by category with on/off toggles | Client-side AsyncStorage/SecureStore; filter applied before scheduling local notification |
| PUSH-10 | Quiet hours during which push notifications are suppressed | Client-side quiet hours window stored in AsyncStorage; checked in notification handler |
</phase_requirements>

---

## Summary

Phase 1 establishes the full push notification pipeline for Carmazium's mobile app. The infrastructure work (INFRA-01 through INFRA-06) gates everything: EAS Build must produce a development client before any push notification code can be tested on a physical device, because Expo Go on Android no longer delivers push notifications as of SDK 52.

The push notification architecture uses a dual-delivery model: Socket.IO `/notifications` namespace delivers `notification:new` events while the app is in the foreground, and Expo Push API (via FCM on Android, APNs on iOS) delivers notifications when the app is backgrounded or killed. The backend gap is small — `NotificationsService.create()` needs ~25 lines added to read `user.preferences.expoPushToken` and POST to the Expo Push API using expo-server-sdk v6. No schema migration is needed; the `preferences Json?` column on the User model already exists and `updateProfile()` already writes to it.

The notification inbox (PUSH-07/08) is powered by existing backend endpoints (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count`) that are already implemented and wired through the controller. Preferences and quiet hours (PUSH-09/10) are implemented client-side only — no backend changes needed.

**Primary recommendation:** Build in this order: (1) create `notification-icon.png` asset, (2) run `eas build:configure` to get projectId, (3) wire Android channel + token registration in `_layout.tsx`, (4) add `pushToExpo()` to backend `NotificationsService`, (5) notification inbox screen, (6) preferences screen, (7) install react-native-gifted-charts.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-notifications` | `~0.29.14` | Push token registration, local notifications, notification listeners | Official Expo SDK; handles FCM/APNs token abstraction |
| `expo-constants` | `~17.0.8` | Read `extra.eas.projectId` for `getExpoPushTokenAsync` | Required for project ID resolution |
| `expo-device` | (transitive) | `Device.isDevice` guard — skip token on simulators | APNs hangs indefinitely on iOS Simulator |
| `socket.io-client` | `^4.8.3` | Foreground notification delivery via `/notifications` namespace | Already in use |
| `expo-secure-store` | `~14.0.1` | Store notification preferences (category toggles, quiet hours) | Already installed; appropriate for user settings |
| `@react-native-async-storage/async-storage` | `1.23.1` | Fallback for non-sensitive notification preferences | Already installed |
| `expo-router` | `~4.0.20` | Deep link navigation from notification tap | Already in use |

### New (backend only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-server-sdk` | `^6.1.0` (npm) | Server-side Expo Push API client | Official Expo SDK; handles batching, receipts, error codes |

### New (mobile)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-svg` | `~15.8.0` | Peer dependency for react-native-gifted-charts | Expo-managed version for SDK 52 |
| `react-native-gifted-charts` | `^1.4.77` | Bar/line charts for dealer analytics | Built on react-native-svg; no Skia dependency; expo-linear-gradient already present |

### Installation
```bash
# From mobile/ directory
npx expo install react-native-svg react-native-gifted-charts

# From backend/ directory
npm install expo-server-sdk
```

---

## Architecture Patterns

### Recommended File Structure (Phase 1 additions)
```
mobile/
├── assets/
│   └── notification-icon.png          # 96×96 white-on-transparent PNG (NEW — required before EAS Build)
├── app/
│   ├── _layout.tsx                    # MODIFY: Android channel + usePushNotifications + notification response listener
│   └── notifications/
│       └── index.tsx                  # NEW: notification inbox screen
├── src/
│   ├── constants/
│   │   └── api.ts                     # MODIFY: add NOTIFICATIONS_READ, NOTIFICATIONS_READ_ALL, NOTIFICATIONS_UNREAD_COUNT
│   ├── hooks/
│   │   ├── usePushNotifications.ts    # NEW: token registration + rotation listener
│   │   └── useNotifSocket.ts          # NEW: Socket.IO bridge → local push
│   ├── lib/
│   │   └── notifications.ts           # NEW: scheduleLocalNotification(), notification preference helpers
│   └── store/
│       └── notifications.store.ts     # NEW: unread count badge, pending deep-link URL

backend/
└── src/
    └── notifications/
        └── notifications.service.ts   # MODIFY: add pushToExpo() + call from create()
```

---

## 1. EAS Build Setup

### Exact Commands (run from mobile/ directory)
```bash
npm install -g eas-cli           # Developer machine only — not in package.json
eas login                        # Authenticate with Expo account
eas build:configure              # Creates eas.json + writes projectId into app.json
```

`eas build:configure` is the correct command (not `eas project:init`). It:
- Creates `mobile/eas.json` with default profiles
- Writes `extra.eas.projectId` into `app.json` automatically
- Asks which platforms to configure (answer: All)

### eas.json — Exact Structure
Create `mobile/eas.json` (or let `eas build:configure` create it, then edit):

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "airafadil619@gmail.com",
        "ascAppId": "FILL_IN_AFTER_APP_STORE_CONNECT_REGISTRATION",
        "appleTeamId": "FILL_IN_FROM_APPLE_DEVELOPER_ACCOUNT"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**`developmentClient: true`** means the build includes expo-dev-client (developer tools) and targets internal distribution. These builds are never submitted to app stores.

### app.json Additions Required
After `eas build:configure` runs, `app.json` will have this added automatically:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

Also add `google-services.json` reference for Android FCM (required for real Android push tokens):
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

`google-services.json` comes from Firebase Console (create a project for `co.carmazium.app`). Add it to `.gitignore`.

### Build Commands
```bash
# Install dev build on physical Android device
eas build --profile development --platform android

# Install dev build on physical iOS device
eas build --profile development --platform ios

# Install on connected Android device directly
eas build --profile development --platform android --local
```

### Credential Provisioning
- **iOS**: EAS manages provisioning profiles automatically from Apple Developer account. Run `eas credentials` if prompted. Apple Developer Program membership required.
- **Android**: EAS generates and manages the signing keystore on first build automatically.

---

## 2. Android Notification Channel

### Where to Place It
In `mobile/app/_layout.tsx`, call `setNotificationChannelAsync` **before** any other notification API, at module level (outside the component function) or as the first action in the root layout effect.

### Exact Code Pattern
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/notifications/
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Call at module level — before component definition
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('carmazium-default', {
    name: 'Carmazium Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ff0037',
    showBadge: true,
  });
  Notifications.setNotificationChannelAsync('carmazium-bids', {
    name: 'Auction Bids',
    importance: Notifications.AndroidImportance.MAX,   // MAX = heads-up display
    vibrationPattern: [0, 100, 100, 100],
    lightColor: '#ff0037',
    showBadge: true,
  });
  Notifications.setNotificationChannelAsync('carmazium-messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    showBadge: true,
  });
}
```

**Why THREE channels:** Android users can independently silence message notifications while keeping auction bid alerts at maximum importance. The backend must include `channelId` on every push payload it sends.

**Critical:** `AndroidImportance.MAX` is required for heads-up (banner on top of screen) behavior. `HIGH` allows sound/vibration but may not show a banner depending on device manufacturer. Use `MAX` for time-sensitive auction events.

---

## 3. Push Token Registration

### Full Pattern for `usePushNotifications.ts`
```typescript
// Source: https://docs.expo.dev/push-notifications/push-notifications-setup/
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiRequest } from '@/lib/api/client';
import { ENDPOINTS } from '@/constants/api';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // iOS Simulator: getExpoPushTokenAsync hangs indefinitely — must guard
    console.log('Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    // Android channel must exist before token registration
    await Notifications.setNotificationChannelAsync('carmazium-default', {
      name: 'Carmazium Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff0037',
      showBadge: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.error('EAS projectId missing from app.json — run eas build:configure');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;  // e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

### How to Call It in `_layout.tsx`
```typescript
// Inside the onAuthStateChange callback, after setUser(user) succeeds:
const token = await registerForPushNotificationsAsync();
if (token) {
  // Merge into preferences — does not overwrite other preference keys
  await apiRequest(ENDPOINTS.USERS_ME, {
    method: 'PATCH',
    body: { preferences: { expoPushToken: token } },
  });
}

// Also subscribe to token rotation
const tokenListener = Notifications.addPushTokenListener(async ({ data: newToken }) => {
  await apiRequest(ENDPOINTS.USERS_ME, {
    method: 'PATCH',
    body: { preferences: { expoPushToken: newToken } },
  });
});
// return () => tokenListener.remove();  // cleanup
```

**CRITICAL — preferences merge issue:** The current `updateProfile()` in `users.service.ts` does a full replace on `preferences`:
```typescript
...(data.preferences !== undefined && { preferences: data.preferences }),
```
This **overwrites** the entire JSON column. When posting `{ preferences: { expoPushToken: token } }`, any existing preference keys (quiet hours, category toggles) will be erased. The planner must decide between:
- **Option A (recommended):** Modify `updateProfile()` to shallow-merge preferences: `preferences: { ...existingPreferences, ...data.preferences }`
- **Option B (simpler but risky):** Mobile reads current preferences first, merges locally, then writes the full object back

Option A requires a one-line backend change. Document this as a required task.

---

## 4. Dual-Delivery Architecture

### setNotificationHandler (background behavior)
```typescript
// Place at module level in _layout.tsx or notifications.ts — before any component
// Source: https://docs.expo.dev/push-notifications/receiving-notifications/
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,   // Show banner when app is foregrounded
    shouldShowList: true,     // Show in notification center
    shouldPlaySound: true,
    shouldSetBadge: false,    // Badge count managed manually
  }),
});
```

### Foreground Listener (addNotificationReceivedListener)
```typescript
// Receives push notifications delivered while app is open
// ALSO fires for local scheduled notifications
const notifListener = Notifications.addNotificationReceivedListener((notification) => {
  const data = notification.request.content.data;
  // Update Zustand unread count badge
  useNotificationsStore.getState().incrementUnread();
});
```

### Socket.IO → Local Notification Bridge
When Socket.IO delivers `notification:new` while the app is in the foreground, the app schedules a local notification so the system banner appears:

```typescript
// mobile/src/lib/notifications.ts
import * as Notifications from 'expo-notifications';

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId = 'carmazium-default',
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(channelId && { categoryIdentifier: channelId }),  // iOS category
    },
    trigger: null,  // null = deliver immediately
  });
}
```

```typescript
// mobile/src/hooks/useNotifSocket.ts
import { useEffect } from 'react';
import { getNotifSocket } from '@/lib/socket';
import { scheduleLocalNotification } from '@/lib/notifications';
import { useNotificationsStore } from '@/store/notifications.store';

export function useNotifSocket() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    getNotifSocket().then((socket) => {
      const handler = (notification: any) => {
        // Increment badge
        useNotificationsStore.getState().addNotification(notification);
        // Show system banner via local push
        scheduleLocalNotification(
          notification.title,
          notification.message,
          {
            notifId: notification.id,
            type: notification.type,
            link: notification.data?.link ?? null,
          },
        );
      };
      socket.on('notification:new', handler);
      cleanup = () => socket.off('notification:new', handler);
    });

    return () => cleanup?.();
  }, []);
}
```

**Why bridge socket events to local notifications:** The system notification banner (heads-up) only appears from either a real push notification or a scheduled local notification. Socket events alone update state but cannot show system banners. The bridge is the correct pattern.

### Presence Flag (prevents duplicate delivery)
The backend should not fire Expo Push API when the user has an active socket connection. The gateway's `connectedUsers` Map already tracks which users are connected to `/notifications`. The `pushToExpo()` function should check this:

```typescript
// In NotificationsGateway — expose a method
isUserConnected(userId: string): boolean {
  const socketIds = this.connectedUsers.get(userId);
  return !!socketIds && socketIds.length > 0;
}
```

```typescript
// In NotificationsService.create() — only push if user is offline
if (!this.notificationsGateway.isUserConnected(dto.userId)) {
  await this.pushToExpo(expoPushToken, { title, body, data });
}
```

This requires injecting `NotificationsGateway` into `NotificationsService`. Both are in the same NestJS module — add `NotificationsGateway` to `NotificationsService`'s constructor.

---

## 5. Backend Changes — NotificationsService

### Install expo-server-sdk in Backend
```bash
# From backend/ directory
npm install expo-server-sdk
```

### Add pushToExpo() to notifications.service.ts

```typescript
// Source: https://github.com/expo/expo-server-sdk-node
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// At class level — one shared instance
private readonly expo = new Expo();

private async pushToExpo(
  token: string,
  payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string },
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    this.logger?.warn(`Invalid Expo push token: ${token}`);
    return;
  }

  const message: ExpoPushMessage = {
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    channelId: payload.channelId ?? 'carmazium-default',  // REQUIRED for Android — matches channel created on device
    sound: 'default',
    priority: 'high',
  };

  const chunks = this.expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
      // Handle DeviceNotRegistered in receipts — check after 15+ minutes for async receipts
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // Clear the stale token from this user's preferences
            // (userId needs to be passed in or looked up)
            this.logger?.warn('DeviceNotRegistered — token should be cleared');
          }
        }
      }
    } catch (err) {
      this.logger?.error('Expo push send failed', err);
    }
  }
}
```

### Modify create() to call pushToExpo()

```typescript
async create(dto: CreateNotificationDto) {
  const { link, ...prismaFields } = dto;
  const mergedData = { ...(dto.data || {}), ...(link ? { link } : {}) };

  // Write to DB first
  const notification = await this.prisma.notification.create({
    data: {
      ...prismaFields,
      data: Object.keys(mergedData).length > 0 ? mergedData : undefined,
    },
  });

  // Emit real-time (foreground)
  this.notificationsGateway.sendNotification(dto.userId, notification);

  // Push to device if user is offline (background/killed state)
  if (!this.notificationsGateway.isUserConnected(dto.userId)) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { preferences: true },
    });
    const prefs = user?.preferences as Record<string, any> | null;
    const expoPushToken = prefs?.expoPushToken;
    if (expoPushToken) {
      await this.pushToExpo(expoPushToken, {
        title: dto.title,
        body: dto.message,
        data: { ...mergedData, notifId: notification.id },
        channelId: this.getChannelId(dto.type),
      });
    }
  }

  return notification;
}

private getChannelId(type: string): string {
  if (type.includes('BID') || type.includes('AUCTION')) return 'carmazium-bids';
  if (type.includes('MESSAGE') || type.includes('CHAT')) return 'carmazium-messages';
  return 'carmazium-default';
}
```

**Constructor update required:**
```typescript
// notifications.service.ts constructor
constructor(
  private readonly prisma: PrismaService,
  private readonly notificationsGateway: NotificationsGateway,  // ADD
) {}
```

This requires a circular dependency fix: `NotificationsGateway` is currently in the same module but declared as a provider alongside `NotificationsService`. Use `forwardRef` if NestJS complains, or inject via `ModuleRef`.

**Simplest fix:** Use `@Inject(forwardRef(() => NotificationsGateway))` on the gateway parameter and add `forwardRef` wrapping in the module imports. Both are in `NotificationsModule` — this is typically not circular but add `forwardRef` defensively.

---

## 6. Deep Link Routing

### Notification Response Handler Pattern
```typescript
// In mobile/app/_layout.tsx useEffect (after fonts loaded + auth wired)
// Source: https://docs.expo.dev/push-notifications/receiving-notifications/

import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useNotificationsStore } from '@/store/notifications.store';

// Inside RootLayout component:
const router = useRouter();
const { setPendingDeepLink } = useNotificationsStore();

useEffect(() => {
  // Handle notification tap while app is running (foreground or background)
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link as string | undefined;
    if (link) {
      router.push(link as any);
    }
  });

  // Handle cold start: app was killed, user tapped notification to open
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const link = response.notification.request.content.data?.link as string | undefined;
      if (link) {
        // Router may not be ready yet — store as pending and navigate from tab navigator
        setPendingDeepLink(link);
      }
    }
  });

  return () => responseListener.remove();
}, []);
```

**Cold-start guard:** On iOS, `router.push()` called synchronously before the navigator is mounted will throw. Store the pending link in Zustand, then in `app/(tabs)/_layout.tsx` consume it in a `useEffect`:
```typescript
useEffect(() => {
  const pending = useNotificationsStore.getState().pendingDeepLink;
  if (pending) {
    useNotificationsStore.getState().clearPendingDeepLink();
    router.push(pending as any);
  }
}, []);
```

### Deep Link Mapping by Notification Type

| Notification Type | Backend `link` value | Expo Router path |
|------------------|---------------------|-----------------|
| OUTBID | `/auction/${auctionId}` | `app/auction/[id].tsx` — already registered in _layout.tsx |
| OFFER_RECEIVED | `/offers/${offerId}` | Needs `offer/[id]` route in _layout.tsx |
| OFFER_ACCEPTED / REJECTED / COUNTERED | `/offers/${offerId}` | Same |
| AUCTION_WIN | `/messages/${roomId}` | `app/messages/[roomId].tsx` — already registered |
| MESSAGE | `/messages/${roomId}` | Same |
| KYC_APPROVED / KYC_REJECTED | `/profile` | Tab route |

The backend `CreateNotificationDto` already has a `link` field and `NotificationsService.create()` merges it into the `data` JSON column. Mobile reads it as `notification.request.content.data.link`.

---

## 7. Notification Inbox Screen (PUSH-07, PUSH-08)

### API Shape
`GET /notifications?page=1&limit=20` returns:
```typescript
interface PaginatedResponse<Notification> {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
}

interface Notification {
  id: string;
  userId: string;
  type: string;        // e.g. "OUTBID", "OFFER_RECEIVED", "MESSAGE"
  title: string;
  message: string;
  data: Record<string, any> | null;  // contains { link, notifId, ... }
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}
```

### Mark-as-Read Pattern
```typescript
// Single notification read on tap
await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });

// Mark all read (tap "Mark all read" button)
await apiRequest('/notifications/read-all', { method: 'PATCH' });
```

### Constants to Add to api.ts
```typescript
NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
NOTIFICATIONS_READ_ALL: '/notifications/read-all',
NOTIFICATIONS_UNREAD_COUNT: '/notifications/unread-count',
```

### dashboardApi Addition
```typescript
// In dashboard.ts
notificationsPage: (page = 1, limit = 20) =>
  apiRequest<PaginatedResponse<Notification>>(ENDPOINTS.NOTIFICATIONS, {
    params: { page, limit },
  }),
unreadCount: () =>
  apiRequest<{ count: number }>(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT),
```

### Notifications Zustand Store Shape
```typescript
// mobile/src/store/notifications.store.ts
interface NotificationsState {
  unreadCount: number;
  notifications: Notification[];
  pendingDeepLink: string | null;
  // Actions
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setPendingDeepLink: (link: string) => void;
  clearPendingDeepLink: () => void;
}
```

---

## 8. Notification Preferences Screen (PUSH-09, PUSH-10)

### Storage Strategy
Notification preferences are **client-side only** — no backend changes needed. Store in `expo-secure-store` (already installed).

```typescript
// mobile/src/lib/notifications.ts — preference helpers

export interface NotificationPreferences {
  bids: boolean;
  offers: boolean;
  messages: boolean;
  system: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;   // "22:00"
  quietEnd: string;     // "08:00"
}

const PREFS_KEY = 'notification_preferences';
const DEFAULT_PREFS: NotificationPreferences = {
  bids: true,
  offers: true,
  messages: true,
  system: true,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const raw = await SecureStore.getItemAsync(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const current = await getNotificationPreferences();
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}
```

### How Preferences Affect Notification Filtering
The preference check happens in `useNotifSocket.ts` and in `addNotificationReceivedListener`, **before** calling `scheduleLocalNotification`:

```typescript
// In useNotifSocket handler:
const prefs = await getNotificationPreferences();

// Check quiet hours
if (prefs.quietHoursEnabled && isQuietHours(prefs.quietStart, prefs.quietEnd)) {
  return;  // Suppress — do not schedule local notification
}

// Check category
const category = getNotificationCategory(notification.type);
if (!prefs[category]) return;  // Category disabled

scheduleLocalNotification(notification.title, notification.message, data);
```

```typescript
function isQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) return nowMins >= startMins && nowMins < endMins;
  // Overnight: e.g. 22:00–08:00
  return nowMins >= startMins || nowMins < endMins;
}

function getNotificationCategory(type: string): keyof NotificationPreferences {
  if (type.includes('BID') || type.includes('AUCTION')) return 'bids';
  if (type.includes('OFFER')) return 'offers';
  if (type.includes('MESSAGE') || type.includes('CHAT')) return 'messages';
  return 'system';
}
```

**Note:** Quiet hours and category preferences only suppress **local scheduled notifications** (the bridge from Socket.IO and the foreground handler). They cannot suppress APNs/FCM push notifications that arrive when the app is killed — that would require a backend preference check before calling `pushToExpo()`. For Phase 1, client-side suppression is sufficient for PUSH-09/10.

---

## 9. react-native-gifted-charts (INFRA-06)

### Installation
```bash
# From mobile/ directory — expo install resolves compatible versions
npx expo install react-native-gifted-charts react-native-svg
```

`expo-linear-gradient` is already in `package.json` — gifted-charts uses it for gradient fills.

### Basic Verification Chart (confirm package works)
```typescript
// Source: https://gifted-charts.web.app/
import { BarChart, LineChart } from 'react-native-gifted-charts';

// Minimal bar chart — place in a dealer dashboard card to verify rendering
const data = [
  { value: 50, label: 'Jan' },
  { value: 80, label: 'Feb' },
  { value: 90, label: 'Mar' },
];

<BarChart
  data={data}
  barWidth={22}
  spacing={20}
  roundedTop
  xAxisThickness={0}
  yAxisThickness={0}
  yAxisTextStyle={{ color: '#9ca3af' }}
  xAxisLabelTextStyle={{ color: '#9ca3af' }}
  noOfSections={3}
  maxValue={100}
  frontColor="#ff0037"
/>
```

**Confidence:** MEDIUM — verified via npm (v1.4.77, May 2026), react-native-svg is Expo-managed for SDK 52, expo-linear-gradient already present. No official Expo compatibility matrix entry but dependency chain is clean.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expo push token delivery | Custom FCM/APNs SDK integration | `expo-server-sdk` + Expo Push API | Handles batching, receipts, token validation, error codes; FCM managed by Expo infra |
| Push notification channel creation | Custom native module | `Notifications.setNotificationChannelAsync()` | Official API; handles all Android versions |
| Token format validation | Regex on token string | `Expo.isExpoPushToken(token)` from expo-server-sdk | Expo's own validator; handles format changes |
| Quiet hours time comparison | Moment.js or date-fns | Plain `Date` arithmetic (shown above) | Zero dependency; 10 lines; no edge cases in this use |
| Notification inbox pagination | Custom cursor/scroll logic | TanStack Query `useInfiniteQuery` with `page` param | Handles loading states, re-fetch, cache invalidation |
| Deep link routing from notification tap | Manual URL parser + navigator | `router.push(data.link)` with typed routes | Expo Router handles all route resolution |
| Duplicate notification suppression | Complex state machine | `isUserConnected()` check in gateway + presence flag | Backend already tracks connected users in `connectedUsers` Map |

---

## Common Pitfalls

### Pitfall 1: Android notification channel must be created before any notification code
**What goes wrong:** Android 8.0+ silently discards all notifications with no error if no channel exists.
**Prevention:** Call `setNotificationChannelAsync` at module top-level in `_layout.tsx`, before the component function runs, before `useEffect`, before any notification listener is registered.
**Warning sign:** Android device never receives notifications but iOS works fine.

### Pitfall 2: `getExpoPushTokenAsync()` hangs on iOS Simulator
**What goes wrong:** The call never resolves, freezing the registration flow.
**Prevention:** Guard with `Device.isDevice` check — skip the entire token flow on simulators.
**Warning sign:** Registration hook never completes; app appears stuck on splash.

### Pitfall 3: `extra.eas.projectId` missing causes silent failure
**What goes wrong:** `getExpoPushTokenAsync()` throws `"Calling getExpoPushTokenAsync without projectId is deprecated"` or returns an experienceId-based token (not an EAS token).
**Prevention:** Run `eas build:configure` before writing any notification code. Verify `app.json` has `extra.eas.projectId`.
**Warning sign:** Token format starts with `@username/` instead of `ExponentPushToken[...]`.

### Pitfall 4: Push notifications do not work in Expo Go on Android (SDK 52)
**What goes wrong:** Push token registered successfully but no notifications arrive on Android.
**Prevention:** Use a development build (`eas build --profile development`). Do not use Expo Go for push notification testing on Android at all.

### Pitfall 5: `preferences` column full-replace overwrites existing keys
**What goes wrong:** Calling `PATCH /users/me` with `{ preferences: { expoPushToken: "..." } }` erases quiet hours and category toggles that were stored in other preference keys.
**Prevention:** Modify `updateProfile()` to shallow-merge preferences: read existing value, spread, write back. One line change in `users.service.ts`.

### Pitfall 6: Cold-start notification tap: router not mounted when `router.push()` called
**What goes wrong:** Deep link navigation throws "Route not found" or silently fails on iOS cold start.
**Prevention:** Store pending deep link in Zustand from `getLastNotificationResponseAsync()`. Consume and navigate from the tab navigator's `useEffect` once mounted.

### Pitfall 7: Duplicate notifications (Socket.IO + Expo Push both fire)
**What goes wrong:** User receives the same notification twice — once from the Socket.IO bridge and once from FCM/APNs.
**Prevention:** The `isUserConnected()` check in the gateway prevents Expo Push from firing when a socket is active. This check must be implemented before enabling the backend push path.

### Pitfall 8: `channelId` missing from backend push payload
**What goes wrong:** Notification delivered to Android but silently routed to the system "Miscellaneous" channel with low importance — no heads-up banner.
**Prevention:** Always include `channelId` on every `ExpoPushMessage`. Use `getChannelId(type)` helper to map notification types to the correct channel.

### Pitfall 9: `notification-icon.png` missing causes EAS Build failure
**What goes wrong:** Build fails with asset not found error.
**Prevention:** Create the asset before running any EAS build command. The file must exist at `mobile/assets/notification-icon.png` and be 96×96 white-on-transparent PNG.

---

## Code Examples

### Complete `_layout.tsx` modifications (diff-style summary)

```typescript
// ADD at module top-level, before RootLayout function:
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('carmazium-default', {
    name: 'Carmazium Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ff0037',
    showBadge: true,
  });
  Notifications.setNotificationChannelAsync('carmazium-bids', {
    name: 'Auction Bids',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 100, 100, 100],
    lightColor: '#ff0037',
    showBadge: true,
  });
  Notifications.setNotificationChannelAsync('carmazium-messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    showBadge: true,
  });
}

// ADD to RootLayout component, new useEffect after existing auth useEffect:
// (1) Register push token after auth confirmed
// (2) Set up notification response listener for deep linking
// (3) Check getLastNotificationResponseAsync for cold-start
// (4) Set up useNotifSocket hook
```

### Backend `notifications.service.ts` complete new constructor
```typescript
constructor(
  private readonly prisma: PrismaService,
  @Inject(forwardRef(() => NotificationsGateway))
  private readonly notificationsGateway: NotificationsGateway,
) {}
```

And in `notifications.module.ts`, no change needed if both are in the same module — but add `forwardRef` wrapping if circular dependency errors occur:
```typescript
providers: [
  NotificationsService,
  {
    provide: NotificationsGateway,
    useClass: NotificationsGateway,
  },
],
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Test push in Expo Go on Android | Must use EAS development build | SDK 52 (deprecated) / SDK 53 (removed) | EAS Build is now required before any push notification testing |
| `setNotificationHandler` with `shouldShowAlert` | `shouldShowBanner` + `shouldShowList` | SDK 50+ | Old `shouldShowAlert` still accepted but `shouldShowBanner` is the current API |
| `expo-notifications` with `getExpoPushTokenAsync()` without projectId | Must pass `{ projectId }` explicitly | SDK 47+ | Passing no projectId uses deprecated experienceId-based tokens |
| Manual FCM/APNs integration | Expo Push API gateway via `expo-server-sdk` | Architecture choice | Expo handles the Firebase/APNs credential management |

---

## Open Questions

1. **Preferences merge strategy**
   - What we know: `updateProfile()` currently full-replaces the `preferences` JSON column
   - What's unclear: Whether the planner wants to fix this in a backend task (Phase 1) or defer to Phase 9 (client reads first, merges, writes)
   - Recommendation: Fix in Phase 1 — one line in `users.service.ts`. If not fixed, push token registration will silently erase later-added quiet hours preferences.

2. **`notification-icon.png` creation**
   - What we know: `app.json` already references `./assets/notification-icon.png`; EAS Build will fail without it
   - What's unclear: Whether this is a task for the developer to create manually before running the build, or if a placeholder should be committed
   - Recommendation: Make creating this asset Wave 0 task — it gates the entire build. Document exact specs: 96×96 PNG, white shape on transparent background, no color fills.

3. **Firebase project for `google-services.json`**
   - What we know: Android push notifications require FCM; `google-services.json` comes from Firebase Console
   - What's unclear: Whether a Firebase project for `co.carmazium.app` already exists
   - Recommendation: Plan a task to create Firebase project + download `google-services.json`. This is required before Android push delivery works in the dev build.

4. **`DeviceNotRegistered` receipt handling**
   - What we know: expo-server-sdk provides receipt-based error checking; `DeviceNotRegistered` means token should be cleared
   - What's unclear: Whether full receipt checking (async, 15+ min delay) should be implemented in Phase 1 or deferred
   - Recommendation: Defer full receipt polling to a background job in a later phase. For Phase 1, handle synchronous ticket errors only (immediate failures).

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual device testing (no automated test framework detected in mobile/) |
| Config file | None — no jest.config.* or vitest.config.* found |
| Quick run command | `eas build --profile development --platform android` then physical device install |
| Full suite command | Manual checklist on physical Android + iOS devices |

No automated test infrastructure exists for the mobile project. All Phase 1 validation is manual device testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Device Needed |
|--------|----------|-----------|-------------------|--------------|
| INFRA-01 | Dev build installs and launches on physical Android device | Manual smoke | `eas build --profile development --platform android` | Physical Android |
| INFRA-02 | Push token appears in user.preferences in DB after login | Manual + DB query | `PATCH /users/me` confirmed via Fly.dev logs / Prisma Studio | Physical device |
| INFRA-03 | Android notification banner appears (heads-up) — not silent | Manual smoke | Background app, trigger test notification | Physical Android |
| INFRA-04 | EAS Build completes without asset-not-found error | Build log | `eas build --profile development` — check build logs | n/a |
| INFRA-05 | Token format is `ExponentPushToken[...]` not `@username/...` | Manual + console.log | Log token in registerForPushNotificationsAsync | Physical device |
| INFRA-06 | BarChart renders without error on dealer screen | Manual visual | Launch app, navigate to dealer dashboard | Simulator OK |
| PUSH-01 | Outbid notification arrives foreground + background | Manual | Place bid from second account, overbid from third | 2 physical devices |
| PUSH-02 | Offer notification arrives on seller's device | Manual | Make offer on listing, check seller device | 2 physical devices |
| PUSH-03 | Offer accept/reject/counter notification arrives | Manual | Respond to offer from seller account | 2 physical devices |
| PUSH-04 | Auction win notification + chat room deep link | Manual | Wait for auction end, check winner device | Physical device |
| PUSH-05 | Chat message notification arrives when backgrounded | Manual | Send message, background recipient app | 2 physical devices |
| PUSH-06 | Tapping notification navigates to correct screen | Manual | Tap each notification type, verify route | Physical device |
| PUSH-07 | Notification inbox shows paginated list | Manual visual | Navigate to /notifications, scroll | Simulator OK |
| PUSH-08 | Tapping notification marks it read; "mark all read" works | Manual | Check isRead toggle in DB / UI badge count | Simulator OK (with mock data) |
| PUSH-09 | Category toggle suppresses specific notification types | Manual | Disable "bids" toggle, trigger outbid — no banner | Physical device |
| PUSH-10 | Quiet hours window suppresses all local notifications | Manual | Set quiet hours to current time, trigger event — no banner | Physical device |

### Sampling Rate
- **Per task commit:** Visual inspection on simulator for UI tasks; physical device test for push delivery tasks
- **Per wave merge:** Full manual checklist on physical Android + physical iOS
- **Phase gate:** All 16 requirements manually verified on physical devices before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/assets/notification-icon.png` — 96×96 white-on-transparent PNG — required before any EAS Build runs (INFRA-04 blocker)
- [ ] Firebase project created and `google-services.json` downloaded — required for Android FCM push delivery (PUSH-01 through PUSH-06 blocker on Android)
- [ ] `eas build:configure` run from `mobile/` directory — writes `extra.eas.projectId` to `app.json` (INFRA-05 blocker)
- [ ] `expo-server-sdk` installed in backend — required for PUSH-01 through PUSH-06

---

## Sources

### Primary (HIGH confidence)
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) — registration pattern, projectId, permission flow
- [Expo Notifications SDK Reference](https://docs.expo.dev/versions/latest/sdk/notifications/) — `setNotificationChannelAsync`, `scheduleNotificationAsync`, `getLastNotificationResponseAsync`
- [Expo Receiving Notifications](https://docs.expo.dev/push-notifications/receiving-notifications/) — `setNotificationHandler`, `addNotificationReceivedListener`, `addNotificationResponseReceivedListener`
- [expo-server-sdk-node GitHub](https://github.com/expo/expo-server-sdk-node) — `Expo` class, `sendPushNotificationsAsync`, receipt error handling
- [EAS Build eas.json Reference](https://docs.expo.dev/build/eas-json/) — profile structure, `developmentClient`, `distribution`
- [EAS Build Setup](https://docs.expo.dev/build/setup/) — `eas build:configure`, credential provisioning
- Direct source read: `backend/src/notifications/notifications.service.ts` — confirmed no Expo push delivery exists
- Direct source read: `backend/prisma/schema.prisma` — confirmed `User.preferences Json?` column
- Direct source read: `backend/src/users/users.service.ts` — confirmed `updateProfile` writes `preferences`; confirmed full-replace behavior
- Direct source read: `backend/src/notifications/notifications.gateway.ts` — confirmed `connectedUsers` Map for presence tracking
- Direct source read: `backend/src/notifications/notifications.controller.ts` — confirmed all read/unread endpoints exist
- Direct source read: `mobile/app.json` — confirmed `expo-notifications` plugin already configured with icon/color

### Secondary (MEDIUM confidence)
- [react-native-gifted-charts npm](https://www.npmjs.com/package/react-native-gifted-charts) — v1.4.77, actively maintained, react-native-svg peer dep
- [Expo Push Notifications Guide 2026 — ReactNativeRelay](https://reactnativerelay.com/article/react-native-push-notifications-expo-complete-guide-2026) — confirms current patterns

### Tertiary (LOW confidence)
- Community NestJS + expo-server-sdk integration patterns — structure verified against expo-server-sdk official docs

---

## Metadata

**Confidence breakdown:**
- EAS Build Setup: HIGH — verified against official EAS docs and existing `app.json`/`package.json`
- Android Notification Channel: HIGH — verified against official Expo SDK reference
- Push Token Registration: HIGH — verified against official setup guide; projectId pattern confirmed
- Backend Changes: HIGH — NotificationsService read directly; `preferences Json?` confirmed in schema
- Deep Link Routing: HIGH — Expo Router 4 patterns confirmed; cold-start guard is documented pitfall
- Notification Inbox: HIGH — all backend endpoints exist and verified in controller
- Notification Preferences: HIGH — client-side only; SecureStore already installed
- react-native-gifted-charts: MEDIUM — no official Expo compatibility matrix entry

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (expo-notifications is stable; EAS CLI commands stable; expo-server-sdk v6 API stable)
