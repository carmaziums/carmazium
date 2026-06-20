---
phase: 09
plan: 03
subsystem: mobile-dealer-kyc
tags: [kyc, verification, auth, auction, document-upload, supabase-storage]
dependency_graph:
  requires: [09-01-PLAN]
  provides: [dealer-kyc-document-upload, isVerified-auth-field, auction-bid-verification-gate]
  affects: [DealerKYCScreen, authStore, AuctionDetailScreen]
tech_stack:
  added: []
  patterns:
    - expo-image-picker launchImageLibraryAsync with mediaTypes 'images'
    - expo-document-picker getDocumentAsync with copyToCacheDirectory true (iOS required)
    - convertAndCompress + uploadToStorage from storageHelper.ts for all KYC docs
    - Zustand selector pulling both role and user from useAuthStore
key_files:
  created: []
  modified:
    - carmazium app/carmazium app/src/store/authStore.ts
    - carmazium app/carmazium app/src/screens/main/DealerKYCScreen.tsx
    - carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx
decisions:
  - authStore login path was missing isAddressVerified — added it alongside isVerified for consistency
  - Document upload UI shows dashed-border tap area / uploading spinner / green checkmark + Replace link
  - proofOfAddress picker accepts both PDF and image (type: ['application/pdf', 'image/*'])
  - Bid gate shows Alert with Cancel + Go to Verification — bid UI remains visible (intentional UX)
  - Role gate (non-dealer) uses setBidError; KYC gate uses Alert.alert with navigation CTA
  - quickBidBtnText style key was missing in AuctionDetailScreen causing TS2551 — fixed inline (Rule 1)
metrics:
  duration: 199s
  completed: 2026-06-20
  tasks_completed: 2
  files_modified: 3
---

# Phase 09 Plan 03: Wave 3 — Dealer KYC + Verification Gate Summary

**One-liner:** KYC document capture (9 fields, image+PDF) with Supabase upload, isVerified in authStore for all 3 auth paths, and bid-gate Alert with DealerKYC navigation CTA in AuctionDetailScreen.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 09-03-01 | authStore isVerified + DealerKYCScreen document capture | f9c72207 | authStore.ts, DealerKYCScreen.tsx |
| 09-03-02 | Dealer verification gate in AuctionDetailScreen | 11d2d6fe | AuctionDetailScreen.tsx |

## What Was Built

### Task 1: authStore + DealerKYCScreen

**authStore.ts:**
- Added `isVerified?: boolean` to `User` interface
- Added `dealerProfile?: { isVerified?: boolean }` to `UserProfileResponse.data`
- `initializeAuth`: populates `isVerified: profile.dealerProfile?.isVerified ?? false`
- `login`: populates `isVerified` + also added missing `isAddressVerified` (was omitted)
- `signup` (session path): populates `isVerified`

**DealerKYCScreen.tsx:**
- Added imports: `expo-image-picker`, `expo-document-picker`, `convertAndCompress`, `uploadToStorage`, `useAuthStore`
- Added `userId` from auth store for Supabase path scoping
- Added `docUrls` and `docUploading` state maps
- Added `handleDocumentCapture(fieldName, type)` — unified picker for images and PDFs
  - Image path: `launchImageLibraryAsync` → `convertAndCompress` → `uploadToStorage`
  - PDF path: `getDocumentAsync({ copyToCacheDirectory: true })` → `uploadToStorage` (with image fallback via `convertAndCompress`)
  - Upload path: `kyc/{userId}/{fieldName}-{timestamp}.{ext}` in `kyc-documents` bucket
- Added document upload UI section with 9 fields:
  - **Image fields:** drivingLicenceFront, drivingLicenceBack, paymentScreenshot, directorSelfie
  - **PDF fields:** vatCertificate, companyRegistration, memorandumOfAssociation, articlesOfAssociation, proofOfAddress
- Each field shows: tap-to-upload (dashed border) / uploading spinner / green checkmark + "Replace" link
- KYC submit payload now spreads `docUrls` alongside text fields (`{ ...form, ...docUrls }`)

### Task 2: AuctionDetailScreen Verification Gate

- Added `role` to `useAuthStore` destructure alongside `currentUser`
- `handleBid`: role gate — non-dealers get `setBidError('Only dealers can place bids in auctions.')`
- `handleBid`: KYC gate — unverified dealers get `Alert.alert('Verification Required', ...)` with:
  - "Cancel" (style: 'cancel')
  - "Go to Verification" → `navigation.navigate('DealerKYC')` (confirmed valid in `MainStackParamList`)
- Bid UI remains visible to all users — gate fires on bid attempt, not on screen mount

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing `isAddressVerified` to login path in authStore**
- **Found during:** Task 1 — reviewing the login set() call
- **Issue:** Login path was setting the user object without `isAddressVerified`, which was present in both initializeAuth and signup paths. Inconsistency would cause the field to always be `undefined` after login.
- **Fix:** Added `isAddressVerified: profile.isAddressVerified || false` to the login path's user object
- **Files modified:** `src/store/authStore.ts`
- **Commit:** f9c72207

**2. [Rule 1 - Bug] Added missing `quickBidBtnText` style key in AuctionDetailScreen**
- **Found during:** Task 2 TypeScript check — pre-existing TS2551 error
- **Issue:** `s.quickBidBtnText` was referenced at lines 959 and 976 (seller "RESERVE" and "CANCEL" buttons) but the key was not defined in the StyleSheet. Caused TypeScript errors.
- **Fix:** Added `quickBidBtnText` style to the StyleSheet
- **Files modified:** `src/screens/vehicle/AuctionDetailScreen.tsx`
- **Commit:** 11d2d6fe

## Pre-existing Deferred Errors (out of scope)

These pre-existing TS errors exist in other files and were not introduced by this plan:
- `GlobalDrawer.tsx(207)` — `role` property not on User (pre-existing)
- `DealerInventoryScreen.tsx(312)` — blob url pattern (pre-existing)
- `EarningsScreen.tsx` — expo-file-system/legacy import needed (pre-existing)

## Self-Check: PASSED

Files confirmed:
- `src/store/authStore.ts` — modified, isVerified in all 3 auth paths
- `src/screens/main/DealerKYCScreen.tsx` — modified, document capture implemented
- `src/screens/vehicle/AuctionDetailScreen.tsx` — modified, bid gate implemented

Commits confirmed:
- f9c72207 — Task 1 commit
- 11d2d6fe — Task 2 commit

TypeScript: zero new errors introduced. 4 pre-existing errors in out-of-scope files remain.
