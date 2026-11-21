# Android build 122 release-blocking stack navigation regression

Date: 2026-11-21. Existing production package `uk.carmazium.app` tested directly in BlueStacks Samsung SM-S908E (Android emulator-5554). No separate test app was created.

## Build 122 repro evidence

Installed **build 122 over build 121**, using the same production signer and `adb install -r`. The package's original installation timestamp remained `2026-11-20 11:36:34`; app data was not cleared.

Public guest-account actions:
- Home and Buy Cars rendered and loaded live marketplace listing cards.
- Opening the featured **BMW 7 Series YD68 VST** vehicle details from Buy Cars caused a persistent blank dark screen instead of the vehicle details and fullscreen gallery.
- Restarting the app and selecting **Pricing** from the native main menu caused the same blank screen.
- Navigating to **Login** rendered the normal sign-in form successfully.
- Android `adb logcat` showed `ReactNativeJS: TypeError: Cannot read property 'length' of undefined`, with a component stack beginning at `NativeStackNavigator`, at the moment the main-stack route was pushed (observed at 18:39:57 local emulator time).
- Private local screenshots: `C:\Users\Dell\CarMazium-QA-Tools\carmazium-122-bmw-details.png`, `carmazium-122-bmw-loaded.png`, `carmazium-122-pricing-test.png`, and `carmazium-122-login-test.png`.

## Code review and isolated mitigation

`MainStackNavigator.tsx` in build 122 had extended the previous stable guest-only `screenLayout` into a role-dependent layout. It subscribed to `accountRole` and conditionally nested `AdminBottomNav` or `PersonalDashboardBottomNav` in a native-stack screen wrapper, even though this wrapper is also used when transitions add routes. The older build-121 code rendered the existing `GuestGate` without those extra conditional wrappers.

The 123 hotfix restores the **same stable guest-only screen layout** as build 121. It preserves the `GuestGate` authentication check for account-only pages and the per-role dashboard tabs in `TabNavigator`. It deliberately removes role-specific bottom shortcuts from pushed stack pages as a temporary tradeoff. Those shortcuts require a separate per-screen implementation with device acceptance, not a dynamic wrapper on every native-stack route.

The code review identifies a strong regression candidate, **not yet a proven runtime root cause**. Rebuilding and testing on an emulator is mandatory.

## Checks and release gate

- Four source-level navigation tests pass, validating stable screenLayout, public vehicle/pricing/valuation routes, guest authentication gating and retained dashboard tabs.
- TypeScript and ESLint pass.
- Full Jest: 51 tests / 11 suites pass.
- The real success condition remains a **new signed build > 122** installed via `adb install -r` (without uninstalling build122), verifying public VehicleDetail and Pricing open without blank-screen crashes and that fullscreen BMW 1/N swipes and counting work.
- Then verify first-login guided tour, skip/replay, account cold-start persistence, and admin/dealer/buyer-seller role screens with authenticated sessions.
- Customer site continues to offer build 111. **Do not publish or enable OTA** until all critical routes work.

No dashboard-card consolidation changes are authorised or included.
