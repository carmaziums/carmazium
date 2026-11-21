# Android customer-build provenance — 20 November 2026

The owner's website download is the authoritative customer-app lineage. Verified the actual downloadable file, source record, package and signing identity before continuing native changes.

| Item | Verified result |
| --- | --- |
| Website download | https://www.carmazium.com/downloads/CarMazium-1.0.0-v105.apk |
| Website metadata | /api/app-version and /download-app identify version 1.0.0 / code 105 |
| Website APK bytes | 99,114,490 |
| Website APK SHA256 | 755574e857c6789ae187345e2780531fa5a30eafe2ba94161decbca98301b3e0 |
| Release-recorded source | 4ff05829990bed2095bf4660cade3b38d9fe930f |
| Installed customer package | uk.carmazium.app, version 1.0.0 / code 108 |
| Pulled customer APK bytes | 99,115,270 |
| Pulled customer APK SHA256 | 51e3029fef9728c1f8eda076feeddfedd75e0d7f7d53d39ce7752455d02db303 |
| Shared signing certificate SHA256 | ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24 |
| Installed private candidate | uk.carmazium.qa, version 1.0.1 / code 2; workflow #150 / 44788018987 |
| Private candidate source | 304056369956249b40d1fbd6fa1a02f5265edd25 |
| Private APK SHA256 | 9e2d36c4b03f168b1c1f35c3584e6b695efa073dafb8425db562e83c40a1c167 |
| Private install | adb install -r, update 18:15:07; original QA install 14:39:37 and login retained |
| Final customer install check | code 108, last update 13:35:32 unchanged at 18:46 |

Website hash matched the website metadata and GitHub release asset digest. Pulled installed 108 matched the retained verified candidate byte-for-byte. Certificate extraction establishes identity; CI supplied signature verification. The current native branch descends from the website release-recorded source. A later release-tag target is not substituted for the recorded build source.

The private QA app deliberately uses the laptop's isolated localhost API and a separate package. It is not the website's downloadable APK and does not replace the customer app. Workflow numbers 146/148/150 are build-job numbers, not Android version codes.

Build108 native fixes retained; backend PR929 policy/evaluation files aligned into the isolated branch and local server (56 policy tests passed). Homepage PR937, About PR938 and offer-history PR939 are in installed #150. PR940's seller-bonus wording is source-only and not in #150.

Both #150 CI jobs passed. Homepage/filter fixes, About and seller acceptance-to-sale have actual BlueStacks evidence in android-emulator-2026-11-20.md. This provenance verification does not certify all application features.

No downgrade, uninstall, app-data clear, public download replacement, customer release, Play publication, or production OTA was performed.
