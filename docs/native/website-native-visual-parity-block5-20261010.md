# Issue #477 — Block 5/10: Customers & CRM website/native parity

Date: 10 October 2026. **50% = five of ten scheduled blocks implemented, NOT an actual pixel-similarity measurement.**

## Canonical comparison

Website `src/app/dashboard/dealer/crm/page.tsx` provides Customers (“Enquiries, offers and buyer follow-up”) with Add Customer, Offers received, an automatic-enquiries explanation, **four** two-column metrics: New / Active / Follow-up due / Sold, and a mobile **six-stage Kanban** with one selected stage displayed at a time. The stages are **New Leads, Contacted, Viewing / Qualified, Negotiating, Closed Won, Lost**. Cards show buyer name, actual source, linked vehicle, email/phone, latest activity, next follow-up state and a phase selector. `AddLeadModal` allows a manually added customer to link to an owned vehicle using the supported `listingId` field. Web uses drag/drop on desktop, but on mobile stage changes use a selector.

The previous native `DealerLeadsScreen.tsx` had working CRM mutations and buyer contact details, but opened in a **different list-first layout**, labelled stages generically, showed a six-column horizontally scrolling board, omitted follow-up reminders from board cards and loaded only `page=1&limit=50` customers. No code-level source parity can compensate for missing authenticated screenshots.

## What Block 5 changes

- Default native Customers screen to **board** while retaining the previous **list view** as a secondary toggle.
- Match the website's first-fold title/description; place Add Customer and role-gated Offers received in header actions (no duplicate header/back control). Explain automatic enquiries vs manually created customers in a green-tinted guidance panel.
- Show real four-number stats: **New** = NEW leads; **Active** = status not WON/LOST; **Follow-up due** = nextFollowUpAt past and not closed; **Sold** = WON. Do not invent follow-up counts or report loading/network failure as authoritative zeroes. Error state has a Retry option.
- Show one selected native pipeline stage at a time, with the exact six web stage labels and per-stage counts in horizontally scrollable stage tabs; add explicit accessibility selected states. Preserve alternate list/Hot/Warm/Won/Lost workflow and pull-to-refresh.
- Full-width native board cards now show actual buyer, verified source label, interested vehicle, direct email/call buttons when present, last activity, follow-up/overdue badge, phase status and click-to-move stage picker. No invented dummy buyers/messages. Native uses a stage picker instead of HTML5 drag/drop, preserving screen-reader and touch navigation.
- Add website-equivalent **follow-up tomorrow at 09:00 local** (or clear existing) via authenticated PATCH `/dealers/leads/{id}`; stage changes and notes continue to use existing endpoints. Full permission gates unchanged.
- Add optional **“Search your listings...”** field to existing Add Customer bottom sheet; use read-only `fetchAllMyListings` and send existing validated `listingId` on Create Lead, just as the website does. Existing buyer name, email, phone, source, notes and staff assignment retained.
- Replace 50-lead truncation with a **bounded 40-page read-only loop**, stopping when backend pagination indicates complete, a short page is encountered or no unseen IDs appear. Fail explicitly rather than displaying a silently incomplete total. No customer data is written during refresh.
- Preserve `withDealerGate(DealerLeadsScreen, 'MANAGE_CRM')`, view-only staff boundary, `MANAGE_OFFERS` gate for Offers received, existing `createChatRoom` restrictions, buyer contact, staff assignment, notes, history and all back/navigation behaviour.

## Boundary and risks

- No changes to production website, backend, API schema, KYC, bidding, payments, listing fees, auth, app signing, OTA or store submission. The unchanged API retains business validation and permission gates.
- All action handlers continue using current authorized account contexts. New only production mutation pathways are **existing** PATCH follow-up and CREATE Lead with optional `listingId`; **do not run them against real data to QA**. No synthetic dataset/account is available here.
- 40-page cap is defensive against malicious/looping backends; if a dealership exceeds 2,000 customers, the UI shows an explicit fetch error rather than pretending the list is complete. Revisit server pagination/virtualisation separately if needed.
- Existing web profile and native brand/theme may vary by user state. Original videos `az_recorder_20261010_140222.mp4` / `az_recorder_20261010_141055.mp4` remain **not directly accessible** in this chat. Earlier recording notes in `docs/native/website-visual-parity-recordings-20261010.md`, website source inspected; DO NOT claim fresh frame-by-frame review.

## Verification and manual acceptance

- Source/contract tests in `scripts/test-native-visual-parity-block5.test.mjs`, wired to Release Certification, assert stages, counts, API paging, permissions, reminder API, buyer contact, optional listing association, scoped rollback.
- [ ] Same authenticated synthetic dealer test record, matching website & native at **360×800** and **390×844** on Android, with matching theme, font, stages, scroll position, long names and overdue reminders
- [ ] iOS screenshot, 200% dynamic type, VoiceOver/TalkBack, selected stage tab and card contact targets
- [ ] Verify 0/1/50/51/101 seeded leads and failures on later pages; stale values must be visibly marked and the Retry action work
- [ ] Stage change between any of the six columns, follow-up tomorrow/clear, Add Customer associated vehicle, buyer chat and team reassignment in **approved isolated synthetic staging only**
- [ ] Staff without MANAGE_CRM cannot enter; CRM-capable staff without MANAGE_OFFERS cannot navigate to dealer offers; verify nondealer deep links denied
- [ ] Buyer and dealer roles, shared shell (merged #476/#479) and dealer Home/Stock (#480/#481) remain unchanged

**VISUAL SIGN-OFF: PENDING.** No post-change installed Android/iOS app or authenticated matching website screenshot comparison was available. CI green means source code/typechecks passed, **not** matching pixels, gestures or approved end-user builds.

## Rollback / stop

Block 5 PR is based on merged **PR #476**, **PR #478**, **PR #479**, **PR #480** and **PR #481**. **Revert only the Block 5 PR** to restore prior native Customers screen without undoing those PRs. Keep Block 5 PR open/unmerged after CI and **STOP AT 50%** until the user explicitly says “proceed.” No Block 6 work without that approval.
