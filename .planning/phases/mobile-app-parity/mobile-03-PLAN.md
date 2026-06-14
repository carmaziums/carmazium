---
phase: mobile-app-parity
plan: "03"
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - "src/screens/sell/SellCarFlowScreen.tsx"
  - "src/screens/main/DealerKYCScreen.tsx"
  - "src/screens/vehicle/VehicleDetailScreen.tsx"
autonomous: true
requirements: []
must_haves:
  truths:
    - "SellCarFlowScreen fields show real-time inline validation: border turns Colors.error on invalid and Colors.success on valid, with an error message below the field on blur/keystroke"
    - "SellCarFlowScreen photo preview grid uses expo-image (not react-native Image)"
    - "DealerKYCScreen submits documents to the KYC endpoint and shows a pending state after submission (not a spinner or blank)"
    - "VehicleDetailScreen photo gallery uses Reanimated + gesture-handler spring-snap with pinch-to-zoom on full-screen tap"
    - "VehicleDetailScreen finance calculator shows a 'Coming Soon' label and makes no API calls"
    - "DVLA lookup in SellCarFlowScreen remains intact (already implemented — do not re-add)"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/screens/main/DealerKYCScreen.tsx"
      provides: "KYC submission + pending state"
  key_links:
    - from: "src/screens/main/DealerKYCScreen.tsx"
      to: "KYC submission endpoint"
      via: "apiClient POST with uploaded document references"
    - from: "src/screens/vehicle/VehicleDetailScreen.tsx"
      to: "react-native-gesture-handler"
      via: "Gesture.Pinch + Gesture.Pan for gallery"
---

<objective>
Wave 2 — Sell flow & KYC. Add real-time inline validation and expo-image to the sell wizard, audit and wire DealerKYCScreen end-to-end with a pending state, and upgrade the VehicleDetailScreen photo gallery to a spring-snap gesture gallery with pinch-to-zoom while labeling the finance calculator "Coming Soon".

Purpose: These are the trust-and-conversion screens. Listing creation must feel responsive (live validation), KYC must complete and confirm, and the vehicle gallery must feel native.
Output: A validated sell wizard, a working KYC flow, and a gesture photo gallery.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md

<interfaces>
Shared (Wave 0): Skeleton, EmptyState, ErrorBanner from src/components/ui/*, haptics from src/lib/haptics.
Tokens: Colors.error='#EF4444', Colors.success='#22C55E', Colors.inputBorder, Colors.inputBorderFocused, Colors.accent, Colors.bgTertiary='#18181E', FontFamily.mono/bold/regular.

SellCarFlowScreen facts (src/screens/sell/SellCarFlowScreen.tsx):
- DVLA lookup ALREADY implemented via `POST /dvla/lookup` through apiClient — populates make/model/year/fuelType/colour with graceful fallback. DO NOT add or re-wire DVLA.
- Imports `Image` from 'react-native' (around line 5) for the photo preview grid — this must change to expo-image.
- Multi-step wizard with text inputs; publish via `POST /listings`.

DealerKYCScreen facts (src/screens/main/DealerKYCScreen.tsx, 606 lines): document upload UI exists; the submission wiring and pending-state are the unknowns to audit. Check src/lib/apiClient.ts and any dealer/kyc helper for the correct endpoint (likely POST /dealers/kyc). Image upload uses expo-image-picker (already installed).

VehicleDetailScreen facts (src/screens/vehicle/VehicleDetailScreen.tsx, 1607 lines): has `financeExpanded` state + deposit/term inputs. Current gallery is a horizontal FlatList. expo-image already used for images.

Gesture-handler (Wave 0): use the modern Gesture API — `import { Gesture, GestureDetector } from 'react-native-gesture-handler'` + Reanimated `useSharedValue`/`useAnimatedStyle`. GestureHandlerRootView is already wrapping the app (Wave 0 Task 4).
</interfaces>
</context>

<tasks>

<task type="modify">
  <name>Task 1: SellCarFlowScreen — real-time inline validation + expo-image swap</name>
  <files>src/screens/sell/SellCarFlowScreen.tsx</files>
  <action>
    Part A — expo-image swap:
    - Change the photo preview grid to import `Image` from 'expo-image' (currently from 'react-native', ~line 5). Add `transition={200}` and a dark placeholder style (backgroundColor Colors.bgTertiary) on each thumbnail so there is no white flash. If 'Image' from react-native is used elsewhere for non-photo purposes, alias the expo-image import (e.g. `import { Image as ExpoImage } from 'expo-image'`) and use it only for car photo thumbnails.

    Part B — real-time inline validation:
    - Add per-field validation state. For each user-entered field (price, mileage, and any required text fields; the offer/price input especially), compute validity on change and on blur.
    - Validity rules: price must be a positive number; mileage must be a non-negative integer; required text fields must be non-empty. (Do NOT validate DVLA-autofilled fields that the user did not type.)
    - Visual feedback: a field's TextInput borderColor becomes Colors.error when touched+invalid, Colors.success when touched+valid, else Colors.inputBorder. Render an error message Text (FontFamily.regular, FontSize.xs, Colors.error) directly below the field when touched+invalid.
    - Do NOT use Alert.alert for field errors. Keep haptics optional here.
    - Disable the step's continue/publish button while the current step has any touched-invalid field.
    - Leave DVLA lookup, image picker, and POST /listings publish logic untouched.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Type an invalid price (e.g. -5 or empty): border turns red + error text appears, continue disabled. Type a valid value: border turns green. Upload a photo: preview shows via expo-image with no white flash. DVLA lookup still autofills.</manual>
  </verify>
  <done>Sell wizard fields show live red/green border + inline error text; continue is gated on validity; photo grid uses expo-image; DVLA untouched.</done>
</task>

<task type="modify">
  <name>Task 2: DealerKYCScreen — audit, wire submission, add pending state</name>
  <files>src/screens/main/DealerKYCScreen.tsx</files>
  <action>
    1) Audit the current submission path. Identify the correct backend endpoint (search apiClient usages and FEATURE_AUDIT.md; expected `POST /dealers/kyc`). Do NOT invent a new endpoint or change the backend.
    2) Wire the submit action: on submit, upload/attach the captured licence document(s) (front/back as the existing UI captures them) and POST to the KYC endpoint via apiClient. Use the existing expo-image-picker capture flow already in the screen. Show an ErrorBanner (from src/components/ui/ErrorBanner) with onRetry if the request fails — no Alert.alert for the API error.
    3) Pending state: after a successful submission (or when the screen loads and the dealer's KYC status is already 'pending'/'under review'), render a clear pending-state view — a shield/clock Ionicon, heading "Verification in progress", subtext "Your documents are under review. We'll notify you once verified." Use FontFamily.bold heading + FontFamily.regular body, Colors tokens. This replaces the upload form while pending — not a spinner or blank screen. Reuse EmptyState if its shape fits, otherwise a dedicated pending view.
    4) Call haptics.success() on successful submission.
    5) Ensure the screen has a skeleton or graceful loading state while fetching current KYC status.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>As a dealer, capture front/back licence and submit: request fires to the KYC endpoint, success haptic, screen switches to the pending state. Reopen the screen while pending: pending state shows immediately. Force a network failure: ErrorBanner with Try again appears (no Alert).</manual>
  </verify>
  <done>KYC documents submit to the correct endpoint; a pending state replaces the form after submission and on re-entry while pending; failures show an inline ErrorBanner.</done>
</task>

<task type="modify">
  <name>Task 3: VehicleDetailScreen — gesture photo gallery + finance Coming Soon</name>
  <files>src/screens/vehicle/VehicleDetailScreen.tsx</files>
  <action>
    1) Photo gallery spring-snap: Replace the horizontal FlatList gallery with a Reanimated + gesture-handler implementation. Use a horizontal pan Gesture (`Gesture.Pan()`) driving a shared `translateX`, snapping to the nearest photo index with `withSpring` on gesture end (snap = -index * screenWidth, damping ~20, stiffness ~200). Render the photo strip as a Reanimated.View row of expo-image photos, each width = screen width. Keep the page-dot indicator in sync with the active index. Use FontFamily.mono for any photo counter (e.g. "3/12").
    2) Pinch-to-zoom: On full-screen photo tap (open the existing/located full-screen viewer, or add a Modal), wrap the active image in a `Gesture.Pinch()` driving a shared `scale` with `useAnimatedStyle` transform: [{ scale }]; clamp scale between 1 and 4; spring back to 1 on release if below 1. Combine with a pan gesture using `Gesture.Simultaneous(pinch, pan)` so the user can move a zoomed image. Use GestureDetector. (GestureHandlerRootView is already mounted from Wave 0.)
    3) expo-image polish: ensure gallery images use expo-image with `transition={200}` and a dark placeholder (backgroundColor Colors.bgTertiary) — no white flash.
    4) Finance calculator: locate the financeExpanded section with deposit/term inputs. Add a clear "Coming Soon" label/badge near the finance section header (FontFamily.bold, Colors.warning or Colors.textMuted). Ensure NO API calls fire from the finance section — if any handler calls the backend, gate it behind a no-op / remove the call. Keep the input UI visible but inert.
    Use Colors.* tokens throughout; no hardcoded hex.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Swipe the gallery: photos spring-snap (no inertia scroll). Tap to full-screen, pinch: image zooms and pans, releases back. Expand finance: "Coming Soon" label shows, no network call fires.</manual>
  </verify>
  <done>Gallery spring-snaps between photos with synced dots, pinch-to-zoom works full-screen, and the finance calculator is labeled Coming Soon with zero API calls.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- SellCarFlowScreen: live validation borders/messages + expo-image preview; DVLA intact.
- DealerKYCScreen: submission wired + pending state + ErrorBanner on failure.
- VehicleDetailScreen: spring-snap gallery + pinch-to-zoom + finance Coming Soon (no API calls).
</verification>

<success_criteria>
Sell wizard validates fields in real time, KYC completes with a pending confirmation, and the vehicle gallery feels native with spring-snap and pinch-to-zoom.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-03-SUMMARY.md` documenting the KYC endpoint used, the validation rule set, and the gesture gallery approach.
</output>
