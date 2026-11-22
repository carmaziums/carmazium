# TradeXchange Block 2 — Stage 10 final QA and release-readiness record

Date: 22 November 2026  
Pull request: https://github.com/carmaziums/carmazium/pull/983  
Branch: `feature/tradexchange-block2-jobs-20261122`  
Original Android package: `uk.carmazium.app`  

## Two distinct completion states

**Source implementation: 10/10 stages submitted for review.** The original backend, website and native Android service-job flows remain in one product and use the same existing accounts, jobs, quotes and payments.

**Production release: NO-GO until independent acceptance evidence is verified.** This document is a source/code certification record, not authorisation to merge, install an APK, replace the site download, start OTA updates, or transact with real customers in QA.

The user's Desktop Commander machine `DESKTOP-LPIB4R3` was offline when Stage 10 was attempted. Its original installed APK, signing identity, user data, logged-in dealer account and browser session were **not** inspected. No APK was built or installed, and no production customer data, orders, payouts, emails or invoices were mutated for this task.

## Final automated checks

- Stages 10%–90%: `scripts/test-tradexchange-block2-post-job.test.mjs`, `scripts/test-tradexchange-block2-stage2.test.mjs` through `stage9.test.mjs`; source/runtime regression and CI tests.
- Stage 100%: `scripts/test-tradexchange-block2-stage10.test.mjs` verifies one canonical Android package and native routes, authenticated provider/customer/staff job ownership, provider eligibility/privacy, preserved Stripe idempotency/48-hour protection, retained customer/provider history, and fail-closed customer APK release acceptance.
- Existing Block 1 navigation/legacy route guards and Stage 9 retrospective QA are run in the same TradeXchange provider CI workflow. Dedicated backend Jest also exercises `services.service.spec.ts`, `services.payment-hardening.spec.ts`, `services.lifecycle-hardening.spec.ts`, `service-job-alerts.service.spec.ts`, `notification-email-policy.spec.ts` and `service-job-notification.spec.ts`.
- One-product parity, web/native/backend TypeScript, web build, full backend Jest/build, release-readiness contract, mobile auth/guided tour, and disposable synthetic-PostgreSQL security/payment checks must all be **green for the exact final PR head**. Passing only a previous commit does not certify a later revision.
- Stage 10 corrected obsolete parity assertions while **keeping the intended protection**: the native ProviderMessages workspace is reachable from the ProviderOverview, not as a redundant nested action under Find Jobs; the website uses real accessible links instead of `<Link><Button>`. MaziuM platform knowledge for the canonical `/dashboard/partner` was reviewed and its source hash refreshed; the knowledge-drift gate was not bypassed.

## Customer/role QA matrix — independent device and signed-in checks still needed

| Journey | Code and synthetic CI | Real account / original Android QA |
| --- | --- | --- |
| Buyer/seller creates delivery, recovery or inspection job and submits photos/vehicle details | Source/runtime tests | Outstanding |
| Verified dealer opts into multiple service roles, uploads insurance, selects postcode, receives matching new-job alerts | Backend capability/notification tests | Outstanding |
| Existing contractor sees historical accepted work after verification expires | Backend and source tests | Outstanding |
| Business team staff views authorised work and is barred from unauthorised quote/manage access | Controller and backend tests | Outstanding |
| Provider quotes/updates/withdraws; customer compares and selects exactly one; duplicate accept blocked | Transactional/backend and source tests | Outstanding |
| Stripe Checkout, interrupted return, server-confirmed payment and contact unlocking | Mock Stripe/backend and source tests | Outstanding; no live charge |
| Job starts, completes, two-party date change, 48-hour review, dispute/refund and released payout history | Mock Stripe/backend and source tests | Outstanding |
| Both dealer/provider and buyer/seller dashboards: visible tab, page, button, light/dark, accessibility and native navigation parity | Repository static/typechecks | Outstanding |
| Guided tour voice-on/Next, replay, login survival after app restart, fullscreen photo swipe/counter | Native CI only (where covered) | Outstanding |

**Never call a read-only source assertion a verified signed-in journey.** The above account scenarios must be checked with authorised synthetic users or owner-controlled accounts; avoid making real bids, Stripe charges, payment releases, customer notifications or damaging changes in production.

## Original production Android signer and deployment hold

1. Reconnect the authorised desktop and inspect the existing original installed app package, its version code and SHA-256 signing certificate fingerprint. The earlier records mention multiple build numbers; do not assume build 125 is the installed/customer download without checking the actual binary.
2. Verify original release keystore provenance and owner-approved certificate pin, then build a versionCode **higher than the currently installed/customer-distributed version**, using `carmazium app/carmazium app/scripts/release-android.mjs --apk` and the original release signing identity. Do not generate a new signing key or package ID.
3. Independently verify APK filename, size, source commit SHA, SHA-256, `aapt` package/version and `apksigner verify --print-certs` signer. Follow `scripts/check-customer-app-release-acceptance.mjs` and `docs/native/DIRECT_ANDROID_APK_RELEASE_RUNBOOK.md`.
4. Install the **same certified APK over** the original app on the owner's emulator without clearing data. Verify existing data, dealer/provider and customer login persistence, tours with voice, native service pages, buttons, alerts, job lifecycle, light/dark mode, font scaling, gallery swipe and image counter. Independently repeat on a named physical Android device. An emulator alone does not meet the release acceptance standard.
5. Verify website and native app against the exact same authenticated role journeys, including complete dealer dashboards and buyer/seller screens. Resolve any remaining mismatches before any rollout.
6. Verify deployed backend migrations, secrets/config/health, Stripe Connect webhook and lifecycle workers, email notification preferences and rollback preparation **without mutating real customer data in test**. Review exact merged GitHub commit, signed binary/source correspondence and public first-party installer URL.
7. Obtain written owner release approval **bound to the exact commit and APK fingerprint**, then follow human release review. The customer APK acceptance script itself never authorises publication.

Until these gates are satisfied: **PR #983 remains draft and unmerged; customer website and direct Android download must not be replaced.** Stage 10 source work can be complete while physical-device verification and production release acceptance are outstanding.

## Regression and rollback

Before release, preserve the prior known-good source commit, website deployment, public APK fingerprint and rollback path. If service payment, insurance/identity gating, staff permissions, notifications or account sessions regress, block distribution and restore the prior version; never roll back database financial records by copying an earlier snapshot over live payments.
