# Pitfalls Research: Carmazium Mobile — Remaining Features

**Domain:** Expo 52 React Native car marketplace — push notifications, EAS build, maps, multi-step forms, WebSocket bridge, charts, KYC uploads, deep linking
**Researched:** 2026-05-30
**Overall Confidence:** HIGH (most pitfalls verified against official Expo docs, GitHub issues, and SDK changelogs)

---

## Push Notifications Pitfalls

### Pitfall 1: Missing Android Notification Channel Causes Silent Drop
**What goes wrong:** Android 8.0+ silently discards all notifications if no channel exists. No error is thrown, no log appears — the notification simply never surfaces. Nine out of ten Android notification failures trace back to this.
**Why it happens:** Developers call `getExpoPushTokenAsync()` or schedule notifications before calling `setNotificationChannelAsync()`. The channel must exist before any notification is sent or received.
**Prevention:** Call `setNotificationChannelAsync()` once at app startup (in the root layout or the notification registration utility) before any other notification API call. Set `importance: Notifications.AndroidImportance.HIGH` for heads-up (pop-on-screen) behaviour. Create separate channels for auction bids, messages, and system alerts so users can disable categories independently.
**Phase:** Push notifications setup phase — Day 1 of implementation, not Day 2.

---

### Pitfall 2: Android "Miscellaneous" Channel Hijacks Backgrounded Notifications
**What goes wrong:** Even when a custom channel is set, backgrounded notifications on some Android builds silently fall into a system-created "Miscellaneous" channel whose default importance disables heads-up display. The notification arrives but never pops.
**Why it happens:** Android routing bug: without an explicit `channelId` on every individual notification payload, the OS re-routes to "Miscellaneous".
**Prevention:** Always include `channelId` on every notification object, both in the Expo Push API payload (`to`, `title`, `body`, `channelId`) and in any local notification scheduled via `scheduleNotificationAsync`. The channel must match a channel created via `setNotificationChannelAsync`.
**Phase:** Push notifications setup phase. Validate with a physical Android device in both foreground and background states before marking complete.

---

### Pitfall 3: Push Notifications Require a Development Build — Expo Go Does Not Work on Android
**What goes wrong:** Developers test in Expo Go and notice notifications never arrive on Android, or only arrive on iOS. The feature appears broken but is a Expo Go limitation.
**Why it happens:** As of SDK 52, Expo deprecated push notifications in Expo Go on Android. SDK 53 removed it entirely. Remote push notifications (as opposed to local in-app notifications) require a custom development build with your own credentials.
**Prevention:** Create a development build (`eas build --profile development`) before writing any push notification code. Do not use Expo Go as a notification test target on Android at all. iOS Expo Go retains support via EAS auto-configuration, but a dev build is safer across both platforms.
**Phase:** Must be addressed at project infrastructure setup before any notification feature work begins.

---

### Pitfall 4: `useLastNotificationResponse` Does Not Catch Cold-Start Taps on iOS Without Early Listener Registration
**What goes wrong:** On iOS, if the app is killed and the user taps a notification to launch it, `useLastNotificationResponse` may miss the response because the listener was not registered at module load time.
**Why it happens:** On iOS, the notification response is delivered very early in the process lifecycle. If `addNotificationResponseReceivedListener` is only registered inside a component's `useEffect`, it may be called after the response has already been dispatched and lost.
**Prevention:** Register `addNotificationResponseReceivedListener` at module top-level (outside any component, in a `notifications.ts` utility imported in the root layout). Check `getLastNotificationResponseAsync()` in the root layout's `useEffect` on every app start to handle the cold-start case. With Expo Router 4, handle navigation in the root `_layout.tsx` so the router is mounted before any navigation attempt.
**Phase:** Push notifications phase. Specifically test the killed-app tap scenario on a physical iOS device with TestFlight or a dev build.

---

### Pitfall 5: `getExpoPushTokenAsync()` Hangs Indefinitely on iOS Simulator
**What goes wrong:** The call to `getExpoPushTokenAsync()` never resolves on the iOS Simulator, causing the registration flow to hang silently.
**Why it happens:** APNs does not function on the iOS Simulator. The call cannot complete.
**Prevention:** Guard the entire token registration block with `Device.isDevice` from `expo-device`. Only call `getExpoPushTokenAsync()` on physical devices. Provide a graceful fallback message or skip the flow on simulators. Never `await` the token call without a timeout guard.
**Phase:** Push notifications phase.

---

### Pitfall 6: Stale Push Token — DeviceNotRegistered Error Not Handled
**What goes wrong:** After a user reinstalls the app on Android, a new token is generated. Old tokens on your backend continue to receive `DeviceNotRegistered` errors from Expo's push service. These pile up and cause noise.
**Why it happens:** On Android, reinstalling generates a new FCM registration token. The old one is invalidated immediately.
**Prevention:** In the Carmazium backend (NestJS), handle the `DeviceNotRegistered` error from Expo Push API responses and delete/update the stored token for that user. On the mobile side, re-register the token on every app launch (not just first install) and PATCH the backend if the token differs from the stored value.
**Phase:** Push notifications phase, and revisit during backend webhook integration.

---

## EAS Build / App Store Pitfalls

### Pitfall 1: iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) Causes Submission Rejection
**What goes wrong:** App Store Connect rejects the build with an error referencing required reason APIs (UserDefaults, file timestamps, disk space, system boot time, active keyboard) that lack declared reasons in `PrivacyInfo.xcprivacy`.
**Why it happens:** Apple mandated `PrivacyInfo.xcprivacy` for all apps as of spring 2024. Third-party CocoaPods dependencies (including many Expo SDK packages) access these APIs but Apple does not always correctly parse the privacy manifests from static dependencies, requiring you to declare their API reasons in your app's own manifest.
**Prevention:** Add `expo.ios.privacyManifests` to `app.json` with `NSPrivacyAccessedAPITypes` entries. The Expo docs provide the correct reason codes. Audit every native dependency for API usage. EAS Build with SDK 52+ defaults to Xcode 16, which is required by Apple as of April 2025.
**Phase:** EAS Build / App Store preparation phase, before first TestFlight build.

---

### Pitfall 2: Android Must Be Manually Uploaded First Before EAS Submit Works
**What goes wrong:** `eas submit --platform android` fails because the Google Play API requires at least one build to have been manually uploaded through the Play Console before API-based submissions are accepted.
**Why it happens:** Google Play's publishing API only works for apps that already exist in the console with an initial manual upload. This is a Google policy, not an EAS bug.
**Prevention:** For the first Android release, upload the AAB manually via the Play Console web UI. All subsequent submissions can use `eas submit`. Document this as a one-time step in the release runbook.
**Phase:** App Store preparation phase, first Android release.

---

### Pitfall 3: Google Maps API Key Leaked in App Bundle / Not Restricted
**What goes wrong:** The Google Maps API key ends up embedded in the app binary without restrictions, exposing it to abuse and unexpected billing charges.
**Why it happens:** Developers place the API key directly in `app.json` or commit it to version control. Unrestricted keys are trivially extractable from Android APKs/AABs.
**Prevention:** Store the key as an EAS secret (`eas secret:create`). Reference it in `app.config.js` (not `app.json`) using `process.env.GOOGLE_MAPS_API_KEY`. Restrict the Android key by package name (`co.carmazium.app`) and the SHA-1 certificate fingerprint. Restrict the iOS key by the bundle identifier (`co.carmazium.app`).
**Phase:** Map feature phase and EAS Build phase. Do not defer key restriction until submission.

---

### Pitfall 4: Production Signing Key SHA-256 Differs from Debug Key in `assetlinks.json`
**What goes wrong:** Deep links and Android App Links work perfectly in a development build but silently fall back to the browser in the production build.
**Why it happens:** `assetlinks.json` was populated with the debug keystore SHA-256. The production build uses the upload keystore (or Google Play App Signing key), which has a different fingerprint.
**Prevention:** Use `eas credentials` to obtain the SHA-256 of the production signing certificate. If using Google Play App Signing, retrieve the SHA-256 from the Google Play Console under App integrity. Include both the upload key and the App Signing key fingerprints in `assetlinks.json` so both work. Verify with `adb shell pm get-app-links co.carmazium.app`.
**Phase:** Deep linking phase, but validated again during EAS Build production phase.

---

### Pitfall 5: Provisioning Profile Expires Every 12 Months
**What goes wrong:** A production iOS build fails in CI with a provisioning profile expiry error 12 months after initial setup.
**Why it happens:** Apple distribution provisioning profiles expire after 12 months. Revoking or allowing the associated distribution certificate to expire also invalidates the profile immediately.
**Prevention:** Use EAS managed credentials (`"credentialsSource": "remote"` in `eas.json`) so Expo handles rotation. Set a calendar reminder to review credentials 30 days before the anniversary. Never revoke your distribution certificate without regenerating the provisioning profile first.
**Phase:** EAS Build phase.

---

### Pitfall 6: `infoPlist` Purpose Strings Missing for Permissions Used by Dependencies
**What goes wrong:** The build is rejected by App Store Review because a native dependency (e.g., an analytics SDK or a library used by Expo) accesses a permission-gated API without a corresponding `NSXxxUsageDescription` in `Info.plist`.
**Why it happens:** Carmazium's `app.json` already includes `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSLocationWhenInUseUsageDescription`, but dependencies (maps, notifications) can pull in additional APIs. Missing a single string causes a hard rejection.
**Prevention:** After each new native dependency is added, run `npx expo prebuild --clean` and inspect the generated `ios/[AppName]/Info.plist` to verify all required keys are present. Keep a checklist: location (already added), camera (already added), photo library (already added), microphone (not needed — but verify).
**Phase:** EAS Build phase, run the check before every TestFlight submission.

---

## Map Performance Pitfalls

### Pitfall 1: `tracksViewChanges={true}` on Custom Markers Tanks Frame Rate
**What goes wrong:** Custom marker components (car listing cards used as pins) cause the map to drop to below 30 FPS when more than ~30 markers are visible, making scrolling and panning feel laggy.
**Why it happens:** `tracksViewChanges` is `true` by default on `<Marker>`. This causes React Native to re-render the native marker view on every JS render cycle, multiplied by the number of visible markers.
**Prevention:** Set `tracksViewChanges={false}` on every `<Marker>` once the image content has fully loaded. If the marker state can change (e.g., a "selected" outline), use a controlled update pattern: set to `true` briefly while updating, then back to `false`. Keep custom marker components as lightweight as possible — avoid Animated values or heavy shadow styles inside markers.
**Phase:** Map / Near Me feature phase.

---

### Pitfall 2: `onRegionChange` Fires Continuously and Triggers Expensive Re-fetches
**What goes wrong:** Every pan or zoom gesture fires dozens of `onRegionChange` events per second, each potentially triggering a new API call to fetch listings in the viewport, which floods the backend and degrades UI performance.
**Why it happens:** `onRegionChange` fires on every frame of the gesture. Developers attach data-fetching logic to it thinking it is a drag-end event.
**Prevention:** Use `onRegionChangeComplete` (fires once after the gesture ends) for all data fetching and clustering recalculation. Add a debounce of 300–500ms even on `onRegionChangeComplete` to handle rapid successive zoom changes.
**Phase:** Map / Near Me feature phase.

---

### Pitfall 3: No Marker Clustering with Many Listings Causes Rendering Collapse
**What goes wrong:** With 50+ listing pins visible simultaneously, the map becomes unresponsive. On lower-end Android devices, the app can crash outright.
**Why it happens:** Each marker is an independent native view. React Native's bridge cannot sustain synchronous updates for many markers simultaneously.
**Prevention:** Use `react-native-map-clustering` (a wrapper around `react-native-maps` with SuperCluster) from the first day of map work. Do not prototype without clustering and "add it later" — clustering changes the component hierarchy. For the Near Me view, cluster at all zoom levels and only expand individual pins at street-level zoom.
**Phase:** Map / Near Me feature phase. Clustering is not optional even for MVP.

---

### Pitfall 4: Google Maps API Key Not Configured in `app.json` Plugin — Map Shows Blank on Android
**What goes wrong:** The map renders a white/blank screen on Android in a production or preview build, even though it appears correctly in a development build or on iOS.
**Why it happens:** `react-native-maps` requires the Google Maps API key to be embedded at native build time via the `@react-native-maps/maps` config plugin entry in `app.json`. Without it, the Android map initialises with no API key and renders blank. The iOS map uses Apple Maps by default (no API key required), masking the issue during iOS-first development.
**Prevention:** Add the config plugin to `app.json` with both `androidGoogleMapsApiKey` and `iosGoogleMapsApiKey` pointing to EAS secrets. Rebuild the development build after adding the plugin — a JS-only reload is not sufficient.
**Phase:** Map / Near Me feature phase, before writing any map UI code.

---

## Multi-step Form / Image Upload Pitfalls

### Pitfall 1: iOS Returns HEIC Files That the Backend Rejects
**What goes wrong:** On iPhone, `launchImageLibraryAsync()` returns `.heic` files when `allowsEditing: false` (the SDK 54+ default). The Carmazium NestJS backend likely only accepts JPEG/PNG. Uploads silently fail or return a 415 error.
**Why it happens:** iOS stores photos natively as HEIC for efficiency. Expo's picker returns the original asset when `allowsEditing` is disabled and `videoExportPreset` is `Passthrough`. There is also a known Expo bug where the `mimeType` is reported as `image/jpeg` but the actual file is still HEIC.
**Prevention:** After picking, always transcode through `expo-image-manipulator`: `manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 0.85 })`. This guarantees a JPEG output regardless of source format. Do not trust the `mimeType` returned by the picker on iOS. Apply this conversion in a shared `prepareImageForUpload()` utility function used by both the Sell My Car wizard and the KYC upload flow.
**Phase:** Sell My Car wizard phase and KYC phase.

---

### Pitfall 2: Wizard State Lost on Back-Navigation or App Backgrounding
**What goes wrong:** User fills in 3 of 6 wizard steps, receives a phone call (app backgrounds), returns, and finds the form blank. Or the user taps the hardware back button on Android and loses all progress.
**Why it happens:** Wizard step state held only in React `useState` is destroyed when the component unmounts, which happens on navigate-away in Expo Router. Android back gesture destroys the screen unless the navigation stack is managed carefully.
**Prevention:** Store the wizard's draft state in a dedicated Zustand slice (`useSellWizardStore`) persisted with `zustand/middleware/persist` using `AsyncStorage`. Load the draft on wizard mount and clear it only on successful submission. Implement a "Resume draft?" prompt if a draft exists and the user re-enters the wizard.
**Phase:** Sell My Car wizard phase.

---

### Pitfall 3: Image Upload Progress Not Communicated — Users Cancel Valid Uploads
**What goes wrong:** Large vehicle photos (3–6 MB raw) take 5–15 seconds to upload on mobile data. Without a visible progress indicator, users assume the app has frozen and either cancel or force-quit.
**Why it happens:** Standard `fetch()` does not expose upload progress. React Native's `XMLHttpRequest` does via `upload.onprogress`, but it is rarely used.
**Prevention:** Use `axios` with `onUploadProgress` callback or `XMLHttpRequest` directly to report upload progress. Display a per-image progress bar or percentage in the photo step of the wizard. Disable the "Next" button until all images have uploaded successfully. Pre-compress images client-side to <1.5 MB before upload to reduce wait time.
**Phase:** Sell My Car wizard phase.

---

### Pitfall 4: No File Size Validation Before Upload Causes Backend Rejection or OOM on Device
**What goes wrong:** Raw iPhone photos can be 8–15 MB. Uploading multiple uncompressed photos causes the request to time out, the backend to reject with a 413 error, or (on low-memory devices) the app to crash with an out-of-memory error during the upload buffer.
**Why it happens:** `expo-image-picker` returns the raw file URI with no size enforcement. Developers forget to validate before upload.
**Prevention:** After picking, check `FileSystem.getInfoAsync(uri)` for file size. If > 2 MB, compress with `expo-image-manipulator` reducing quality progressively until under the threshold. Enforce a maximum of 10 photos in the wizard to cap total upload payload. Show an error if the compressed result still exceeds the limit.
**Phase:** Sell My Car wizard phase and KYC phase.

---

### Pitfall 5: Requesting Media Library Permission Before Picker Opens Causes Double Dialog
**What goes wrong:** On iOS, a permissions dialog appears after the user selects a photo, creating a confusing two-step dialog flow that many users decline.
**Why it happens:** In SDK 54+, accessing the original HEIC/AVIF file (with `allowsEditing: false`) requires media library permission, displayed after selection. This is a separate permission from the photo picker itself.
**Prevention:** Explicitly call `requestMediaLibraryPermissionsAsync()` before opening the picker. This front-loads the permission dialog to a natural moment (before any picker appears). The `app.json` already includes `NSPhotoLibraryUsageDescription`; ensure the Android `READ_EXTERNAL_STORAGE` permission (also already declared) is confirmed granted before picker launch.
**Phase:** Sell My Car wizard phase (first screen with image upload).

---

## WebSocket → Local Notification Bridge Pitfalls

### Pitfall 1: Socket.IO Connection Is Killed When App Backgrounds on iOS
**What goes wrong:** Real-time auction bid updates and message notifications stop arriving within 30 seconds of the app entering the background on iOS, because the OS suspends the TCP connection.
**Why it happens:** iOS aggressively suspends background processes. A live Socket.IO connection (TCP) cannot be maintained indefinitely in the background. Socket.IO's built-in reconnection logic will fire when the app returns to foreground, but events sent during suspension are missed.
**Prevention:** This is the architectural core of the WebSocket → push bridge: **Socket.IO is a foreground delivery mechanism only.** For background delivery, the backend must send an actual Expo Push notification via the Expo Push API (FCM/APNs). Design the notification system with two paths: (1) foreground — Socket.IO `/notifications` namespace delivers real-time events, (2) background/killed — NestJS sends an Expo push token notification. The mobile app only needs Socket.IO for live in-app updates while active.
**Phase:** Push notifications + WebSocket integration phase.

---

### Pitfall 2: Duplicate Notifications When App Is Foreground (Socket.IO + Push Both Fire)
**What goes wrong:** Users receive the same notification twice: once as an in-app banner from Socket.IO and once as a system push notification from APNs/FCM.
**Why it happens:** The backend fires push notifications unconditionally whenever an event occurs. The mobile app is also connected via Socket.IO and handles the same event in real time.
**Prevention:** Implement a presence signal: when the `/notifications` Socket.IO namespace connects, send a `user:active` event to the backend. The backend stores this as an ephemeral presence flag (Redis or in-memory). Only send FCM/APNs push if the user is NOT currently active on the socket. When the socket disconnects (app backgrounds), the presence flag expires and push notifications resume.
**Phase:** WebSocket + push bridge integration phase.

---

### Pitfall 3: Socket.IO Reconnection Events Not Mapped to UI State — Stale Bid/Offer Data
**What goes wrong:** After a network interruption (tunnel, weak signal), the Socket.IO client silently reconnects but the auction room or offers screen still shows stale data from before the disconnection. Users bid on outdated prices.
**Why it happens:** Socket.IO reconnection fires the `connect` event again, but does not automatically re-fetch any state that was missed during the disconnection window. The app's Zustand auction store still holds the last-known values.
**Prevention:** Listen for the Socket.IO `connect` event (which fires on every successful connection, including reconnections) and trigger a TanStack Query refetch of auction state. In the auction room component, show a "Reconnecting..." badge when the socket status is not `connected`. Configure explicit reconnection parameters: `reconnectionAttempts: 10`, `reconnectionDelayMax: 5000`.
**Phase:** Auction room and notifications phase. Test with airplane mode toggle.

---

### Pitfall 4: Auth Token on Socket.IO Connection Not Refreshed — Stale Supabase Token
**What goes wrong:** The Socket.IO handshake uses the Supabase access token passed as `auth: { token }`. Supabase access tokens expire after one hour. After expiry, the socket reconnects with an expired token and the NestJS `SessionAuthGuard` rejects the connection, silently dropping all authenticated events.
**Why it happens:** The token is captured once at socket initialisation and baked into the handshake options. Reconnection reuses the same options object with the expired token.
**Prevention:** Implement a token refresh hook: before reconnecting (using the `reconnect_attempt` Socket.IO event), call `supabase.auth.getSession()` to obtain a fresh access token, and update the socket's `auth` object: `socket.auth = { token: freshToken }`. Ensure the Zustand auth store triggers socket auth updates when the Supabase session refreshes.
**Phase:** Socket.IO + auth integration phase.

---

## Deep Linking Pitfalls

### Pitfall 1: Notification Tap Deep Links Navigate Before Expo Router Is Mounted
**What goes wrong:** Tapping a push notification that should open `carmazium://auction/123` causes a "Route not found" error or navigates to the wrong screen, particularly on cold start.
**Why it happens:** The notification response handler fires early in the process lifecycle. Expo Router's navigation context may not yet be mounted when `router.push()` is called.
**Prevention:** In the root `_layout.tsx`, use `useLastNotificationResponse` in a `useEffect` that depends on both the notification response AND a `routerReady` flag. Only navigate once the router is confirmed mounted. Alternatively, store the pending deep link URL in Zustand and consume it in a `useEffect` inside the main tab navigator once rendered. Do not attempt navigation in the notification handler callback directly.
**Phase:** Push notifications + deep linking phase.

---

### Pitfall 2: Universal Links / App Links Fall Through to Browser in Production
**What goes wrong:** `https://carmazium.co.uk/auction/123` opens in Safari/Chrome instead of the app in the production build, even though the custom scheme `carmazium://` works correctly.
**Why it happens:** Either: (a) the AASA file (`apple-app-site-association`) is not served at `https://carmazium.co.uk/.well-known/apple-app-site-association` with the correct content-type (`application/json`), (b) the `assetlinks.json` on Android includes the wrong SHA-256 fingerprint for the production signing key, or (c) the associated domains entitlement in the iOS build does not match the domain exactly.
**Prevention:** Verify the AASA file is reachable and valid using Apple's validation tool before submitting. Ensure `expo.ios.associatedDomains` in `app.json` includes `"applinks:carmazium.co.uk"`. For Android, extract the production SHA-256 via `eas credentials` and put it in `assetlinks.json`. Note: Android verification can take up to 20 seconds after install; wait before testing. Test universal links from Messages or Notes, not from a browser address bar (browsers intentionally suppress App Links).
**Phase:** Deep linking phase, validated again during EAS production build phase.

---

### Pitfall 3: Custom Scheme `carmazium://` Opens Correctly on iOS But Fails on Android in Some Contexts
**What goes wrong:** The custom URL scheme works from a browser but not when tapped from a push notification data payload on Android.
**Why it happens:** Android does not allow apps to open custom URI schemes from implicit intents in all contexts (particularly from background services or notification trampoline activities, which were restricted in Android 12+).
**Prevention:** For notification deep links on Android, use the `https://` universal link URL in the notification data payload rather than the custom `carmazium://` scheme. Android App Links (https://) are handled reliably from notification taps. Keep the custom scheme for programmatic in-app navigation only.
**Phase:** Deep linking + push notifications integration phase.

---

### Pitfall 4: Expo Router `expo-linking` and `useURL` Re-renders on Every Focus Event
**What goes wrong:** Screen components that use `useURL()` from `expo-linking` re-render repeatedly as the user navigates between tabs, causing visible flicker or redundant API calls.
**Why it happens:** `useURL()` emits a new event on each tab focus in some Expo Router configurations, not just on actual deep link arrival.
**Prevention:** Do not use `useURL()` for deep-link-to-navigation bridging at the tab level. Instead, handle deep link routing exclusively in the root `_layout.tsx` using `Linking.addEventListener` and process it once. Use Expo Router's built-in file-based routing for all expected paths — the router automatically handles in-app navigation from deep links without any manual `useURL` usage.
**Phase:** Deep linking phase.

---

## Dealer Analytics Charts Pitfalls

### Pitfall 1: SVG-Based Chart Libraries (react-native-chart-kit) Lag on Datasets > 200 Points
**What goes wrong:** The dealer analytics screen with sales velocity charts or revenue over 90 days becomes janky or unresponsive, dropping below 30 FPS on mid-range Android devices.
**Why it happens:** SVG-based charting libraries like `react-native-chart-kit` render each data point as a DOM-equivalent SVG node over the JS bridge. Large datasets create many nodes that the bridge cannot update at frame rate.
**Prevention:** Use `victory-native` (XL version, `@formidable-labs/victory-native-xl`) which renders via React Native Skia, bypassing the JS bridge for rendering. For datasets > 200 points (e.g., daily stats for a year), downsample to 60–100 representative points before passing to the chart — there is no visual benefit to plotting 365 individual bars on a 375px-wide screen. Pre-aggregate data in the TanStack Query fetch layer, not inside the chart component.
**Phase:** Dealer analytics phase.

---

### Pitfall 2: Chart Re-renders on Every Parent State Change Causing Skia Reallocation
**What goes wrong:** The analytics screen shows visible chart flicker when any unrelated state (e.g., a tab badge count) updates, even when chart data has not changed.
**Why it happens:** If the chart data array is not memoised, a new array reference is created on every render, causing Victory Native / Skia to fully re-render the chart surface.
**Prevention:** Wrap chart data derivation in `useMemo`. Isolate chart components behind `React.memo`. Keep chart state (selected data point, tooltip visibility) in local component state rather than global Zustand, to prevent global store updates from triggering chart re-renders.
**Phase:** Dealer analytics phase.

---

## General Expo 52 / EAS Pitfalls

### Pitfall 1: NativeWind v4 Dark Mode Requires `userInterfaceStyle: "automatic"` in `app.json`
**What goes wrong:** NativeWind `dark:` prefix classes have no effect. The entire app stays in light mode (or dark mode) regardless of user preference or the `colorScheme.set()` call.
**Why it happens:** Carmazium's `app.json` has `"userInterfaceStyle": "dark"` (dark mode forced). NativeWind's dark mode class system reads the OS colour scheme, but with `"dark"` forced, the native side never reports "light" — the variant selector cannot toggle. The inverse: setting to `"light"` means `dark:` classes never activate.
**Prevention:** Since Carmazium is intentionally dark-first with a forced dark UI, do not use the NativeWind `dark:` prefix at all — write all styles as the canonical style. Only switch to `"automatic"` if a theme toggle is introduced. This is confirmed correct for the current `app.json` configuration.
**Phase:** Relevant to all UI phases. Document as a team convention at project start.

---

### Pitfall 2: `expo-secure-store` Size Limit (2048 Bytes) Causes Silent Write Failure for Large Tokens
**What goes wrong:** Storing a Supabase session object (which can exceed 2048 bytes due to JWT payloads + refresh tokens) in `SecureStore` silently fails on iOS. The auth state appears to save but is empty on next launch.
**Why it happens:** iOS Keychain items accessed via `expo-secure-store` have a 2048-byte value limit. Values exceeding this are rejected without an error in some SDK versions.
**Prevention:** Store only the minimum required fields: `{ access_token, refresh_token, expires_at }`. Do not store the full Supabase session JSON blob. Reconstruct the session on launch using `supabase.auth.setSession({ access_token, refresh_token })`. This is also better security hygiene.
**Phase:** Auth phase (already completed scaffold) — validate this now if not already done.

---

### Pitfall 3: Expo Router Typed Routes Generate Invalid Types When Route Files Have Build Errors
**What goes wrong:** TypeScript compilation fails across the entire project with cryptic type errors in `expo-router` generated types, not at the actual location of the bug.
**Why it happens:** Expo Router 4 with `experiments.typedRoutes: true` (already enabled in `app.json`) generates route type definitions from the file system. If any route file has a TypeScript or syntax error, the generated types become invalid and cascade errors everywhere.
**Prevention:** Fix TypeScript errors file-by-file. Use `npx tsc --noEmit` to surface all errors and resolve them in file order. When adding new route files, stub them with valid TypeScript exports immediately rather than leaving them empty or with `// TODO` placeholders.
**Phase:** Ongoing throughout all feature phases.

---

### Pitfall 4: TanStack Query Cache Serves Stale Data After Realtime Socket Updates
**What goes wrong:** A Socket.IO event updates auction bid data in the Zustand store, but the TanStack Query cache for the same auction still serves the old data on screen until the `staleTime` expires.
**Why it happens:** TanStack Query and Zustand manage the same domain data independently. Socket events update Zustand directly, but TanStack Query is unaware of the change.
**Prevention:** After receiving a Socket.IO event that invalidates cached data (e.g., new bid placed, offer accepted), call `queryClient.invalidateQueries({ queryKey: ['auction', id] })` to trigger a background refetch. Use `queryClient.setQueryData` for optimistic updates where the new data is already available from the socket payload. Decide and document the source-of-truth rule per entity: Socket.IO events are the trigger, TanStack Query is the cache.
**Phase:** Auction room phase (already partially scaffolded). Apply the same pattern consistently in all phases that use both Socket.IO and TanStack Query.

---

## Phase-Specific Warning Summary

| Phase | Pitfall to Address First | Mitigation |
|-------|--------------------------|------------|
| Push Notifications | Android channel creation must precede all other notification code | Call `setNotificationChannelAsync` in root layout before any other notification API |
| Push Notifications | Dev build required — do not use Expo Go on Android | Set up EAS development profile before writing notification code |
| Map / Near Me | Clustering is not optional for >30 pins | Install `react-native-map-clustering` on Day 1 of map work |
| Map / Near Me | Google Maps API key must be in `app.json` plugin, not env only | Configure plugin, rebuild dev build before any map testing |
| Sell My Car Wizard | HEIC images will be rejected by backend | Add `prepareImageForUpload()` utility using `expo-image-manipulator` before any upload code |
| Sell My Car Wizard | Draft state lost on back-navigation | Create Zustand sell wizard store with AsyncStorage persistence on Day 1 |
| KYC Upload | Same HEIC + file size issues as Sell wizard | Reuse `prepareImageForUpload()` utility |
| WebSocket Bridge | Socket.IO cannot deliver background notifications | Implement FCM/APNs push path in NestJS; Socket.IO is foreground-only |
| WebSocket Bridge | Duplicate notifications when app is active | Implement socket presence flag on backend before enabling push |
| Deep Linking | Router not mounted when cold-start notification fires | Route navigation through a `routerReady` + pending-link Zustand pattern |
| Deep Linking | Wrong SHA-256 in `assetlinks.json` for production build | Extract production fingerprint from `eas credentials` before testing App Links |
| EAS Build / App Store | Privacy manifest missing for dependency APIs | Add `privacyManifests` to `app.json` before first TestFlight build |
| EAS Build / App Store | First Android upload must be manual | Upload first AAB via Play Console web UI; document as one-time step |
| Dealer Analytics | SVG charts lag on large datasets | Use Victory Native XL (Skia) with data downsampling |
| All phases | NativeWind `dark:` classes have no effect | Carmazium is forced dark — do not use `dark:` prefix; write canonical dark styles |

---

## Sources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Push Notifications Troubleshooting and FAQ — Expo](https://docs.expo.dev/push-notifications/faq/)
- [Handle Incoming Notifications — Expo](https://docs.expo.dev/push-notifications/receiving-notifications/)
- [What You Need to Know About Notifications — Expo](https://docs.expo.dev/push-notifications/what-you-need-to-know/)
- [Expo SDK 53 Changelog (Push Notifications Deprecated in Expo Go Android)](https://expo.dev/changelog/sdk-53)
- [Android Notification Channel Issue — expo/expo #30762](https://github.com/expo/expo/issues/30762)
- [Notification Action Buttons Not Showing in Background/Killed — expo/expo #36282](https://github.com/expo/expo/issues/36282)
- [react-native-maps Expo Documentation](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Expo EAS Build: Google Maps Not Working — Medium](https://naqeebali-shamsi.medium.com/expo-eas-build-google-maps-not-working-with-react-native-maps-52847ea5f79f)
- [react-native-map-clustering npm](https://www.npmjs.com/package/react-native-map-clustering)
- [EAS Submit — Expo Documentation](https://docs.expo.dev/submit/introduction/)
- [Expo Privacy Manifests — Apple](https://docs.expo.dev/guides/apple-privacy/)
- [App Credentials — Expo Documentation](https://docs.expo.dev/app-signing/app-credentials/)
- [Android App Links — Expo Documentation](https://docs.expo.dev/linking/android-app-links/)
- [iOS Universal Links — Expo Documentation](https://docs.expo.dev/linking/ios-universal-links/)
- [Overview of Linking — Expo Documentation](https://docs.expo.dev/linking/overview/)
- [Handling Deep Links from Notifications — expo/router Discussion #627](https://github.com/expo/router/discussions/627)
- [ImagePicker — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [HEIC Gallery Photo MIME Reported as JPEG — expo/expo #35714](https://github.com/expo/expo/issues/35714)
- [Socket.IO Disconnect When App Goes to Background — socketio/socket.io Discussion #4346](https://github.com/socketio/socket.io/discussions/4346)
- [Victory Native XL — GitHub](https://github.com/FormidableLabs/victory-native-xl)
- [NativeWind Dark Mode Documentation](https://www.nativewind.dev/docs/core-concepts/dark-mode)
- [Making Expo Notifications Actually Work on Android 12+ — Medium](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845)
- [Expo EAS iOS Privacy Manifest Fixes 2026 — HeyDev](https://heydev.us/blog/expo-eas-ios-privacy-manifest-build-failures-2026)
- [EAS Build iOS Uploads Show Success But Never Reach App Store Connect — expo/eas-cli #3195](https://github.com/expo/eas-cli/issues/3195)
