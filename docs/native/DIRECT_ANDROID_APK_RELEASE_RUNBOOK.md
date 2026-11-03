# CarMazium Android APK — direct first-party installation

**Status: preparation only.** No public customer APK has been built or approved yet. This checklist deliberately keeps the customer website download disabled until the exact installed binary is tested and approved.

## Architecture and current controls

The mobile source is in carmazium app/carmazium app (Expo / React Native). The production Android package is **uk.carmazium.app**, not the separate read-only **uk.carmazium.qa**. Android users can install a release-signed APK directly from carmazium.com without Google Play. The app remains connected to the CarMazium backend for marketplace operations. An APK does not run on iOS or Windows.

Existing pipeline:
- .github/workflows/carmazium-android-release-candidate.yml — manual INTERNAL_REVIEW_ONLY signed APK builder on main, checks signing key, source, package, version and checksum; uploads a 3-day internal-review artifact (readable by users with repository read access).
- scripts/android-apk-release-evidence.mjs — records exact original APK, package, release signer, version and SHA-256.
- scripts/verify-first-party-android-apk.mjs — independently validates signed bytes served from the production CarMazium HTTPS URL.
- src/lib/mobileAppDownloads.ts — fail-closed website download flag, URL and SHA-256. No arbitrary external installer.
- scripts/stage-android-direct-download.mjs — prepares the exact signed candidate privately for a later approved public download; does **not** publish or approve anything.
- The candidate workflow disables Expo OTA; later sideloaded updates require a higher Android versionCode signed with the **same** release key.


**GitHub artifact visibility warning:** CarMazium's source repository is currently **public**. GitHub Actions artifacts can be downloaded by anyone who has read access to the repository; do NOT treat a 3-day internal artifact as confidential storage. If the owner requires pre-release binaries to remain confidential, first use a private repository or separately controlled encrypted artifact destination. Do not run a signed production candidate until this exposure is acceptable. See GitHub's official artifact download permissions.

## Owner-only action 1 — signing identity

1. Determine whether a production **uk.carmazium.app** APK was previously installed on any customer phone. If it was, you must locate and retain the **original** signing keystore (JKS), alias and passwords; replacing the signer can prevent updates.
2. If no production signing identity exists, make one permanent release keystore with Android Studio / JDK keytool on a trusted device. Use a strong private password and a unique non-debug alias.
3. Back up the JKS plus passwords in two secure, owner-controlled locations. **Never** paste private keys, base64 keystore, store/key passwords, or customer credentials into chat, issue comments or Git commits.
4. Use keytool to inspect the certificate SHA-256 fingerprint; remove separators to obtain exactly 64 hexadecimal characters. Verify it independently after the build.
5. Open GitHub repository **carmaziums/carmazium → Settings → Secrets and variables → Actions → New repository secret**. Add these five secrets:
   - CARMAZIUM_ANDROID_RELEASE_KEYSTORE_BASE64 — one-line base64 of the full JKS file bytes.
   - CARMAZIUM_ANDROID_RELEASE_KEY_ALIAS — the original release key alias.
   - CARMAZIUM_ANDROID_RELEASE_STORE_PASSWORD — the store password.
   - CARMAZIUM_ANDROID_RELEASE_KEY_PASSWORD — the key password.
   - CARMAZIUM_ANDROID_RELEASE_CERT_SHA256 — owner-pinned SHA-256 certificate digest (64 hex characters, no colons).
   
   This is a one-time setup, not required for every build. The build runner uses signing material ephemerally and removes it afterward.

## Owner-only action 2 — signed internal review APK

1. Check the exact **main** Git commit SHA and outstanding native customer QA issue #653.
2. Select an Android versionCode **greater than any previously distributed** production version.
3. Open **GitHub → Actions → CarMazium Android release candidate (internal review only) → Run workflow**.
4. Select main, then enter:
   - source_sha: the reviewed full 40-character main commit SHA
   - approval: INTERNAL_REVIEW_ONLY
   - version_code: increasing positive integer
5. On success download the **CarMazium-Android-REVIEW-ONLY** workflow artifact ZIP before its 3-day retention expires; extract CarMazium-Android-REVIEW-ONLY.apk, release-evidence.json, SHA256SUMS.txt.
6. Also download the separate **CarMazium-Android-STAGED-NOT-APPROVED** internal artifact ZIP. It contains the **same signed APK bytes** renamed for future first-party hosting, plus SHA256SUMS.txt and staging-manifest.json; it is NOT publicly approved or uploaded to the website. Both artifact ZIPs expire after 3 days.
7. If the workflow fails, provide only the failing workflow step name and non-sensitive error message for diagnosis. Do not disclose secret values.

## Owner/device-only action 3 — real installation and feature acceptance

Install the signed candidate on a **physical Android** handset. Do not uninstall an existing production app merely to bypass a signing mismatch; first investigate certificate continuity. Note device model, Android version, source SHA, APK SHA-256 and signer.

Check fresh install, cold start, sign-up, email confirmation, existing-account login/logout, reset password, buyer/seller/dealer navigation, search and saved cars, listing form, valuation, images and damage, auctions, offers, messages, notifications, deep links, TradeXchange, dark/light UI, large-text accessibility, offline/errors and safe update installation.

**Important:** the production APK connects to the live backend and may contain a live Stripe publishable key. Do not create artificial live payments, bids, refunds or KYC records. Financial flows require a safe test arrangement and evidence. Record any crashes, data loss, auth or payment failures and fix them before public distribution.

After passing QA, obtain explicit owner sign-off binding the **exact source SHA, APK SHA-256, certificate digest and tested version**.

## Engineering action 4 — stage an identical versioned APK

**Normally no local SDK or command is needed:** the signed candidate workflow automatically generates a separate **CarMazium-Android-STAGED-NOT-APPROVED** Actions artifact using this validation. This does **not** release it to customers.

For independent re-verification or manual staging on a trusted technical computer with Node.js and Android SDK Build-Tools 36.0.0, set ANDROID_HOME and the separately owner-verified environment variable CARMAZIUM_ANDROID_RELEASE_CERT_SHA256.

From the repo root, optionally run:

    node scripts/stage-android-direct-download.mjs /path/CarMazium-Android-REVIEW-ONLY.apk /path/release-evidence.json /path/new-private-stage

This checks signer/package/version with apksigner + aapt, compares binary SHA-256 to build evidence, and copies the **same bytes** to a versioned file (for example CarMazium-1.0.0-v42.apk), with a SHA256SUMS.txt and staging-manifest.json. It only creates a private staging folder; it never publishes or authorises a customer release.

## Engineering action 5 — first-party hosting and final release gate

1. After owner approval and physical-device acceptance, arrange hosting of the exact APK at https://www.carmazium.com/downloads/<versioned-name>.apk. Choose hosting capable of the **actual size** and download volume; do not assume Vercel's file size limits will support it.
2. The exact URL must return HTTP 200, no redirect, application/vnd.android.package-archive, identity/no compression and **exact approved bytes**. No QA, debug, preview or REVIEW-ONLY installer may be served.
3. On the operator's computer, verify hosted bytes again:

       node scripts/verify-first-party-android-apk.mjs https://www.carmazium.com/downloads/<versioned-name>.apk /path/release-evidence.json

   This intentionally reports that technical verification does not itself grant customer release approval.
4. Only after all approvals configure production Vercel environment:
   - NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED=true
   - NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL=https://www.carmazium.com/downloads/<versioned-name>.apk
   - NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256=<exact approved binary SHA-256>
5. Redeploy the website and verify /download-app from an Android phone; confirm that downloaded bytes still match and that installation succeeds. Disable the approval flag immediately if integrity fails.
6. Preserve original JKS, reviewed release ZIP, evidence, and tested APK privately for future updates. Later versions must use the same signing certificate and higher versionCode.

**Release guarantee:** a green CI build or staged file is not proof the product works. No invented QA results, approvals, secrets or fake download URLs. Android APK sideloading requires no Google Play Store.
