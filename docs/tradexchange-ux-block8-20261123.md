# TradeXchange UX — Block 8: service lifecycle and direct provider access

Date: 23 November 2026. Continuation of draft PR #987. Checkpoint: 80%; source implementation only.

## Provider dashboard access

- The existing operational dashboard at `/dashboard/service` is the direct contractor dashboard destination. Dealer and contractor account menus, the mobile website menu and dealer home have an explicit Provider Dashboard shortcut. Dealer navigation and the matching native card expose the same destination.
- Contractor Profile in the original native app opens `ProviderOverview`; native notifications and `/dashboard/service` deep links match it. Guided introductions use this operational home.
- Provider navigation exposes Dashboard, Find Jobs, My Work, Messages, Service Setup and Account Settings. Service applications, insurance, business details and payout setup remain in `/dashboard/partner`; existing setup card identity and routes are retained.
- Pending providers see setup guidance without losing assigned work. Dealership staff see business-managed access guidance, rather than a misleading personal application prompt. Backend role, dealership actor, approval, KYC and payout checks remain authoritative.

## Customer quotes, payment and completion

- Customer request detail puts the status, next action and quote comparison before the vehicle details. The chosen provider, whole-request amount and scope sit beside payment continuation. Inspection findings precede completion confirmation. Native now shows all vehicles and their notes, rather than only the first vehicle.
- Existing checkout target validation, atomic quote selection, confirmed-payment evidence, refund amounts, 9%/91% allocation and 48-hour completion review rules remain in place. Query-string checkout returns do not prove payment. Contact presentation now follows the server-recorded payment state, including paid disputes.
- The existing support panel becomes an expandable “Changes, support and progress” section and opens automatically during disputes. Cancellation, rescheduling, counterpart date agreement, progress timestamps, case notes and private evidence remain available. Support request choices reset safely when quote acceptance changes the job status; synchronous guards and shared busy state prevent competing customer actions.
- Web and native detail state is keyed by account and job; superseded refresh responses are ignored. A checkout failure preserves its useful error while refreshing the accepted quote. Checkout/review locks remain held through authoritative readback.
- The original native app now provides the existing verified-review submission and saved-review display, using the existing server permission and review endpoint after release. No new transaction or review backend was created. Auction-refusal feedback now displays the server-returned refund amount, including £0 for a waived fee; it does not assume that every customer paid £125.
- Automatic MaziuM greetings no longer obscure service workspaces or request forms on web/native. The assistant launcher, conversation and saved opt-out remain available.
- MaziuM navigation guidance now distinguishes Provider Dashboard from Service Setup and recognises the existing dashboard route. Regression gates include the new lifecycle and native behaviour checks.

## Verification

- Final website and original native TypeScript checks: passed.
- Targeted source regression suite: 195 passed, zero failed/skipped.
- Native renderer suite: 22 passed, zero failed/skipped, including actual customer detail review submission under duplicate taps, acceptance failure/error recovery, multi-vehicle ordering and account switching while a stale response is pending.
- Existing backend delivery/recovery/inspection lifecycle suite: 49 passed. No backend service/payment handler changed.
- Dashboard catalogue synchronisation and product parity guards: passed. Provider navigation and guided-tour suites also passed. The knowledge fingerprint guard now parses source arrays correctly when paths include `[id]`; its two regressions pass and all 90 referenced sources are covered and verified.
- Synthetic browser customer lifecycle: 1440px/light, 390px/dark and 320px/light. Covered current/expired quote comparison, server acceptance followed by checkout failure, pending payment return, single resume/review/case-note submission under duplicate taps, completion consent, released review readback, post-payout dispute wording, reschedule agreement and evidence controls. No detected horizontal overflow or uncaught page errors in the passing runs.
- Synthetic provider navigation: eight configurations covering approved contractor, contractor requiring setup, approved dealer and dealership staff at 1440px/light and 390px/dark. Direct dashboard/setup paths, notices, noindex and layout checks passed.
- Final targeted mobile visual checks verified unobscured provider/scope text with the greeting suppressed and launcher retained. Inspection findings precede confirmation; dismissing auction-refusal consent sends no mutation. Screenshots were inspected at narrow widths.

All browser and renderer data was synthetic. External calls were intercepted; no live service jobs, applications, messages, reviews, payments or refunds were created. One initial 390px browser navigation stalled at the global authentication loader; the isolated rerun and subsequent targeted checks passed. This observation remains recorded rather than being attributed to an unverified cause.

QA scripts, logs and screenshots are in `C:/Users/Dell/CarMazium-QA-Tools`, under `tx-ux-block8-*` / `tx-block8-*`. Browser fixtures are development-preview checks, not real-account or physical-device certification.

## Checkpoint boundary

Stop at 80% for owner review. The existing draft branch/PR contains the source changes; production web deployment, signed Android/iOS builds, real-account testing and owner device sign-off remain later release work. Main was fetched and remains an ancestor of this branch; no upstream conflict was present.
