# CarMazium Android/iOS Audit — Block 9

## Aim

Create a repeatable **unauthenticated Android emulator boot smoke test** before wider installed-device comparisons. The existing Block 8 APK was verified to contain only `lib/arm64-v8a` native libraries and therefore cannot be installed on the standard GitHub Actions x86_64 Android emulator.

## Implementation
- Existing **CarMazium Android standalone QA APK** workflow now builds both `arm64-v8a` (real Android phones) and `x86_64` (GitHub emulator) into the same internally distributed read-only APK. No release signing, Play upload, EAS credentials or OTA updates.
- New `emulator-smoke` job requires the `build-qa` job **in the same workflow run** and downloads exactly that build artifact, not a "latest" or prior-version APK.
- Uses an Android 15 (API 35) Pixel 6 x86_64 emulator with KVM, installs only `uk.carmazium.qa`, launches MainActivity, confirms app process survives startup, captures an **unauthenticated, logged-out PNG**, and uploads a private 7-day `CarMazium-QA-Emulator-Report` artifact containing screenshot + source commit and APK checksum. No taps, credentials, account creation, bids, payments, chats, or KYC.
- New source-contract regression test is wired into release certification.
- This is **emulator smoke coverage**; it does *not* prove native UI matches the website or certify a real phone/iPhone. A screenshot is a point-in-time boot check, not a visual parity audit.

## Security
Existing QA-only non-GET API and Supabase Storage mutation blocks stay active. Main production app `uk.carmazium.app`, live backend, native App Store/Play signing and OTA channels remain unchanged. Screenshots could contain publicly visible listings and are restricted to repo collaborators.
