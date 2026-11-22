# TradeXchange Block 2 — ten 10% checkpoints (22 November 2026)

Scope: consolidate the **existing** job marketplace, not a second marketplace layered over old pages. Preserve all job IDs, quotes, participants, notifications, permissions, paid work, history and Stripe records. Keep website and existing customer Android package `uk.carmazium.app` consistent; no QA APK or build 125 replacement during intermediate stages.

- **10% — Post Job foundation (this commit).** Existing Android form posts to the existing `POST /services/jobs`. Delivery/recovery accepts multiple vehicles with per-vehicle registration-or-make/model validation and notes. Optional pickup and delivery addresses are present. On success, navigate directly to the native job-detail screen. Existing inspection remains a single-vehicle form; server-side gating and permissions are unchanged.
- **20% — Post Job parity (source checkpoint complete).** Native scheduling supports ASAP or selected future local date/time; Android and website validate date, postcode and vehicle year; both support up to 12 vehicles for delivery (inspection remains one). The website delivery form now retains an account-scoped session draft and clears it after posting; Android uses account-scoped AsyncStorage with guarded hydration and ordered cleanup. The native Services main CTA offers delivery/recovery or inspection directly, without a duplicate chooser screen. Fixed native registration whitespace normalization.
- **30% — Find Jobs and provider matching (source checkpoint complete).** Web and original Android provider screens now fetch Delivery/Recovery vs Inspection matches from the existing server-side filtered feed **before** pagination. The same filter applies to My Work on the backend, restricted by contractor profile and authorised service types; it does **not** require new-work verification to view authorised accepted/completed jobs. Both screens retain independent available/assigned requests and dedicated error/verification messages. Website selections persist in the URL query, Android filters trigger fresh cursor requests, and both screens link to the canonical TradeXchange partner hub instead of building another setup page.
- **40% — Provider quote lifecycle (source checkpoint complete).** Original website and Android quote screens use exact GBP-to-integer-pence conversion, accepted whole-job price range (£1–£50,000), active-quote edit vs new quote labels, and confirmed withdrawal. Backend enforces range even for internal callers, guards quote submission by role/service/coverage/current eligibility/payout/open-job state, and uses one quote per business per job with concurrency checks. Reacting to a withdrawn/expired quote is treated as a new offer for customer notification. A distinct view permission allows authorised withdrawal of an existing active quote even when new-work verification expires, without enabling another submission. Customer identity, contact, streets and other providers' quotes remain filtered server-side until the paid acceptance conditions are met.
- 50% — Customer quote comparison and explicit acceptance; competing quote handling and race safety.
- 60% — Existing checkout, payment-state recovery and escrow/fee evidence; never change prices, splits or paid history without independent checks.
- 70% — Work tracking, scheduling, contact visibility after acceptance and job changes.
- 80% — Completion, customer confirmation, 48-hour policy, refunds/disputes and retained history.
- 90% — In-app and email alerts, provider opt-in eligibility, duplicate-route cleanup, website/native UX parity.
- 100% — Regression and security tests, signed-in journey testing, final release checks and controlled website/original Android release. Verify customer APK provenance and signing before any replacement.

## 10% source evidence

- The existing Android job creation screen is extended, not cloned.
- The existing customer job detail and job list routes are reused.
- Both website service job forms remain operational, and no database, backend payment or notification contract is altered.
- Regression file: `scripts/test-tradexchange-block2-post-job.test.mjs`.
- Static source assertions/checks can be run in GitHub CI; **full TypeScript, app build, emulator and customer release verification remain pending** because the connected laptop was offline at this checkpoint.
- Work is staged in a separate branch, not automatically deployed or merged to main.

## Release safety

The recently merged insurance rules remain authoritative: collection, delivery and recovery require verified motor trade insurance **and** public liability; inspection requires verified public liability only. A business may provide multiple services under the same account. Work already accepted remains accessible if a new-job verification expires.

## 20% evidence and limits
- Regressions authored at `scripts/test-tradexchange-block2-stage2.test.mjs`, plus updated 10% regression.
- Eleven source-level invariant checks confirmed on the live GitHub branch (API continuity, native date/year/vehicle logic, scoped drafts, website form validators, direct native choice and registration normalization).
- Vercel previews and GitHub Actions builds are still in progress; **do not mark full build, emulator or signed customer APK testing as passed**.
- The laptop device was offline as of this checkpoint; no device-level testing or changes to the customer APK were performed.
- This checkpoint is source implementation, not a production release. Do not merge, deploy or update customer installers until QA clears the release gate.

## 30% implementation and validation

- Backend: `GET /services/jobs/assigned?serviceType=DELIVERY|INSPECTION` reuses the existing validated job-service query DTO and respects authorised contractor/team scope; no new tables, payment changes or payout changes.
- Available feed already verifies currently approved capability, insurance/eligibility and postcode coverage. Both clients now ask it to filter **before** pagination, avoiding false-empty filtered pages.
- Existing React Native and website provider job screens remain the only job marketplaces. Native My Work remains independent of feed failures, and the website's selected filter is represented by `?service=DELIVERY` or `?service=INSPECTION`.
- Regression coverage: backend `services.service.spec.ts` (expired verification still reveals an authorised completed inspection job, no unauthorised service spillover); native `scripts/test-partner-service-parity.test.mjs`; source tests `scripts/test-tradexchange-block2-stage3.test.mjs`, integrated into the existing provider workflow CI.
- The earlier source-guard checks in `scripts/test-tradexchange-provider-continuity.test.mjs` and `scripts/test-dealer-purchase-detail.test.mjs` were updated to reflect filtered API callbacks and purchase listing linkage without weakening the assertions.
- GitHub and Vercel CI results must be checked for this head commit before claiming a validated release. Original public APK, production website and build 125 remain unchanged. The user's desktop connection was offline; native emulator, signed APK and real-account end-to-end testing are **not** certified.

## 40% implementation and verification

- Existing protected `PUT /services/jobs/:id/quote` and `DELETE /services/jobs/:id/quote` endpoints retained; no new quote, payment or provider tables, no changes to platform commission or paid records.
- Server `getJob` includes presentation hints `canQuote` and `canWithdrawQuote` scoped to the actor and their business. Mutations retain their own authoritative live checks. `canWithdrawQuote` is separate from new-work verification so an old active offer can still be withdrawn if authorised.
- Website and native app share the same strict fixed-price GBP conversion to pence; zero, negative, sub-penny, scientific and over-cap values are rejected locally. The backend independently rejects invalid amounts. Preview displays customer gross, CarMazium fee and provider share from settings without altering commercial terms.
- App and web allow updating only an ACTIVE quote; a withdrawn quote can be reactivated using the single existing quote row and its customer alert is classified as a new offer. Withdrawing an ACTIVE quote requires user confirmation and the job must still be OPEN.
- Backend regression scenarios added to `backend/src/services/services.service.spec.ts`: invalid amounts cannot mutate, reactivation reuses the quote ID, privacy for a read-only staff account, and expired insurance cannot prevent authorised withdrawal.
- Source/runtime boundary tests: `scripts/test-tradexchange-block2-stage4.test.mjs` (web/native quote parser equivalence, endpoint, permission and privacy assertions), run in the existing provider workflow CI.
- Provider workflow CI passed on an intermediate Stage 4 commit; final head CI, backend unit tests, and signed device/end-to-end checks must still be verified before any release claim.
- Original customer app and website remain unchanged until controlled production deployment after Stage 10. Laptop device remains offline, so emulator verification is outstanding.

Do not create a new Android package ID, QA customer installer or substitute website URL screens for native job screens. Preserve original signing certificate and build 125 for the later coordinated release.
