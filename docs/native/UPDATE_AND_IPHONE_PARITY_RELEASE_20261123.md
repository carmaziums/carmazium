# CarMazium native update reliability and iPhone website parity — 23 November 2026

## Scope

The *existing* Android app `uk.carmazium.app` and iPhone app `uk.carmazium.app` remain the only release identities. The website remains authoritative for text, page structure, navigation and customer-facing UI. This patch **does not change the website** or create an iOS-specific product. Existing Android build **126** and its public download are not retroactively altered by source commits.

## Android version update reliability

- Native Android install identity is checked before offering a CarMazium APK. Prefer native package metadata when available, not only an Expo JS configuration value that may be stale after an update.
- The app checks on launch and after resuming when the last successful check is at least **15 minutes** old. A failed update-service request may retry after **one minute**. Concurrent checks are suppressed.
- Under **Account Settings → App updates**, a manual **Check for updates** control shows the installed build, a clear no-update confirmation or a retryable error. This is Android-only. A new signed APK is downloaded from the existing validated HTTPS URL and Android explicitly asks the user to install it.
- The app must never claim a new APK was installed merely because the package installer opened. Failed downloads and an untrusted version/URL never launch the installer.
- An installed Android APK **cannot be silently upgraded** by this website sideload mechanism. The Android system's installation confirmation is still required. Opening the app without seeing a prompt on the same build is expected.

## Expo OTA — prospective, gated release only

- Build 126 was produced with `expo.updates.enabled=false` and remains unable to fetch EAS OTA updates. Changing source alone cannot make it OTA-capable.
- The **next** originally signed Android APK starts at **versionCode 127**, with app version **1.0.2**, the company-owned EAS endpoint `https://u.expo.dev/9c77bb81-205c-42f8-913e-b69a0953ec10` and the `production` update channel embedded **only in the signed native Android build workflow**. The shared source `app.json` intentionally has no `updates.requestHeaders` channel: EAS preview and iOS candidates must retain their own channels. The prior `appVersion` runtime compatibility policy becomes **1.0.2**, isolating it from the older **1.0.1** binaries.
- This source change alone publishes **no OTA update**. An authorised, tested `eas update --platform android --channel production` release is a separately approved action. Publish only JavaScript and compatible assets; native dependency, permissions or configuration changes require another signed APK and a new runtime version.
- Keep Expo's anti-bricking safeguards enabled. Never switch to a former developer's Expo account or preview channel. Check the embedded Android channel/runtime in the signed candidate; never infer it from `app.json` alone.
- An iOS signed candidate must use CarMazium's existing Apple signing identity and TestFlight/App Store Connect submission. Do not publish Android-only OTA bundles to an unverified iPhone runtime.

## iPhone UI against existing website

- Existing shared native screens, role restrictions, dashboard card order and page routes remain in use on both platforms. No duplicate iPhone screens, web changes or new pages.
- At normal iPhone display width, **Provider overview** now retains the website's `grid-cols-2` metric density rather than expanding each metric to full width at moderate iOS Dynamic Type. At very narrow width or large accessibility settings, it becomes one column.
- Existing **DashboardCards** iOS compact two-column presentation and **My Posted Jobs** single scrolling `FlatList` remain protected by regression tests. The entire page—not just the inner job cards—must scroll. Shared native TradeXchange and personal/dealer navigation must not diverge from the website.
- Regression tests are **source and synthetic-layout checks only**, not proof that the entire production iPhone matches the site pixel-for-pixel. A physical iPhone test must compare: homepage, dealer stock/CRM/auctions, buyer/seller dashboard, My Cars, Purchases, provider onboarding/insurance, job post/quote/complete, menus and tab bars, notification and guided-tour voice/replay, vehicle fullscreen photo swipe, dark/light modes, Dynamic Type and keyboard safe-area scrolling.
- For each visual difference, change the existing native component to follow the current mobile website; do not introduce a second navigation hierarchy or new custom design. Preserve website and Android behaviour.

## Release acceptance and rollback

1. All source, native TypeScript, website/parity, Android signing and Expo channel checks must pass on the same reviewed commit.
2. Produce a new signed Android **127+** APK from the original key, assert package/signing digest/runtime and install **over 126 without clearing data**. Test the update prompt from the prior build to the new one on a real Android phone where available.
3. Build the signed iPhone candidate from the same reviewed source and test on an actual iPhone. Check native UI and tour before an App Store/TestFlight promotion.
4. Publish the exact signed and verified Android APK to a new GitHub Release, update Vercel URL + SHA256, redeploy and verify the public download byte-for-byte. Do not replace build 126 solely on a green source test.
5. Only after native runtime 1.0.2 is installed and EAS channel/rollbacks are verified, authorise any compatible OTA update. For a bad OTA, stop publishing to the channel, roll back/republish last known good update with matching runtime, and maintain a signed APK fallback.

**Status:** Development changes prepared on an isolated branch; signed build 127+, iPhone installation and future OTA delivery remain unverified.
