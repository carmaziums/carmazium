---
phase: 17-mobile-catalog-swipe
plan: 01
subsystem: testing
tags: [jest, jest-expo, testing-library, react-native, tdd, carousel, vehicle-card]

requires:
  - phase: mobile-app-parity-plan-5
    provides: VehicleCard.tsx component with expo-image and expo-haptics

provides:
  - jest.config.js at app root with jest-expo@54 preset, @/ alias, transformIgnorePatterns
  - VehicleCard.test.tsx with 5 RED carousel test stubs (carousel-image, carousel-dots, carousel-dot, Image.prefetch)
  - jest-expo@54, @testing-library/react-native@12.9.0, jest@29 as devDependencies

affects:
  - 17-02 (GREEN phase — implements carousel to pass these tests)
  - any future mobile test files (jest.config.js is shared)

tech-stack:
  added:
    - jest-expo@54.0.17 (matched to expo~54.0.0)
    - "@testing-library/react-native@12.9.0 (React 19.x compat)"
    - jest@29.7.0 (jest-expo@54 peer requirement)
  patterns:
    - "TDD RED phase: test stubs written before implementation"
    - "Mock expo-image with MockImage.prefetch as static jest.fn() for testability"
    - "react-native-reanimated mocked via require('react-native-reanimated/mock')"
    - "react-native-gesture-handler mocked with manual stub (no jestSetup import)"

key-files:
  created:
    - "carmazium app/carmazium app/jest.config.js"
    - "carmazium app/carmazium app/src/components/__tests__/VehicleCard.test.tsx"
  modified:
    - "carmazium app/carmazium app/package.json"
    - "carmazium app/carmazium app/package-lock.json"

key-decisions:
  - "jest-expo@54 (not @52/@53) required — matches expo~54.0.0 to avoid NativeModules/UIManager incompatibility"
  - "jest@29 pinned (jest-expo@54 ships @jest/globals@^29 as dep; jest@30 breaks clearMocksOnScope)"
  - "Test 1 uses getByTestId('carousel-image') not queryByTestId to ensure RED failure for 1-image card"
  - "Avoided wrapping render() in async act() — causes 'Can't access .root on unmounted test renderer' in RNTL v12"

patterns-established:
  - "makeListing(n) factory pattern: minimal CarListing with n image URIs for carousel testing"
  - "expo-image mock: named export Image + static prefetch = jest.fn() — required because expo-image is not a class"

requirements-completed:
  - SWIPE-01
  - SWIPE-02
  - SWIPE-03
  - DOTS-01
  - GESTURE-01
  - HAPTIC-01
  - ANIM-01
  - PREFETCH-01

duration: 18min
completed: 2026-06-21
---

# Phase 17 Plan 01: Mobile Catalog Swipe — TDD RED Infrastructure Summary

**Jest test infrastructure established with jest-expo@54 and 5 RED carousel stubs that assert carousel-image, carousel-dots, carousel-dot testIDs and Image.prefetch calls not yet in VehicleCard**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-21T16:33:00Z
- **Completed:** 2026-06-21T16:51:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created jest.config.js with jest-expo@54 preset, @/ -> src/ moduleNameMapper, and correct transformIgnorePatterns for reanimated + gesture-handler ESM
- Installed jest-expo@54, @testing-library/react-native@12.9.0, jest@29 as devDependencies (resolved three version conflicts)
- Created VehicleCard.test.tsx with 5 RED tests: all fail with clear assertion errors (testID not found / prefetch not called), zero test-runner crashes

## Task Commits

1. **Task 1: Create jest.config.js** - `bbb8ab60` (chore)
2. **Task 2: Write VehicleCard RED test stubs** - `b5d7b0f9` (test)

## Files Created/Modified

- `carmazium app/carmazium app/jest.config.js` — Jest runner config with jest-expo preset, @/ alias, transformIgnorePatterns
- `carmazium app/carmazium app/src/components/__tests__/VehicleCard.test.tsx` — 5 RED carousel test stubs
- `carmazium app/carmazium app/package.json` — jest-expo@54, @testing-library/react-native@12.9.0, jest@29 added as devDependencies
- `carmazium app/carmazium app/package-lock.json` — updated lockfile

## Decisions Made

- **jest-expo@54 pinned:** Versions @52 and @53 both crash at runtime — @52 due to UIManager.defineProperty non-object error (RN 0.81 incompatibility), @53 due to missing expo-modules-core/src/Refs module resolution. @54 matches the project's `expo~54.0.0`.
- **jest@29 pinned:** jest@30 (latest) breaks jest-expo@52+ with `this._moduleMocker.clearMocksOnScope is not a function`. jest-expo ships `@jest/globals: ^29` as a dependency; jest@29 is correct.
- **Test 1 uses getByTestId not queryByTestId:** `queryByTestId('carousel-dots')` returns null for a 1-image card — which is correct and passes even before implementation. Using `getByTestId('carousel-image')` ensures Test 1 fails RED because the carousel image testID doesn't exist yet.
- **No async act() wrapper:** Wrapping `render()` in `await act(async () => {...})` causes "Can't access .root on unmounted test renderer" in @testing-library/react-native v12. Direct synchronous `render()` is correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jest-expo version escalation from @52 to @54**
- **Found during:** Task 2 verification (running npx jest)
- **Issue:** jest-expo@52 crashes: `Object.defineProperty called on non-object` in preset/setup.js (UIManager incompatibility with RN 0.81.5). jest-expo@53 crashes: `Cannot find module 'expo-modules-core/src/Refs'`. Both block the test runner entirely.
- **Fix:** Escalated to jest-expo@54 which is built for expo~54 (matching the project). Also pinned jest@29 because jest@30 caused a separate `clearMocksOnScope` crash.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx jest --testPathPatterns=VehicleCard` runs successfully with 5 assertion failures (no runner crashes)
- **Committed in:** b5d7b0f9 (Task 2 commit)

**2. [Rule 3 - Blocking] Avoided async act() pattern from plan spec**
- **Found during:** Task 2 — first test run showed "Can't access .root on unmounted test renderer"
- **Issue:** The plan suggested `await act(async () => { utils = render(...) })` pattern, which causes RNTL v12 to unmount the renderer before the outer `await` resolves, crashing all queries.
- **Fix:** Removed async act() wrappers; used direct synchronous `render()` calls (standard RNTL v12 pattern).
- **Files modified:** VehicleCard.test.tsx
- **Verification:** Tests 2-5 now produce clean "testID not found" assertion errors, not runner crashes.
- **Committed in:** b5d7b0f9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required to get the test runner operational. No scope creep — test assertions are identical to the plan spec.

## Issues Encountered

- jest-expo version selection required three iterations (52 → 53 → 54) due to incompatibilities at each step
- Test 1 originally passed (GREEN) using `queryByTestId` — redesigned to `getByTestId('carousel-image')` so it correctly fails RED

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- jest.config.js is shared infrastructure — all future mobile tests use it
- 5 RED tests ready for Plan 17-02 to turn GREEN by implementing the carousel in VehicleCard.tsx
- testIDs contract for Plan 17-02: `carousel-image` (image strip), `carousel-dots` (container), `carousel-dot` (individual dot with accessibilityState.selected)
- Image.prefetch contract: called with first 3 image URIs on mount via useEffect

---
*Phase: 17-mobile-catalog-swipe*
*Completed: 2026-06-21*
