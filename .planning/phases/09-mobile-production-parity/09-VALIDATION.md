---
phase: 9
slug: mobile-production-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc --noEmit`) — no jest setup in mobile app |
| **Config file** | `carmazium app/carmazium app/tsconfig.json` |
| **Quick run command** | `cd "carmazium app/carmazium app" && npx tsc --noEmit 2>&1 \| head -30` |
| **Full suite command** | `cd "carmazium app/carmazium app" && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick tsc check
- **After every plan wave:** Manual device test against physical Android APK
- **Before `/gsd:verify-work`:** Full tsc must be clean; all manual verifications done
- **Max feedback latency:** 15 seconds (TypeScript compile)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 9-01-01 | 01 | 1 | storageHelper | compile | `npx tsc --noEmit` | ⬜ pending |
| 9-01-02 | 01 | 1 | DVLA lookup | compile + manual | tsc + plate lookup in sim | ⬜ pending |
| 9-01-03 | 01 | 1 | photo upload | compile + manual | tsc + upload 2 photos | ⬜ pending |
| 9-01-04 | 01 | 1 | listing create | compile + manual | tsc + POST /listings visible | ⬜ pending |
| 9-01-05 | 01 | 1 | auction create | compile + manual | tsc + POST /auctions visible | ⬜ pending |
| 9-02-01 | 02 | 2 | Stripe listing fee | compile + manual | tsc + Payment Sheet presents | ⬜ pending |
| 9-02-02 | 02 | 2 | Stripe HPI fee | compile + manual | tsc + HPI Payment Sheet | ⬜ pending |
| 9-02-03 | 02 | 2 | Stripe auction fee | compile + manual | tsc + win screen payment | ⬜ pending |
| 9-03-01 | 03 | 3 | KYC doc upload | compile + manual | tsc + POST /dealers/kyc | ⬜ pending |
| 9-03-02 | 03 | 3 | dealer bid gate | compile + manual | tsc + unverified blocked | ⬜ pending |
| 9-04-01 | 04 | 4 | handover proof upload | compile + manual | tsc + POST /handover-proof | ⬜ pending |
| 9-04-02 | 04 | 4 | cold-start notification deep-link | compile + manual | tsc + cold-start nav | ⬜ pending |
| 9-04-03 | 04 | 4 | notif deep-link | compile + manual | tsc + cold-start nav | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Parallel execution note:** Waves 2 and 3 are independent and can run in parallel. Wave 2 (09-02-PLAN: Stripe payments) and Wave 3 (09-03-PLAN: Dealer KYC) both depend only on Wave 1 completing. They do NOT depend on each other — assign to separate executors or run sequentially in either order.

---

## Wave 0 Requirements

- [ ] Install missing packages: `npx expo install expo-image-manipulator base64-arraybuffer @react-native-async-storage/async-storage expo-document-picker`
- [ ] Verify packages resolve without peer conflicts: `npx expo-doctor`
- [ ] Confirm `StripeProvider` already in `App.tsx` (do not re-add)

*TypeScript infrastructure already exists — no test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DVLA auto-submit at 7-8 chars | Wave 1 | Requires physical keyboard input on device | Type a UK plate (e.g. AB12 CDE) char by char; lookup fires at 7th char |
| HEIC photo converts silently | Wave 1 | Requires device with HEIC camera output | Take a photo on iOS device; confirm uploaded URL is .jpg not .heic |
| Photo upload progress bars | Wave 1 | Visual UI — cannot assert with tsc | Upload 3 photos; each must show 0→100% progress individually |
| Stripe Payment Sheet dark theme | Wave 2 | Visual — theming not assertable via tsc | Trigger listing fee sheet; confirm black background, red accent |
| KYC pending screen after submit | Wave 3 | Requires backend KYC endpoint response | Submit KYC; confirm pending state screen shown (not spinner) |
| Dealer bid blocked (unverified) | Wave 3 | Requires dealer account without KYC | Log in as unverified dealer; try to bid; confirm modal shown |
| HPI report inline display | Wave 4 | Requires HPI endpoint to return data | Tap "Check HPI"; complete Stripe payment; confirm summary shown inline |
| Cold-start notification nav | Wave 4 | Requires killing app + tapping notification | Kill app; send test push; tap; confirm correct screen opens |
| Push deep-link all 10 types | Wave 4 | Requires triggering 10 different notification events | Trigger each of the 10 notification types; verify each navigates correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc) or manual test instructions above
- [ ] Sampling continuity: tsc run after every commit
- [ ] Wave 0 package installs confirmed before Wave 1 begins
- [ ] No watch-mode flags used in CI-equivalent checks
- [ ] Feedback latency < 15s for compile checks
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
