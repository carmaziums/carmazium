# Native appearance preference engine — Block 2/10
Date: 2026-10-10 · Issue #502 · **Draft source-only; not live theme parity**

## Scope completed
The shared native `NativeAppearanceProvider` now prepares a device-wide Light/Dark/System preference *before* app navigation and authenticated UI mount.

- `src/theme/NativeAppearanceProvider.tsx` owns one stable preference storage key `carmazium:native:appearance:v1` in local device AsyncStorage; there is **no backend write** and preference is not coupled to dealer/buyer accounts.
- `useColorScheme()` subscribes through React Native to OS appearance changes. In System preference, `resolveNativeAppearance` recomputes the selected light/dark semantic palette without remote data.
- Startup initially uses a safe existing dark palette and waits for the saved preference before rendering the app's navigation tree. Corrupt/unsupported values or AsyncStorage rejection fail closed to dark. A 4-second timeout prevents an indefinite dark blank while a hanging storage API is resolving; late reads after timeout are ignored.
- `setAppearancePreference(next)` validates the requested value, refuses writes before hydration, serialises successive storage updates, returns true only on successful persistence, and does not claim a failed write succeeded. The context exports the saved preference, current resolved mode, immutable semantic palette, hydration status and asynchronous setter.
- `App.tsx` mounts `AppContent` inside `NativeAppearanceProvider`; its existing signed-in routing, payment provider, status bar and global layers are unchanged.

## Important staging and limitations
- **This provider does not change colours in Block 2.** App navigation still uses `dark: true`, status bar remains light, existing static `Colors` and all screens continue using their established dark palette. This prevents an illegible half-themed app before Blocks 3–9 migrate navigation, shared components, full buyer/dealer flows, and settings.
- A genuine user-facing Light/Dark/System picker is not yet available. Do NOT remove the honest Account Settings warning until actual live theme switching is verified across the whole app.
- React Native System mode is not the same as syncing the website's separate theme preference across devices; the website and native app may store their chosen appearances independently. No account or server sync is promised.
- A successful Source/TypeScript test is not physical Android/iPhone QA. Dark/Light/System restart, OS toggles, persistence failure and rapid selection changes need device testing after complete migration.
- No public APK URL or iOS TestFlight link was activated, no production DB/payment/auth/role/auction changes, no signing keys accessed.

## Verification
- `scripts/test-native-theme-persistence-block2.test.mjs` dynamically transpiles and runs the pure TypeScript appearance resolver for normal/invalid/System preferences, checks frozen website-matched tokens, and asserts native provider lifecycle/writes/startup via focused source contracts.
- The test runs in Release Certification alongside Block 1 website token checks and the full TypeScript/Backend/Product parity suite.
- Review order: #501 dealer-menu repair → #503 semantic tokens → this stacked Block 2 PR. Do not merge overlapping drafts independently.

## Next (Block 3)
Migrate `NavigationContainer`, `StatusBar`, header and bottom tab chrome to context palette with safe fallback, plus modal/backdrop surfaces. **Keep user-facing Light mode disabled** until shared components and screens have been fully converted.
