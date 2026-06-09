# Carmazium Mobile App — Developer Setup Guide

> React Native / Expo 54 · TypeScript · Zustand · Supabase · Stripe

---

## Prerequisites

| Tool | Required version | Install |
|---|---|---|
| Node.js | 20 LTS or 22 | https://nodejs.org |
| npm | 10+ (ships with Node) | — |
| Expo CLI | Latest | `npm i -g expo-cli` |
| EAS CLI | 13+ | `npm i -g eas-cli` |
| Expo Go app | Latest | App Store / Google Play |

**No Android Studio or Xcode required for local testing** — Expo Go covers both platforms.

---

## 1. Clone & install

```bash
git clone https://github.com/pizn-01/carmazium.git
cd carmazium/carmazium\ app/carmazium\ app
npm install
```

---

## 2. Environment variables

Create a `.env` file in `carmazium app/carmazium app/`:

```env
EXPO_PUBLIC_API_URL=https://carmazium-hjoh9w.fly.dev
EXPO_PUBLIC_SUPABASE_URL=https://bwtnzmevjlowwronylxm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dG56bWV2amxvd3dyb255bHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzU0ODYsImV4cCI6MjA2NDY1MTQ4Nn0.afLqKj5aWzeVulSBWbmVypA9Zs2Z3uCUkWgUJn7mE0o
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SCdEd8rAGPNUbOXb0oOcVdPeNpLV4ktAiej1pc8zMxn2YKAcWZOtymIYBvMbmr6P36uzRVQTjEBQdUZdqmfXbC7004ZlbIrGS
# Leave blank until you have a Sentry project
EXPO_PUBLIC_SENTRY_DSN=
```

> All `EXPO_PUBLIC_*` vars are **client-side safe** — they're deliberately public keys (Supabase anon key, Stripe publishable key). Do **not** add any secret keys here.

---

## 3. Run the app

```bash
npx expo start
```

This opens the Metro bundler. Then:

- **iOS** — scan the QR code with the Camera app (requires iOS 16+)  
- **Android** — scan the QR code inside the **Expo Go** app  
- **iOS Simulator** — press `i` in the terminal (requires Xcode on macOS)  
- **Android Emulator** — press `a` in the terminal (requires Android Studio)

> **Tip:** the app connects to the live production backend (`https://carmazium-hjoh9w.fly.dev`). You can register a new test account — it hits the real Supabase database.

---

## 4. Project structure

```
carmazium app/carmazium app/
├── App.tsx                  # Root: fonts, auth init, OTA updates, push listeners
├── app.json                 # Expo config: icon, splash, plugins, runtimeVersion
├── eas.json                 # EAS build + submit profiles (all env vars baked in)
├── assets/
│   └── images/
│       ├── icon.png             # 1024×1024 app icon (iOS + Android legacy)
│       ├── adaptive-icon.png    # Android adaptive icon foreground layer
│       ├── splash.png           # 2048×2048 splash screen
│       └── onboarding_car*.png  # Onboarding slide images
└── src/
    ├── components/          # Shared UI components
    │   ├── GlobalDrawer.tsx     # Slide-out nav drawer (buyer / seller / dealer)
    │   ├── GlobalAIChatBot.tsx  # Floating AI assistant
    │   └── ...
    ├── constants/
    │   └── colors.ts            # Brand palette (#DC1F26 red, #0A0A0C dark)
    ├── context/             # React contexts (Chat, Drawer)
    ├── lib/
    │   ├── apiClient.ts         # Axios wrapper → EXPO_PUBLIC_API_URL
    │   ├── supabase.ts          # Supabase client
    │   ├── pushNotifications.ts # Expo push token registration + channels
    │   └── *Api.ts              # Feature-specific API modules
    ├── navigation/          # React Navigation stack/tab/drawer definitions
    ├── screens/
    │   ├── auth/            # Login, Register, ForgotPassword, ResetPassword
    │   ├── main/            # Home, Search, Live auctions, Saved, Settings…
    │   ├── account/         # Unified dashboard, PaymentHistory…
    │   ├── seller/          # Seller listings, offers, analytics, performance
    │   ├── buyer/           # Buyer bid history, offers
    │   ├── sell/            # Multi-step car listing flow (SellCarsScreen)
    │   ├── vehicle/         # VehicleDetail, AuctionDetail, Negotiation
    │   ├── loading/         # Custom splash screen
    │   └── onboarding/      # Role-selection onboarding
    └── store/
        └── authStore.ts     # Zustand: isAuthenticated, user, role (buyer|seller|dealer)
```

---

## 5. Auth & role system

| Backend role | App role | Access |
|---|---|---|
| `BUYER` | `'buyer'` | Browse, save, bid, buy |
| `SELLER` | `'seller'` | List cars, manage offers, seller analytics |
| `DEALER` | `'dealer'` | Full dealer dashboard, team, inventory, KYC |

Roles are assigned at registration and stored in Supabase `profiles.role`. The app maps them in `src/store/authStore.ts → initializeAuth / login / signup`.

**To test all three roles:**
1. Register three separate accounts
2. In Supabase dashboard (`bwtnzmevjlowwronylxm.supabase.co`) → Table editor → `profiles` → change the `role` column to `SELLER` or `DEALER` for the relevant user
3. Log out and log back in — the app will reflect the correct role

---

## 6. Key screens to test

### Buyer flow
- Register → onboarding → HomeScreen browsing
- Search & filter vehicles
- Open a listing → bid in a live auction (LiveScreen)
- Save a vehicle → SavedScreen
- Start negotiation → NegotiationScreen

### Seller flow
- Register with SELLER role (set via Supabase after sign-up)
- Sell a car → SellCarsScreen (multi-step: details, photos, 3D damage mapper, pricing)
- Review incoming offers → SellerOffersScreen
- Seller analytics → SellerPerformanceScreen

### Dealer flow
- Register with DEALER role
- Full dealer dashboard → UnifiedDashboardScreen
- Inventory management → DealerInventoryScreen
- Leads → DealerLeadsScreen
- Onboarding / KYC → DealerOnboardingScreen

### Common
- Settings → role badge reflects real role (no "Become a dealer" toggle)
- Chat → ChatScreen
- Notifications → NotificationsScreen
- Profile → ProfileScreen

---

## 7. Backend API

All API calls go to `https://carmazium-hjoh9w.fly.dev` (Fly.io, NestJS).

| Module | Base path |
|---|---|
| Auth | `/auth/*` |
| Listings | `/listings/*` |
| Auctions | `/auctions/*` |
| Offers / Negotiation | `/offers/*` |
| Payments | `/payments/*` |
| Chat | `/chat/*` (WebSocket + REST) |
| Notifications | `/notifications/*` |
| Users / Profiles | `/users/*` |

Swagger UI (if enabled): `https://carmazium-hjoh9w.fly.dev/api`

---

## 8. Push notifications (local testing)

Push notifications require a **physical device** — they do not work in simulators/emulators.

After logging in, call `registerForPushNotifications(userId)` from `src/lib/pushNotifications.ts`. The token is sent to `POST /users/push-token` on the backend.

---

## 9. OTA updates

OTA updates via `expo-updates` are **disabled in development** (`__DEV__` guard). They only activate in production EAS builds. No action needed for local testing.

---

## 10. Production builds (when ready)

> You need an **EAS account** and credentials filled in `eas.json` before building for stores.

```bash
# Log in to EAS
eas login

# Initialize the project (generates EAS project ID)
eas init

# Development build (internal distribution, dev client)
eas build --platform all --profile development

# Preview build (internal distribution, production JS)
eas build --platform all --profile preview

# Production build (App Store + Google Play)
eas build --platform all --profile production
```

**Before running production build, fill in `eas.json`:**
- `submit.production.ios.appleId` — your Apple ID email
- `submit.production.ios.ascAppId` — App Store Connect numeric app ID
- `submit.production.ios.appleTeamId` — 10-char team ID from developer.apple.com
- `submit.production.android.serviceAccountKeyPath` — path to your Google Play service account JSON
- Update `app.json → updates.url` with your EAS project UUID

**Submit to stores after a successful production build:**
```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## 11. Common issues

| Symptom | Fix |
|---|---|
| `Unable to resolve module` | Run `npm install` then restart Metro with `npx expo start -c` |
| Blank screen / auth loop | Check `.env` is in the right directory and values are correct |
| Camera/location permission denied | Test on a real device; grant permissions in device Settings |
| Stripe payment sheet doesn't open | Ensure `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set correctly |
| 3D damage mapper blank | WebGL not supported in Expo Go on some Android devices; test on iOS or a development build |
| TypeScript errors | Run `npx tsc --noEmit` — should report 0 errors on a clean checkout |

---

## 12. Contact

Backend & web app repo: `https://github.com/pizn-01/carmazium`  
Backend deployed at: `https://carmazium-hjoh9w.fly.dev`  
Web app: production on Vercel  
