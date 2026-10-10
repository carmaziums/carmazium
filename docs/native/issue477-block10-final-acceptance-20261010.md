# CarMazium website/native parity + pre-store Android APK — Block 10 final handoff
Date: 10 October 2026. Issue #477 continuation. **SOURCE DEVELOPMENT REVIEW: COMPLETE (10 planned blocks). CUSTOMER RELEASE: NO-GO.**

This is a read-only release decision and test checklist, **not** a customer installer or public-download authorisation.

## Verified repository baseline
- Production `main` already includes merged [PR #491](https://github.com/carmaziums/carmazium/pull/491), the original guarded internal-only release candidate workflow. PR #476 was preserved.
- Draft PRs #492 through #499 are **not merged**. #494 consolidated #492 and #493; subsequent PRs #495–#499 were stacked in sequence. **Do not merge each older overlapping PR separately**, as they edit the same workflow, tests and AI component.
- The Block 9 head of draft PR #499 was `99b67cd1c024a9dde21482409cd9699c363f853d`. The `One Product Parity` and `Release Certification` workflows succeeded, and two Vercel status contexts succeeded. This is source-level certification only, **not** a signed native build, production deploy or live phone test.
- Block 10 adds a final, conservative, **non-authorising** evidence auditor, regression tests and a NO-GO evidence template. The Block 10 PR is intended to be the single consolidated merge candidate. All pending PRs remain draft until separately reviewed and approved.

## Completed source-work overview
1. Block 1 / #492: restrict candidate signing workflow to manual dispatch from main; add source guard and CI triggers.
2. Block 2 / #493: require explicit positive Android versionCode, production APP_ENV and signed APK version check.
3. Block 3: local synthetic release-keystore preflight research; genuine signing identity still unknown.
4. Block 4 / #494: independent release-signing certificate pin and private-key access proof before Android build; synthetic negative tests.
5. Block 5 / #495: attest actual copied private-review APK's SHA-256, version, package, source commit and signer; revalidate before upload.
6. Block 6 / #496: verify exact first-party hosted APK's HTTPS response and real bytes, signer/package/version; forbid debug/review-only website URLs.
7. Block 7 / #497: website/native Mazium welcome, persistent rotating prompts, assistant/privacy controls, user-isolated history and web duplicate-prompt fix.
8. Block 8 / #498: website-style native Mazium greeting, 20-second cadence, per-account dismissal, foreground safety, accessibility and reduced-motion behaviour.
9. Block 9 / #499: invalidate stale AI responses after consent withdrawal; route native AI filter cards correctly and preserve selected filters; improve touch targets and accessible semantics.
10. Block 10: independent NO-GO release evidence/acceptance auditor; explicit owner approval and device testing checklist; final consolidated source PR.

These 10 are **planned source-development checkpoints**, not a measure of signed customer-release readiness. Device parity, especially native full light/dark appearance and guest AI API design, is not certified.

## How to audit the current blocker inventory
```bash
# From the repository root; this intentionally exits 2 (NO-GO).
node scripts/check-customer-app-release-acceptance.mjs \
  docs/native/issue477-block10-release-evidence-TEMPLATE.json

# Unit-test the fail-closed auditor with synthetic ONLY evidence.
node --test scripts/test-customer-app-release-acceptance.test.mjs
```
The template is deliberately filled with false/empty values. The checker returns independent Android and iPhone blockers. Even a fully filled self-reported checklist returns **MANUAL_RELEASE_REVIEW_REQUIRED**, never public download approval. Assertions in a JSON file are **not external evidence**. The owner/release reviewer must independently verify actual signed binaries, installs, screenshots, file hosting and signing provenance before considering any change.

## True Android customer release sequence (NOT yet performed)
1. Review this single consolidated draft, reconcile earlier PRs and merge only approved source to main after CI/quality review. Re-run CI on the final main commit and establish its exact full source SHA. Never claim PR success equals merge.
2. Owner supplies/reconciles existing *long-term* CarMazium production signing identity **outside GitHub code/chat**, preserving certificate continuity with future updates and Play distribution. Verify cert SHA-256 out of band. GitHub Secrets cannot be read via the current tools; their existence, correctness and provenance **were not verified**.
3. Dispatch **manual internal review candidate** workflow from final `main` using exact source SHA and increasing versionCode. Confirm success and actual retained signing cert; obtain the private GitHub Actions internal review artifact. Build includes production service configuration; **do not use real bids, KYC, payment/refund trials or other mutating QA on live accounts**.
4. Independently inspect the APK using Android build tools, confirm package `uk.carmazium.app`, version, signing certificate digest, source evidence, exact APK SHA-256/size and binary installability. Preserve evidence outside source control.
5. Install the exact signed APK on physical Android phones. Test clean install, updates, login, browse/search, Mazium greeting/chips/filter cards, sharing consent and withdrawal mid-request, user switching, keyboard, accessibility and purchase-flow navigation. Conduct transaction-mutating tests only on isolated synthetic staging, not production.
6. Independently compare real website screenshots with that actual APK for buyer/trader roles, including small screens and large text. Note design/theme differences honestly.
7. Obtain explicit owner written release approval **bound to exact APK hash and final main source SHA**. Without verified approvals, stop.
8. **Only after approval** host the versioned release APK on first-party HTTPS; hosting itself makes the file accessible even while the button is disabled. Run `node scripts/verify-first-party-android-apk.mjs <exact-url> <verified-evidence.json>` with Android SDK to re-download the hosted bytes and match signing identity/sha/version/size. Never host internal REVIEW-ONLY or `uk.carmazium.qa` debug-signed artifacts.
9. Only after the above may release staff configure the Vercel variables `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_URL`, `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_SHA256` and `NEXT_PUBLIC_CARMAZIUM_ANDROID_APK_RELEASE_APPROVED=true`. Verify production `/download-app` and re-download the actual public installer to check bytes/signing, plus browser and device download UX. Do not change those variables without separate owner approval.

## iOS remains a separate release decision
- An arbitrary iOS IPA is **not** a general UK website-install method. CarMazium needs an Apple-signed, approved TestFlight beta and a working external invite for pre-App Store installation.
- Confirm App Store Connect build/review status, device iPhone sign-in and Mazium functional/screenshots review, valid public TestFlight invitation, and explicit owner approval before adding a working TestFlight link.
- The Android release's success must not make the iOS button appear ready; both use independent feature gates.

## Release blockers on 10 October 2026
- **NO-GO:** Current Block 10 source PR unmerged. Older PRs #492–#499 still draft.
- **NO-GO:** Genuine production signing key, keystore provenance and owner-pinned certificate not confirmed.
- **NO-GO:** No genuinely release-signed customer APK has been built or obtained for inspection in this work; GitHub source CI does not create one.
- **NO-GO:** No actual signed Android device installation, upgrade, functional/privacy/security QA, and buyer/trader screenshot signoff.
- **NO-GO:** No approved binary hosted on first-party HTTPS, measured public SHA-256, or completed deployment approval.
- **NO-GO:** iOS TestFlight invitation/build, iPhone device QA and full theme parity not verified.
- **DESIGN GAP:** Native AI guest access is authenticated-only, whereas the website widget can render for guests. Do not bypass authentication; secure publicly usable AI requires separate design, rate limits, abuse protection and privacy review.
- **DESIGN GAP:** Native AI currently inherits the app-wide navy theme. Website light/dark parity and pixel-accurate screenshot acceptance remain unverified.
- Live website accessibility via external public browsing was not established during this block; no claim is made that production hosts a downloadable APK.

## Non-regression
No key material is published to Git, generated, rotated or shown; no APK has been uploaded publicly. No database migrations, payment changes, roles/auth bypasses or app-store submissions. Current website download feature flag stays **OFF** until verified final release.

**Block 10 completion means this 10-block source programme has reached its final review checkpoint. It does not mean customer installation is ready.** Await separate explicit approval for a consolidated merge and any release.
