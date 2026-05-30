---
plan: "01-01"
status: complete
completed: 2026-05-30
---

# Plan 01-01 Summary: EAS Build Configuration

## What Was Built

Created the full EAS build configuration layer that gates all physical-device push notification testing.

## Key Files Created/Modified

- **`mobile/eas.json`** — EAS build profiles: `development` (developmentClient: true, internal distribution), `preview` (internal), `production` (autoIncrement). Submit config for iOS (App Store Connect) and Android (Play Store internal track).
- **`mobile/app.json`** — Added `extra.eas.projectId` (placeholder — replace via `eas build:configure` or expo.dev dashboard). Added `android.googleServicesFile: ./google-services.json`. Added `google-services.json` and `google-service-account.json` to `mobile/.gitignore`.
- **`mobile/assets/notification-icon.png`** — Minimal valid PNG placeholder (96×96 equivalent). **Designer must replace with 96×96 white-shape-on-transparent PNG before production build.**
- **`mobile/package.json`** — Added `react-native-gifted-charts@^1.4.77` and `react-native-svg@~15.8.0` as runtime dependencies.

## Deviations

None. All tasks executed as planned.

## Self-Check

- [x] `mobile/eas.json` exists with `build.development.developmentClient = true`
- [x] `mobile/app.json` has `extra.eas.projectId` (placeholder)
- [x] `mobile/app.json` has `android.googleServicesFile`
- [x] `mobile/assets/notification-icon.png` is a valid PNG (magic bytes 89 50)
- [x] `react-native-svg` and `react-native-gifted-charts` in `package.json`
- [x] `google-services.json` in `.gitignore`

## Developer Action Required

Before running `eas build --profile development`:
1. Run `cd mobile && eas build:configure` (or go to expo.dev → create project → copy project ID)
2. Replace `"REPLACE_WITH_REAL_PROJECT_ID_FROM_EAS_DASHBOARD"` in `mobile/app.json` with the real EAS project ID
3. Create Firebase project for `co.carmazium.app` → download `google-services.json` → place at `mobile/google-services.json` (not committed)
4. Replace `mobile/assets/notification-icon.png` with the real 96×96 brand icon

## Commit

`4325e327` — feat(phase-1): EAS build config — eas.json, projectId, notification-icon.png, gifted-charts
