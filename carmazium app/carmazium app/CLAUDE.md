# Carmazium Mobile — Claude Code Instructions

This file is auto-loaded by Claude Code whenever it works in this directory. Read `CONTEXT.md` alongside this for the current state of the project and recent history.

## Stack

- Expo SDK 54, React 19.1, React Native 0.81
- React Navigation 7 (native stack + bottom tabs) — **not** Expo Router
- StyleSheet API — **not** NativeWind, no Tailwind classes anywhere in this app
- Zustand for state (`authStore`, `watchlistStore`, `sellWizardStore`)
- Direct `apiClient` (`src/lib/apiClient.ts`) calls — **not** TanStack Query, no React Query anywhere
- Socket.IO on `/auctions`, `/chat`, `/notifications`
- `@stripe/stripe-react-native` for payments (checkout is enabled on mobile — not a "no payments" app)

## Design system — read before writing any UI

The visual source of truth is **`<repo-root>/CarMazium Design System/`** —
`colors_and_type.css` for tokens, and `ui_kits/carmazium-mobile/` for a complete
React concept kit (`mobile-kit.jsx` atoms plus ~20 designed screens). When
building or restyling a screen, check whether the kit already designs it before
inventing a layout.

**Never add a raw hex, font size or corner radius.** The 2026-08-14 overhaul
existed largely because a codemod had lifted every literal into a token without
collapsing them, leaving ~150 colours, 14 arbitrary font sizes and 16 corner
radii — no system, just a dump. Use:

- `Colors` (`constants/colors.ts`) — ground / brand / text / border / semantic
  plus alpha scales. Brand red is **`#FF0037`** (the design system explicitly
  retires `#ED1C24`; web still ships the old one, so the platforms differ on
  purpose until web catches up).
- `Type` and `TextPresets` (`constants/typography.ts`) — `eyebrow`, `monoPrice`,
  `monoFigure`, `tabLabel` are the design-system roles. **Prices, bids and
  countdowns are always mono.**
- `Radius`, `Elevation`, `Blur`, `Motion` (`constants/spacing.ts`).

The `sizeNN` font tokens and the `deepBlue_*` / `darkBlue_*` / `pale*` / `mid*`
colour names are **deprecated aliases** kept so the collapse could land without
editing 60 screens at once. They resolve to canonical values. Don't use them in
new code and don't add to them; migrate call sites off them when you touch a
file.

Two RN-specific traps the tokens exist to stop you re-hitting:

- **`Elevation.*` must be spread whole.** Each level ships the iOS `shadow*` set
  *and* the Android `elevation` number. Using one without the other gives you a
  shadow on a single platform — which is how the app previously had no card
  shadow on either.
- **iOS clips shadows to `overflow: 'hidden'`.** A card that clips a full-bleed
  image loses its shadow on iOS only. `components/ui/Card.tsx` already handles
  this (it splits into a shadow host + clipping child, on iOS only, because
  Android's elevation isn't clipped and won't draw behind a transparent
  background). Use `Card` rather than re-solving it.

Shared primitives live in **`src/components/ui/`** — `Card`, `Badge`, `Chip`,
`Eyebrow`, `Price`, `GlassPill`, `EmptyState`, `Skeleton`, `ErrorBanner`.
Prefer them over hand-rolling a card/badge/label in a screen; the per-screen
versions are exactly what made the app look inconsistent.

`expo-blur` and `@react-native-masked-view` are **not installed** — adding
either forces a native prebuild. So "glass" is a translucent fill without a real
backdrop blur, and `Price` is solid rather than gradient-clipped. Both are
one-component changes if those deps ever land.

## Conventions — follow these, don't introduce new patterns

- All styling via `StyleSheet.create()`. Never inline style objects for anything reused more than once, never NativeWind/Tailwind.
- All API calls go through `apiClient` (`src/lib/apiClient.ts`) or a thin wrapper lib (`paymentsApi.ts`, `aiApi.ts`, `chatApi.ts`, `dvlaApi.ts`) — never raw `fetch()` in a screen.
- Icons: `Ionicons`/`MaterialCommunityIcons` from `@/components/BrandIcon` only. Never mix in a different icon set.
- Images: `expo-image`, never the RN `<Image>` component.
- Design tokens: `Colors` (`src/constants/colors.ts`) and `FontFamily`/`FontSize` (`src/constants/typography.ts`). Zero hardcoded hex colors or system-font fallbacks.
- Navigation param types live in `MainStackParamList` (`src/navigation/MainStackNavigator.tsx`). Update this type whenever adding/removing a route.
- **A registered route isn't a reachable one.** Five fully-built screens shipped
  unreachable because nothing ever navigated to them. After adding a screen,
  grep for a `navigate('YourScreen'` call — if there isn't one, wire the drawer
  (`components/GlobalDrawer.tsx`) or a call site too.
- **Dealer feature screens are gated.** They're registered wrapped in
  `withDealerGate` (`components/DealerGate.tsx`), which mirrors web's
  `dashboard/dealer/layout.tsx`. A new dealer feature screen should be wrapped
  the same way; `DealerKYC` and `DealerOnboarding` must stay ungated, since
  they're how a user becomes verified. The gate passes on
  `isVerified || isDealerStaff` — **staff of a verified dealership have no
  `dealerProfile` of their own**, so gating on `isVerified` alone locks out
  every employee of every dealer.
- **HOCs go at module scope, never inline in JSX.** `component={withX(Screen)}`
  written inside the navigator creates a new component type each render, and
  React Navigation remounts the screen and drops its state. Hoist to a
  `const GatedX = withX(X)`.
- **Zustand: always use a selector.** `const { a, b } = useStore()` subscribes
  the component to every field, so an unrelated write re-renders it. This was
  the app's worst perf bug twice over — every listing card re-rendering when any
  listing was saved, and the live auction socket tearing down mid-auction
  because `currentUser`'s identity changed. Prefer a primitive:
  `useWatchlistStore((s) => s.savedIds.has(id))`.
- **Lists:** `FlatList` with stable `renderItem`/`keyExtractor`, never
  `ScrollView` + `.map()` over server data. Defining `renderItem` inline hands
  the list a new reference each render and defeats row memoisation.
- **Fonts:** `App.tsx` loads only the nine variants actually referenced. If you
  add a weight to `FontFamily`/`TextPresets`, add it there too or it silently
  falls back to the system font.
- There is exactly **one** listing-creation flow: `src/screens/sell/SellCarFlowScreen.tsx` (route `SellCarFlow`). It handles both CLASSIFIED and AUCTION listing types, editing, and the 3D damage-mapping viewer. Do not create a second one — a duplicate screen doing the same job is what caused the bugs fixed in 2026-07-06 (see `CONTEXT.md`).
- The 3D damage viewer (`src/components/damage/ThreeDVehicleViewer.tsx`) is a WebView + Three.js component, not `@react-three/fiber` — the app only has one GLB model file (`src/assets/3d/vehicle.glb`), shown regardless of actual body type. Getting per-body-type models (the web app has three) is an asset task, not a code task.
- Zone IDs in `src/components/damage/damageZones.ts` must match the web app's zone ids (kebab-case, e.g. `front-bumper`) for the `/damage/{id}/save` `part` field — web and mobile both post to the same backend endpoint and must agree on the format.

## Web app is the source of truth for field parity

The web app lives at the repo root (`..\..\src\` relative to this directory, i.e. `src\` as a sibling of `backend\` and `carmazium app\` at the repo root — NOT inside `carmazium app/`). This path is relative deliberately: it has drifted before (previously documented as `D:\carmazium\src\`, which does not exist on every machine this repo is checked out on) — always resolve it relative to the repo root you're actually in, don't hardcode a drive letter. When adding or auditing a listing/payment/AI-feature field, check the equivalent web code first:
- `src/components/listing/ListingWizard.tsx` — the listing creation form and its exact `/listings` payload shape
- `src/lib/aiApi.ts` — the AI description generation payload shape
- `src/components/listing/ThreeDVehicleViewer.tsx` / `VehicleDamageMapper.tsx` — the full 37-zone damage taxonomy and `/damage/{id}/save` payload

Don't guess a field name or enum value — grep the web repo for the real one before shipping a payload field.

Some content is **ported verbatim and must not be edited here**:

- `src/data/termsSections.ts` is a byte-for-byte copy of web's Terms
  (`src/app/terms/page.tsx` lines 14-856). When the terms change, re-copy the
  whole file rather than hand-editing either side — two hand-maintained copies
  of legal text is how they drifted apart in the first place.
- The How It Works fee figures (`HowItWorksScreen.tsx` `RECEIPTS`) mirror web's.
  Two different numbers for the same fee across platforms is worse than none.

**Web is not always right.** Mobile is ahead of it in places, and parity work
should not "fix" mobile down to web's level:
- `DealerOffersScreen` / `SellerOffersScreen` gate "Mark as Sold" on
  `listing.status !== 'SOLD'`; web's dealer offers page still doesn't.
- `DealerFinanceScreen` deliberately avoids web's `FUNDED`/`REVIEWING` statuses,
  which don't exist in the schema.
- Mobile's signup hardcoding `role: 'BUYER'` is deliberate, not web's old
  silent-default bug: reading local role there once wrote `DEALER` into the
  database. Dealers elevate via `POST /users/elevate`, and buyer/seller are one
  account on mobile.

## Backend

- Same backend for web and mobile: `https://carmazium-hjoh9w.fly.dev` (baked in via `EXPO_PUBLIC_API_URL`)
- Auth: Supabase Bearer token via `Authorization: Bearer <token>` header, handled inside `apiClient`
- **The backend rejects unknown DTO properties** (NestJS `forbidNonWhitelisted`-style validation — errors read `"property X should not exist"`). Never add a field to a payload without confirming the backend/web actually sends it — this exact bug (`declarationAcknowledged`, `priceAsking`, `damageRecords`, `dateOfLastV5CIssued` sent directly to `/listings`) broke listing publish for real users on 2026-07-06.

## Native project (`android/`, `ios/`) — read before touching build config

`android/` and `ios/` are **gitignored** and generated by `expo prebuild`, not checked into git. This means:
- `git pull` alone never updates the native project on a new machine.
- Any `app.json` change (permissions, deep-link scheme, plugins) or new native dependency requires `npx expo prebuild --clean --platform <platform>` to actually reach a built binary. Skipping this is why bugs used to "persist even after reinstall."
- See `CONTEXT.md` for the exact build-machine command sequences (release build vs. dev-client fast loop).

## Testing / verification

- `npx tsc --noEmit` from this directory after any change — this app has no other CI gate configured, so this is the only automated check.
- This dev machine (`D:\carmazium`) has no Android SDK/adb/emulator installed. Native builds and on-device verification only work on the separate build machine (`C:\ca\carmazium\`) — don't expect `expo run:android` to get past SDK resolution here.
