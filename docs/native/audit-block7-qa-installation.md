# CarMazium native app audit — Block 7: installable test builds

Audit date: 10 October 2026. This is a review-build plan, **not** proof that an APK or IPA has successfully compiled or been installed.

## Android: no Expo account/token needed for separate QA build

The **CarMazium Android standalone QA APK (no Expo credentials)** GitHub Actions workflow runs on the main-branch merge that first introduces it and can subsequently be run manually. It generates the managed Expo project's Android source and builds an APK with React Native's bundled JS and the ephemeral Android **debug key**. Its APK is *not* a Play Store signed release and must never be used as one.

Only claim the APK is downloadable if the workflow completed successfully and uploaded its `CarMazium-Android-QA` artifact. Download the artifact ZIP at **GitHub → carmaziums/carmazium → Actions → CarMazium Android standalone QA APK → successful run → Artifacts → CarMazium-Android-QA**. Extract `CarMazium-QA-Android.apk`, verify the SHA-256 in the ZIP, and on your own Android device choose **Install unknown apps** for the browser/files app used to open the APK. Do not disable system-wide Play Protect and do not download APKs from unofficial sites. The separate `uk.carmazium.qa` package can coexist with the production `uk.carmazium.app` and will display as **CarMazium QA**. Revoke the unknown-app install permission afterwards.

### Read-only precautions

This workflow compiles `EXPO_PUBLIC_QA_READ_ONLY=1`. The bundled JavaScript API client blocks non-read-only backend requests except essential auth-session/bootstrap endpoints. The direct Supabase Storage upload/deletion helpers are also disabled. These guards reduce accidental transactions during visual review; they are **not an exhaustive security sandbox**. The app still connects to CarMazium's live backend and Supabase authentication. Do not use real customer data, place test bids on live auctions, initiate Stripe checkout, change seller inventory, submit identity documents, or send live messages. Real transaction and KYC testing requires a separate synthetic staging backend and approved QA accounts.

The QA APK disables Expo OTA updates and removes production App Links, and is built with the distinct Android package ID. Android APK builds and browser screenshots do not prove native UI parity until reviewed on actual phones.

### Test protocol

Capture screenshots from the installed CarMazium QA build and the website at comparable widths. Verify onboarding, navigation, primary cards, gearbox (Manual, Automatic, CVT, Semi-Automatic and Not specified), website/app colours, typography, pricing copy, badges, photo placeholders, settings navigation, menu overflow, and accessibility (large text and TalkBack). Network operations requiring mutation will intentionally produce a read-only error; do not count those as production failures. Use non-sensitive dealer/seller test accounts for authorised read-only viewing, and verify no direct transaction is possible via common visible buttons. Escalate all bypasses before using the build again.

## Full internal preview builds: signing credentials required

The existing `carmazium-android-preview-apk.yml` uses the real `uk.carmazium.app` package and an **Expo EAS token** (`EXPO_TOKEN` or `EAS_TOKEN`) to produce a signed internal preview. The latest inspected runs (9 Oct 2026) failed at missing token. Only authorised staff should place an EAS token into **GitHub → Settings → Secrets and variables → Actions**, never into source, logs or this chat.

The manually triggered `carmazium-ios-preview-ipa.yml` also requires Expo EAS access **plus Apple development signing and device registration** for internal IPA. It does not and cannot install to the user's iPhone without those prerequisites. TestFlight requires a separate signed build and explicit release process.

**Never claim physical-device testing, Apple approval, Play Store publishing or OTA deployment merely because GitHub CI passed.** Record the APK build ID, source SHA, checksum and actual reviewed screenshots before moving to release certification.
