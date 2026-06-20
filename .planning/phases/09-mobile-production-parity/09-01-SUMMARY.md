---
phase: 09-mobile-production-parity
plan: "01"
subsystem: ui
tags: [react-native, expo, supabase, zustand, async-storage, image-manipulator, arraybuffer]

requires:
  - phase: mobile-app-parity
    provides: SellCarFlowScreen with DVLA lookup, media upload skeleton, and auction wiring

provides:
  - "storageHelper.ts: uploadToStorage (ArrayBuffer, no blob) + convertAndCompress (HEIC→JPEG quality loop)"
  - "sellWizardStore.ts: Zustand persist store backed by AsyncStorage, excludes function refs via partialize"
  - "DVLA auto-submit at 7-8 alphanumeric chars without button tap"
  - "Per-image upload progress bars (0→50→100%) on photo thumbnails"
  - "Draft persistence with onFinishHydration resume-prompt on app restart"
  - "POST /listings fires on final submit with full payload"
  - "POST /auctions fires after listing creation for AUCTION type (non-blocking failure)"

affects:
  - "09-02-PLAN: Stripe payments — listings already created, can now gate payment on creation"
  - "09-03-PLAN: Dealer KYC — uses storageHelper.ts for document upload"
  - "09-04-PLAN: Handover proof upload — uses storageHelper.ts pattern"

tech-stack:
  added:
    - "expo-image-manipulator@14.0.8 (was pre-installed per Wave 0)"
    - "base64-arraybuffer@1.0.2 (was pre-installed per Wave 0)"
    - "@react-native-async-storage/async-storage@2.2.0 (was pre-installed per Wave 0)"
    - "expo-document-picker@14.0.8 (was pre-installed per Wave 0)"
  patterns:
    - "ArrayBuffer upload: FileSystem.readAsStringAsync(Base64) → decode → supabase.storage.upload(arrayBuffer)"
    - "HEIC conversion: manipulateAsync (not class API) in quality loop until <1.2 MB"
    - "Zustand draft: partialize excludes clearDraft/updateDraft; onFinishHydration for async hydration"
    - "expo-file-system/legacy import path for EncodingType + readAsStringAsync (SDK 54 moved these)"

key-files:
  created:
    - "carmazium app/carmazium app/src/lib/storageHelper.ts"
    - "carmazium app/carmazium app/src/lib/sellWizardStore.ts"
  modified:
    - "carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx"

key-decisions:
  - "Import from expo-file-system/legacy not expo-file-system — SDK 54 moved EncodingType and readAsStringAsync to legacy subpath"
  - "handlePlateChange auto-triggers DVLA at 7-8 cleaned alphanumeric chars; button still works for manual trigger"
  - "Auction creation failure after listing creation is non-blocking — shows Alert but still navigates (listing exists)"
  - "Per-image progress key uses category-index pattern (e.g. exterior-0) to uniquely identify thumbnails"

patterns-established:
  - "Pattern 1: All Supabase Storage uploads go through storageHelper.uploadToStorage (ArrayBuffer, never blob)"
  - "Pattern 2: All image compression goes through storageHelper.convertAndCompress before upload"
  - "Pattern 3: Zustand persist onFinishHydration callback for hydration-safe resume prompts"

requirements-completed: []

duration: 8min
completed: "2026-06-20"
---

# Phase 09 Plan 01: Wave 1 — Sell Flow Foundation Summary

**Sell wizard wired to real backends: ArrayBuffer Supabase upload, DVLA auto-submit at 7-8 chars, per-image progress bars, AsyncStorage draft persistence with resume prompt, and POST /listings + POST /auctions on final submit**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T00:28:36Z
- **Completed:** 2026-06-20T00:36:55Z
- **Tasks:** 4 (09-01-01, 09-01-02, 09-01-02b verify, 09-01-03)
- **Files modified:** 3

## Accomplishments

- Created `storageHelper.ts` with `uploadToStorage` (ArrayBuffer pattern, eliminates 0-byte Android bug) and `convertAndCompress` (HEIC→JPEG quality loop targeting <1.2 MB)
- Created `sellWizardStore.ts` with Zustand persist + AsyncStorage, partialize excludes function refs, `onFinishHydration` used for hydration-safe resume prompt
- DVLA lookup now auto-triggers at 7-8 alphanumeric characters via `handlePlateChange` (no button tap required); button still works for manual lookup
- Per-image upload progress bars (0→50→100%) replace the single spinner on photo thumbnails
- Draft persists across app restarts; `onFinishHydration` callback shows "Resume draft?" alert safely after AsyncStorage is loaded
- POST /listings fires on final submit with full vehicle payload; POST /auctions follows immediately for AUCTION type listings

## Task Commits

1. **Task 09-01-01: Create storageHelper.ts and sellWizardStore.ts** - `3f8be15f` (feat)
2. **Task 09-01-02: Wire DVLA auto-submit and fix photo upload** - `8ba5d278` (feat)
3. **Task 09-01-03: Wire draft persistence, listing creation, and auction creation** - `2a1ea890` (feat)

## Files Created/Modified

- `src/lib/storageHelper.ts` - uploadToStorage (ArrayBuffer) + convertAndCompress (HEIC→JPEG quality loop)
- `src/lib/sellWizardStore.ts` - Zustand persist store with AsyncStorage, excludes functions from serialization
- `src/screens/sell/SellCarFlowScreen.tsx` - DVLA auto-submit, ArrayBuffer photo upload, per-image progress, draft persistence, POST /listings + POST /auctions

## Decisions Made

- **expo-file-system/legacy import:** Expo SDK 54 moved `EncodingType`, `readAsStringAsync`, and `getInfoAsync` to the `/legacy` subpath. The main `expo-file-system` export now throws at runtime for these methods. Fixed by importing `* as FileSystem from 'expo-file-system/legacy'` in storageHelper.ts.
- **manipulateAsync over class API:** Used deprecated `manipulateAsync` instead of `ImageManipulator.manipulate().renderAsync()` for SDK 54 stability (class API still evolving).
- **Non-blocking auction failure:** If POST /auctions fails after POST /listings succeeds, the listing is already created. Showing a non-blocking Alert and still navigating to SellerListings prevents the user from losing their listing.
- **`'images'` string literal:** Replaced deprecated `ImagePicker.MediaTypeOptions.Images` with `'images'` string literal per SDK 54 deprecation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] expo-file-system legacy import path for SDK 54**
- **Found during:** Task 09-01-01 (storageHelper.ts TypeScript verification)
- **Issue:** `expo-file-system` in SDK 54 moved `EncodingType` and `readAsStringAsync` to `/legacy` subpath. The main export shows type stubs that throw at runtime. Importing `* as FileSystem from 'expo-file-system'` causes TS errors: `EncodingType` not found, `size` not in `InfoOptions`.
- **Fix:** Changed import to `* as FileSystem from 'expo-file-system/legacy'` in storageHelper.ts. Also removed the `{ size: true }` option from `getInfoAsync` (not in legacy InfoOptions type either; `size` is available as `(info as any).size` from the returned object).
- **Files modified:** `src/lib/storageHelper.ts`
- **Verification:** `npx tsc --noEmit` reports zero errors for storageHelper.ts
- **Committed in:** `3f8be15f` (Task 09-01-01 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Single blocking issue resolved. No scope creep. All must_have requirements met.

## Issues Encountered

- Pre-existing TypeScript errors in `GlobalDrawer.tsx`, `DealerInventoryScreen.tsx`, `EarningsScreen.tsx`, and `AuctionDetailScreen.tsx` were present before this plan and are out of scope. The same `expo-file-system` issue in `EarningsScreen.tsx` (using the main import instead of `/legacy`) is deferred to a later pass.

## User Setup Required

None — all changes are frontend-only. Supabase Storage `listings` bucket is assumed public (existing code uses `getPublicUrl` which confirms it). No backend changes required.

## Next Phase Readiness

- `storageHelper.ts` is ready for Wave 3 (Dealer KYC document upload) — same `uploadToStorage` function handles any bucket
- `sellWizardStore.ts` draft state can be extended with additional wizard fields if needed in later waves
- Wave 2 (Stripe payments) can now gate listing fee payment on the newly wired POST /listings flow

---
*Phase: 09-mobile-production-parity*
*Completed: 2026-06-20*

## Self-Check: PASSED

Files exist:
- FOUND: carmazium app/carmazium app/src/lib/storageHelper.ts
- FOUND: carmazium app/carmazium app/src/lib/sellWizardStore.ts
- FOUND: carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx

Commits exist:
- FOUND: 3f8be15f (feat(09-01): create storageHelper.ts and sellWizardStore.ts)
- FOUND: 8ba5d278 (feat(09-01): wire DVLA auto-submit and fix photo upload)
- FOUND: 2a1ea890 (feat(09-01): wire draft persistence, listing creation, and auction creation)
