# Issue #477 follow-up — pre-store customer download release readiness
Date: 2026-10-10. **Customer downloads still BLOCKED — candidate workflow does NOT publish.**

## Current website
The deployed page [www.carmazium.com/download-app](https://www.carmazium.com/download-app) already supports:
- **Android:** approved signed production APK from first-party `/downloads/*.apk` and actual independently verified SHA-256, then later Play Store.
- **iPhone:** public Apple TestFlight *external* beta invite until the UK App Store listing is available; later the App Store install link takes priority.

These are two different mechanisms. A regular UK iPhone **cannot be given an arbitrary IPA for direct installation from the website**. Users must install Apple's TestFlight app and accept the invitation. A developer account and signed iOS beta are prerequisites, and Apple may review external beta builds. The website must not advertise a non-working invitation or a debug APK.

## Release-signing state discovered
- The GitHub repository contains `carmazium app/carmazium app/plugins/withAndroidReleaseSigning.js`, which can reapply a release keystore to generated Android Gradle projects during Expo prebuild.
- The current `.github/workflows/carmazium-android-offline-qa-apk.yml` produces package `uk.carmazium.qa` signed with an ephemeral **debug key** and is connected to live API configuration; **NOT DISTRIBUTABLE** to customers. A separate Expo `preview` profile also uses the LIVE backend and LIVE Stripe publishable key. Do not publish either.
- No existing approved long-term Android keystore, production release-signer certificate, successful release-signed APK install, public website APK download, iOS App Store Connect beta/test group or Apple TestFlight public invitation was verified in this work. GitHub's secrets cannot be inspected through the available API. Do not claim they exist or invent values.
- The ten-block app/website visual parity source programme is merged, but **device-level visual signoff remains pending**, so a signed APK alone is not production quality approval.

## New manual RELEASE CANDIDATE workflow (NOT public)

`.github/workflows/carmazium-android-release-candidate.yml` allows an owner to build a release-signed Android **candidate for private review only**. Workflow is manual only, never triggered by a push, with required inputs `source_sha`, `approval=INTERNAL_REVIEW_ONLY` and a strictly positive `version_code` (max 2147483647); invalid values fail. The candidate uses `APP_ENV=production` and never publishes.

For a candidate run, configure the following **GitHub Actions Secrets** (never paste keystore material into chat, code, PR or workflow logs):
- `CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64`: Base64 bytes of the **existing protected production release keystore** (not a newly generated key unless the owner has explicitly decided a key rotation and future Play signing approach).
- `CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS`
- `CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD`
- `CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD`
- `CARMAZIUM_ANDROID_RELEASE_CERT_SHA256`: The *certificate's* 64-char hex SHA-256 from the authorised release keystore, verified out of band, **not** the APK file SHA.

The Block 4 preflight runs `scripts/verify-android-release-keystore.mjs` **after restoring the authorised keystore but before compiling**. It uses Java keytool to export the public certificate, validates the owner-pinned SHA-256, checks the certificate is currently valid and not within 90 days of expiry, rejects Android debug certificate names and weak/unexpected signing key types, and proves that the configured private key/password are usable via a temporary certificate signing request (CSR). The temporary CSR is deleted. Passwords are read through child-process environment variables instead of command-line arguments; tool output and credentials are never written into the workflow log. Passing this preflight is not a public release approval. Unit tests use a disposable synthetic CI signer only, which must NEVER be used for a customer APK.

The workflow validates the exact Git SHA, source-controlled identity `uk.carmazium.app`, release signing plugin and settings, and the above secrets. The keystore is reconstructed **only inside a temporary GitHub runner**, outside source-controlled files. Expo prebuild must produce a Gradle `signingConfigs.release`; it never silently accepts debug fallback. After Gradle `assembleRelease`, `apksigner verify` and its actual signer certificate digest must match the independent expected SHA-256, and `aapt dump badging` must confirm the production Android package **and requested versionCode**. Do not reuse a versionCode from a prior customer installer: Android generally requires a higher versionCode for app upgrades. Retain the same signing identity and package name across updates. The `version_code` is injected into the ephemeral build config and recorded in workflow evidence, without changing production source.

Only if every gate passes does it upload an **internal 3-day GitHub Actions artifact** named `CarMazium-Android-REVIEW-ONLY`, with a checksum file. No APK, keystore, Google Play release or website link is auto-published; no actual customer install is made. OTA is disabled for this candidate to prevent reviewing a different later JS bundle. The separate `scripts/check-android-release-candidate.mjs` and `scripts/test-android-release-candidate.test.mjs` provide fail-closed source tests.

**This build references the live service configuration**, unlike the unconfigured isolated synthetic staging that is still needed for mutable app QA. Merely installing a candidate must not trigger test bids, uploads, payment attempts, KYC, refunds or synthetic real-customer messages; real transactional QA requires approved isolated staging.

## To activate public Android download later
1. Provide verified release-signing credentials with secure provenance (ideally retain the same signing identity intended for Play Store). If missing, have the release owner establish a signing strategy first. Do not regenerate signing keys casually.
2. Produce the internal signed candidate, confirm signer digest/package/version and perform Android installation, logout/login, compatibility, malware/dependency scans, payment/permission checks, and source-revision tests on a controlled device.
3. Confirm latest visual/accessibility parity against the website. Do not override Issue #477's recorded NO-GO without an actual approved review.
4. Separately approve a *public* versioned release APK, with provenance to a particular source revision and stable signing certificate. Make a secure file available at a first-party HTTPS CarMazium `/downloads/<version>.apk` path. Confirm the file's actual 64-hex SHA-256 and that the public URL returns the exact approved bytes and `application/vnd.android.package-archive`.
5. Set Vercel `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL`, `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256` and `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED=true`, then redeploy and test customer device installation.
6. Because sideloading may require enabling Android's per-browser “Install unknown apps”, disclose that permission clearly. Plan app updates and future Play signing carefully: app updates need matching package/signature and compatible version codes.

## To activate iPhone TestFlight before the App Store
1. Verify an active **Apple Developer Program membership** with access to CarMazium's App Store Connect app/bundle identifier `uk.carmazium.app`.
2. Create or use the approved iOS distribution certificate/provisioning through the owner's secure Expo EAS or Apple build account, then build and upload a signed beta to App Store Connect. Never assume Android Expo credentials imply Apple signing access.
3. Set up an external TestFlight tester group; supply test notes, required permissions and privacy information, and pass Apple's review for external testing. Obtain an **actual public invitation link**. It may be limited or expire along with its builds.
4. Test opening the link on a UK iPhone, installing TestFlight and the CarMazium beta; confirm logged-in flows and safety. Only after approved public beta availability set `NEXT_PUBLIC_CARMAZIUM_IOS_TESTFLIGHT_URL` in Vercel and redeploy.
5. Later replace the beta button by supplying the verified public `NEXT_PUBLIC_CARMAZIUM_IOS_APP_URL` (App Store takes precedence).

## Required decisions and boundaries
- **NO real customer downloads yet.** A workflow is not a release, and a debug QA APK isn't a customer app.
- Owner must confirm Android release-keystore provenance, Apple Developer/App Store Connect entitlement, and approved website/public beta distribution before activating the links.
- No Vercel environment variables, signing secrets, store accounts, customer data, payments, DB schema, live auctions, native source business rules or production app binaries are changed in this PR.
- This PR is separately reversible. The release-candidate workflow is manually triggered and guarded; it has NOT been run in this turn.

**Status: installation webpage live; signed Android and public TestFlight beta prerequisites still unverified, so activation remains BLOCKED.**
