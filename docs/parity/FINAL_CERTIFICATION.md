# CarMazium One Product — Final Parity Certification

**Date:** 24 September 2026  
**Scope:** Website + native mobile app + shared NestJS backend  
**Certification state:** **REPOSITORY REMEDIATION COMPLETE / CODE PARITY PASS / RUNTIME RELEASE EVIDENCE PENDING**

## Executive result

The repository now has a closed machine-readable parity manifest:

- **57 required cross-platform features**
- **2 approved web-only features**
- **0 unresolved `gap` entries**
- **0 `web_only_candidate` entries**

The required features cover authentication and role boundaries, public marketplace journeys, seller/buyer/dealer/Partner workflows, customer Finance/Warranty enquiries, legacy Finance/Insurance Partner operations, pricing and payment semantics, auctions, service jobs, HPI, chat/notifications, cross-client runtime invalidation, navigation/deep links, terminology, accessibility/state consistency and the shared performance baseline.

The two intentional web-only exceptions are:

1. **`admin.operations`** — privileged internal back-office operations remain in the authenticated web admin console. The native customer/partner app does not expose an ADMIN application surface.
2. **`blog.seo`** — the public blog is an SEO/content surface rather than a transactional app journey and remains available to mobile users through the public website.

These exceptions are documented in `product-parity.json` with explicit reasons. They are not unresolved parity defects.

## Release gate

`scripts/check-product-parity.mjs` is now a release gate rather than only an audit warning:

- every `required` feature must declare existing web and mobile files;
- every approved `web_only` feature must declare web files, no mobile files, and an explicit reason;
- any `gap` fails CI;
- any `web_only_candidate` fails CI;
- unknown parity statuses fail CI.

The `.github/workflows/product-parity.yml` workflow runs the contract gate plus web, mobile and backend typechecks. Its path filters include parity-sensitive source code and the release/config surfaces used by the performance baseline.

## Matched journey coverage

| Journey | Shared backend contract | Web surface | Native surface | Code/CI status |
| --- | --- | --- | --- | --- |
| Authentication / onboarding / verification | Yes | Yes | Yes | Covered |
| Public vehicle marketplace / filters / detail | Yes | Yes | Yes | Covered |
| Retail + auction listing creation | Yes | Yes | Yes | Covered |
| Seller offers / handover / earnings | Yes | Yes | Yes | Covered |
| Auction bidding / winner fee / post-win contact | Yes | Yes | Yes | Covered |
| Verified inspection → vehicle refusal → £125 refund | Yes | Yes | Yes | Covered |
| Dealer business identity / staff RBAC | Yes | Yes | Yes | Covered |
| Dealer inventory / CRM / offers / purchases | Yes | Yes | Yes | Covered |
| Partner capabilities / verification / matching | Yes | Yes | Yes | Covered |
| Provider jobs / quotes / lifecycle / job chat | Yes | Yes | Yes | Covered |
| Finance / Warranty matched enquiries | Yes | Yes | Yes | Covered |
| Legacy Finance / Insurance Partner operations | Yes | Yes | Yes | Covered |
| Cross-client listing / offer / CRM / service invalidation | Yes | Yes | Yes | Covered |
| Stripe checkout / native PaymentIntent reconciliation | Yes | Yes | Yes | Covered |
| Seller £100 reward / provider payout lifecycle | Yes | Yes | Yes | Covered |
| HPI report entitlements | Yes | Yes | Yes | Covered |
| Notifications / deep-link tap routing | Yes | Yes | Yes | Covered |
| Public detail deep links / authenticated back stack | Yes | Yes | Yes | Covered |
| Loading / empty / error / offline states | Shared rules | Yes | Yes | Covered |
| Accessibility semantics | Shared invariants | Yes | Yes | Static guard covered |
| Performance baseline | Shared release invariants | Yes | Yes | Static guard covered |

## Blocks 1–9 result

### Blocks 1–4
The product contract, roles/authentication, public marketplace and seller journey are represented as required parity surfaces and enforced through the shared backend/client contract.

### Block 5 — Buyer
Buyer business rules are aligned, including auction winner fee reconciliation, the 72-hour payment deadline and the verified linked-inspection refusal path. Native mobile now exposes the linked customer service-job journey rather than carrying only an API contract.

### Block 6 — Dealer
Dealer staff operate through one canonical dealership identity. Owner/Admin/Sales/Finance permissions are enforced in the backend and consumed by both clients. Auction winner, seller, bid and fee state use the dealership identity rather than staff shadow identities.

### Block 7 — Partner / TradeXchange
Partner Account, capability application, private verification evidence, matching, provider jobs, Finance/Warranty leads and provider-focused service-job messages are represented on both web and native mobile.

### Block 8 — Payments / HPI / chat / notifications
Hosted and native payment reconciliation, exactly-once seller/provider payout controls, HPI entitlements and native notification/chat routing are guarded against drift.

### Post-certification One Product runtime remediation
A shared `/sync` invalidation channel now covers listings, offers, bids/account summaries, dealer CRM/team/KYC, TradeXchange jobs/enquiries/capabilities and legacy Finance/Insurance Partner mutations. The channel carries no business payload; web and native clients refetch the authoritative backend data when a relevant domain changes. Auction bidding and chat retain their existing dedicated realtime gateways. Native Finance/Warranty customer enquiries and legacy Finance/Insurance Partner dashboards are now first-class parity surfaces, and dealer analytics exposes the same flexible reporting-range model across clients.

### Block 9 — Navigation / states / accessibility / performance
Native public-detail hydration, cross-role back-stack behaviour, shared terminology, loading/error/offline states and accessibility semantics are guarded. Performance hardening now includes idle-loaded Mazium, native onboarding virtualization and Android release minification/resource shrinking.

## Exact-head certification evidence

For PR #233, corrected code head `103cc1056bfdbfdae166c9430214d1649b1b9c0c` produced the following evidence before this certification-document checkpoint:

- One Product parity workflow: **PASS** for product contract, web typecheck, mobile typecheck and backend typecheck/account-role boundary.
- Broad backend CI: **607/607 tests passed** and backend build passed.
- Web Listing CI: web typecheck and production build passed.
- Mobile Listing CI: passed.
- Backend Chat CI: backend build and chat regression passed.
- Vercel preview project `carmazium`: corrected code head reported **READY**.
- Vercel preview project `carmazium-final-unified-review`: corrected code head reported **READY**.

Certification documents are now included in the One Product workflow path filters, so subsequent certification-only changes must rerun the parity gate on the new exact head.

**Programme checkpoint:** **80% complete.** Code-contract parity is green; the final 20% is release/runtime evidence and controlled release completion, not hidden frontend parity work.

## Runtime and external evidence still required

These items are **not code-parity gaps**, but they must be completed before calling a specific mobile/web release fully runtime-certified:

- Build a new signed Android APK/AAB after the Block 9 release-config change and record artifact size versus the documented ~65–68 MB prior APK.
- Run first-use onboarding plus representative marketplace/auction/dashboard scroll journeys on a physical Android device and record any memory/jank regressions.
- Measure production Core Web Vitals / equivalent browser timing (LCP, INP, CLS) after the performance build is live.
- Run representative keyboard + screen-reader checks against real rendered web/native surfaces.
- Publish/verify Apple `apple-app-site-association` with the real Apple Team/app identifier.
- Publish/verify Android `.well-known/assetlinks.json` with the real release signing SHA-256 fingerprint.
- Publish the tested native JavaScript bundle to the production Expo Updates channel (or ship a signed store build where native config changed) using authenticated release credentials; repository code does not assume those credentials exist.

The repository deliberately does not guess the two signing identifiers.

## Release decision

**Code parity:** PASS.  
**Manifest parity:** PASS — zero unresolved gaps.  
**CI release gate:** REQUIRED and regression-blocking.  
**Runtime synchronization code:** PASS — shared invalidation/refetch contract is CI-guarded; auction/chat keep their dedicated realtime gateways.  
**Runtime release certification:** PENDING the device/browser/signing/store-release evidence above.

A release may be treated as functionally one-product at the code-contract level only after the current parity workflow is green on its exact release commit. Runtime-performance, accessibility and universal-link claims should be made only after their corresponding external checks are recorded.


## 80% → 90% release synchronization checkpoint

A common Git SHA is now the One Product release identity:

- web exposes the Vercel commit SHA through `/api/release`;
- backend exposes the Fly image release SHA through `/health/release`;
- Fly builds receive `RELEASE_ID=${GITHUB_SHA}`;
- native EAS Update/build source receives the same approved SHA before bundling;
- the release workflow waits until production web and backend both report the exact SHA before native publication can begin.

Native publication is intentionally gated. Automatic production publication requires repository variable `ONE_PRODUCT_AUTO_RELEASE=true` plus an authenticated `EXPO_TOKEN`. JavaScript-safe releases use EAS Update; native configuration/dependency changes start signed production builds instead. Store submission remains outside this checkpoint because `eas.json` still contains placeholder App Store identifiers and the repository does not contain the real signing/store credentials.

**Programme checkpoint:** **90% complete.** The remaining 10% is external production evidence: signed-device/store association, accessibility/performance runtime checks, and final production smoke/release verification.


## 90% → 100% final remediation checkpoint

**Repository remediation programme:** **100% complete.**  
**Production runtime release certification:** **still pending external evidence.**

Final exact code head before this documentation-only checkpoint:

`7217c48471a477f303e1c221417ddff34685c6a4`

Evidence on that exact code head:
- Product contract parity: **PASS**.
- Web typecheck: **PASS**.
- Mobile typecheck: **PASS**.
- Backend typecheck + self-service role-boundary test: **PASS**.
- Web Listing CI production build: **PASS**.
- Mobile Listing CI: **PASS**.
- Backend Chat CI build + regression tests: **PASS**.
- Broad backend test/build workflow: **PASS**.
- One Product Release Sync contract validation: **PASS**; production convergence and native publication were correctly skipped because this is a PR.
- Vercel `carmazium` preview: **READY**.
- Vercel `carmazium-final-unified-review` preview: **READY**.
- Exact preview runtime error query: **no error/fatal logs found**.

Final remediation completed in this block:
- Added environment-driven Apple Universal Link and Android App Link association handlers.
- Added `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` rewrites.
- Association handlers deliberately fail closed until real Apple Team ID / Android release signing SHA-256 values are configured; no signing identity is guessed.
- Production telemetry identified transient Vercel → Fly `ECONNRESET` / `ETIMEDOUT` failures on server-rendered vehicle pages. The affected pages still returned HTTP 200, but could lose server-rendered backend data on a transient miss.
- Added shared bounded-timeout/exponential-backoff server backend fetching and applied it to vehicle-detail and server-rendered blog/RSS/tag surfaces.
- Added parity guards for both the association contract and SSR backend resilience.
- Live production smoke checks on the currently deployed pre-PR release returned HTTP 200 for `/`, `/search`, `/services/finance`, `/services/warranty` and `/reviews`.

Why PR #233 remains unmerged:
- The currently deployed production website does not yet include `/api/release` or the association handlers; these are in PR #233.
- The installed native apps cannot be guaranteed to move with web/backend until authenticated Expo release credentials are available and native release publication is explicitly enabled.
- Merging now could therefore advance web/backend while leaving installed iOS/Android clients on the previous application code, which would violate the One Product objective this programme is designed to enforce.

External evidence still required before **runtime release certification** can change from PENDING to PASS:
- authenticated `EXPO_TOKEN` and deliberate native-release enablement;
- real App Store Connect / Apple Team values;
- real Android release-signing SHA-256 fingerprint;
- signed Android/iOS build evidence and physical-device journey tests;
- production LCP/INP/CLS measurements;
- representative runtime keyboard/screen-reader checks;
- verified Apple/Android association files on the live domain;
- synchronized production web + backend + native release using one release SHA;
- final production smoke test on that synchronized release;
- repository-admin enforcement of required PR/status checks. The connected GitHub integration cannot administer legacy branch protection, and the repository currently exposes no rulesets.

**Conclusion:** the codebase/remediation work is complete and regression-guarded. A production release must remain gated until the external signing/device/store evidence above is supplied; those are release credentials/evidence, not hidden web/mobile parity defects.
