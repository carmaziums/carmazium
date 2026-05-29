# Stack Research: Carmazium Mobile — Remaining Features

**Project:** Carmazium Mobile App (v1.0 remaining features)
**Researched:** 2026-05-30
**Expo SDK:** 52 (locked — do not upgrade)

---

## New Dependencies Needed

| Package | Version | Purpose | Why not already covered |
|---------|---------|---------|------------------------|
| `react-native-svg` | `~15.8.0` (via `npx expo install`) | Peer dependency for react-native-gifted-charts | Not in package.json; expo-linear-gradient is present but SVG is not |
| `react-native-gifted-charts` | `^1.4.77` | Dealer analytics charts (bar, line, pie) | Not in package.json; no chart library exists |

**That's it for runtime dependencies.** Every other feature uses packages already present.

---

## EAS Build Requirements

EAS Build is a cloud build service — no local Xcode or Android SDK required. The following configuration work is needed before a production build can run.

### 1. Install EAS CLI (developer machine only, not in package.json)

```bash
npm install -g eas-cli
eas login
```

### 2. Create `mobile/eas.json`

This file does not exist yet. Minimum required content:

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

### 3. Link the project to an Expo account

```bash
# Run from mobile/ directory — creates the EAS project ID
eas project:init
```

This generates an EAS `projectId`. Once generated, add it to `mobile/app.json` under `extra.eas` — this is **required** for `getExpoPushTokenAsync()` to work:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "FILL_IN_AFTER_eas_project_init"
      }
    }
  }
}
```

### 4. iOS Credentials

EAS manages provisioning profiles and signing certificates automatically when you run `eas build --platform ios`. Requirements:

- Apple Developer Program membership ($99/year) — needed for App Store distribution
- Run `eas credentials` to let EAS provision automatically (recommended over manual)
- APNs key is provisioned by EAS automatically from your Apple account

### 5. Android Credentials

- EAS generates and manages the Android signing keystore automatically on first build
- For Google Play submission: download a Google Service Account JSON from Google Play Console and place it at the path specified in `eas.json` (`submit.production.android.serviceAccountKeyPath`)
- Add `google-service-account.json` to `.gitignore` — it is a secret

### 6. App Store / Play Store Pre-registration

Before `eas submit` can run:

- Register the app in App Store Connect (get `ascAppId`)
- Create the app in Google Play Console
- Neither step requires a build; both can be done through web UIs in advance

### 7. Push Notification Backend Integration

The existing backend (NestJS on Fly.dev) needs a new endpoint to receive and store Expo push tokens. The mobile app calls this on login. The pattern:

**Mobile side (already possible with existing stack):**
```typescript
// After auth, register push token with backend
const token = await Notifications.getExpoPushTokenAsync({
  projectId: Constants.expoConfig?.extra?.eas?.projectId,
});
await apiClient.post('/notifications/register-token', { token: token.data });
```

**Backend side (NestJS — one new endpoint):**
```typescript
// POST /notifications/register-token
// Stores { userId, expoPushToken } in database
// When an event fires, sends to https://exp.host/--/api/v2/push/send
```

The backend should use `expo-server-sdk` (Node.js package, v6.1.0 as of 2026) — this is a **backend dependency, not a mobile one**. Add it to the NestJS project, not to `mobile/package.json`.

### 8. App Icons and Splash Screen

The `app.json` already references `./assets/icon.png`, `./assets/splash.png`, and `./assets/adaptive-icon.png`. These asset files must exist and meet store requirements before EAS Build runs:

- `icon.png`: 1024×1024 PNG, no transparency (iOS), transparency OK (Android)
- `adaptive-icon.png`: 1024×1024 PNG foreground layer (Android)
- `splash.png`: at minimum 1284×2778 (iPhone 14 Pro Max baseline)
- `notification-icon.png`: 96×96 white-on-transparent PNG (Android)

---

## Chart Library Recommendation

**Recommendation: `react-native-gifted-charts`**

**Why not `victory-native` (XL):**
- victory-native requires `@shopify/react-native-skia` as a peer dependency
- The Skia-compatible version for Expo 52 is `^1.x` but victory-native v41+ expects v2.x, creating a known unresolved peer conflict (GitHub issue #616 in FormidableLabs/victory-native-xl is open as of research date)
- The stable pin for Expo 52 is victory-native@37.3.6 which is a significantly older API with worse DX
- Skia adds ~8MB to the binary for chart rendering alone — disproportionate for dealer analytics screens

**Why `react-native-gifted-charts`:**
- Built on `react-native-svg` (already Expo-managed, version 15.x bundled with SDK 52)
- `expo-linear-gradient` is already in `package.json` — gifted-charts uses it natively for gradient fills
- Zero native modules beyond what's already present — works in both development builds and Expo Go
- Supports bar, line, pie, and donut charts — sufficient for: revenue KPIs, lead funnel, sales velocity, inventory breakdown
- Current version 1.4.77 (May 2026), actively maintained
- Installation: `npx expo install react-native-gifted-charts react-native-svg` (expo-linear-gradient already present)

**Confidence:** MEDIUM — verified via npm, GitHub activity, and multiple community sources; no official Expo compatibility matrix entry, but `react-native-svg` is an Expo-bundled package making the dependency chain clean.

---

## Packages Already in package.json (no action needed)

The following milestone features are fully covered by existing packages — no new installs required:

| Feature | Package Already Present | Version |
|---------|------------------------|---------|
| Push notifications (client) | `expo-notifications` | `~0.29.14` |
| Map / Near Me | `react-native-maps` + `expo-location` | `1.20.1` + `~18.0.11` |
| KYC document upload | `expo-image-picker` | `~16.0.6` |
| Mazium AI search (REST call) | `@tanstack/react-query` + existing `apiClient` | v5 |
| Offer/negotiation threading | `socket.io-client` + `@tanstack/react-query` | v4 + v5 |
| Vehicle compare screen | No new packages needed — data layer + UI only | — |
| Push notification permission flow | `expo-notifications` handles permission API | `~0.29.14` |
| Notification preferences (storage) | `expo-secure-store` + `zustand` | `~14.0.1` + v5 |
| Animated UI (charts, transitions) | `react-native-reanimated` | `~3.16.7` |
| Gradient fills (charts) | `expo-linear-gradient` | `~14.0.2` |

**The `app.json` push notification plugin is already configured** (`expo-notifications` with icon and color). The only missing piece is `extra.eas.projectId` which cannot be filled until `eas project:init` runs.

**The `app.json` already has `bundleIdentifier` (`co.carmazium.app`) and Android `package` (`co.carmazium.app`)** — EAS Build will not prompt for these.

---

## Version Conflicts / Warnings

### W1: `react-native-maps` 1.20.1 and New Architecture

`react-native-maps` 1.20.1 has partial support for React Native's New Architecture (Fabric). Expo 52 ships with New Architecture enabled by default in new projects. If map rendering issues appear, add to `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "android": { "newArchEnabled": false },
        "ios": { "newArchEnabled": false }
      }]
    ]
  }
}
```

Only apply this if map rendering breaks — do not disable New Architecture preemptively. `expo-build-properties` is a dev dependency (`npx expo install expo-build-properties`) if this workaround becomes necessary.

### W2: `expo-notifications` requires a development build for physical device testing

`expo-notifications` does not function in Expo Go for SDK 52+ (Expo Go uses its own push credentials and a different `experienceId`). Push token registration and notification receipt must be tested on a development build (`eas build --profile development`). This is expected behavior, not a bug.

### W3: Android 13+ POST_NOTIFICATIONS runtime permission

On Android API 33+, `requestPermissionsAsync()` from `expo-notifications` must be called at runtime. The current `app.json` does not list `POST_NOTIFICATIONS` in the Android permissions array — this is correct because `expo-notifications` plugin adds it automatically. No manual change needed.

### W4: `notification-icon.png` asset must exist

`app.json` references `./assets/notification-icon.png` in the expo-notifications plugin config. This file must be created (96×96 white-on-transparent PNG) before EAS Build runs. The build will fail if the asset is missing.

### W5: Google Services JSON for FCM (Android)

For Android push notifications to work in production, `google-services.json` (from Firebase Console) must be placed in `mobile/` and referenced by EAS. Without it, Android push tokens will be device-local tokens rather than FCM tokens, and Expo's push service cannot deliver to Android. Add to `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

This is distinct from the Google Play Service Account JSON (which is only for store submission). Two separate Google credentials are required.

---

## What NOT to Add

| Temptation | Why to Avoid |
|------------|-------------|
| `@shopify/react-native-skia` | Only needed for victory-native; gifted-charts works without it; adds ~8MB binary cost and a native module for charts alone |
| `victory-native` | Skia peer conflict on Expo 52 not resolved upstream; use gifted-charts instead |
| `firebase/app` + `@react-native-firebase/messaging` | FCM via Firebase SDK is unnecessary — Expo's push service handles FCM on the backend; mobile only needs `expo-notifications` (already present) |
| `react-query-devtools` | RN-incompatible; web-only package |
| `expo-updates` | OTA update infrastructure is a post-launch concern; adds complexity without value at v1.0 submission stage |
| `expo-dev-client` in `dependencies` | Should only ever be in `devDependencies`; being in `dependencies` bloats production builds |
| A separate push notification service (OneSignal, Courier, etc.) | Overkill when using Expo's push gateway directly; adds a third-party dependency on the critical notification path |
| `@react-native-async-storage/async-storage` for token storage | Already in package.json; use `expo-secure-store` (also present) for the push token — it's sensitive |

---

## Sources

- [Expo push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) — official, HIGH confidence
- [expo-server-sdk-node GitHub](https://github.com/expo/expo-server-sdk-node) — official, HIGH confidence
- [EAS Build configuration](https://docs.expo.dev/build/eas-json/) — official, HIGH confidence
- [EAS Submit configuration](https://docs.expo.dev/submit/eas-json/) — official, HIGH confidence
- [react-native-gifted-charts npm](https://www.npmjs.com/package/react-native-gifted-charts) — MEDIUM confidence
- [victory-native-xl Skia v2 issue #616](https://github.com/FormidableLabs/victory-native-xl/issues/616) — MEDIUM confidence (confirms conflict)
- [react-native-svg Expo docs](https://docs.expo.dev/versions/latest/sdk/svg/) — official, HIGH confidence
- [expo-build-properties docs](https://docs.expo.dev/versions/latest/sdk/build-properties/) — official, HIGH confidence
- [Expo Changelog — RN 0.77 + SDK 52](https://expo.dev/changelog/2025-01-21-react-native-0.77) — official, HIGH confidence
