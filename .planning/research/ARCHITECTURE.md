# Architecture Research: Carmazium Mobile — Remaining Features

**Researched:** 2026-05-30
**Confidence:** HIGH — based on direct source inspection of mobile scaffold, backend controllers, Prisma schema, and official Expo docs

---

## Scaffold Reality Check (Critical Context)

Before integration architecture, note what the scaffold already provides — more than the milestone prompt implies:

| Already Installed | File/Config |
|-------------------|-------------|
| `expo-notifications ~0.29.14` | `mobile/package.json` |
| `expo-location ~18.0.11` | `mobile/package.json` |
| `expo-image-picker ~16.0.6` | `mobile/package.json` |
| `react-native-maps 1.20.1` | `mobile/package.json` |
| Notification plugin + icon/color | `mobile/app.json` plugins |
| Location permission strings (iOS + Android) | `mobile/app.json` |
| Camera + photo library permissions | `mobile/app.json` |
| `DVLA_LOOKUP` endpoint constant | `mobile/src/constants/api.ts` |
| `listingsApi.dvlaLookup(reg)` | `mobile/src/lib/api/listings.ts` |
| `listingsApi.create(data)` | `mobile/src/lib/api/listings.ts` |
| `USERS_ME_KYC` endpoint constant | `mobile/src/constants/api.ts` |
| Screen placeholders in `_layout.tsx`: `sell/index`, `map/index`, `compare/index` | `mobile/app/_layout.tsx` |

**The packages are installed. The work is screen and hook implementation, not package setup.**

One critical gap confirmed: the backend has **no device push token storage endpoint**. `grep` across `backend/src/**/*.ts` for `pushToken`, `deviceToken`, `fcm`, `apns` returned zero matches. Token registration requires a backend addition.

---

## Push Notification Flow (End-to-End)

### Overview

The architecture uses a dual-delivery model: WebSocket for foreground (app open), Expo push notifications for background/closed states. The `/notifications` WebSocket already delivers `notification:new` events. The missing piece is persisting the Expo push token so the backend can trigger APNs/FCM when the socket is not connected.

### Step-by-Step Flow

```
1. App boots → RootLayout mounts
2. useEffect calls registerForPushNotificationsAsync()
   ├── Checks Device.isDevice (skip on simulator)
   ├── Calls Notifications.requestPermissionsAsync()
   ├── If granted: Notifications.getExpoPushTokenAsync({ projectId })
   └── Returns token: ExpoToken { data: "ExponentPushToken[xxxxxx]" }

3. App POSTs token to backend:
   PATCH /users/me  { preferences: { expoPushToken: "ExponentPushToken[...]" } }
   (reuses existing updateProfile endpoint — no backend change needed)
   Token stored in User.preferences JSON column (Prisma schema confirmed)

4. Backend event triggers (auction outbid, offer received, message, KYC approved):
   ├── NotificationsService.create(dto) → writes Notification row
   ├── NotificationsGateway.sendNotification(userId, notification)
   │   └── Emits notification:new to socket room user:{userId}
   └── [NEW] If user has expoPushToken in preferences, call Expo Push API
       POST https://exp.host/--/api/v2/push/send
       { to: token, title, body, data: { notifId, type, link } }

5. Mobile receives notification:
   App OPEN (foreground):
     └── notifSocket.on('notification:new') → scheduleLocalNotification()
         (Notifications.scheduleNotificationAsync with trigger: null)

   App BACKGROUNDED/CLOSED:
     └── APNs/FCM delivers via Expo Push Service
         └── Notifications.addNotificationResponseReceivedListener
             navigates to relevant screen on tap

6. On tap:
   notification.request.content.data.link → router.push(link)
   e.g. data.link = "/auction/abc123" → auction detail
```

### Token Rotation Handling

Push tokens can change. The registration hook must also subscribe to `Notifications.addPushTokenListener` and re-PATCH `/users/me` when a new token arrives.

### Backend Gap Assessment

The `NotificationsGateway` currently only delivers to connected sockets. The Expo Push API call (step 4) needs to be added to `NotificationsService.create()` or via a post-create hook. This is a **backend addition required**, but it is small: read `user.preferences.expoPushToken`, fire a `fetch` to `https://exp.host/--/api/v2/push/send`. No schema change needed because `preferences` is already a `Json?` column on the `User` model.

### Key Files Involved

```
Mobile (new):
  mobile/src/hooks/usePushNotifications.ts   ← token registration + listener setup
  mobile/src/lib/notifications.ts            ← scheduleLocalNotification() helper

Mobile (modified):
  mobile/app/_layout.tsx                     ← call usePushNotifications() in useEffect

Backend (modified):
  backend/src/notifications/notifications.service.ts
    └── add: pushToExpo(userId, payload) called from create()
```

---

## New Files/Directories Needed

| File | Purpose | Hooks Into Existing |
|------|---------|---------------------|
| `mobile/src/hooks/usePushNotifications.ts` | Token registration, permission request, token rotation listener, foreground notification handler | Calls `apiRequest PATCH /users/me`; called from `_layout.tsx` |
| `mobile/src/lib/notifications.ts` | `scheduleLocalNotification(title, body, data)` wrapper around `Notifications.scheduleNotificationAsync` | Used by notifSocket listener and usePushNotifications |
| `mobile/src/hooks/useNotifSocket.ts` | Connects `getNotifSocket()`, listens for `notification:new`, bridges to local push | Uses existing `getNotifSocket()` from `src/lib/socket/index.ts` |
| `mobile/src/store/notifications.store.ts` | Zustand store: unread count badge, notification list | Consumed by tab bar badge and notification screen |
| `mobile/app/notifications/index.tsx` | Notification inbox screen | Calls `dashboardApi.notifications()`; uses `notifications.store` |
| `mobile/app/sell/index.tsx` | Sell My Car wizard (3-step) — Step 1: DVLA reg lookup; Step 2: condition + photo upload; Step 3: review + publish | Uses `listingsApi.dvlaLookup`, `listingsApi.create`, Supabase Storage upload |
| `mobile/src/hooks/useSellWizard.ts` | Multi-step form state machine (step, formData, loading, errors) | Consumed by `app/sell/index.tsx` |
| `mobile/src/lib/storage.ts` | Supabase Storage upload helper: `uploadImage(bucket, path, uri)` → public URL | Uses `@supabase/supabase-js` already in deps; called from sell wizard and KYC |
| `mobile/app/kyc/index.tsx` | KYC upload screen (3 sub-steps: licence front/back, selfie) | Calls `apiRequest POST /users/me/kyc` (USERS_ME_KYC constant exists); uses `storage.ts` |
| `mobile/app/map/index.tsx` | Map/Near Me screen with `MapView`, price pins, bottom sheet, list toggle | Calls `listingsApi.getAll({ lat, lng, radius })`; uses `expo-location` |
| `mobile/src/components/charts/SalesChart.tsx` | Dealer analytics chart (revenue over time, velocity) | Consumes `getDealerDashboard` data from `dashboardApi.dealer()` |
| `mobile/src/components/charts/LeadFunnelChart.tsx` | Dealer lead funnel bar chart | Same data source |
| `mobile/app/(tabs)/dashboard.tsx` | Role-aware dashboard tab (buyer/seller/dealer branch on `user.role`) | Uses `useAuthStore`, `dashboardApi`, `SalesChart` |
| `mobile/app/dealer/inventory.tsx` | Dealer inventory list + status management | Calls `listingsApi.getAll` filtered by sellerId; `listingsApi.update` for status |
| `mobile/app/dealer/leads.tsx` | CRM leads inbox (AI-scored hot/warm/cold) | Calls dealer leads endpoint (needs confirming) |

---

## Modified Files

| File | What Changes | Why |
|------|-------------|-----|
| `mobile/app/_layout.tsx` | Add `usePushNotifications()` call inside the auth `useEffect`; add `<Stack.Screen name="notifications/index">` and `<Stack.Screen name="kyc/index">` | Push token registration must fire after auth confirms a session; new screens need Stack registration |
| `mobile/src/lib/api/dashboard.ts` | Add `dealer()` method calling `ENDPOINTS.DASHBOARD_DEALER` (already exists in ENDPOINTS); add typed interfaces for dealer response shape | Currently dashboard.ts uses `any` types; dealer analytics screen needs structured data |
| `mobile/src/constants/api.ts` | Add `NOTIFICATIONS_READ_ALL: '/notifications/read-all'`, `NOTIFICATIONS_UNREAD_COUNT: '/notifications/unread-count'` | Notification inbox needs mark-all-read and badge count endpoints (backend routes exist at `PATCH /notifications/read-all`, `GET /notifications/unread-count`) |
| `mobile/app/(tabs)/_layout.tsx` | Add notification badge count display on the profile or a dedicated bell tab | Reads from `notifications.store.ts` unread count |
| `mobile/app.json` | Add `react-native-maps` plugin entry with Google Maps API keys; add `POST_NOTIFICATIONS` to Android permissions for SDK 33+ | Maps require Google API key in app config for production EAS build; Android 13+ requires explicit notification permission |
| `backend/src/notifications/notifications.service.ts` | Add `pushToExpo(token, payload)` helper; call it from `create()` after DB write | No socket delivery when app is closed; Expo push fills the gap |

---

## Sell My Car Wizard Architecture

### Form State Strategy

Use a single Zustand store (`useSellWizard`) rather than React local state or a form library. The wizard spans three screens but is presented as a single modal (`presentation: 'modal'` in `_layout.tsx`). Internal navigation between steps is handled by a `step` integer in the store, not by Expo Router route changes — this avoids URL-bar step tracking and keeps back-button behaviour predictable.

```typescript
// mobile/src/hooks/useSellWizard.ts (shape)
interface SellWizardState {
  step: 1 | 2 | 3;
  reg: string;
  dvlaData: DvlaResult | null;
  mileage: number | null;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'PROJECT';
  photos: string[];          // local URIs pre-upload
  uploadedUrls: string[];    // Supabase Storage public URLs post-upload
  price: number | null;
  tier: 'free' | 'standard' | 'premium';
  loading: boolean;
  error: string | null;
}
```

### Step-by-Step Data Flow

**Step 1 — Vehicle (DVLA lookup)**
```
User types reg plate
  → listingsApi.dvlaLookup(reg) → GET /dvla/lookup?reg=BD21KMC
  → Backend calls DVLA API → returns { make, model, year, fuelType, colour, engineSize }
  → Store sets dvlaData; user confirms or adjusts mileage
  → "Continue" advances step to 2
```

**Step 2 — Condition + Photos**
```
User selects condition (radio)
User taps photo slots → expo-image-picker launchImageLibraryAsync OR launchCameraAsync
  → returns { uri, type, fileName }
  → store.photos.push(uri)   (local preview, upload deferred to Step 3 submit)
"Continue" advances step to 3
```

**Step 3 — Review + Publish**
```
User reviews preview card + selects listing tier
Taps "Publish":
  1. uploadImages(): for each photo URI → storage.uploadImage('listings', `${uuid}/${i}.jpg`, uri)
     └── Supabase Storage upload returns publicUrl
  2. listingsApi.create({
       make, model, year, mileage, fuelType, condition,
       images: uploadedUrls,
       price: dvlaData.fairMarketPrice,
       ...dvlaData fields
     })
  3. On success: router.dismiss() (closes modal); TanStack Query invalidates 'listings'
```

### Supabase Storage Upload Pattern

```typescript
// mobile/src/lib/storage.ts
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

export async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const contentType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}
```

Note: `expo-file-system` is a transitive dependency of expo packages; it will be available. The `decode` base64-to-Uint8Array helper comes from the `base64-arraybuffer` package (widely used with Supabase RN; add to deps if not present). The `listings` Supabase Storage bucket must exist and have public read policy.

### KYC Upload (Same Pattern, Different Endpoint)

KYC follows the same `storage.ts` upload helper. Files go to a `kyc` bucket (private, not public). After upload, the app calls `PATCH /users/me/kyc` (USERS_ME_KYC constant already in api.ts) with the storage URLs. The DealerKyc model fields `vatProof`, `companyRegistrationProof`, `directorIdProof`, `paymentScreenshot` are all `String?` URL columns — the backend is ready.

---

## Map Integration

### Library Status

`react-native-maps 1.20.1` is already installed. The iOS and Android location permissions are already declared in `app.json`. The screen placeholder `map/index` is already registered in `_layout.tsx`.

**One missing piece:** Google Maps API keys are not yet in `app.json`. The `react-native-maps` config plugin entry and API keys must be added for production EAS builds. Apple Maps (default on iOS, no key needed) works for dev.

### app.json Addition Required

```json
[
  "react-native-maps",
  {
    "androidGoogleMapsApiKey": "$GOOGLE_MAPS_API_KEY_ANDROID",
    "iosGoogleMapsApiKey": "$GOOGLE_MAPS_API_KEY_IOS"
  }
]
```

Note: Environment variable interpolation in plugins has a known issue in Expo config plugins where literal strings may be used instead of resolved values. Use EAS Secrets or hardcode during build. Flag as LOW confidence on exact env var syntax — verify against current Expo docs at build time.

### Data Flow

```
app/map/index.tsx mounts
  → expo-location.requestForegroundPermissionsAsync()
  → Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  → listingsApi.getAll({ lat, lng, radius: 5, limit: 50 })
    (ListingFilters already has lat, lng, radius fields in mobile/src/lib/api/listings.ts)
  → MapView renders with region centred on user location
  → Listing[] with lat/lng → Marker components with custom price callout
  → Tap marker → router.push('/vehicle/' + listing.id)
  → Bottom sheet (react-native-reanimated BottomSheet or manual) shows horizontal car strip
  → "List view" toggle → flat list sorted by distance (compute from haversine on client)
```

### Required Permissions Runtime Flow

```typescript
// In app/map/index.tsx useEffect
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  // Show permission denied state with CzButton to open Settings
  return;
}
```

`ACCESS_FINE_LOCATION` is already in `android.permissions`. iOS `NSLocationWhenInUseUsageDescription` is set. No additional config needed.

### Component Structure

```
app/map/index.tsx
  ├── <MapView>  (react-native-maps)
  │     └── listings.map(l => <Marker key={l.id} coordinate={{ lat: l.lat, lng: l.lng }}>
  │           <PricePin price={l.price} active={selectedId === l.id} />
  │         </Marker>)
  ├── <SearchBar overlay />
  ├── <FilterChips (Near me, Under £30k, SUV...) />
  ├── <RadiusSlider />
  └── <BottomSheet>
        ├── header: "47 CARS NEARBY"
        └── <FlatList horizontal listings strip />
              OR <FlatList vertical distance-sorted />
```

The `PricePin` component renders the red pill with price text shown in the design mock — it is a plain `View` + `Text` child of `Marker`, not a native image. Keep it simple (no SVG in Marker on Android — use `View` styling).

---

## Dealer Analytics Charts Architecture

The backend `GET /dashboard/dealer` returns `{ totalListings, activeAuctions, recentSales, bidsReceived, profile }` — this is scalar KPI data, not time-series. For sales-over-time charts the analytics would need `/analytics/summary` (which exists but is admin-only and returns aggregate event data).

**Recommendation:** For v1.0, render the dealer analytics tab using the scalar KPIs from `/dashboard/dealer` in a card-based layout (revenue total, listing count, bids). Reserve true time-series charting (victory-native or react-native-gifted-charts) for v1.1 when a time-bucketed dealer endpoint is added. This avoids a backend change on the critical path.

If charts are required in v1.0, use `react-native-gifted-charts` (lighter than Victory, no SVG dependency issues on Android). Install with `npx expo install react-native-gifted-charts react-native-svg`.

---

## Build Order (Considering Dependencies)

The dependency graph has five forcing constraints:
1. Push notification token registration depends on auth being stable
2. Notification inbox depends on the notifSocket bridge and token registration
3. Sell wizard depends on the Supabase Storage helper (shared with KYC)
4. KYC status affects what screens are gateable (bid, list) — needed early
5. Map depends on nothing but location permission (independent)

### Ordered Phases

**Phase 1 — Foundation: Push Notifications + Notification Inbox**

Build first because everything else (auction outbid, offer received, KYC approved) fires notifications. Being unblocked here means all subsequent features can test their notification triggers immediately.

- `mobile/src/lib/notifications.ts` — scheduleLocalNotification helper
- `mobile/src/hooks/usePushNotifications.ts` — token registration + listener
- `mobile/src/store/notifications.store.ts` — unread count
- `mobile/src/hooks/useNotifSocket.ts` — WebSocket → local push bridge
- Modify `mobile/app/_layout.tsx` — wire usePushNotifications after auth
- `mobile/app/notifications/index.tsx` — inbox screen
- Backend: add Expo push delivery to `NotificationsService.create()`

**Phase 2 — Role Dashboards (Buyer / Seller / Dealer KPIs)**

Depends on: auth (done), api layer (done). No new packages needed.

- `mobile/app/(tabs)/dashboard.tsx` — role-branched dashboard tab
- Add typed dealer/buyer/seller response interfaces in `src/lib/api/dashboard.ts`
- `mobile/src/components/charts/SalesChart.tsx` (scalar card, defer time-series)

**Phase 3 — Supabase Storage Helper + Sell My Car Wizard**

Depends on: auth (done), listings API (done). `expo-image-picker` and `expo-file-system` are available.

- `mobile/src/lib/storage.ts` — upload helper (shared with KYC)
- `mobile/src/hooks/useSellWizard.ts` — form state machine
- `mobile/app/sell/index.tsx` — 3-step wizard UI

**Phase 4 — KYC Upload**

Depends on: storage.ts from Phase 3.

- `mobile/app/kyc/index.tsx` — 3-step KYC screen (licence front/back, selfie, pending state)
- Register `kyc/index` in `_layout.tsx` Stack

**Phase 5 — Map / Near Me**

Depends on: listings API (done), location permissions (already in app.json). Fully independent of Phases 1–4.

- `mobile/app/map/index.tsx` — MapView + price pins + bottom sheet
- `mobile/src/components/map/PricePin.tsx` — custom marker view
- Add Google Maps API keys to app.json for EAS build

**Phase 6 — Dealer Flows (Inventory, CRM Leads, Auction Manager)**

Depends on: dashboard (Phase 2), sell wizard (Phase 3 for create listing flow).

- `mobile/app/dealer/inventory.tsx`
- `mobile/app/dealer/leads.tsx`
- `mobile/app/dealer/auctions.tsx`

### Dependency Graph Summary

```
Phase 1: Push Notifications
  ↓
Phase 2: Role Dashboards     ← also depends on auth (existing)
  ↓
Phase 3: Sell Wizard         ← introduces storage.ts
  ↓
Phase 4: KYC                 ← consumes storage.ts from Phase 3

Phase 5: Map/Near Me         ← independent, can run parallel to Phase 3-4

Phase 6: Dealer Flows        ← consumes Phases 2 + 3
```

---

## Backend Changes Required

Only two backend modifications are needed (all other features use existing endpoints):

| Change | File | Scope |
|--------|------|-------|
| Add Expo push delivery | `backend/src/notifications/notifications.service.ts` | Add ~20 lines: read `user.preferences.expoPushToken`, call Expo Push API if token present |
| (Optional) Add `POST /users/me/push-token` endpoint | `backend/src/users/users.controller.ts` | Alternative to using preferences JSON — cleaner but requires schema migration for a `pushToken String?` column on User. Recommend preferences JSON approach to avoid migration. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Push notification flow | HIGH | Verified: backend WebSocket code read directly; Expo docs confirm token pattern; `preferences Json?` column confirmed in schema |
| Storage upload pattern | MEDIUM | Base64 via FileSystem is the documented Supabase RN pattern; `base64-arraybuffer` dep needs confirming |
| Maps setup | HIGH | Package installed, permissions set; Google API key gap is the only open item |
| Sell wizard state | HIGH | DVLA endpoint exists and is typed; `listingsApi.create` exists; wizard shape derived from design system JSX |
| KYC flow | HIGH | DealerKyc model fields confirmed in schema; USERS_ME_KYC constant exists |
| Dealer analytics charts | MEDIUM | Backend returns scalar KPIs only; time-series requires backend work deferred to v1.1 |
| Backend push delivery | HIGH | No token storage exists (confirmed by grep); preferences column is the right landing spot |

---

## Sources

- `mobile/package.json` — confirmed installed packages (expo-notifications, react-native-maps, expo-location, expo-image-picker)
- `mobile/app.json` — confirmed permission strings and plugin config
- `mobile/src/constants/api.ts` — confirmed DVLA_LOOKUP, USERS_ME_KYC endpoint constants
- `mobile/src/lib/api/listings.ts` — confirmed dvlaLookup and create methods
- `backend/src/notifications/notifications.gateway.ts` — confirmed socket delivery pattern
- `backend/src/notifications/notifications.service.ts` — confirmed no Expo push delivery exists
- `backend/prisma/schema.prisma` — confirmed User.preferences Json? column, DealerKyc model, KycStatus enum
- `backend/src/users/users.service.ts` — confirmed updateProfile writes to preferences
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo Notifications SDK Reference](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [react-native-maps Expo Docs](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Supabase React Native Storage](https://supabase.com/blog/react-native-storage)
