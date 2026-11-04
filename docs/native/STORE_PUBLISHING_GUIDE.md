# CarMazium — Publishing the apps to Google Play, Apple App Store and Microsoft Store

A step-by-step guide for the developer taking the CarMazium apps to the stores.
Follow it in order. Every step says **who** does it (👤 owner / 💻 developer).

---

## 0. What you are working with

| Thing | Where / value |
|---|---|
| Code repository | `https://github.com/carmaziums/carmazium` (branch `main`) |
| Mobile app folder | `carmazium app/carmazium app/` (note the spaces — quote the path) |
| App technology | Expo SDK 54, React Native 0.81, React 19.1, React Navigation 7 |
| App name / version | `CarMazium` / `1.0.0` (`app.json`) |
| Android package | `uk.carmazium.app` |
| iOS bundle ID | `uk.carmazium.app` |
| Expo (EAS) project | owner `pizn-01s-team`, project ID `f0ab914b-3433-4816-80a2-0a94e6c6a066` |
| Build profiles | `development`, `preview`, `production` (`eas.json`) |
| Backend API | `https://carmazium-hjoh9w.fly.dev` (same for web and app) |
| Website | `https://www.carmazium.com` (Next.js, hosted on Vercel) |
| Website download page | `https://www.carmazium.com/download-app` |

**State of the app:** feature-complete and owner-approved (tested on Android
up to Preview build v17). The website already lets people install CarMazium
on iPhone (Add to Home Screen) and Windows (browser Install). Your job is the
**store** releases.

Read these first — they already contain store material:

- `carmazium app/carmazium app/CLAUDE.md` and `CONTEXT.md` — app conventions and history
- `docs/native/STORE_LISTING_ASSETS.md` — texts, screenshots, icons
- `docs/native/STORE_PRIVACY_PERMISSIONS.md` — data-safety / privacy answers
- `docs/native/STORE_CONTENT_DECLARATIONS.md` — content rating answers
- `docs/native/STORE_REVIEW_ACCESS.md` — reviewer test account instructions
- `docs/native/STORE_ASSOCIATIONS.md` — app links / universal links

### Ground rules (do not break these)
1. **Never** put passwords, keystores, API keys or tokens in chat, email or git. Only in GitHub *Secrets*, Expo, or the store consoles.
2. Do not change prices, fees or business rules (Auction FREE, Retail £1, buyer fee) without the owner's written approval.
3. No fake listings, bids, reviews, payments or KYC — ever, including in screenshots.
4. Do not commit the temporary `app.json` changes used for test builds.

---

## 1. Accounts the owner must create (👤 owner)

Do these first — they can take days to approve.

| Store | Sign up | Cost (check current price) | What the developer needs |
|---|---|---|---|
| Google Play | https://play.google.com/console/signup — choose **Organisation** | $25 one-off | Invite developer as **Admin** (Users & permissions) |
| Apple | https://developer.apple.com/programs/enroll — choose **Organisation** | $99 / year | Needs a free **D-U-N-S number** for Pulse Cars Limited (Apple links to it). Then invite developer in App Store Connect → Users and Access as **Admin** |
| Microsoft | https://partner.microsoft.com/dashboard/registration — **Company** account | one-off fee for company accounts | Invite developer to Partner Center |
| Expo | https://expo.dev — organisation `pizn-01s-team` | free tier works; paid plan builds faster | Invite developer to the organisation |

Use the same legal company name, address and support email on all three stores.

---

## 2. Set up your computer (💻 developer)

1. Install **Node.js 20 LTS** (https://nodejs.org) and **Git**.
2. Install the Expo build tool:
   ```bash
   npm install -g eas-cli
   eas login            # log in with the account the owner invited
   ```
3. Get the code:
   ```bash
   git clone https://github.com/carmaziums/carmazium.git
   cd carmazium/"carmazium app/carmazium app"
   npm ci
   ```
4. Check it compiles (this is the app's only automatic check):
   ```bash
   npx tsc --noEmit
   ```
5. Run it on your phone. **Expo Go is not enough** (the app has native modules such as Stripe), so use a development build:
   ```bash
   eas build --profile development --platform android   # install the result on your phone
   npx expo start --dev-client
   ```

---

## 3. Google Play (Android)

### 3a. Signing key — decide this first (💻 + 👤)
The owner is creating an Android key (`carmazium-release.jks`, alias `carmazium`)
for the **website APK download**. If the Play Store version is signed with a
*different* key, a customer who installed from the website cannot update from
Play (Android blocks it) and must uninstall first.

**Recommended:** when Play Console asks about **Play App Signing**, choose
**"Use a key from Java keystore"** / **"Export and upload a key from Java
keystore"** and upload the owner's `carmazium-release.jks` (Play Console shows
the exact PEPK tool command). Then website and Play installs share one signature.
The owner runs that command on their computer — the key never leaves them.

### 3b. Build the Android App Bundle (.aab) (💻)
Either on your computer:
```bash
cd "carmazium app/carmazium app"
eas build --platform android --profile production
```
…or in GitHub: **Actions → "CarMazium Google Play production AAB candidate" →
Run workflow** (needs repository secret `EXPO_TOKEN`; create a token at
expo.dev → Account settings → Access tokens).

Every new upload needs a **higher `versionCode`** than the last one (EAS can
auto-increment; check `eas.json`).

### 3c. Create the app in Play Console (💻)
1. Play Console → **Create app** → name `CarMazium`, language English (UK), **App**, **Free**.
2. **Dashboard → Set up your app** — complete every item:
   - App access → "All or some functionality is restricted" → give the reviewer login from `STORE_REVIEW_ACCESS.md`.
   - Ads → answer honestly (the app shows no third-party ads unless the owner says otherwise).
   - Content rating → questionnaire, use `STORE_CONTENT_DECLARATIONS.md`.
   - Target audience → 18+ (vehicle sales and payments).
   - Data safety → use `STORE_PRIVACY_PERMISSIONS.md`.
   - Financial features → declare that payments are taken via Stripe for marketplace services.
3. **Main store listing** → short/long description, icon (512×512), feature graphic (1024×500), phone screenshots — from `STORE_LISTING_ASSETS.md`. Screenshots must show **real** screens, no fake data.

### 3d. Test, then release (💻)
1. **Testing → Internal testing → Create release** → upload the `.aab` → add testers' emails → roll out. Install from the link and test: sign up, sign in (Google, Apple, email), search, a listing, auctions, chat, sell flow, payments (Stripe test card in test mode only), sign out.
2. If Play says your account must run a **closed test** first (required for new *personal* accounts: 12+ testers for 14 days), do it under **Closed testing**.
3. **Production → Create release** → same `.aab` → release notes → **Send for review**. Review usually takes 1–7 days.
4. When live, the store link is `https://play.google.com/store/apps/details?id=uk.carmazium.app`.

---

## 4. Apple App Store (iPhone)

### 4a. Register the app (💻)
1. App Store Connect → **Apps → +** → **New App** → platform iOS, name `CarMazium`,
   bundle ID `uk.carmazium.app` (create it under Certificates, IDs & Profiles if not listed), SKU `carmazium-ios`.
2. Note the numeric **Apple ID** of the app (App Information page) and the **Team ID** (Membership page).

### 4b. Build and upload (💻)
EAS creates and stores the Apple certificates for you:
```bash
cd "carmazium app/carmazium app"
eas build --platform ios --profile production     # log in to Apple when asked
eas submit --platform ios --latest                 # uploads to App Store Connect / TestFlight
```
(GitHub alternative: **Actions → "CarMazium iOS production release candidate"**, needs `EXPO_TOKEN`.)

### 4c. TestFlight (💻)
App Store Connect → **TestFlight** → add internal testers → install the
TestFlight app on an iPhone → test the same journeys as Android. Check that
**Sign in with Apple** works (Apple requires it because the app offers Google sign-in;
it must be enabled in Supabase → Authentication → Providers → Apple).

### 4d. App Store page and review (💻)
1. **App Information**: category Shopping (secondary Business), age rating questionnaire.
2. **App Privacy**: fill the "nutrition label" from `STORE_PRIVACY_PERMISSIONS.md`.
3. **Version page**: screenshots for 6.9" and 6.5" iPhones (and iPad if supported), description, keywords, support URL `https://www.carmazium.com/contact`, privacy policy URL `https://www.carmazium.com/privacy-policy`.
4. **App Review Information**: reviewer login from `STORE_REVIEW_ACCESS.md` + notes explaining dealer auctions and that payments are for a vehicle marketplace.
5. ⚠️ **Payments check before submitting:** Apple requires its own in-app purchase for *digital* goods. Vehicle-related services paid with Stripe are normally allowed, but paid *listing/boost* fees can be questioned. Agree the wording with the owner and be ready to explain it in the review notes. Do not change any price.
6. **Add for Review → Submit**. Review is usually 1–3 days; fix and resubmit if rejected.
7. When live, the link looks like `https://apps.apple.com/gb/app/carmazium/id1234567890`.

### 4e. Universal links (💻 + 👤)
So carmazium.com links open the app: in Vercel set the Apple Team ID used by
`/.well-known/apple-app-site-association` (see `STORE_ASSOCIATIONS.md`) and redeploy.

---

## 5. Microsoft Store (Windows)

The Windows app is the CarMazium website packaged as an installable app
(the site already has the app manifest, icons and offline page).

1. Partner Center → **Apps and games → New product → MSIX or PWA app** → reserve the name **CarMazium**.
2. Open the product → **Product management → Product identity** and note: *Package/Identity/Name*, *Publisher*, *Publisher display name*.
3. Go to **https://www.pwabuilder.com** → enter `https://www.carmazium.com` → **Package for stores → Windows** → paste the three values from step 2 → **Download** the package (`.msixbundle` + instructions).
4. Partner Center → **Start your submission**:
   - Pricing: Free, markets: United Kingdom (and others the owner wants).
   - Properties: category Shopping, privacy policy `https://www.carmazium.com/privacy-policy`.
   - Age ratings questionnaire.
   - Packages: upload the `.msixbundle`.
   - Store listing: description and screenshots (desktop screenshots of the real site).
5. **Submit to the Store**. Certification usually takes 1–3 days.
6. When live, the link looks like `https://apps.microsoft.com/detail/9XXXXXXXXXXX`.

---

## 6. Show the store buttons on the website (💻 or 👤)

The download page already has the buttons; they appear automatically once these
are set in **Vercel → project `carmazium` → Settings → Environment Variables (Production)**,
then **Redeploy**:

| Variable | Value (example format — the site rejects anything else) |
|---|---|
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL` | `https://play.google.com/store/apps/details?id=uk.carmazium.app` |
| `NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL` | `https://apps.apple.com/gb/app/carmazium/id1234567890` |
| `NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL` | optional public beta: `https://testflight.apple.com/join/XXXXXXXX` |
| `NEXT_PUBLIC_CARMAZIUM_MICROSOFT_STORE_URL` | `https://apps.microsoft.com/detail/9XXXXXXXXXXX` |

Validation rules are in `src/lib/mobileAppDownloads.ts`.

**Website APK (Android direct download, no store):** after the owner adds the 5
`CARMAZIUM_ANDROID_RELEASE_*` GitHub secrets, run **Actions → "CarMazium Android
release candidate"** (approval `INTERNAL_REVIEW_ONLY`, new `version_code`), then
**"Publish approved Android APK for website download"** with that run's ID and
approval `OWNER_APPROVED_CUSTOMER_RELEASE`. Its summary prints the three
`NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_*` values to set in Vercel.

---

## 7. Releasing updates later (💻)

- **Small JS/screen fixes:** can go out as an over-the-air update (expo-updates) without store review — only for changes that need no new native code. Follow the existing workflow `publish-approved-mazium-android-ota.yml` and get owner approval first.
- **Anything native** (new permissions, new native library, `app.json` plugin changes, SDK upgrade): new store build. Increase `version` (e.g. `1.0.1`) and the build number/versionCode, rebuild, resubmit to each store.
- Before every release: `npx tsc --noEmit` in the app folder and `node --test scripts/*.test.mjs` at the repo root must pass.

---

## 8. Checklist to send back to the owner

- [ ] Google Play: app live, link: ____________
- [ ] Apple App Store: app live, link: ____________
- [ ] Microsoft Store: app live, link: ____________
- [ ] Store links added in Vercel and visible on /download-app
- [ ] Android signing key shared between website APK and Play (Play App Signing upload of owner key)
- [ ] Reviewer test accounts working and documented
- [ ] Any store rejection reasons and how they were fixed
