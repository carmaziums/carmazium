# CarMazium One Product — Final Parity Certification

**Date:** 24 September 2026  
**Scope:** Website + native mobile app + shared NestJS backend  
**Certification state:** **CODE PARITY PASS / RUNTIME RELEASE EVIDENCE PENDING**

## Executive result

The repository now has a closed machine-readable parity manifest:

- **49 required cross-platform features**
- **2 approved web-only features**
- **0 unresolved `gap` entries**
- **0 `web_only_candidate` entries**

The required features cover authentication and role boundaries, public marketplace journeys, seller/buyer/dealer/Partner workflows, pricing and payment semantics, auctions, service jobs, HPI, chat/notifications, navigation/deep links, terminology, accessibility/state consistency and the shared performance baseline.

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

### Block 9 — Navigation / states / accessibility / performance
Native public-detail hydration, cross-role back-stack behaviour, shared terminology, loading/error/offline states and accessibility semantics are guarded. Performance hardening now includes idle-loaded Mazium, native onboarding virtualization and Android release minification/resource shrinking.

## Runtime and external evidence still required

These items are **not code-parity gaps**, but they must be completed before calling a specific mobile/web release fully runtime-certified:

- Build a new signed Android APK/AAB after the Block 9 release-config change and record artifact size versus the documented ~65–68 MB prior APK.
- Run first-use onboarding plus representative marketplace/auction/dashboard scroll journeys on a physical Android device and record any memory/jank regressions.
- Measure production Core Web Vitals / equivalent browser timing (LCP, INP, CLS) after the performance build is live.
- Run representative keyboard + screen-reader checks against real rendered web/native surfaces.
- Publish/verify Apple `apple-app-site-association` with the real Apple Team/app identifier.
- Publish/verify Android `.well-known/assetlinks.json` with the real release signing SHA-256 fingerprint.

The repository deliberately does not guess the two signing identifiers.

## Release decision

**Code parity:** PASS.  
**Manifest parity:** PASS — zero unresolved gaps.  
**CI release gate:** REQUIRED and regression-blocking.  
**Runtime release certification:** PENDING the device/browser/signing evidence above.

A release may be treated as functionally one-product at the code-contract level only after the current parity workflow is green on its exact release commit. Runtime-performance, accessibility and universal-link claims should be made only after their corresponding external checks are recorded.
