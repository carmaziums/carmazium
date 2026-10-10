# CarMazium website — Apple and Android app installation links

10 October 2026 · Site routes `/download-app`, mobile and desktop navigation, homepage, footer.

## What customers see

- "Get the CarMazium App" on Home, navigation and Footer, linking to `https://www.carmazium.com/download-app`.
- A phone-specific download page with **Download on the App Store**, **Install iPhone Beta via TestFlight**, **Get it on Google Play**, and an optional **Download Android APK** (only a verified, signed PUBLIC release on CarMazium's own domain).
- A platform button links **directly** to the verified official installation destination. No intermediary search page, external redirect service or arbitrary file store.
- Each platform with no configured legitimate public release displays **coming soon** rather than a misleading clickable button. The browser marketplace is still available.

### Current availability — NOT VERIFIED / NOT LIVE

As of the source audit, a verifiable public CarMazium Apple App Store listing and Google Play listing were **NOT VERIFIED**. We do not have either official store product URL, an approved public TestFlight invitation, a signed public production APK or a trusted SHA-256 checksum in this task. App builds and QA artifacts from Expo or GitHub are **NOT LIVE customer releases**. Consequently, this PR does not activate the download buttons. It prepares the website to activate them as soon as verified release URLs are provided and deployed.

The 10-block native visual-parity source implementation is merged (through PR #487), but its device-level sign-off and production release remain blocked. **Do not automatically turn a preview/QA build into a public customer installer.**

### Installation behaviour and platform constraints

- **iPhone (UK), before App Store:** an approved public **Apple TestFlight beta invitation** directs customers into TestFlight. They install TestFlight if needed, accept CarMazium's invitation and install the beta. The build must pass Apple's external beta review, is time-limited and may have a tester limit (Apple allows up to 10,000 external testers). This is NOT downloading an IPA file directly through a website.
- **iPhone (UK), after App Store:** customers use the official CarMazium App Store page. Normal direct IPA sideloading from CarMazium's website is not available to UK iPhone customers; Apple's special direct web-distribution programmes apply only in certain eligible regions.
- **Android Google Play:** customer's click opens CarMazium's exact Google Play product page for package `uk.carmazium.app`; Google handles the install.
- **Android direct APK:** an approved, signed **production** APK may be hosted under `https://www.carmazium.com/downloads/*.apk`. A declared published SHA-256 and explicit owner release approval are required. Android may require "Install unknown apps" permission. An EAS preview, development build, TestFlight invite or unverified executable must **never** be offered to the public.

### Configure in Vercel

Only after the corresponding public App Store/Google Play listing, approved external TestFlight beta invite or signed release Android APK is verified and approved, set the appropriate environment variables in Vercel and **redeploy**:

| Environment variable | Example of the expected format | Mandatory |
| --- | --- | --- |
| `NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL` | `https://apps.apple.com/gb/app/carmazium/id1234567890` **EXAMPLE ONLY — NOT A REAL APP ID** | For iPhone App Store after launch |
| `NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL` | `https://testflight.apple.com/join/A1b2C3d4` **EXAMPLE ONLY — NOT A REAL PUBLIC INVITATION** | Pre-store iPhone beta; only after Apple external beta review and public invitation approval |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL` | `https://play.google.com/store/apps/details?id=uk.carmazium.app` — only once **the exact package has been published** | For Google Play button |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL` | `https://www.carmazium.com/downloads/carmazium-release.apk` — only once a properly signed public APK is hosted | For optional direct Android installation |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256` | Actual 64-character hex SHA-256 of the approved APK | Required for APK button |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED` | Exact value `true` after signed public release approval | Required for APK button |

**DO NOT paste the example numeric Apple App ID**; it is illustrative and would lead to an unrelated or missing app. Configure the real URL copied from the published App Store record.

The `src/lib/mobileAppDownloads.ts` resolver only shows links when format and platform checks pass: Apple hostname `apps.apple.com` with numeric item ID, Apple TestFlight `testflight.apple.com/join/INVITATION` with valid public invitation path (store URL takes priority once configured), Google hostname `play.google.com` and package `uk.carmazium.app`, optional first-party HTTPS APK under `/downloads/` with SHA-256 and approval. **Syntax validation is not proof of app ownership or release approval** — a person must click and verify the publisher, title, app identity, install flow and production signing before setting those values.

### Release QA checklist

- [ ] iPhone TestFlight: upload a signed beta to Apple App Store Connect, submit and pass external beta review, enable an external testing group and create a **public invitation**, confirm CarMazium's developer and actual install on a UK iPhone, expiry and tester capacity.
- [ ] iPhone App Store: confirm title **CarMazium**, publisher/developer, bundle ID `uk.carmazium.app`, UK availability, and real production install.
- [ ] Android: confirm Google Play package `uk.carmazium.app`, verified publisher, signed release, UK availability, actual installation and account login.
- [ ] If distributing APK: use only tested **signed production** build, verify checksum independently, host first-party HTTPS with `application/vnd.android.package-archive` and reasonable security headers. Confirm package/version/signature and actual device installation; no Expo QA app package `uk.carmazium.qa`.
- [ ] Test link routing on desktop, iPhone Safari and Android Chrome; no fake button, broken store page, empty link, "download now" claim while unavailable, privacy surprises or forced automatic download.
- [ ] Confirm light/dark typography, touch targets, screen readers and no hero/nav overlap at 360×800 / 390×844.
- [ ] Verify website `/download-app` sitemap/SEO and client-facing footer/nav/home CTA.
- [ ] Do not claim the app has passed visual parity or app-store approval based on source CI alone.
- [ ] Run `node --test scripts/test-website-mobile-app-downloads.test.mjs`, web TypeScript and release checks.

## Scope and rollback

This PR changes **website-only marketing and download configuration**, not the native app, backend, KYC, bids, Stripe payment flow, production datasets, Expo signing, Play/App Store accounts or app distribution. Roll back this feature PR independently if necessary.

**Launch status: the website supports an approved iPhone TestFlight beta and a signed Android APK for pre-store distribution. Neither link is yet activated: no approved public TestFlight invitation or signed production Android release artifact has been verified.**
