# Phase 9: Mobile Production Parity - Research

**Researched:** 2026-06-20
**Domain:** React Native / Expo 54 — image upload, Stripe native payments, Supabase Storage, push notification deep-linking, Zustand draft persistence, Dealer KYC document capture
**Confidence:** HIGH (stack choices verified against installed packages and existing code; APIs verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- One comprehensive phase, 4 waves executed sequentially
- Wave 1 = Sell flow (DVLA lookup, photo upload, AI description, listing creation, auction creation)
- Wave 2 = Stripe native payments (`@stripe/stripe-react-native` Payment Sheet)
- Wave 3 = Dealer KYC + verification gate
- Wave 4 = Missing features (HPI report, handover proof upload, push notification deep-linking for 10 types)
- Backend at `https://carmazium-hjoh9w.fly.dev` — DO NOT suggest backend changes
- `StripeProvider` already mounted at root in `App.tsx` with `publishableKey`, `merchantIdentifier`, `urlScheme`
- `useStripe()` + `createPaymentSheet` from `paymentsApi.ts` already used in `PurchaseFlowScreen.tsx` — use this as the canonical pattern
- All icons through `BrandIcon.tsx`; all styles via `StyleSheet.create` + `colors.ts`
- Only KYC-verified dealers can place bids — enforce this gate throughout

### Claude's Discretion

- Loading skeleton design within each screen
- Exact animation/transition choices
- Error message copy (follow web app wording where possible)
- Compression quality settings (as long as output is under 1.5 MB per image)

### Deferred Ideas (OUT OF SCOPE)

- Map / Near Me screen (Phase 10)
- AI standalone search screen (GlobalAIChatBot covers for now; Phase 10)
- App store submission assets (Phase 10)
- Partner portals: Finance, Insurance, Service Provider, Admin (separate milestone)
- Admin mobile dashboard
- Vehicle Compare deep polish (minor if time; otherwise Phase 10)
- Seller public profile deep polish (Phase 10)
</user_constraints>

---

## Summary

Phase 9 wires 47 already-built screens to real backends. The screens exist, the navigation exists, and the backend endpoints are live. The work is: (1) filling in the missing API calls, (2) adding image manipulation and upload infrastructure that is currently absent (no `expo-image-manipulator`, no `base64-arraybuffer`, no `expo-document-picker` installed), (3) enabling the Stripe Payment Sheet for listing fees, HPI, and auction buyer fees (the pattern already works in `PurchaseFlowScreen.tsx`), and (4) adding the KYC dealer verification gate to `AuctionDetailScreen.tsx` bid placement.

The current `uploadToSupabase` in `SellCarFlowScreen.tsx` uses a `fetch → blob` pattern that is unreliable on Android. The production-correct pattern for React Native is `FileSystem.readAsStringAsync(uri, { encoding: Base64 }) → decode(base64) → supabase.storage.from().upload(arrayBuffer, { contentType })`. This is the pattern to adopt for all four waves.

The Zustand draft store for the sell wizard does not yet exist. No `@react-native-async-storage/async-storage` is installed. Both must be added in Wave 1.

**Primary recommendation:** Install the four missing packages first (wave 0 setup task), then build each wave using the patterns documented below. Never deviate from `apiClient` for JSON endpoints or the `arrayBuffer` upload pattern for Supabase Storage.

---

## Standard Stack

### Core (already installed — confirmed from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@stripe/stripe-react-native` | 0.50.3 | Native Payment Sheet | Already installed, `StripeProvider` already in `App.tsx` |
| `@supabase/supabase-js` | ^2.107.0 | Storage uploads + auth | Already installed, `supabase.ts` exports `supabase` client |
| `expo-image-picker` | ~17.0.11 | Camera + gallery selection | Already installed; used in SellCarFlowScreen and SellCarsScreen |
| `expo-file-system` | v19.0.23 | Read file as Base64 for Supabase upload | Already installed |
| `expo-notifications` | ~0.32.17 | Push notification listeners | Already installed; `addNotificationListeners` in pushNotifications.ts |
| `expo-linking` | ~8.0.12 | Stripe Connect return URL, deep-link handling | Already installed; used in App.tsx |
| `zustand` | ^5.0.14 | State management + draft persistence | Already installed |

### Missing — Must Install Before Any Wave

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `expo-image-manipulator` | latest Expo 54 compatible | HEIC→JPEG conversion, quality compression | Not installed; iOS returns HEIC by default in SDK 54 |
| `base64-arraybuffer` | latest | Convert Base64 string to ArrayBuffer for Supabase upload | Not installed; Blob/FormData unreliable on Android |
| `@react-native-async-storage/async-storage` | latest | Zustand persist middleware storage backend | Not installed; required for sell wizard draft state |
| `expo-document-picker` | latest Expo 54 compatible | KYC document upload (PDFs + images from Files app) | Not installed; needed for Wave 3 document capture |

**Installation (run in mobile app directory):**
```bash
npx expo install expo-image-manipulator
npx expo install expo-document-picker
npx expo install @react-native-async-storage/async-storage
npm install base64-arraybuffer
```

---

## Architecture Patterns

### Recommended Project Structure for New Files

```
src/
├── lib/
│   ├── storageHelper.ts      # NEW — shared Supabase Storage upload helper
│   ├── sellWizardStore.ts    # NEW — Zustand persist store for draft state
│   ├── dvlaApi.ts            # NEW — DVLA lookup API function
│   └── auctionApi.ts         # EXISTS — add createAuction function here
├── screens/
│   ├── sell/
│   │   └── SellCarFlowScreen.tsx   # MODIFY — add HEIC conversion, progress bars, DVLA auto-submit
│   ├── main/
│   │   ├── DealerKYCScreen.tsx     # MODIFY — add document capture, Supabase upload
│   │   └── AuctionDetailScreen.tsx # MODIFY — add dealer verification gate
│   └── vehicle/
│       └── VehicleDetailScreen.tsx # MODIFY — add HPI button + Payment Sheet
```

---

### Pattern 1: Supabase Storage Upload (ArrayBuffer method — production-correct for Android)

**What:** The current `blob` upload pattern in `SellCarFlowScreen.tsx` (line 588) uses `fetch(uri) → blob()` which silently corrupts or produces 0-byte files on Android. The official Supabase React Native guide mandates the ArrayBuffer path.

**When to use:** Every file upload to Supabase Storage in this phase.

```typescript
// src/lib/storageHelper.ts
// Source: https://supabase.com/blog/react-native-storage
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Convert a local file URI to ArrayBuffer and upload to Supabase Storage.
 * Returns the public URL string.
 *
 * @param localUri  - file:// URI from ImagePicker or ImageManipulator
 * @param bucket    - Supabase Storage bucket name (e.g. 'listings', 'kyc-documents')
 * @param path      - destination path within bucket (e.g. 'userId/filename.jpg')
 * @param contentType - MIME type (e.g. 'image/jpeg', 'application/pdf')
 */
export async function uploadToStorage(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string = 'image/jpeg',
): Promise<string> {
  // 1. Read file as Base64
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 2. Convert to ArrayBuffer
  const arrayBuffer = decode(base64);

  // 3. Upload
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  // 4. Return public URL — getPublicUrl is synchronous, returns { data: { publicUrl } }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}
```

**Key note on `getPublicUrl`:** Returns `{ data: { publicUrl: string } }` (no error field). The bucket must have public access enabled in the Supabase dashboard or via `updateBucket({ public: true })`. The `listings` bucket is assumed to already be public given the existing code references `getPublicUrl`.

---

### Pattern 2: HEIC-to-JPEG Conversion with 1.5 MB Cap (expo-image-manipulator)

**What:** iOS in SDK 54 returns original asset format from the library (HEIC or AVIF) when `allowsEditing: false`. `expo-image-manipulator` converts to JPEG and compresses. The API does NOT return file size — use `FileSystem.getInfoAsync()` after compression to check, then loop with lower quality if still too large.

**Known pitfall:** `FileSystem.getInfoAsync()` sometimes under-reports file size by ~40% after manipulation (issue #15212). Use a conservative target of 1.2 MB for the check loop to ensure the actual file is safely under 1.5 MB.

```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const MAX_BYTES = 1.2 * 1024 * 1024; // 1.2 MB check target (conservative for 1.5 MB actual cap)
const MAX_ITERATIONS = 6;

export async function convertAndCompress(uri: string): Promise<string> {
  let quality = 0.85;
  let currentUri = uri;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // manipulateAsync is the stable API — the new class-based API is still
    // evolving in Expo 54. Use manipulateAsync for stability.
    const result = await ImageManipulator.manipulateAsync(
      currentUri,
      [], // no resize — preserve original dimensions
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const info = await FileSystem.getInfoAsync(result.uri, { size: true });
    const size = info.exists ? (info as any).size ?? 0 : 0;

    if (size <= MAX_BYTES || i === MAX_ITERATIONS - 1) {
      return result.uri;
    }

    // Reduce quality by 15% each iteration
    quality = Math.max(0.3, quality - 0.15);
    currentUri = result.uri;
  }

  return currentUri;
}
```

**Expo 54 note:** `manipulateAsync` is marked deprecated in SDK 54 docs but remains the stable, production-safe path. The new `ImageManipulator.manipulate(source).renderAsync()` class-based API is available but less battle-tested. Use `manipulateAsync` for this phase.

---

### Pattern 3: Stripe Payment Sheet (initPaymentSheet + presentPaymentSheet)

**What:** Already fully wired in `PurchaseFlowScreen.tsx` (lines 83–138). Use this as the canonical reference. `StripeProvider` is already in `App.tsx`. `useStripe()` hook gives `initPaymentSheet` and `presentPaymentSheet`.

**Backend contract:** `POST /payments/intent` returns `{ clientSecret, ephemeralKey, customerId, publishableKey, transactionId }` — confirmed in `paymentsApi.ts`.

```typescript
// Source: Existing PurchaseFlowScreen.tsx (lines 83-138) — CANONICAL PATTERN
// Do not rebuild. Copy this pattern verbatim for each payment trigger.
import { useStripe } from '@stripe/stripe-react-native';
import { createPaymentSheet } from '../../lib/paymentsApi';

const { initPaymentSheet, presentPaymentSheet } = useStripe();

async function triggerPayment(listingId: string, amount: number, type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION') {
  const sheet = await createPaymentSheet({ listingId, amount, type, currency: 'gbp' });

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Carmazium',
    customerId: sheet.customerId,
    customerEphemeralKeySecret: sheet.ephemeralKey,
    paymentIntentClientSecret: sheet.clientSecret,
    allowsDelayedPaymentMethods: false,
    appearance: {
      colors: {
        primary: '#DC1F26',
        background: '#111116',
        componentBackground: '#18181f',
        componentBorder: 'rgba(255,255,255,0.08)',
        componentDivider: 'rgba(255,255,255,0.06)',
        primaryText: '#FFFFFF',
        secondaryText: '#A0A0AB',
        componentText: '#FFFFFF',
        placeholderText: '#606070',
        icon: '#A0A0AB',
        error: '#DC1F26',
      },
    },
  });

  if (initError) throw new Error(initError.message);

  const { error: presentError } = await presentPaymentSheet();
  if (presentError) {
    if (presentError.code !== 'Canceled') throw new Error(presentError.message);
    return false; // user cancelled — not an error
  }
  return true; // payment succeeded
}
```

**Appearance API note:** The `style: 'alwaysDark'` iOS-only option exists but is unreliable on Android (GitHub issues #593, #692 — system theme always applied). Use explicit `appearance.colors` object as shown above for reliable dark theme on both platforms.

**Payment flows to wire:**
| Flow | Trigger Screen | Amount | type param |
|------|----------------|--------|------------|
| Listing fee BASIC | SellCarFlowScreen step 5 | 100 (£1 in pence) | `COMMISSION` |
| Listing fee STANDARD | SellCarFlowScreen step 5 | 1000 | `COMMISSION` |
| Listing fee PREMIUM | SellCarFlowScreen step 5 | 2500 | `COMMISSION` |
| HPI report | VehicleDetailScreen | 999 | `COMMISSION` |
| Auction buyer fee | AuctionCompleteScreen | 12500 | `COMMISSION` |
| Deposit | PurchaseFlowScreen | 50000 | `DEPOSIT` |
| Full payment | PurchaseFlowScreen | varies | `FULL_PAYMENT` |

**Note on amounts:** Stripe amounts are in pence (GBP minor units). Confirm with backend — if backend accepts pounds, pass the raw number; if it takes pence, multiply by 100. The existing `createPaymentSheet` call in `PurchaseFlowScreen` passes `total` directly (pounds), so backend likely takes pounds. Do not change this.

---

### Pattern 4: Zustand Persist Store for Sell Wizard Draft

**What:** No draft persistence exists today. Must create a new Zustand store with `persist` middleware + AsyncStorage.

```typescript
// src/lib/sellWizardStore.ts
// Source: https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SellWizardDraft {
  make: string;
  model: string;
  year: string;
  mileage: string;
  title: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  colour: string;
  price: string;
  listingType: 'CLASSIFIED' | 'AUCTION' | '';
  exteriorImages: string[];  // Supabase public URLs only (already uploaded)
  interiorImages: string[];
  damageImages: string[];
  // ... other wizard fields
  lastStep: number;
  clearDraft: () => void;
  updateDraft: (partial: Partial<Omit<SellWizardDraft, 'clearDraft' | 'updateDraft'>>) => void;
}

export const useSellWizardStore = create<SellWizardDraft>()(
  persist(
    (set) => ({
      make: '', model: '', year: '', mileage: '', title: '',
      fuelType: '', transmission: '', bodyType: '', colour: '',
      price: '', listingType: '',
      exteriorImages: [], interiorImages: [], damageImages: [],
      lastStep: 1,
      clearDraft: () => set({ make: '', model: '', year: '', mileage: '', title: '',
        fuelType: '', transmission: '', bodyType: '', colour: '',
        price: '', listingType: '',
        exteriorImages: [], interiorImages: [], damageImages: [],
        lastStep: 1,
      }),
      updateDraft: (partial) => set((state) => ({ ...state, ...partial })),
    }),
    {
      name: 'czm-sell-wizard-draft',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist serializable fields — exclude function refs
      partialize: (state) => ({
        make: state.make, model: state.model, year: state.year,
        mileage: state.mileage, title: state.title, fuelType: state.fuelType,
        transmission: state.transmission, bodyType: state.bodyType,
        colour: state.colour, price: state.price, listingType: state.listingType,
        exteriorImages: state.exteriorImages, interiorImages: state.interiorImages,
        damageImages: state.damageImages, lastStep: state.lastStep,
      }),
    }
  )
);
```

**Critical:** Only store Supabase public URLs in `exteriorImages/interiorImages/damageImages` — never local `file://` URIs, as these are ephemeral and may not survive app restart.

---

### Pattern 5: DVLA Auto-Submit (7–8 char UK plate)

**What:** Auto-trigger DVLA lookup when input reaches 7–8 alphanumeric characters (the standard UK new-style plate format: 2 letters + 2 digits + space + 3 letters = 7 chars without space, or 8 with space).

**Current state:** `SellCarFlowScreen.tsx` already has a `handleDvlaLookup` function wired to `POST /dvla/lookup` (line 508). What's missing is the auto-trigger on character count.

```typescript
// Add to the plate TextInput onChange handler in SellCarFlowScreen.tsx
const handlePlateChange = (raw: string) => {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  setPlate(cleaned);
  // UK plate: 7 chars without space (e.g. BD51SMR), 8 with (e.g. BD51 SMR)
  if (cleaned.length >= 7 && cleaned.length <= 8 && !dvlaFetched && !dvlaLoading) {
    handleDvlaLookup(cleaned);
  }
};
```

**UK plate regex for validation before lookup:**
```typescript
// Covers current format (2001+): XX11 XXX and older formats
const UK_PLATE_RE = /^[A-Z]{2}[0-9]{2}[A-Z]{3}$|^[A-Z][0-9]{1,3}[A-Z]{3}$|^[A-Z]{3}[0-9]{1,3}[A-Z]$/;
```

---

### Pattern 6: Push Notification Deep-Linking (Cold Start + Background)

**What:** `App.tsx` already handles foreground and background taps via `addNotificationListeners`. The cold-start case (app was closed) requires `getLastNotificationResponseAsync()` called during initialization.

**Current state:** `App.tsx` has `addNotificationResponseReceivedListener` via `addNotificationListeners`, but does NOT call `getLastNotificationResponseAsync()` for cold-start scenarios.

```typescript
// Add to App.tsx useEffect (the notification listeners useEffect)
// Source: https://docs.expo.dev/versions/latest/sdk/notifications/
import * as Notifications from 'expo-notifications';

// Inside notification useEffect, AFTER setting up the live listener:
const handleResponse = (response: Notifications.NotificationResponse | null) => {
  if (!response) return;
  const rawData = response.notification.request.content.data as Record<string, any>;
  if (!rawData?.screen) return;
  // Wait for nav to be ready before navigating
  const navigate = () => {
    if (navigationRef.isReady()) {
      (navigationRef.current as any)?.navigate('Main', {
        screen: rawData.screen,
        params: rawData.params ?? {},
      });
    } else {
      setTimeout(navigate, 100); // retry until ready
    }
  };
  navigate();
};

// Cold-start: check last response on mount
Notifications.getLastNotificationResponseAsync().then(handleResponse);

// The existing addNotificationListeners already handles background tap.
// Pass handleResponse as the onResponse callback.
```

**10 notification types → screen mapping:**

| `type` in notification data | `screen` to navigate | `params` |
|-----------------------------|-----------------------|----------|
| `BID_PLACED` | `LiveAuctionDetailed` | `{ listing: { id: auctionId } }` |
| `OUTBID` | `LiveAuctionDetailed` | `{ listing: { id: auctionId } }` |
| `AUCTION_ENDING` | `LiveAuctionDetailed` | `{ listing: { id: auctionId } }` |
| `AUCTION_WON` | `AuctionComplete` | `{ listingId, auctionId, hammerPrice }` |
| `AUCTION_ENDED` | `LiveAuctionDetailed` | `{ listing: { id: auctionId } }` |
| `OFFER_RECEIVED` | `SellerOffers` | `{}` |
| `COUNTER_RECEIVED` | `BuyerOffers` | `{}` |
| `OFFER_ACCEPTED` | `BuyerOffers` | `{}` |
| `OFFER_REJECTED` | `BuyerOffers` | `{}` |
| `PAYOUT_FAILED` | `Settings` | `{}` |

**Note:** Screen names must exactly match `MainStackParamList` keys. Verify `'SellerOffers'`, `'BuyerOffers'`, `'Settings'` are registered names (they appear in the navigator).

---

### Pattern 7: KYC Document Capture (expo-document-picker + expo-image-picker)

**What:** KYC needs two picker types:
- **Photos/IDs** (driving licence front/back, payment screenshot): use `expo-image-picker` (already installed)
- **PDF documents** (VAT certificate, company registration, memorandum): use `expo-document-picker` (must install)

```typescript
// For photo documents — use existing expo-image-picker
import * as ImagePicker from 'expo-image-picker';

async function capturePhotoDocument(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: false, // SDK 54: false = original format (may be HEIC)
    quality: 1.0,
  });
  if (result.canceled) return null;
  const uri = result.assets[0].uri;
  // Convert HEIC→JPEG + compress
  const processedUri = await convertAndCompress(uri);
  // Upload to Supabase Storage
  const path = `kyc/${userId}/${Date.now()}-doc.jpg`;
  return uploadToStorage(processedUri, 'kyc-documents', path, 'image/jpeg');
}

// For PDF documents — use expo-document-picker
import * as DocumentPicker from 'expo-document-picker';

async function captureDocumentPdf(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true, // REQUIRED — makes file readable by FileSystem
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const path = `kyc/${userId}/${Date.now()}-${asset.name}`;
  return uploadToStorage(asset.uri, 'kyc-documents', path, asset.mimeType ?? 'application/pdf');
}
```

**expo-document-picker `getDocumentAsync` return shape (Expo 54):**
```typescript
// result.assets[0] has: uri, name, mimeType, size
// result.canceled: boolean
```

---

### Pattern 8: Dealer Verification Gate for Bidding

**What:** `authStore.ts` currently stores `role` but NOT `isVerified` for dealers. The `/users/me` endpoint likely returns `dealerProfile.isVerified`. Must add this to the auth store and check it before bid placement.

**Step 1 — Add `isVerified` to authStore:**
```typescript
// In authStore.ts — add to User interface and auth state:
interface User { /* existing fields */ isVerified?: boolean; }

// In initializeAuth/login/signup, after fetching /users/me:
const isVerified = profile.dealerProfile?.isVerified ?? false;
set({ user: { ...existingFields, isVerified } });
```

**Step 2 — Guard in AuctionDetailScreen.tsx `handleBid`:**
```typescript
// At the top of handleBid (line 336):
const { role, user } = useAuthStore();
if (role !== 'dealer') {
  setBidError('Only dealers can place bids in auctions.');
  return;
}
if (!user?.isVerified) {
  // Show modal / navigate to KYC
  navigation.navigate('DealerKYC');
  Alert.alert(
    'Verification Required',
    'Verify your dealership to place bids. Complete KYC in Settings.',
    [{ text: 'Go to Verification', onPress: () => navigation.navigate('DealerKYC') }]
  );
  return;
}
```

---

### Pattern 9: Seller Stripe Connect Onboarding

**What:** `POST /users/stripe-connect/onboard` returns a hosted Stripe Connect URL. Open with `Linking.openURL()`. Handle the return via the existing deep-link listener in `App.tsx` (the `carmazium://` scheme is already configured).

```typescript
// In EarningsScreen.tsx or SettingsScreen.tsx (Payouts section)
import * as Linking from 'expo-linking';

async function handleConnectOnboard() {
  const res = await apiClient<{ url: string }>('/users/stripe-connect/onboard', { method: 'POST' });
  await Linking.openURL(res.url);
  // App.tsx deep-link listener will fire when Stripe redirects to carmazium://
  // Re-fetch seller profile on app resume to check connect status
}
```

---

### Anti-Patterns to Avoid

- **Blob upload to Supabase from RN:** `fetch(uri).then(r => r.blob())` then upload — produces 0-byte files on Android. Use ArrayBuffer pattern exclusively.
- **Using `manipulateAsync` new class API:** The `ImageManipulator.manipulate().renderAsync()` class-based API is in flux in SDK 54. Use `manipulateAsync` for stability.
- **Storing `file://` URIs in Zustand persist:** These are ephemeral and will break on app restart. Only store post-upload Supabase public URLs.
- **`style: 'alwaysDark'` for Payment Sheet:** Android ignores it and uses system theme. Use explicit `appearance.colors` instead.
- **Navigating before `navigationRef.isReady()`:** Always check `navigationRef.isReady()` before calling `navigate()` from notification handlers or cold-start code.
- **Calling `getDocumentAsync` without `copyToCacheDirectory: true`:** FileSystem cannot read the picked file without this option on iOS.
- **`ImagePicker.MediaTypeOptions.Images`:** `MediaTypeOptions` is deprecated in SDK 54. Use the string literal `'images'` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File size check loop | Custom `fetch().then(blob => blob.size)` | `FileSystem.getInfoAsync(uri, { size: true })` | Blobs unreliable size in RN |
| HEIC detection | Manual MIME type parsing | `manipulateAsync` with `SaveFormat.JPEG` unconditionally | Always converts regardless of input format |
| Payment UI | Custom payment form | `@stripe/stripe-react-native` `presentPaymentSheet()` | PCI compliance, fraud protection |
| PDF file access | Custom native module | `expo-document-picker` | Already Expo ecosystem, handles permissions |
| AsyncStorage access | Custom storage wrapper | `@react-native-async-storage/async-storage` via `createJSONStorage` | Zustand handles all serialization |
| Navigation-ready check | `setTimeout` hacks | `navigationRef.isReady()` with recursive retry | Already supported by `createNavigationContainerRef` |

---

## Common Pitfalls

### Pitfall 1: Supabase Storage Zero-Byte Files on Android
**What goes wrong:** Images appear to upload successfully (no error) but arrive as 0 bytes.
**Why it happens:** `fetch(uri).then(r => r.blob())` doesn't work reliably in React Native's fetch polyfill when the URI is a local file:// path.
**How to avoid:** Always use `FileSystem.readAsStringAsync(uri, { encoding: Base64 })` → `decode(base64)` → upload ArrayBuffer.
**Warning signs:** Uploaded image URL returns a broken image or 0-byte file in Supabase dashboard.

### Pitfall 2: HEIC Images Breaking Backend or Display
**What goes wrong:** Backend receives HEIC binary but `contentType: 'image/jpeg'` is set; or the image URL displays broken on web.
**Why it happens:** SDK 54 returns original HEIC format when `allowsEditing: false`. The upload might succeed but the file is HEIC masquerading as JPEG.
**How to avoid:** Run `convertAndCompress()` on every picked image before upload, unconditionally.
**Warning signs:** Images display fine on iOS but break on Android or web.

### Pitfall 3: Cold-Start Notification Navigation Crash
**What goes wrong:** App crashes or silently fails to navigate on tap from a killed state.
**Why it happens:** `navigationRef.current` is not ready when the notification response handler fires — navigation container hasn't mounted yet.
**How to avoid:** Use the retry pattern (`if (navigationRef.isReady()) navigate() else setTimeout(retry, 100)`).
**Warning signs:** Works from background (navigator ready) but fails from killed state.

### Pitfall 4: Zustand Draft Store Hydration Race
**What goes wrong:** Screen mounts and renders empty state before AsyncStorage hydration completes, causing the "resume draft" prompt to never appear.
**Why it happens:** `persist` with async storage is async — the store starts with initial values.
**How to avoid:** Check `useSellWizardStore.persist?.hasHydrated()` or use the `onFinishHydration` callback before showing the resume prompt.
**Warning signs:** Draft state always appears empty on first mount even though data was saved.

### Pitfall 5: Payment Amount in Wrong Unit
**What goes wrong:** Stripe shows £9,990.00 instead of £9.99.
**Why it happens:** Passing pence when backend expects pounds (or vice versa).
**How to avoid:** Check existing `PurchaseFlowScreen.tsx` — it passes pounds directly to `createPaymentSheet`. Follow this convention for all new payment triggers.
**Warning signs:** Payment Sheet shows unexpectedly large amount.

### Pitfall 6: expo-document-picker Files Not Readable
**What goes wrong:** `FileSystem.readAsStringAsync(asset.uri)` throws "file not found".
**Why it happens:** On iOS, document picker returns a security-scoped bookmark URL that FileSystem cannot access without `copyToCacheDirectory: true`.
**How to avoid:** Always pass `{ copyToCacheDirectory: true }` to `getDocumentAsync`.
**Warning signs:** Fails on iOS only; Android works fine without this option.

### Pitfall 7: `isVerified` Not in authStore Causes Gate to Always Block
**What goes wrong:** All dealers are treated as unverified.
**Why it happens:** `isVerified` is not currently fetched from `/users/me` or stored in `authStore`.
**How to avoid:** Add `isVerified` to the `User` interface in authStore and populate from `profile.dealerProfile?.isVerified` in `initializeAuth`, `login`, and `signup` paths.
**Warning signs:** KYC-approved dealers still see the verification gate.

---

## Code Examples

### Upload a KYC Document (complete flow)
```typescript
// Source: Pattern derived from Supabase blog + expo-image-manipulator docs
async function uploadKycDocument(
  localUri: string,
  fieldName: string,
  userId: string,
): Promise<string> {
  // 1. Convert to JPEG + compress
  const jpegUri = await convertAndCompress(localUri);
  // 2. Upload to Supabase
  const path = `kyc/${userId}/${fieldName}-${Date.now()}.jpg`;
  return uploadToStorage(jpegUri, 'kyc-documents', path, 'image/jpeg');
}
```

### Wire HPI Payment + Reveal
```typescript
// In VehicleDetailScreen.tsx — add HPI button handler
async function handleHpiCheck(listingId: string) {
  const paid = await triggerPayment(listingId, 9.99, 'COMMISSION');
  if (!paid) return; // user cancelled
  const result = await apiClient<{ data: HpiSummary }>(`/hpi/listing/${listingId}/summary`);
  setHpiData(result.data);
}
```

### Wire Handover Proof Upload
```typescript
// In SellerAuctionsScreen.tsx — handover button on won auction
async function handleHandoverUpload(auctionId: string, userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' });
  if (result.canceled) return;
  const jpegUri = await convertAndCompress(result.assets[0].uri);
  const proofUrl = await uploadToStorage(jpegUri, 'handover', `${userId}/${auctionId}.jpg`, 'image/jpeg');
  await apiClient(`/auctions/${auctionId}/handover-proof`, {
    method: 'POST',
    body: JSON.stringify({ proofUrl }),
  });
  haptics.success();
}
```

---

## Wave-by-Wave Technical Gaps Summary

### Wave 1: Sell Flow Gaps

| Item | Current State | What Needs Doing |
|------|---------------|------------------|
| DVLA auto-submit | Button tap only | Add `onChangeText` char-count trigger at 7–8 chars |
| Photo HEIC conversion | Missing | Add `convertAndCompress()` before upload |
| Photo upload per-image progress | Single spinner | Replace with per-image progress bar (0→100%) |
| Upload method | `fetch→blob` (broken on Android) | Switch to ArrayBuffer pattern via `storageHelper.ts` |
| AI description | Wired (`/ai/generate-description`) | Already wired in SellCarFlowScreen — verify it works |
| Damage analysis | Missing | Add `POST /damage/analyze` call on damage images |
| Draft save | Not implemented | Create `sellWizardStore.ts` with Zustand persist |
| Listing publish with payment gate | Missing payment check | Add badge tier → Stripe Payment Sheet before `POST /listings/:id/publish` |
| Auction creation | Wired (lines 696–711) | Already wired — verify `endTime = startTime + 24h` is handled by backend |

### Wave 2: Stripe Payments Gaps

| Item | Current State | What Needs Doing |
|------|---------------|------------------|
| PurchaseFlowScreen | Fully wired | No changes needed |
| Listing fee payment | Missing | Wire after badge selection in SellCarFlowScreen |
| HPI payment | Missing | Wire to VehicleDetailScreen "Check HPI" button |
| Auction buyer fee | Missing | Wire to AuctionCompleteScreen |
| Stripe Connect onboard | Missing | Wire `POST /users/stripe-connect/onboard` in EarningsScreen/Settings |

### Wave 3: Dealer KYC Gaps

| Item | Current State | What Needs Doing |
|------|---------------|------------------|
| Text field submission | Wired (DealerKYCScreen lines 213–220) | Already works |
| Document capture (photos) | Missing | Add image picker + compress + upload for each doc field |
| Document capture (PDFs) | Missing | Add `expo-document-picker` for VAT cert, company reg, memorandum |
| Document URL submission | Missing | POST URLs alongside text fields |
| `isVerified` in authStore | Not tracked | Add to User interface + hydration paths |
| Bid gate in AuctionDetailScreen | Missing | Add role + isVerified check at top of `handleBid` |
| DealerOnboarding `POST /users/elevate` | Screen exists | Verify it fires `{ newRole: 'DEALER' }` |

### Wave 4: Missing Features Gaps

| Item | Current State | What Needs Doing |
|------|---------------|------------------|
| HPI button on VehicleDetail | Missing | Add button + Stripe + `GET /hpi/listing/:id/summary` reveal |
| Handover proof upload | Missing | Add to SellerAuctionsScreen after auction win |
| Cold-start notification handling | Missing | Add `getLastNotificationResponseAsync()` in App.tsx |
| 10 notification type routing | Partial (screen field expected but not mapped) | Add type→screen mapping to notification response handler |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ImagePicker.MediaTypeOptions.Images` | String literal `'images'` | Expo SDK 52+ | Old form still works but deprecated; use new string form |
| `fetch(uri).blob()` for Supabase upload | `FileSystem.readAsStringAsync` → `decode` → ArrayBuffer | Ongoing RN limitation | Blob approach silently corrupts on Android |
| `manipulateAsync` (deprecated) | `ImageManipulator.manipulate()` class API | SDK 53/54 | Old API still works and is more stable; use it for now |
| `Notifications.getLastNotificationResponse()` (sync) | `getLastNotificationResponseAsync()` (async) | Recent expo-notifications | Both available; async preferred |

**Deprecated/outdated in this project:**
- `ImagePicker.MediaTypeOptions.Images`: Deprecated. Use `'images'` string literal.
- `supabase.from().upload(blob)` in React Native: Not officially deprecated but functionally broken on Android. Replace with ArrayBuffer.

---

## Open Questions

1. **Supabase `kyc-documents` bucket existence and public policy**
   - What we know: `listings` bucket is used and appears public (existing `getPublicUrl` calls work)
   - What's unclear: Whether `kyc-documents` bucket exists and whether it should be public or private (KYC docs are sensitive)
   - Recommendation: Create `kyc-documents` bucket as private; use signed URLs instead of public URLs for KYC docs. Or confirm with project owner whether public is acceptable.

2. **`/users/me` response shape for `dealerProfile.isVerified`**
   - What we know: `DealerProfileScreen.tsx` references `stats?.isVerified` (line 504) from a separate `/dealers/profile` endpoint
   - What's unclear: Whether `/users/me` returns `dealerProfile.isVerified` or if a separate call is needed
   - Recommendation: Check `/users/me` response in authStore — if not present, add a `GET /dealers/profile` call during auth hydration for dealer role users only.

3. **Listing fee payment — `POST /listings/:id/publish` contract**
   - What we know: Endpoint exists; `requiresPayment: true` field is referenced in CONTEXT.md
   - What's unclear: Does the backend gate on payment completion, or does the frontend just fire Stripe first and then call publish?
   - Recommendation: Fire Payment Sheet → on success → call `POST /listings/:id/publish`. This is the safe sequence regardless of backend behavior.

4. **Stripe amount units for listing fees**
   - What we know: `PurchaseFlowScreen` passes pounds directly
   - What's unclear: Whether `/payments/intent` expects GBP pence or pounds for listing fees vs. purchase amounts
   - Recommendation: Follow `PurchaseFlowScreen.tsx` convention (passes pounds). If behavior is wrong, investigate backend.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently configured for mobile app (no jest.config.js in mobile directory) |
| Config file | N/A |
| Quick run command | `cd "carmazium app/carmazium app" && npx tsc --noEmit` (TypeScript check only) |
| Full suite command | `cd "carmazium app/carmazium app" && npx tsc --noEmit` |

**Note:** The jest infrastructure documented in STATE.md (Phase 2 Wave 0) lives in the web app root or a previous phase structure. The mobile app (`carmazium app/carmazium app/`) has no jest.config.js. TypeScript compilation is the primary automated quality gate.

### Phase Requirements → Validation Map

| Req ID | Behavior | Test Type | How to Validate | Automated? |
|--------|----------|-----------|-----------------|------------|
| SELL-01 | DVLA lookup auto-fills fields | Manual + TS | Enter plate `BD51SMR` → observe fields populate within 2s | Manual |
| SELL-02 | Manual entry fallback | Manual | Submit without DVLA → listing creates OK | Manual |
| SELL-03 | Condition fields (mileage, MOT, etc.) | TS type check | `npx tsc --noEmit` confirms payload types | `npx tsc --noEmit` |
| SELL-04 | Photo upload HEIC→JPEG, max 1.5 MB | Manual | Upload HEIC photo → check Supabase bucket — file is JPEG, < 1.5 MB | Manual |
| SELL-05 | Listing price + type selection | Manual + TS | Select AUCTION → step 5 appears; select PREMIUM → payment sheet fires | Manual |
| SELL-06 | Review screen before publish | Manual | Step 4/5 shows summary of all entered data | Manual |
| SELL-07 | Listing created on backend | Manual API | POST /listings fires → 201 response → navigate to seller dashboard | Manual |
| SELL-08 | Draft save and resume | Manual | Force-close app mid-wizard → reopen → "Resume draft?" prompt appears | Manual |
| KYC-01 | KYC initiation from profile | Manual | Tap "Get Verified" → DealerKYCScreen opens | Manual |
| KYC-02 | Photo/PDF document capture | Manual | Tap document field → picker opens → doc appears in field | Manual |
| KYC-03 | 1.5 MB compression | Manual | Upload 5 MB HEIC → check Supabase — file < 1.5 MB | Manual |
| KYC-04 | Pending state after submit | Manual | Submit KYC → PendingView shown | Manual |
| KYC-05 | Push notification on approval | Manual | Admin approves in backend → notification arrives | Manual |
| DEALER-03 | Offer conversion rate + avg views | TS + Manual | `npx tsc --noEmit` + navigate to DealerAnalyticsScreen | Manual |
| DINV-01/02/03/04 | Dealer inventory CRUD | Manual + API | Filter works, status change calls API, add listing navigates to wizard | Manual |
| DCRM-01/02/03/04 | Dealer CRM leads | Manual + API | Leads list loads, filter chip changes list, status update calls PATCH, Message fires createChatRoom | Manual |
| DAUC-01/02/03 | Dealer auction manager | Manual + API | Auctions list with countdown, POST /auctions fires, cancel fires DELETE/PATCH | Manual |

### TypeScript Gate (must pass before each wave merge)
```bash
cd "carmazium app/carmazium app" && npx tsc --noEmit
```

### Wave 0 Gaps (setup required before any wave)
- [ ] Install `expo-image-manipulator` — covers SELL-04, KYC-03
- [ ] Install `base64-arraybuffer` — covers Supabase upload reliability (SELL-04, KYC-02/03)
- [ ] Install `@react-native-async-storage/async-storage` — covers SELL-08 (draft persistence)
- [ ] Install `expo-document-picker` — covers KYC-02 (PDF document capture)
- [ ] Create `src/lib/storageHelper.ts` — shared upload utility used by all waves
- [ ] Create `src/lib/sellWizardStore.ts` — Zustand persist store for draft state

---

## Sources

### Primary (HIGH confidence)
- Expo ImageManipulator docs — https://docs.expo.dev/versions/latest/sdk/imagemanipulator/ — `manipulateAsync` API, `SaveFormat`, `compress` range
- Expo ImagePicker docs — https://docs.expo.dev/versions/latest/sdk/imagepicker/ — SDK 54 HEIC default behavior, `allowsEditing: false` note
- Expo Notifications docs — https://docs.expo.dev/versions/latest/sdk/notifications/ — `addNotificationResponseReceivedListener`, `getLastNotificationResponseAsync` signatures
- Supabase React Native Storage guide — https://supabase.com/blog/react-native-storage — ArrayBuffer upload pattern, Base64 decode approach
- Stripe React Native initPaymentSheet docs — https://docs.stripe.com/payments/mobile/accept-payment?platform=react-native — confirmed `initPaymentSheet` params
- Existing codebase — `App.tsx`, `PurchaseFlowScreen.tsx`, `paymentsApi.ts`, `DealerKYCScreen.tsx`, `SellCarFlowScreen.tsx` — confirmed as-built state

### Secondary (MEDIUM confidence)
- expo-document-picker Expo docs — https://docs.expo.dev/versions/latest/sdk/document-picker/ — `getDocumentAsync` signature, `copyToCacheDirectory` requirement
- Zustand persist docs — https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md — `createJSONStorage` pattern (confirmed via WebSearch cross-reference)
- Stripe appearance API docs — https://docs.stripe.com/elements/appearance-api/mobile?platform=react-native — `colors` object structure

### Tertiary (LOW confidence — needs validation)
- FileSystem.getInfoAsync size under-reporting issue — https://github.com/expo/expo/issues/15212 — 1.2 MB conservative target is mitigation
- `alwaysDark` Android behavior — GitHub issues #593, #692 in stripe-react-native — use explicit `appearance.colors` as mitigation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; APIs verified in official docs
- Architecture patterns: HIGH — based on existing working code (PurchaseFlowScreen, SellCarFlowScreen, App.tsx)
- Pitfalls: HIGH — Blob upload issue verified (Supabase blog), HEIC issue verified (Expo docs), cold-start issue verified (Expo docs)
- Zustand persist: HIGH — pattern verified via official Zustand docs
- Dealer gate implementation: MEDIUM — `isVerified` field shape in `/users/me` not confirmed (open question 2)

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable ecosystem; Expo 54 + stripe-react-native 0.50 are pinned in package.json)

---

## RESEARCH COMPLETE
