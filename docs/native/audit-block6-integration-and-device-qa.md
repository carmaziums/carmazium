# CarMazium native integration — audit Block 6

Prepared 10 October 2026. This document does **not** certify Android or iOS binaries as tested, nor the app as visually identical to the website.

## Source integration

One integration pull request merges separate (independently revertible) reviewed corrections:

- #464 — vehicle card accuracy: gearbox, semi-auto and CVT, badges, no stock photos.
- #465 — seller/dealer inventory, full pagination, guarded editing and persistent auction shortlist routing.
- #466 — reliable server-backed valuations, correct DVLA state on registration change, complete auction histories.
- #467 — explicit bid confirmation, £125 buyer fee disclosure, publishing mutex, schedule time parsing, complete upcoming auction catalogue.

Shared-file collisions are resolved **by retaining both sets of changes** in `auctionApi.ts`, `LiveScreen.tsx`, `SavedScreen.tsx`, `SellCarFlowScreen.tsx`, and release certification. All four original regression suites and a new integrated contract are required CI checks.

Do not merge individual superseded branches after the integration pull request lands, as this would reintroduce old files or cause conflicts. Close them with a link to the integrated change once it is merged.

## Installation/build gates

The existing **CarMazium Android UI preview APK** GitHub Actions workflow can be manually dispatched on `main` and produces an internal APK on the *preview* channel only. No automatic store/OTA release.

The new **CarMazium iOS internal preview build** GitHub Actions workflow can likewise be manually dispatched. An Apple provisioning profile and registered device(s) are required for direct .ipa installs. Unregistered iPhones require a separately managed TestFlight distribution; this workflow does not submit to the App Store or TestFlight.

**Blocking prerequisite:** Prior preview runs reported missing GitHub Actions secret `EXPO_TOKEN` or `EAS_TOKEN`. Recheck before claiming a build exists. To enable, use an authorised Expo EAS account token stored in *GitHub → Repository Settings → Secrets and variables → Actions* as `EXPO_TOKEN`. Do not include a token in source code, chat, workflow logs, or tickets. GitHub Actions permission to call the Expo account and current Android/iOS signing credentials must also be confirmed.

**Critical:** The current EAS preview profile points to CarMazium's **live backend** and a **live Stripe publishable key**. Do not test real fees, place live dealer bids, submit real customer listings, inspect customer ID data, issue refunds or alter production data on review devices. Test-account / synthetic-data access must be isolated and formally approved. Avoid modifying production EAS/OTA channels for app review.

## Device acceptance checklist — must be performed on actual installed devices

1. Capture Android and iOS screenshots/video of the same website-equivalent navigation flow at comparable viewport sizes and light/dark settings, checking readable contrast, tap targets and overflow.
2. On both systems, verify unified Profile/Settings, login/password reveal, notifications with network unavailable, and app restart/persistence.
3. Compare live/retail/saved cards: Manual, Automatic, Semi-Automatic, CVT and undisclosed gearbox; no incorrect default or unrelated photograph; actual featured/insurance/HPI badges.
4. Compare sell journeys: change an analysed registration to another, ensure MOT/make/model/year/price reset, explicitly set vehicle details, and check backend valuation errors are labelled accurately.
5. On approved synthetic dealer accounts only: view live and scheduled auctions, verify KYC/permission read-only states, test bid UI confirmation **without confirming a real bid**; compare browser and app.
6. On synthetic seller accounts only: review auction vs retail selection, 10+ images, legal declarations, payment-gated submission, scheduling including British Summer Time boundaries, and failed/network-offline states **without transacting on the live backend**.
7. Verify saved-auction navigation, dealer shortlist, cross-client persistence and display after app restart.
8. Verify full pagination with >50 listings/auctions using approved synthetic fixture data; test errors and retries.
9. Verify return-to-list refresh, Android back gestures, iOS safe areas, accessibility/TalkBack/VoiceOver, deeplinks and notifications.
10. Compare installed binary SHA/build ID to the integration commit and record observed defects as new separate blocks; release to production only after signed binaries, Apple/Google internal testing and explicit approval.

## Release decision

Passing GitHub CI means **source checks completed**, not that Android APK/iOS IPA binaries have been built or device-validated. Never label the app "fixed live" or "ready to download" without a verifiable EAS build ID, artifact link, and installed-device verification.
