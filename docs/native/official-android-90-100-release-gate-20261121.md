# CarMazium production Android app: 90–100% verification/release gate

Date: 21 November 2026. Current source branch `fix/native-app-tour-20261121` integrates current main (commit `ae7843aba4b83dca6f02e0fb04bbd1f418c1b081`) and the website/app comparison work. This report is for the **existing** production Android package, not an alternative QA application.

## User constraint: exact existing Android app, no separate testing app

- Source manifest package ID: `uk.carmazium.app`; display name CarMazium.
- Installed app on BlueStacks Samsung SM_S908E: `uk.carmazium.app`, build **121**, version **1.0.1**, preserved; no uninstall, data clearing or app replacement.
- Live website API `https://www.carmazium.com/api/app-version`: build **111**, version **1.0.1**, APK URL `https://www.carmazium.com/downloads/CarMazium-1.0.1-v111.apk` and pinned SHA256 beginning `c328d890...`. This is the older but same application. Customer download and Expo OTA were not changed.
- The next update must have Android **versionCode > 121**, the same signer as installed production build 121, same `uk.carmazium.app`, verified login persistence and first-party site-byte checksum integrity.
- No separate `uk.carmazium.qa` package was created or installed. Only production-source JavaScript and assets were exported, not an APK.

## Source integration

- Latest main already supplies `NativeGuidedTour` using the website's approved step copy and `NativeTourVoice`, plus auth/session restoration, warranty and service-job updates.
- Removed the older duplicate `NativeAppTour` and unused `expo-speech` dependency from the feature branch. App.tsx now mounts **one** `NativeGuidedTour` component.
- Retained prior blocks' official-app changes: role dashboard navigation, admin native read-only management screens, dealer inventory/listing routes, personal dashboard, search, gallery, notifications and settings.
- Extended mainline tour eligibility to admin/finance/insurance roles and added safe native admin route allowlist for the supported admin pages. Unsupported actions never receive an automatic tour navigation.
- Native first-use completion is per-account and separate from prior website walkthrough completion. Replays work through the same single tour store, backed by existing Account Settings control. Completion/skip write the already-existing backend tour acknowledgement only after a user action.
- Kept current main's sign-in restoration changes intact. Duplicate tour alerts and competing signup/login observers are not shipped.

## Verification completed in this working session

- Full native Jest suite, including vehicle card carousel, admin, dealer, buyer/seller, saved, notifications, gallery and tour checks: **51 passed / 51** across **11 suites**, after updating intentionally stale VehicleCard red-stub assertions to the current real ImageCarousel implementation.
- Mainline guided-tour interaction script: **8 passed / 8**. Narration lifecycle **3 passed / 3**; authentication-subscription **5 passed / 5**; service jobs **2 passed / 2**.
- TypeScript `tsc --noEmit` passed; targeted ESLint for the integrated modules passed; full Jest rerun passed 51/51 tests (11 suites).
- Production-profile Android Expo/Metro JS + asset export: **passed**, bundling 3,844 modules and generating the Android Hermes bundle in `C:\Users\Dell\CarMazium-QA-Tools\official-app-merged-android-js`. This is **not** an APK or a second app.
- Confirmed the original signing-key file exists at `C:\CarMaziumKey\carmazium-release.jks` but this working copy has neither the matching release keystore properties nor the build environment needed to produce a verified update-compatible APK. No signing secrets were accessed, copied or printed.

## Not yet verified: release blockers

1. The **new source has NOT been installed as a new production APK in BlueStacks**, and has not been accepted on a physical phone. Real fullscreen swipe/pinch, first-login/replay tour, dark mode, notifications, buyer/seller/dealer/admin navigation, and cold-restart login still require binary device testing.
2. **Signer continuity has not been proven** against build 121; the working copy lacks the trusted release signing configuration. Never substitute debug signing, use a different package ID, uninstall 121, or reset its data as a workaround.
3. The public website download remains **111**, while the emulator is on 121. Do not publish the branch or replace `/download-app` until an exact candidate binary is signed, installed over the existing app, tested and checksum-verified.
4. Some admin tools still open website URLs instead of native pages. The full vehicle-detail layout, listing valuation first step, purchase/finance/warranty action states and cross-role accessibility/dark-mode parity are not yet demonstrably identical. A 100% or 0.01%-difference claim would be unsupported.
5. The new native guide uses a safe page-level highlight; website tour can highlight individual DOM controls. Pixel-perfect spotlight equivalence remains unverified and is unlikely to be identical without additional measurement.
6. Consequential actions (offers, auction bids, handovers, payments, refunds, approvals) were not executed against live customer data. Use safe fixture accounts/transactions for those acceptance tests.

## Publication gate

Before release: obtain access to the **original** trusted signing configuration through the approved private CI/secrets process; build one `uk.carmazium.app` APK at versionCode >121; verify certificate digest and SHA-256; install it **over** build 121 with all user data retained; test on the same emulator against mobile Chrome with matching admin/dealer/personal accounts; run regression for gallery, tour, settings, notifications, stock, purchases and chat; then obtain explicit owner acceptance of the exact APK SHA-256 before updating the website's approved download URL and OTA settings.

No changes to the user-proposed dashboard-card consolidations have been implemented. Discuss those **after** technical app parity/release decisions, as requested.

**Status: source integration/verification completed to the extent supported; full 100% app parity and a public release are BLOCKED by the signed-binary/device acceptance gate and listed feature gaps.** Do not state this is a 100% parity-certified app.
