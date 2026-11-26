# Google Play update delivery

The original package remains `uk.carmazium.app` with the existing customer signing certificate. Play Console's app signing certificate was independently matched to the original certificate on 26 November 2026.

Google Play blocked production draft 134 because it requested `REQUEST_INSTALL_PACKAGES`. CarMazium is a vehicle marketplace; self-updating is not an eligible reason to request that permission. Do not submit a false permitted-use declaration.

The Play candidate workflow runs `prepare-google-play-distribution.mjs` before native prebuild. It:
- removes the install permission and blocks dependency manifest merging from restoring it;
- bundles the store-only updater implementation, with no APK download or installer imports;
- disables Expo OTA in that binary so the website distribution channel cannot reintroduce the direct APK updater;
- retains package, version code, company project and signing credentials.

Settings provides an Open Google Play button for the original listing. Google Play manages updates. The separate direct-download APK workflow retains its existing optional signed-APK updater; iOS is unchanged.

The workflow inspects the final AAB manifest, rejecting the install permission or enabled Expo OTA, and retains the existing signature, source SHA, identity and checksum checks. A new increasing build code is required because 134 is already uploaded. Verify its generated installation APK over the existing emulator app without uninstalling, then replace the production draft bundle and send for review. Do not represent the unsubmitted draft as publicly available.
