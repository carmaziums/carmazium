---
phase: 1
slug: eas-build-and-full-push-notification-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type checking (tsc --noEmit) + Jest (unit) + manual device tests |
| **Config file** | `mobile/tsconfig.json` (exists) |
| **Quick run command** | `cd mobile && npx tsc --noEmit` |
| **Full suite command** | `cd mobile && npx tsc --noEmit && npx jest --testPathPattern=notifications` |
| **Estimated runtime** | ~15 seconds (tsc), ~30 seconds (tsc + jest) |

---

## Sampling Rate

- **After every task commit:** Run `cd mobile && npx tsc --noEmit`
- **After every plan wave:** Run `cd mobile && npx tsc --noEmit && npx jest --testPathPattern=notifications`
- **Before `/gsd:verify-work`:** Full suite must be green + manual device test checklist complete
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Requirement | Test Type | Automated Command | Status |
|---------|-------------|-----------|-------------------|--------|
| EAS json + app.json config | INFRA-01, INFRA-05 | manual | `cd mobile && cat eas.json && cat app.json \| grep projectId` | ⬜ pending |
| notification-icon.png asset | INFRA-04 | automated | `test -f mobile/assets/notification-icon.png && echo OK` | ⬜ pending |
| gifted-charts install | INFRA-06 | automated | `cd mobile && npx tsc --noEmit` (import resolves) | ⬜ pending |
| Android channel creation | INFRA-03 | manual | Launch on Android device, check logcat for channel creation | ⬜ pending |
| registerForPushNotificationsAsync | INFRA-02 | manual | Login on physical device, verify token written to backend preferences | ⬜ pending |
| Foreground notification handler | PUSH-01–05 | manual | Trigger event, verify banner appears while app is open | ⬜ pending |
| Background notification delivery | PUSH-01–05 | manual | Background app, trigger event, verify OS notification appears | ⬜ pending |
| Deep link from notification tap | PUSH-06 | manual | Tap notification, verify correct screen opens (3 states: cold/warm/fg) | ⬜ pending |
| Notifications inbox screen | PUSH-07, PUSH-08 | automated | `cd mobile && npx tsc --noEmit` + visual inspection | ⬜ pending |
| Notification preferences screen | PUSH-09, PUSH-10 | automated | `cd mobile && npx tsc --noEmit` + manual toggle test | ⬜ pending |
| Backend pushToExpo() | PUSH-01–05 | manual | Trigger outbid event, verify Expo push receipt has no error | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `mobile/assets/notification-icon.png` — 96×96 white-on-transparent PNG created
- [ ] `mobile/__tests__/notifications.test.ts` — type-level stubs for notification helper functions
- [ ] `mobile/jest.config.js` — Jest config with ts-jest preset (if running unit tests)

*Note: Most Phase 1 verification is manual (physical device required for push notifications). TypeScript type checking is the primary automated gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push token stored in backend | INFRA-02 | Requires physical device + Expo push token infra | 1. Login on physical iOS or Android device 2. Check backend user preferences field for expoPushToken key |
| Foreground push notification appears | PUSH-01–05 | Requires physical device with EAS dev build | 1. Keep app open 2. Trigger outbid/offer/message event from another account 3. Verify in-app banner appears |
| Background push notification appears | PUSH-01–05 | Requires physical device, OS-level notification | 1. Background app 2. Trigger event 3. Verify OS notification tray shows notification |
| Cold-start deep link | PUSH-06 | Requires force-quit app state on device | 1. Force-quit app 2. Tap notification from tray 3. Verify app opens on correct screen (not home tab) |
| Warm-start deep link | PUSH-06 | Requires backgrounded app state | 1. Background app 2. Tap notification 3. Verify app navigates to correct screen |
| Android notification channel | INFRA-03 | Android-only, device-specific | 1. Install on Android 8+ device 2. Open Settings > Apps > Carmazium > Notifications 3. Verify channel "Carmazium" exists |
| Google FCM delivery | PUSH-01–05 | Requires google-services.json + Firebase project | 1. Configure Firebase project for co.carmazium.app 2. Background Android device 3. Trigger notification event 4. Verify receipt has no DeviceNotRegistered error |

---

## Validation Sign-Off

- [ ] `eas.json` created with development, preview, production profiles
- [ ] `extra.eas.projectId` in `app.json` matches EAS dashboard
- [ ] `notification-icon.png` exists at `mobile/assets/notification-icon.png`
- [ ] Android notification channel created in root layout
- [ ] Push token registration works on physical device (logged to backend)
- [ ] At least 1 notification event type delivers on physical device (foreground + background)
- [ ] Deep link from cold-start notification opens correct screen
- [ ] Notifications inbox renders with data from GET /notifications
- [ ] Notification preferences toggles persist across app restart
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
