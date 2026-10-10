# CarMazium website — Apple and Android app installation links

10 October 2026 · Site routes `/download-app`, mobile and desktop navigation, homepage, footer.

## What customers see

- "Get the CarMazium App" on Home, navigation and Footer, linking to `https://www.carmazium.com/download-app`.
- A clean phone-specific download page with **Download on the App Store**, **Get it on Google Play**, and an optional **Download Android APK** (only a verified, signed PUBLIC release on CarMazium's own domain).
- A platform button links **directly** to the verified official installation destination. No intermediary search page, external redirect service or arbitrary file store.
- Each platform with no configured legitimate public release displays **coming soon** rather than a misleading clickable button. The browser marketplace is still available.

### Current availability — NOT VERIFIED / NOT LIVE

As of the source audit, a verifiable public CarMazium Apple App Store listing and Google Play listing were **NOT VERIFIED**. We do not have either official store product URL, a signed public production APK or a trusted SHA-256 checksum in this task. App builds and QA artifacts from Expo or GitHub are **NOT LIVE customer releases**. Consequently, this PR does not activate the download buttons. It prepares the website to activate them as soon as verified release URLs are provided and deployed.

The 10-block native visual-parity source implementation is merged (through PR #487), but its device-level sign-off and production release remain blocked. **Do not automatically turn a preview/QA build into a public customer installer.**

### Installation behaviour and platform constraints

- **iPhone (UK):** customer's click opens CarMazium's exact Apple App Store product page, where Apple handles installation. UK iPhone users cannot generally install an ordinary unsigned iOS IPA directly through a merchant website. Apple's alternative web distribution is geographically restricted and requires Apple's applicable distribution processes; it is not used here.
- **Android Google Play:** customer's click opens CarMazium's exact Google Play product page for package `uk.carmazium.app`; Google handles the install.
- **Android direct APK:** an approved, signed **production** APK may be hosted under `https://www.carmazium.com/downloads/*.apk`. A declared published SHA-256 and explicit owner release approval are required. Android may require "Install unknown apps" permission. An EAS preview, development build, TestFlight invite or unverified executable must **never** be offered to the public.

### Configure in Vercel

Only after the App Store/Google Play listing or Android APK has been released, verified to resolve to the **CarMazium** app and approved for **public installation**, set the appropriate environment variables in the CarMazium website project and **redeploy**:

| Environment variable | Example of the expected format | Mandatory |
| --- | --- | --- |
| `NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL` | `https://apps.apple.com/gb/app/carmazium/id1234567890` **EXAMPLE ONLY — NOT A REAL APP ID** | For iPhone button |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APP_URL` | `https://play.google.com/store/apps/details?id=uk.carmazium.app` — only once **the exact package has been published** | For Google Play button |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL` | `https://www.carmazium.com/downloads/carmazium-release.apk` — only once a properly signed public APK is hosted | For optional direct Android installation |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256` | Actual 64-character hex SHA-256 of the approved APK | Required for APK button |
| `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED` | Exact value `true` after signed public release approval | Required for APK button |

**DO NOT paste the example numeric Apple App ID**; it is illustrative and would lead to an unrelated or missing app. Configure the real URL copied from the published App Store record.

The `src/lib/mobileAppDownloads.ts` resolver only shows links when format and platform checks pass: Apple hostname `apps.apple.com` with numeric item ID, Google hostname `play.google.com` and package `uk.carmazium.app`, optional first-party HTTPS APK under `/downloads/` with SHA-256 and approval. **Syntax validation is not proof of app ownership or release approval** — a person must click and verify the publisher, title, app identity, install flow and production signing before setting those values.

### Release QA checklist

- [ ] iPhone: confirm store page title **CarMazium**, verified publisher/developer, matching bundle ID `uk.carmazium.app`, real public install available in the UK, and install opens correct native app.
- [ ] Android: confirm Google Play package `uk.carmazium.app`, verified publisher, signed release, UK availability, actual installation and account login.
- [ ] If distributing APK: use only tested **signed production** build, verify checksum independently, host first-party HTTPS with `application/vnd.android.package-archive` and reasonable security headers. Confirm package/version/signature and actual device installation; no Expo QA app package `uk.carmazium.qa`.
- [ ] Test link routing on desktop, iPhone Safari and Android Chrome; no fake button, broken store page, empty link, "download now" claim while unavailable, privacy surprises or forced automatic download.
- [ ] Confirm light/dark typography, touch targets, screen readers and no hero/nav overlap at 360×800 / 390×844.
- [ ] Verify website `/download-app` sitemap/SEO and client-facing footer/nav/home CTA.
- [ ] Do not claim the app has passed visual parity or app-store approval based on source CI alone.
- [ ] Run `node --test scripts/test-website-mobile-app-downloads.test.mjs`, web TypeScript and release checks.

## Scope and rollback

This PR changes **website-only marketing and download configuration**, not the native app, backend, KYC, bids, Stripe payment flow, production datasets, Expo signing, Play/App Store accounts or app distribution. Roll back this feature PR independently if necessary.

**Launch status: webpage ready for approved destinations; public app install links not yet activated.**
