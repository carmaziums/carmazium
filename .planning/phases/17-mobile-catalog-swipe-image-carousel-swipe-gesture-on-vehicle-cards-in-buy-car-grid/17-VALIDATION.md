---
phase: 17
slug: mobile-catalog-swipe-image-carousel-swipe-gesture-on-vehicle-cards-in-buy-car-grid
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest with jest-expo preset |
| **Config file** | `carmazium app/carmazium app/jest.config.js` |
| **Quick run command** | `cd "carmazium app/carmazium app" && npx jest --testPathPattern=VehicleCard -x` |
| **Full suite command** | `cd "carmazium app/carmazium app" && npx jest` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite green + manual device smoke test
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Behaviour | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | Single-image card renders no GestureDetector | unit | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | 2+ image card renders indicator dots | unit | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | Dots count capped at 5 | unit | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-01-04 | 01 | 1 | Active dot index matches state | unit | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-01-05 | 01 | 1 | Image.prefetch called for indices 0-2 on mount | unit (mock) | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 2 | All 5 unit tests GREEN | unit | `jest --testPathPattern=VehicleCard` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 3 | TypeScript compiles clean | tsc | `cd "carmazium app/carmazium app" && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `carmazium app/carmazium app/src/components/VehicleCard.spec.tsx` — 5 unit test stubs covering render behaviours (created by Plan 17-01 as the first wave task)

*Existing jest-expo infrastructure covers all other needs.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Haptics fire on image advance (not during drag) | Device haptic feedback | Swipe card image on physical device, feel one subtle tap per advance |
| Spring rubber-band at boundaries | Reanimated physics — not testable in jest | Swipe past last image, feel spring pull-back; no hard stop |
| Snap threshold (flick vs. slow drag) | Velocity-based — no jest equivalent | Fast flick advances; slow drag under threshold springs back |
| Tap navigates to listing detail | Touch event co-existence | Tap (not swipe) a 2+ image card; confirm navigation |
| Vertical parent scroll unimpeded | Live gesture conflict | Scroll vertically past a 2+ image card; confirm no stutter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
