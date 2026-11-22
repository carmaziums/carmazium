# TradeXchange Block 1 — Stage 10 release gate and QA

Date: 22 November 2026  
Pull request: https://github.com/carmaziums/carmazium/pull/980  
Branch: `feature/tradexchange-block1-consolidation-20261122`

## Release state

**Review only — not yet a customer release.** The public website and original Android download remain unchanged. Block 2 job lifecycle, payments, bids and acceptance have not been redesigned. The consolidated TradeXchange hub reuses the existing services backend.

## Evidence completed

1. Stage 9: 53/53 website/onboarding/workflow and 28/28 Android provider checks passed, website/Android TypeScript passed, product parity passed, web production build completed.
2. Stage 10: resolved old dealer navigation and mobile dealer-service tests without resurrecting duplicate pages. Local runs passed 19/19 dealer navigation and 21/21 Android seller/dealer regressions.
3. Verified preview is READY for the reviewed branch. Using a temporary protected-preview link, ran read-only Chrome smoke tests at mobile 390×844 and desktop 1366×768 on /services, /services/delivery, /services/inspection, /dashboard/partner, and /dashboard/service/capabilities. Each returned HTTP 200 with no page errors or horizontal overflow. Authenticated routes showed the expected sign-in screen; no account creation, payments or uploads were attempted.
4. Reviewed MaziuM platform knowledge and canonical navigation. Provider setup, trade insurance, documents, payouts and job-area preferences point to /dashboard/partner; provider job feeds remain /dashboard/service/jobs. Refreshed knowledge hashes and added a regression test.
5. Confirmed BlueStacks emulator holds customer package `uk.carmazium.app`, versionCode **111**, currently signed out. No app data was deleted. A newly signed APK has NOT been built or installed; updating and authenticated QA remain release gates.
6. Repaired stale CI assertions for responsive native settings, legacy service settings, and service preferences. Mobile Listing (21/21 locally), Dealer Navigation (19/19 locally), Block 9 visual/settings and profile redirect checks (10/10 locally) passed.
7. Reviewed and corrected MaziuM service-navigation facts and evidence fingerprints. Normalized CRLF/LF before hashing to ensure the **same code** yields the same manifest on Windows and Linux; do not bypass the drift guard. Run green CI on the latest commit before release approval.

## Must be completed before 100% / production release

- All PR #980 checks green, including Release Certification, backend CI, web CI and parity.
- Signed-in dealer and existing-contractor acceptance on preview with correct profile/approval state, one TradeXchange entry, no duplicate onboarding pages, saved documents, insurance eligibility, payout and job-area preferences.
- Verify original Android release signing certificate against the already installed app and independent release evidence; prepare a new versionCode higher than 111 using the existing main-only signing workflow.
- Install the exact verified signed APK **over** the installed original without uninstalling or clearing data; test account persistence, native TradeXchange documents, guided tour, permissions, and light/dark layouts.
- Verify on a named physical Android device as required by the customer release certification contract. A BlueStacks emulator alone does not satisfy physical-device acceptance.
- Stage and test production infrastructure, verify identical web/app navigation and service rules, then approve website/customer APK distribution together. Do not enable the APK download until signed binary, checksum, package and source SHA agree.

## Rollback and data safety

The PR is draft until validated. Do not bypass `check-customer-app-release-acceptance.mjs` or signing protections, start an OTA update to the existing customer channel, replace the public APK with a review-only artifact, create a second Android package, delete user data, or start Block 2 before explicit Block 1 acceptance.

Production customer-facing release status: **NO-GO until these gates pass**.
