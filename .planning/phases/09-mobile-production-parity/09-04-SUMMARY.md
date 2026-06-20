---
phase: 09-mobile-production-parity
plan: "04"
subsystem: ui
tags: [react-native, expo-image-picker, supabase-storage, push-notifications, deep-linking, expo-notifications]

# Dependency graph
requires:
  - phase: 09-mobile-production-parity
    plan: "01"
    provides: uploadToStorage + convertAndCompress in storageHelper.ts
  - phase: 09-mobile-production-parity
    plan: "02"
    provides: Stripe payments, HPI flow wired
  - phase: 09-mobile-production-parity
    plan: "03"
    provides: KYC document capture, isVerified auth gate
provides:
  - "Handover proof upload button on ENDED auctions with winner in SellerAuctionsScreen"
  - "Cold-start push notification handling via getLastNotificationResponseAsync in App.tsx"
  - "Client-side 10-type NOTIFICATION_SCREEN_MAP covering all notification types"
  - "navigationRef.isReady() retry pattern preventing cold-start navigation crashes"
affects: [push-notification-routing, seller-post-auction-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cold-start notification: getLastNotificationResponseAsync().then(handler) called inside notification useEffect after addNotificationListeners"
    - "Navigation retry: if (navigationRef.isReady()) navigate() else setTimeout(navigate, 100) — prevents crash when container not mounted"
    - "Notification screen resolution: rawData.screen field takes priority; falls back to NOTIFICATION_SCREEN_MAP[rawData.type]"
    - "Handover upload: convertAndCompress (HEIC->JPEG) then uploadToStorage('handover', userId/auctionId-ts.jpg)"

key-files:
  created: []
  modified:
    - "carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx"
    - "carmazium app/carmazium app/App.tsx"

key-decisions:
  - "ApiListing type extended with ENDED status and winnerId to support won auction detection"
  - "Card layout restructured to column flex to allow handoverSection below existing horizontal row"
  - "NOTIFICATION_SCREEN_MAP defined at module level (outside App component) so it is not recreated on render"
  - "handleNotificationResponse now accepts null and returns early — safe for getLastNotificationResponseAsync which resolves null when no pending response"
  - "LiveAuctionDetailed params shape: { listing: { id: auctionId } } matches the screen's navigation param contract"

patterns-established:
  - "Handover upload flow: ImagePicker -> convertAndCompress -> uploadToStorage(bucket='handover') -> POST /auctions/:id/handover-proof"
  - "Notification deep-link priority: backend screen field > client NOTIFICATION_SCREEN_MAP[type]"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-06-20
---

# Phase 09 Plan 04: Wave 4 — Handover Proof + Push Notification Deep-Linking Summary

**Seller handover proof upload (ENDED auctions with winner) and complete push notification deep-linking with cold-start handling for all 10 notification types via navigationRef.isReady() retry pattern**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-20T01:00:00Z
- **Completed:** 2026-06-20T01:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- SellerAuctionsScreen: added handover proof upload button below auction card when `status === 'ENDED'` and `winnerId` present; full flow with ImagePicker, convertAndCompress, uploadToStorage to 'handover' bucket, POST /auctions/:id/handover-proof, haptics.success on success, ActivityIndicator during upload, ErrorBanner with retry on failure, "Handover proof submitted" success text
- App.tsx: replaced bare `handleNotificationResponse` with null-safe version that resolves screen from `rawData.screen` first then falls back to `NOTIFICATION_SCREEN_MAP[rawData.type]`, builds correct params per type, and uses `if (navigationRef.isReady()) navigate() else setTimeout(navigate, 100)` retry pattern
- App.tsx: added `Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse)` for cold-start (app killed) notification tap handling — all 10 types covered

## Task Commits

1. **Task 09-04-01: Handover proof upload in SellerAuctionsScreen** - `0d132c23` (feat)
2. **Task 09-04-02: Cold-start notification handling + 10-type screen map in App.tsx** - `5b092915` (feat)

## Files Created/Modified

- `carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx` — Added ImagePicker/storageHelper/haptics/ErrorBanner imports; extended ApiListing with ENDED status + winnerId; handoverUploading/Uploaded/Error state; handleHandoverUpload(); card layout restructured to column flex with cardRow + handoverSection; new styles
- `carmazium app/carmazium app/App.tsx` — Added `* as Notifications` import; NOTIFICATION_SCREEN_MAP module-level constant (10 types); replaced handleNotificationResponse with null-safe version featuring type-map fallback + isReady retry; added getLastNotificationResponseAsync cold-start check

## Decisions Made

- Extended `ListingStatus` type to include `'ENDED'` and added `winnerId?: string | null` to `ApiListing` — necessary to type-check the won auction condition without casting
- Card layout changed from `flexDirection: 'row'` to `flexDirection: 'column'` with a `cardRow` inner view — allows the handover section to render as a full-width block below the thumbnail/info/status row without breaking existing layout
- `NOTIFICATION_SCREEN_MAP` placed at module level (outside App component) — it's a static constant, no reason to recreate on every render
- `handleNotificationResponse` now typed `(response: Notifications.NotificationResponse | null)` — matches the null case returned by `getLastNotificationResponseAsync` while still satisfying the `addNotificationListeners` `onResponse` parameter (which receives non-null from the live listener)

## Deviations from Plan

None - plan executed exactly as written. The `mediaTypes: 'images' as any` cast was added because the newer `expo-image-picker` API accepts the string literal `'images'` but TypeScript types expect the enum value — this is a known SDK 54 quirk and the cast is intentional.

## Issues Encountered

Pre-existing TypeScript errors in GlobalDrawer.tsx (`role` property on User) and DealerInventoryScreen.tsx (`url` in blob type) — both were already deferred in prior plans and unchanged. No new errors introduced.

## User Setup Required

None — no external service configuration required. Supabase 'handover' bucket must exist for proof uploads to succeed (backend responsibility).

## Next Phase Readiness

Phase 09 (09-mobile-production-parity) is now complete — all 4 waves executed:
- Wave 1: Sell flow (DVLA, photo upload, listing creation, draft persistence)
- Wave 2: Stripe native payments (listing fee, HPI, buyer fee, Stripe Connect)
- Wave 3: Dealer KYC + verification gate for bidding
- Wave 4: Handover proof upload + push notification deep-linking (all 10 types, cold-start)

Ready for Phase 10: app store submission, map/near-me screen, AI standalone search, vehicle compare polish.

---
*Phase: 09-mobile-production-parity*
*Completed: 2026-06-20*
