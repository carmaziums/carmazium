# Carmazium Mobile — Project Context & Handover

**Read this first, then `CLAUDE.md` in the same directory.** `CLAUDE.md` is the "how to work in this codebase" doc (conventions, stack rules, source-of-truth pointers). This doc is the "what's the current state, how do you build and ship it, and what still hurts" doc.

---

## 0. START HERE — current state (2026-08-14)

**The overhaul described in §0.1 below has largely been executed.** Read this
section first; §0.1/§0.2 are kept underneath as the brief that produced it.

Plan and full status: **`MOBILE_OVERHAUL_PLAN.md`** (same directory).
Evidence: **`.parity/01`–`06`** — six audits covering UI/visual, dealer parity,
navigation/journeys, perf + notifications, web visual drift, and backend drift.
29 commits, all on `main` (`55a41ba4..827e1fb8`), every one `tsc`-clean.

### 0.0.1 What the problem actually was

Not "the screens were never styled." A 2026-07-11 codemod had lifted every raw
literal in the codebase into a named token **without collapsing them**, leaving
~150 colours (sixteen near-identical dark blues), 14 arbitrary font sizes
carrying the *majority* of the app's text, and 16 different corner radii across
575 sites. Consistency had been enforced; a palette, type scale and radius scale
had never existed. That is the mechanical reason it read as amateur, and all
three are now closed at the token level rather than screen by screen.

### 0.0.2 What shipped

- **Foundation** — real palette (brand red now `#FF0037`, client-confirmed),
  semantic type scale, `Radius`/`Elevation`/`Blur`/`Motion` tokens, primitives
  in `components/ui/`, floating tab bar. See `CLAUDE.md` for the rules.
- **Navigation** — 5 built-but-unreachable screens reconnected, wrong
  post-action destinations fixed, notification tap-routing rebuilt off the
  backend's `link` field.
- **Dealer** — KYC gate (`components/DealerGate.tsx`) matching web's layout
  gate, with staff-membership support added to `authStore`.
- **Parity** — auction filter panel, gated seller contact on live auctions,
  Call Seller, postcode prompt, How It Works fee ledger, Terms ported verbatim.
- **Perf** — 11 unused fonts dropped from startup, Home rails virtualised,
  whole-store Zustand subscriptions removed from listing cards and the auction
  socket.
- **Push** — now works client-side; needed **no backend route** (see §0.0.4).

### 0.0.3 A mistake made during this work — for the record

Phase 1 repointed `Colors.textFaint` at the design system's `fg4` (`#4B556B`).
That was wrong: `textFaint` was `#8A8A93`, and all 33 of its call sites use it
for *readable content* — spec-table labels on VehicleDetail, the monthly-payment
figure, listing locations. Repointing it quietly pushed all of them below the
WCAG AA floor, undoing a contrast fix `mobile-ui-ux-audit.md` had specifically
called for.

Caught and fixed in `c1c310c1`: `textFaint` now resolves to `#8A93A8`
(= `textMuted`, where `#8A8A93` always belonged) and `textDisabled` took over
`#4B556B` for genuinely non-content text. **The fix is not mentioned in that
commit's message** — it rode along with an empty-states commit — so anyone
bisecting a contrast question between `a53234f5` and `c1c310c1` should know it
was live in that window. Noted here because the commit log won't tell you.

Lesson worth keeping: a token rename is not cosmetic when the old and new names
mean different things. Check what the *call sites* use a token **for** before
repointing it at a same-ish colour.

### 0.0.4 Not done — and why

- **Nothing has been seen running.** This machine has no Android SDK (§4). The
  whole 29-commit range is unverified on device. Verify first: the **dealer KYC
  gate** with three accounts (verified dealer, unverified dealer, staff of a
  verified dealership — the staff path was reasoned from the backend query, not
  observed); then the **floating tab bar** (most likely visual regression, since
  screens may have assumed the old edge-to-edge height).
- **Push needs two operational steps**, not code: `app.json` changed so it needs
  `expo prebuild` + a fresh binary (OTA won't pick it up), and Android delivery
  needs **FCM credentials on the Expo project** (`eas credentials`). There's no
  `googleServicesFile` in `app.json` and no `google-services.json` in the repo,
  so whether that was ever set up is unverified. Without it, pushes still won't
  arrive.
- **The `#FF0037` red is mobile-only.** Web still ships `#ed1c24`, so the two
  platforms visibly differ until web adopts the design system.
- **Terms needs a copy owner's sign-off.** It's a faithful copy of web, but
  "faithful copy" and "correct" are different claims, and the mobile
  presentation (83 cards in one scroll; web has a jump-to-section index mobile
  lacks) is unreviewed.
- **Per-screen layout work** against the kit's designed compositions
  (`screens-vehicle`, `screens-auction`, `screens-sell`,
  `screens-dealer-dashboard`) is the main remaining UI work, plus the chamfered
  primary CTA. It's judgement per screen, not a codemod, and wants a device.

### 0.0.5 Two claims from the original brief that did not survive audit

- **The dealer dashboard is not "hallucinated by an AI."** All 11 dealer screens
  were read in full and every displayed number traced to a real endpoint backed
  by a real Prisma query; a grep for mock/dummy/fake/`Math.random` found nothing.
  The dealer problem was navigation and the missing KYC gate.
- **No P0 was found in either drift audit.** Mobile was not exposing seller
  contact data web gates, and a field-by-field diff of `CreateListingDto`
  against mobile's publish payload found no `forbidNonWhitelisted` risk — the
  2026-07-06 incident has not regressed.

---

## 0. The brief that produced the above (2026-08-10)

Development focus has shifted fully to this app. Two things anyone picking this up needs to know before touching code:

### 0.1 The UI/UX mandate: a full professional redesign, not another patch pass

Client feedback as of 2026-08-10, verbatim in spirit: the app currently **"looks like generic slop, like a student made it as their academic project"** — not industry-grade. The ask is to **majorly improve the mobile app's UI/UX entirely**.

**Read `mobile-ui-ux-audit.md` and `mobile-ui-ux-plan.md` in this directory for history, but understand what they actually cover before assuming the UI/UX problem is solved:** that audit (2026-07-10) and plan (status banner: all 6 stages DONE by 2026-07-12) fixed **consistency and correctness** issues — design tokens enforced instead of 1,600+ raw hex literals, ~20 hand-rolled modals consolidated onto one `BottomSheet` component, always-on fake "✓ VERIFIED"/"4.5★" trust chrome gated on real data, accessibility labels added, a dealer density preset. **None of that is a visual design pass.** Perfectly consistent, accessible, token-driven UI can still look exactly like every other dark-mode React Native app — flat cards, default spacing, a red accent on near-black, no typographic personality, no signature moment anywhere in the product. That's almost certainly what "generic slop" is pointing at: the plumbing got fixed, the actual look was never designed.

This is a new, distinct initiative on top of that prior work, not a continuation of it:
- Treat the current palette (`src/constants/colors.ts`) and type scale (`src/constants/typography.ts`) as open to a real redesign, not just enforcement targets. Prior work made the app *consistent*; this pass should make it *distinctive*.
- Avoid the generic-AI-design defaults if this gets handed to Claude Code as a design brief: warm-cream-serif, near-black-with-one-neon-accent, or broadsheet-hairline-rules are all templated answers regardless of subject — CarMazium's own vernacular (UK vehicle marketplace, auctions, dealer trade culture) should drive palette/type/layout choices, not a generic "AI app" look.
- Match complexity of execution to whatever direction gets chosen — a bold redesign needs to be executed with precision (spacing, motion, a real signature element), not just a color swap on the existing layouts.
- Scope is "entirely," per the client's own words — likely means every major screen (Home, Search, Vehicle Detail, Sell flow, Auctions, Dashboards), not a spot-fix list. Plan accordingly rather than treating this as another 6-stage patch plan bolted onto the existing one.

Before starting execution, it's worth producing a fresh design plan (palette, type pairing, layout concept, one signature element) and getting it reviewed/approved before touching 50+ screens — same principle as the existing `mobile-ui-ux-plan.md`'s staged approach, but the deliverable this time is a look, not a checklist of bug fixes.

### 0.2 Backend changed while focus was on web — read this before assuming old behavior

The backend (shared with web, `https://carmazium-hjoh9w.fly.dev`) picked up real behavior changes between 2026-07-27 and 2026-08-10 while this app wasn't being actively worked on. Full detail in **`FEATURE_AUDIT.md` (repo root) §10** — read it before touching auctions, offers, chat, payouts, or onboarding. Highlights that affect mobile directly:

- Auctions now require admin review before going live in *every* case (previously had a gap) — any "your auction is now live" mobile copy needs to account for a review step.
- Unpaid auction wins auto-revert after 72h (new `Auction.wonAt` field + cron) — won-auctions screen should reflect `CANCELLED`, not assume a win is permanent.
- Payout status has two more fields (`stripeRefundError`, `manualPayoutConfirmedAt`) — `sellerBonusReleased` alone was never sufficient to mean "paid" and still isn't.
- Received-offers response now includes the listing's current status — this was filed specifically because mobile's dealer offers screen offered "Mark as Sold" on an already-sold listing. Confirm mobile reads the new field.
- Chat `findOrCreateRoom` now reliably returns `otherUser` — any defensive workaround for the old crash is still safe to keep, just no longer load-bearing.
- New mandatory `postcode` field on `User` (alongside existing `location`) — mobile onboarding/profile screens should collect it too if they don't already.

### 0.3 This doc's own currency

§6 ("what's shipped") below still stops at **2026-07-21** — §10's history log
now runs to 2026-08-14, and §0 above covers current state. Original note kept:
§6 Six more mobile commits landed between then and 2026-08-10 (`c95c670e`, `b7a8ab43`, `d2d6b9eb`, `d0affee0`, `63cccc6b`, `c21a447d` — chat bubble/search-pill/keyboard fixes and a "web/backend parity" pass) that were never folded into this doc. Give `git log --oneline --since=2026-07-21 -- "carmazium app"` a pass and update §6/§10 for real before relying on them as a complete picture of current state.

---

## 1. What this app is

A React Native / Expo mobile app for **Carmazium** — a UK vehicle marketplace with retail classifieds *and* live auctions. Same backend as the web app (`https://carmazium-hjoh9w.fly.dev`); the web app lives in `<repo-root>\src\` as a sibling of this directory.

Roles supported in-app: `buyer`, `seller`, `dealer`. The DB also has `admin`, `finance_partner`, `insurance_partner`, `service_provider` — **none of those have mobile dashboards** and their web equivalents are considered intentional gaps (admins/partners use web).

`buyer` and `seller` are treated as the same unified entity in the drawer (matches web's `formatRole()` → "Buyer/Seller Account"). Dealer keeps its own separate DEALER CONTROLS group.

---

## 2. Handover checklist — first day on this project

1. `cd "C:\ca\carmazium\carmazium app\carmazium app" && git pull && npm install`
2. Read this file top-to-bottom, then read `CLAUDE.md`
3. Verify the build machine is set up:
   - `adb devices` shows at least one device/emulator
   - `keystores\release.jks` and `keystores\release.keystore.properties` both exist (release signing)
   - `.env` has `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Run `npx tsc --noEmit` from the app root — must be clean before you start touching code
5. Verify build-machine setup — see §4 (JDK, Android SDK, keystore, `.env`)
6. Try the fast-loop path once (§5a) to confirm the dev client installs and Metro connects
7. Skim §6 for the current shipped state so you don't re-implement things that already exist
8. Skim §8 for open issues so you don't accidentally step on them

---

## 3. Repo layout

```
<repo-root>\                          ← the git repo root
├── src\                              ← WEB app (Next.js 14 App Router) — source of truth for parity
├── backend\                          ← NestJS backend, shared by web + mobile
│   └── src\                          ← controllers here define every API endpoint
└── carmazium app\                    ← the outer folder is not the project, it's a container
    └── carmazium app\                ← ← this Expo project (yes, the doubled name is real)
        ├── src\                      ← all mobile source lives here
        │   ├── screens\              ← one file per screen, grouped by area
        │   ├── components\           ← shared UI (BottomSheet, IconButton, VehicleCard, etc.)
        │   ├── lib\                  ← apiClient + thin wrappers (paymentsApi, chatApi, etc.)
        │   ├── store\                ← Zustand (authStore, watchlistStore, sellWizardStore)
        │   ├── navigation\           ← RootNavigator, MainStackNavigator, TabNavigator
        │   ├── constants\            ← Colors, FontFamily/FontSize, spacing
        │   └── context\              ← ChatContext, DrawerContext, LocationContext
        ├── android\                  ← generated by expo prebuild — GITIGNORED, never edit by hand
        ├── ios\                      ← same, gitignored
        ├── assets\images\            ← app assets (icons, splash, logo.png, logo-light.png, onboarding cars)
        ├── keystores\                ← release.jks + release.keystore.properties (git-ignored)
        ├── app.json                  ← Expo config (permissions, plugins, updates channel, runtimeVersion)
        ├── .env                      ← EXPO_PUBLIC_* env vars, auto-loaded by Expo
        ├── CLAUDE.md                 ← conventions doc (read alongside this)
        └── CONTEXT.md                ← this file
```

---

## 4. Build machine setup (this device: `C:\ca\carmazium\`)

This machine is the *only* box in the setup that can build and sign the mobile app. The web/backend dev machine (`D:\carmazium`) doesn't have the Android SDK. If you're taking this device over, verify each of these is present before you touch code.

### 4.0. Installed toolchain (versions currently working)

| Tool | Version | Where |
|------|---------|-------|
| Node.js | v24.16.0 | System PATH |
| npm | 11.13.0 | with Node |
| Git | 2.54 for Windows | System PATH |
| JDK | OpenJDK 21.0.10 (Android Studio JBR) | `C:\Program Files\Android\Android Studio\jbr\` |
| Android SDK | (root: `C:\Users\SG\AppData\Local\Android\Sdk`) | `%LOCALAPPDATA%\Android\Sdk` |
| SDK Build Tools | 35.0.0, 36.0.0, 36.1.0, 37.0.0 | `%LOCALAPPDATA%\Android\Sdk\build-tools\*` |
| Android NDK | 27.1.12297006 | `%LOCALAPPDATA%\Android\Sdk\ndk\*` |
| adb | 1.0.41 (Version 37.0.0) | `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` |
| Gradle | 8.14.3 (via wrapper `android\gradlew.bat`) | project-local |
| Expo CLI | 54.0.25 (via `npx expo`) | project-local |
| EAS CLI | **not installed globally** — install if you need `eas update` / `eas build` | via `npm i -g eas-cli` |

**Required environment variables** (verify with `echo %JAVA_HOME%` etc. in cmd.exe):

```
JAVA_HOME  = C:\Program Files\Android\Android Studio\jbr
ANDROID_HOME = C:\Users\SG\AppData\Local\Android\Sdk
Path additions:
  %ANDROID_HOME%\platform-tools     (for adb)
  %ANDROID_HOME%\emulator            (if using emulator)
  %JAVA_HOME%\bin                    (for the gradlew JVM)
```

`ANDROID_SDK_ROOT` is not currently set on this machine — Gradle picks `ANDROID_HOME` up fine either way, but if you install a newer SDK to a different location, set both.

If any of the above is missing, install/set it before running the build recipe below. Missing `JAVA_HOME` is the most common cause of `gradlew.bat` failing before it even prints its first task.

### 4.1. Release signing (keystore) — **CRITICAL, back this up**

Signing keystore lives at:

```
carmazium app\carmazium app\keystores\release.jks
carmazium app\carmazium app\keystores\release.keystore.properties
```

Both files are in `.gitignore` and **exist only on this machine**. There is no second copy. If you lose them, users cannot install any future release APK over an existing install of this app — they'd have to uninstall first. Back both up to a password manager attachment or encrypted external drive **before doing anything else** on this device.

`release.keystore.properties` contains (in this order):
- `MYAPP_RELEASE_STORE_FILE=release.jks` (relative to the `keystores\` folder)
- `MYAPP_RELEASE_KEY_ALIAS=carmazium-release`
- `MYAPP_RELEASE_STORE_PASSWORD=…` (redacted here — read from the file)
- `MYAPP_RELEASE_KEY_PASSWORD=…` (identical to store password — PKCS12 keystores don't support separate ones)

The properties file is consumed by `plugins/withAndroidReleaseSigning.js` during `expo prebuild`; you don't need to point Gradle at it manually.

### 4.2. Environment file (`.env`)

Located at `carmazium app\carmazium app\.env`. Also gitignored — never commit it. Required keys (exact names, all `EXPO_PUBLIC_*` prefix so Expo bakes them into the client bundle):

```
EXPO_PUBLIC_API_URL              = https://carmazium-hjoh9w.fly.dev
EXPO_PUBLIC_SUPABASE_URL         = https://bwtnzmevjlowwronylxm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY    = (Supabase anon/public key — read from Supabase project settings)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_… (live Stripe publishable key — do NOT swap for pk_test in a real build)
```

The Stripe key is a **live** key. Any release APK built on this machine will process real card charges. If you need to test with test cards, temporarily swap to `pk_test_…` and don't commit or ship that build.

The anon Supabase key is safe to embed in the client (that's what it's for). The Stripe *secret* key never touches this app — it lives in `backend\.env`.

### 4.3. EAS / Expo project identity

- Owner: `pizn-01s-team`
- Slug: `carmazium`
- EAS project ID: `f0ab914b-3433-4816-80a2-0a94e6c6a066`
- OTA update URL: `https://u.expo.dev/f0ab914b-3433-4816-80a2-0a94e6c6a066`
- `runtimeVersion.policy: sdkVersion` — every Expo SDK bump invalidates the OTA channel and requires a fresh binary rollout
- Channel currently used: `production`

To publish an OTA update from this machine, log into EAS once (`npx eas login` — the token persists in `~/.expo/`) and then `npx eas update --branch production --message "..."`. See §5c for the cache-invalidation caveat.

### 4.4. On-device Android debugging (physical device)

Enable Developer Options on the phone (tap Build Number 7 times in Settings → About), turn on USB Debugging, connect via USB, and confirm with `adb devices`. If `adb devices` shows the device as "unauthorized", accept the "Allow USB debugging?" prompt on the phone; if it shows nothing at all, cycle `adb kill-server && adb start-server` and re-plug the cable. This machine has intermittently lost the connection mid-session before — a cold plug re-detect fixes it.

---

## 5. Dev workflow

Two paths. **Use the fast loop unless you're actually shipping a signed APK.**

### 5a. Fast loop (day-to-day iteration)

Requires an Android SDK + emulator or USB-connected device. The build machine (`C:\ca\carmazium\`) has this set up.

**One-time**, or whenever a native dependency / `app.json` change (permissions, deep-link scheme, plugins) lands:

```cmd
cd "C:\ca\carmazium\carmazium app\carmazium app"
git pull
npm install
npx expo prebuild --clean --platform android
npx expo run:android
```

Builds a debug APK with the dev client baked in, installs and launches it on whatever `adb devices` sees. Auto-loads `.env` — no manual env vars needed on this path.

**Every day after that:**

```cmd
npm start
```

Open the already-installed dev-client app; it reconnects to Metro automatically. JS/TSX saves hot-reload instantly.

### 5b. Release build (only when shipping to real users)

This is the recipe that works reliably on the current build machine. The naive `gradlew.bat assembleRelease` hangs occasionally (flaky NDK compiler crashes, most likely antivirus interference) — the args below have been tested through many rebuilds.

```powershell
Set-Location "C:\ca\carmazium\carmazium app\carmazium app\android"

# 1. Wipe stale intermediate outputs — mandatory for JS-only changes
Remove-Item -Recurse -Force "app\build\generated" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "app\build\intermediates\assets" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "app\build\intermediates\merged_assets" -ErrorAction SilentlyContinue

# 2. Bake env vars into the bundle (gradle → Expo bundler → JS bundle)
$env:EXPO_PUBLIC_API_URL = "https://carmazium-hjoh9w.fly.dev"
$env:EXPO_PUBLIC_SUPABASE_URL = "https://bwtnzmevjlowwronylxm.supabase.co"
$env:NODE_ENV = "production"
# Pull the two secret keys from .env — DO NOT commit them anywhere
$envFile = Get-Content "..\.env" -Raw
if ($envFile -match 'EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)') { $env:EXPO_PUBLIC_SUPABASE_ANON_KEY = $matches[1].Trim() }
if ($envFile -match 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=(.+)') { $env:EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = $matches[1].Trim() }

# 3. Build — arm64-v8a only (covers ~all real devices from the last 7 years),
#    single-arch to dodge the flaky armeabi-v7a compiler crashes on this box.
#    --max-workers 2 avoids parallelism-related NDK crashes.
#    --no-daemon keeps the JVM ephemeral (a stale daemon has hung the build before).
.\gradlew.bat assembleRelease `
  -PreactNativeArchitectures=arm64-v8a `
  --max-workers 2 `
  --no-daemon
```

**Typical build time:** ~5-9 minutes with intermediates cached from a prior successful run. First-ever build or after a full clean is closer to 12-15 minutes.

**Signed with:** `keystores\release.jks`, alias `carmazium-release`. Password lives in `keystores\release.keystore.properties` (git-ignored). The APK ends up at `android\app\build\outputs\apk\release\app-release.apk` (~65-68 MB).

**When the build hangs:** compare `Get-Process java | Select CPU` (actual CPU seconds) against wall-clock elapsed. A healthy build climbs steadily; a hang flatlines. Kill via `Get-Process java, node | Stop-Process -Force` and retry with the same args.

### 5c. OTA update path (JS-only changes, no native changes)

```cmd
eas update --branch production --message "..."
```

Faster than a full rebuild but **unsafe if any native dependency changed** since the last real build (the running binary won't have it compiled in). App config: `updates.checkAutomatically: "ON_LOAD"`, `runtimeVersion.policy: "sdkVersion"`, real EAS URL `https://u.expo.dev/f0ab914b-3433-4816-80a2-0a94e6c6a066`. This means a cached OTA update in app-private storage will silently override an embedded-bundle APK patch on the same runtime version — if you need to force the embedded bundle after a patch, clear app data (`adb shell pm clear uk.carmazium.app`) or uninstall+reinstall. `adb install -r` preserves app data.

---

## 6. What's currently shipped (state of the mobile app as of 2026-07-21)

**All the following are on `main` and included in the latest release APK.** If you find yourself thinking about building any of these, they're already done — go look before duplicating.

### Fixed bugs (recent)
- **Chat bubble text wraps horizontally** — was rendering character-by-character on the sender/dealer side. Root cause was missing explicit `width: '100%'` on the outer `dealerBubbleWrapper`/`userBubbleWrapper` row containers (percentage `maxWidth` on nested containers computes unreliably against an auto-width parent on Android's first layout pass). Fix in [ChatScreen.tsx](src/screens/main/ChatScreen.tsx).
- **3-car Compare screen text wraps mid-word** — added new `rowValThreeCol` style with `flexShrink: 1` (deliberately not touching the shared `rowVal` used by the 2-car mode). [CompareScreen.tsx](src/screens/main/CompareScreen.tsx).
- **Dealer "My Listings" cards not tappable** — [MyListingDashboardScreen.tsx](src/screens/sell/MyListingDashboardScreen.tsx) `ListingRow` was a plain `<View>`; wrapped in `TouchableOpacity` navigating to `SellCarFlow` for editing.
- **Search "Filters" sheet freeze** — was a false alarm from testing methodology (ADB ESCAPE key vs real hardware BACK); no code change needed.
- **Buyer offer +/- buttons not moving the visible amount** — [VehicleDetailScreen.tsx](src/screens/vehicle/VehicleDetailScreen.tsx). Root cause: `adjustOffer` updated `offerAmount` but the TextInput binds to a separate `offerAmountDraft` string, which only synced on modal-open. Fix: update both in `adjustOffer`.
- **Keyboard covering UI** — added `avoidKeyboard` to the Make Offer sheet, Search filters sheet, Compare vehicle picker sheet. Also wrapped BuyerOffersScreen's inline counter-back / delivery-address inputs in a `KeyboardAvoidingView` (they aren't inside a modal). Audited every `BottomSheet` / `Modal` in the app; these were the only remaining gaps.
- **Create Auction sheet rendering empty** — the sheet opened but content had zero height. Root cause: `modalContainer` uses `flex: 1`, and Yoga collapses `flex: 1` children to 0 when the parent has only `maxHeight` (not `height`). Fix: added `fillHeight` prop to `BottomSheet` that switches to `height: X%` when opted in. Only the Create Auction sheet uses it currently; other sheets keep shrink-to-fit.
- **Delivery request modal stayed open silently on success** — now closes on success + shows an Alert confirmation.
- **Handover proof upload had no user-visible acknowledgment** — added Alert on success.
- **Bid placement had no confirmation** — added a 3-second green "Bid accepted — £X" banner on `AuctionDetailScreen`.
- **VerifyEmail resend button had no cooldown** — matches web's 60s cooldown now.

### Features added
- **Buyer/Seller unified drawer** — [GlobalDrawer.tsx](src/components/GlobalDrawer.tsx). Both roles see a "MY DASHBOARD" group with Dashboard, My listings, My sent offers, Incoming offers, My auctions, Watchlist, Earnings, Performance analytics. Dealer stays separate with DEALER CONTROLS.
- **WatchlistScreen** — [WatchlistScreen.tsx](src/screens/main/WatchlistScreen.tsx). Previously users could heart listings but had no screen to view them.
- **Handover verification (seller side)** — already fully implemented on mobile matching web exactly (`SellerAuctionsScreen`'s upload flow, Supabase `listings` bucket with `handover/` prefix, `POST /auctions/:id/handover-proof`, admin approval → £100 seller bonus release). Added the missing £100/£25/£125 fee-breakdown row for parity with web's `dashboard/seller/auctions/page.tsx`.
- **Cross-listing (retail ↔ auction) indicators** on inventory rows — both [MyListingDashboardScreen.tsx](src/screens/sell/MyListingDashboardScreen.tsx) and [DealerInventoryScreen.tsx](src/screens/main/DealerInventoryScreen.tsx) show either a "🔗 Linked auction — LIVE" chip (tappable → opens `SellerAuctions`) or an "Also list on auction" quick-action for eligible ACTIVE listings.
- **Real brand logo** — [Logo.tsx](src/components/Logo.tsx) now renders the actual `logo.png` (370x82) via `expo-image` instead of the hand-drawn "red circle + CAR/MAZIUM" glyph. `assets/images/logo.png` and `logo-light.png` copied from web's `public/assets/images/`.
- **Listing status banners** on VehicleDetail — SOLD (red), DRAFT / PENDING_REVIEW / REJECTED (amber). Sticky "Make Offer" CTA disables + relabels when status !== ACTIVE.
- **Last-offer teaser** — "Last offer: £X · date" on VehicleDetail for sellers/public viewers.
- **Offer status chip** on VehicleDetail — buyer's own offer status (PENDING / REJECTED / ACCEPTED / WITHDRAWN / COUNTERED) with web-aligned copy. COUNTERED chip is tappable → navigates to BuyerOffers.
- **Search "× Clear" button** — surfaces the Reset action outside the filter modal.
- **Offer range hint** — Make Offer modal shows "Range: £X – £Y" upfront.
- **Handover proof fee breakdown** — £100 bonus / £25 platform fee / £125 buyer paid cells above the upload button on SellerAuctions.

### Icons & assets
- **33 previously-broken icons fixed** — [BrandIcon.tsx](src/components/BrandIcon.tsx) maps Ionicons/MaterialCommunityIcons names → Lucide equivalents. Any unmapped name silently fell back to `HelpCircle` (question mark). Added 33 missing mappings (analytics-outline, arrow-redo-outline, business-outline, calculator-outline, car-sport, cash-outline, close-circle, download-outline, globe-outline, hourglass-outline, information-circle, link-outline, locate, mail-open-outline, notifications-off-outline, paper-plane-outline, person-add-outline, person-circle-outline, play-circle, pound, radio-outline, remove, return-down-back-outline, rocket-launch-outline, timer-outline, trending-up-outline, videocam-outline, and a few more). If you see a `?` icon on a new screen, check `ICON_MAP` first.

---

## 7. Architecture at a glance

- **Navigation**: React Navigation 7. Root switches by auth state: `Auth` → `VerifyEmail` → `PostSignupOnboarding` → `Main`. `Main` is a native stack with a `Tabs` navigator inside (Home / Search / Live / Sell / Saved / Profile-drawer-trigger). See [RootNavigator.tsx](src/navigation/RootNavigator.tsx), [MainStackNavigator.tsx](src/navigation/MainStackNavigator.tsx).
- **State**: Zustand — `authStore` (user, isAuthenticated, role, accountRole), `watchlistStore` (savedIds, savedListings, hydrateFromApi), `sellWizardStore` (the multi-step sell flow's persisted draft).
- **API**: everything through [apiClient.ts](src/lib/apiClient.ts) which handles the Supabase Bearer token + JSON body/response. Never raw `fetch()` in a screen. Domain wrappers: `paymentsApi.ts`, `aiApi.ts`, `chatApi.ts`, `dvlaApi.ts`, `auctionApi.ts`, `listingsApi.ts`, `watchlistApi.ts`, `storageHelper.ts`, `deliveryApi.ts`.
- **Realtime**: Socket.IO on `/auctions` (bid updates, viewer counts, extension events), `/chat` (message stream), `/notifications`. Sockets live in `context/ChatContext.tsx` and inline in `AuctionDetailScreen.tsx`.
- **Payments**: `@stripe/stripe-react-native` for the native Payment Sheet path (`/payments/intent`), and an in-app WebView modal (`StripeCheckoutModal`) for Stripe hosted-checkout URLs (used by HPI report purchase, dealer KYC £1 fee, listing-tier fee, and handover flows). Never `Linking.openURL` for Stripe — the payment screen used to freeze on a black screen when the system browser handed off; the in-app patterns fix that.
- **Auth**: Supabase. User's Bearer token is stored via `expo-secure-store` and attached inside `apiClient`. Deep links back from Stripe/email verification handled via `expo-linking` + `expo-web-browser`'s `openAuthSessionAsync`.
- **Chat**: Socket.IO + REST. Rooms fetched via `/chat/rooms`, messages via `/chat/rooms/:id/messages`, sent via socket. Message rendering in `ChatScreen.tsx` — special-message parsing (`parseSpecialMessage`) surfaces offer / counter cards inline in the message stream.

---

## 8. Known issues, open gaps, and follow-ups

### Backend-blocked (won't ship without backend work)
- **Proxy / max-bid (eBay-style auto-bid)** on auctions — web doesn't have it either. Needs a new schema field on `Bid` (or an `AutoBid` entity), a service to auto-place bids when outbid, socket updates. Roughly a full-stack feature, not a mobile patch. Genuine feature request from UX audit.

### Mobile-only, deferred
- **Partner-role dashboards** (Service Provider, Finance Partner, Insurance Partner) — web has them (`/dashboard/service/*`, `/dashboard/finance/*`, `/dashboard/insurance/*`), mobile has zero support. `authStore` role type only allows `buyer | seller | dealer`. Deferred by user decision — those roles use web.
- **Admin dashboard** — intentional gap on mobile.
- **Guest browsing** — mobile gates the entire app behind `isAuthenticated` (`RootNavigator.tsx`); web supports unauthenticated browsing for SEO. Sign-in-modal-on-Make-Offer is mooted by this. To close, would need a guest route surface.
- **Loading-state consistency** — some action buttons show ActivityIndicator, others just fade via opacity, others do nothing. No standardization done yet.
- ~~**Empty-state CTAs**~~ — **closed 2026-08-14** (`c1c310c1`). `EmptyState`
  rebuilt to the design kit and the dead ends given routes onward; Watchlist had
  been hand-rolling its own with nothing to tap, and Search's no-results now
  offers "Clear filters".
- **Skeleton vs spinner parity** — mobile uses `<Skeleton>` on auction and chat screens; web uses `Loader2` overlays. No single pattern.

### Verified on-device but keep an eye out
- Every screen with a text input inside a `BottomSheet` needs `avoidKeyboard` on the sheet — the pattern is one keyboard-avoidance fix at a time, not a global config. If you add a new sheet with a `TextInput`, remember to pass the prop.
- If a new sheet uses `flex: 1` on its top-level child (e.g. because it embeds a `FlatList` that needs to fill the sheet), pass `fillHeight` too — otherwise you'll get the "empty sheet with a stub at the bottom" symptom.

### Not verified
- No automated tests beyond `npx tsc --noEmit`. No CI. The `src/components/__tests__/VehicleCard.test.tsx` file has jest type errors that predate this session and don't get run.
- On-device verification is done manually via a physical Android device connected to the build machine (`adb devices`). No emulator recipe documented.

---

## 9. Where to look for more detail

- `CLAUDE.md` (same directory) — conventions, source-of-truth pointers, stack constraints
- `MOBILE_OVERHAUL_PLAN.md` (same directory) — the 2026-08-14 overhaul: diagnosis, phases, what shipped, what's blocked and on whom
- `.parity/01`–`06` (same directory) — the six audits behind that plan, with file:line evidence
- `<repo-root>/CarMazium Design System/` — **visual source of truth**: tokens in `colors_and_type.css`, and a full React concept kit for mobile in `ui_kits/carmazium-mobile/` (atoms + ~20 designed screens). Check it before designing a screen from scratch.
- `FEATURE_AUDIT.md` (repo root) — running list of web features audited against mobile
- `.planning/phases/mobile-app-parity/mobile-CONTEXT.md` — older planning doc; parts of it are stale (e.g. mentions of "3D viewer not surfaced" — it's now the default). Treat as historical.
- `src\components\listing\ListingWizard.tsx` (web) — canonical listing-creation payload shape; check this before touching `SellCarFlowScreen.tsx`'s `/listings` POST body
- `backend\src\<module>\<module>.controller.ts` — every mobile API endpoint is defined here; grep for the route path before assuming behavior

---

## 10. History log (compressed)

### 2026-08-14 — UI/UX overhaul + web/backend drift catch-up

29 commits, `55a41ba4..827e1fb8`, all on `main`. Full detail in
`MOBILE_OVERHAUL_PLAN.md`; evidence in `.parity/01`–`06`. Summary in §0 above.

- Six audits run (UI/visual, dealer parity, navigation/journeys,
  perf + notifications, web visual drift, backend drift)
- Palette / type scale / radius scale collapsed onto the design system;
  primitives built in `components/ui/`; tab bar floated
- Navigation: 5 unreachable screens reconnected, post-action destinations
  corrected, notification routing rebuilt off the backend's `link`
- Dealer KYC gate added, with staff-membership support in `authStore`
- Auction filter panel, gated seller contact, Call Seller, postcode prompt,
  fee ledger, Terms ported verbatim from web
- Perf: 11 unused fonts, Home rail virtualisation, Zustand whole-store
  subscriptions in listing cards and the auction socket
- Push fixed client-side (token now written via `PATCH /users/me` —
  `/users/push-token` never existed; the sender reads
  `preferences.expoPushToken`, and `preferences` is a merged JSON column)
- One self-inflicted regression (`textFaint` contrast), caught and fixed —
  see §0.0.3

### 2026-07-21 — This handover session
- Unified buyer/seller drawer; built WatchlistScreen; swapped hand-drawn Logo for real PNG
- Fixed 33 unmapped icons rendering as question marks
- Wave 1 UX quick-wins: resend cooldown, status banners, last-offer teaser, offer status chip, offer range hint, delivery/handover Alerts, bid-accepted flash, tappable COUNTERED chip, search Clear button, offer +/- state sync
- Cross-listing indicators added to MyListingDashboard and DealerInventory rows
- Root-caused and fixed Create Auction sheet rendering empty (added `fillHeight` prop to BottomSheet)
- Two UX/feature audits run against web via Haiku subagents; findings deduped and prioritized

### 2026-07-19/20 — Prior QA session
- Chat bubble character-by-character wrapping fixed on sender side
- 3-car Compare mid-word text wrapping fixed
- Dealer "My Listings" cards made tappable

### 2026-07-12
- Damage zone-ids diffed against web `ALL_ZONES` — 14 were wrong (not the 23 previously flagged), all corrected in `damageZones.ts`
- SellerAuctionsScreen Create Auction modal migrated from hand-rolled full-screen `<Modal>` to shared `<BottomSheet>` (the same modal whose `flex: 1` bug was root-caused on 2026-07-21 above)
- Backend `PaymentsService`: F1 (LISTING_FEE 400'd at DTO validation), F2 (`createPaymentSheet` trusted client amount), F3 (dealer KYC £1 fee never called), F6 (`createCheckoutSession` had the same client-trust gap as F2) — all fixed with unit tests
- `DealerKYCScreen`: removed retired manual-bank-transfer fields; now calls `/dealers/kyc/checkout` and opens returned URL in `StripeCheckoutModal`
- Doc path corrected — web app location now described relative to repo root, not a hardcoded `D:\` path

### 2026-07-06
- 3D vehicle viewer rewritten as WebView + Three.js loading a real `.glb` model (previously a flat SVG car silhouette)
- EAS Update / OTA pipeline made functional (channel created, embedded in shipped binary)
- Backend `forbidNonWhitelisted` DTO rejection root-caused; removed four fields (`declarationAcknowledged`, `priceAsking`, `damageRecords`, `dateOfLastV5CIssued`) from listing publish payload
- Payment screen black-screen bug fixed — switched from `Linking.openURL` to `expo-web-browser`'s `openAuthSessionAsync` (in-app auth sheet)
- Two drifted listing-creation screens consolidated into a single canonical `SellCarFlowScreen.tsx`; the duplicate `SellCarsScreen.tsx` was deleted
- `expo-dev-client` added — enabled the fast-loop dev workflow described in §5a
