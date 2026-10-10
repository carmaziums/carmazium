# Issue #477 — Block 10/10: Final visual acceptance, evidence, and release readiness

**Date:** 10 October 2026. **Code implementation checkpoints: 10/10. Visual acceptance: NOT COMPLETE. RELEASE APPROVAL: BLOCKED.** Do **not** equate 100% of ten scheduled source blocks with 100% website-to-native visual similarity.

## Executive disposition

**VISUAL SIGN-OFF: PENDING.** The accumulated Block 1–9 code work is in GitHub. PR #486 (Block 9) is MERGED in main at `7cf9ea9eab320c8f90e5917a5aa2e3f7cd7696b7`. This Block 10 PR provides a reproducible visual gate, identity/route test matrix, evidence requirements and separate rollback. It **does not** attest pixel equivalence of dealer/customer/public screens, live deploy an app, produce a new installable Android APK, or imply iOS has been installed.

Previous merged work retained: **PR #476**, **PR #478**, **PR #479**, **PR #480**, **PR #481**, **PR #482**, **PR #483**, **PR #484**, **PR #485**, **PR #486**. All ten scheduled blocks can be source-complete while final visual approval remains **BLOCKED**.

### Re-verified evidence, source ownership and limits

| Evidence | Verified reference | Scope established | Not established |
| --- | --- | --- | --- |
| Latest completed Block 9 source CI | Release Certification #38067277869; One Product Parity #38067277844; Mobile Chat CI #38067277805 | Native/web TS, backend tests/build, permission and UI source contracts green at Block 9 head `7bdbe2c2e75701f0ca1c7ceca2c3e3743873333e` | Native simulator boot, identical pixels, role-by-role app navigation or screen-reader success |
| Public website screenshot artifact | GitHub run #38067277751, `carmazium-issue477-block1-public-web-baseline`, artifact 11675715452, generated workflow at Block 9; image ZIP manifest source SHA `dc6e880fd7dce726372df01c559c89f5060691dc` | **Anonymous website** Home + Sell, 360×800 / 390×844 Chromium viewport | Native app visuals or authenticated dealer/CRM screens |
| Earlier Android QA emulator | Run #38057186815, `CarMazium-QA-Emulator-Report` artifact 11672235576 and Android QA artifact 11671698164, SHA `28dcd9e` | An **older** Android logged-out launch screenshot / emulator smoke | Updated Blocks 1–9 app; iOS; authenticated visual parity |
| User website/native recordings | Written `docs/native/website-visual-parity-recordings-20261010.md` | Historical mismatch observations underlying Issue #477 | Post-change identical screenshots. Original MP4 files not directly replayable via the currently available GitHub tool |
| Source authority | Website /dashboard/dealer, /dashboard/dealer/inventory, /dashboard/dealer/crm, /dashboard/dealer/auctions, /search, /sell, /profile and relevant chat/account pages | Website component/layout rules and current source routes | Runtime rendering on same authenticated fixture, accessibility tree, colour sampling, human-approved visual compare |
| Android preview workflow | `.github/workflows/carmazium-android-preview-apk.yml` and `carmazium app/carmazium app/eas.json` | Internal preview profile, `preview` OTA channel and APK format, requires `EXPO_TOKEN` or `EAS_TOKEN` | A **new** post-Block-9 APK built, downloaded or installed; isolated staging backend |
| iOS preview | `eas.json` preview iOS profile has `simulator:false` | Internal iOS release-candidate profile described in source | Apple signing, TestFlight access, installation, VoiceOver or device QA |

**Source-verified website appearance mismatch:** The downloaded actual public Home/Sell screenshots (390×844 and 360×800) render a LIGHT website (white navigation, light valuation panel, red accents), while the current native UI uses a predominantly static DARK palette. These are materially different presentations. No native light-theme implementation was introduced in this block, and release sign-off remains blocked until a supported theme decision is implemented and verified on Android/iOS. The cookie-consent overlay covers part of the public screenshot and must not be counted as a missing native UI item without a matched privacy scenario.\n\n**Critical blocker — Preview is NOT isolated staging:** `eas.build.preview.env.EXPO_PUBLIC_API_URL` points to the same **live Fly backend** as production and carries a live Stripe publishable key. It may be useful for read-only viewing by authorised people, but it is **not** safe for synthetic mutable acceptance workflows. Never place synthetic bids/payments, execute KYC, create real listings, edit customer data or test handover on that live backend. Before meaningful QA mutations, provision a separately approved **synthetic staging backend/database** and explicitly test that the preview build is pointed there. Do not silently swap production credentials. Preview build publication, OTA update and store submission are **not authorised in this task**.

**MaziuM source clarification:** Contrary to an earlier Block 8 inventory note, the native assistant EXISTS as `carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx` and is mounted by `App.tsx`. Website uses `src/components/features/MaziumWidget.tsx` via `MaziumWidgetLoader`. Native and web share a mascot and AI chat/report endpoints; each requires opt-in before chat. Block 10 aligns the native welcome text, website quick replies (including ULEZ) and floating clearance above large-text tabs, **without** changing consent or sending any AI request. Native guest access remains different. The actual assistant panel is still not pixel-verified.\n\n## Final approval gate — actually enforced

`scripts/verify-native-visual-acceptance.mjs` accepts a private manifest and an exact 40-character source SHA. This gate fails unless all of the following are true:

- Source SHA equals the **exact** app+website revision under test; independent reviewer and distinct tester both identified.
- Staging is approved, HTTPS, declared isolated/synthetic-only and **is not** live Fly backend or CarMazium website. Images remain private, consented and redacted; never commit private buyer/vehicle/customer images or screenshots to public GitHub.
- **Sixteen required role/screen pairs** are present at **both 360×800 and 390×844** (32 matched screen-state records total), each having **three actual PNG files**: identical-fixture website, Android and iOS. Each PNG's bytes, cryptographic sha256, intrinsic resolution and declared device-pixel-ratio are verified; labels alone are not proof.
- The same fixture, screen, role, theme and UI state are independently confirmed on each pair with human notes and individual PASS. A screenshot presence test is NOT a pixel equivalence verdict.
- Sixteen distinct **manual checks** are signed as PASS, including Android install, iOS install, verified dealer permission/retail bid refusal, financial copy/auction handover, saved/chat state, 200% font scale, TalkBack and VoiceOver, light theme, MaziuM consent, keyboard/safe areas and no dead controls.
- A final independent human reviewer signs `finalDecision: APPROVED` against the current candidate. Blank, stale or forged metadata does not pass if the actual screenshots are not present.
- `node scripts/verify-native-visual-acceptance.mjs --manifest /private/qa/issue477.json --sha <exact-tested-git-sha>` runs **on the controlled QA workstation**. Missing input returns nonzero and **BLOCKED**. The source unit tests validate fail-closed behaviour using mock screenshot dimensions; they do not substitute for real screenshot files.

The optional private QA manifest must **not** be checked in. Use distinct redacted synthetic accounts and dummy vehicles. If real iOS screenshots or accessible test accounts are unavailable, the gate remains blocked; do not rewrite assertions or waive platform cases to manufacture approval. This script is a verification aid, not a substitute for human review.

## Canonical visual pair matrix

Every row needs both viewports (360×800, 390×844), 3 platform PNGs per viewport, and matched fixture/state:

| ID | Identity / role | Website screen | Native screen | Mandatory checks | State |
| --- | --- | --- | --- | --- | --- |
| D01 | Verified dealer OWNER | /dashboard/dealer | DealerHome | KPIs, periods, actual stats, tabs, hero | PENDING |
| D02 | Dealer OWNER | /dashboard/dealer/inventory | DealerStock | Card photo, VRM, transmission, search, status, imports | PENDING |
| D03 | Dealer OWNER | /dashboard/dealer/crm | DealerCustomers | Board/list, six stages, genuine counts, add customer, notes | PENDING |
| D04 | Dealer OWNER | /dashboard/dealer/auctions | DealerBuyBid | Five destinations, owned/live, shortlist/bid positions, £125 buyer auction fee information | PENDING |
| D05 | Dealer OWNER | /profile | Settings | All nine settings, identity, bank/KYC gates, privacy | PENDING |
| D06 | Restricted dealer STAFF | Restricted /dashboard/dealer route | Gated Stock/CRM/BuyBid | No bypass by deep-link, no owner business KYC, error retry | PENDING |
| B01 | Buyer | / | Home | Sell first, FREE auction vs £1 retail, conditional £100 reward | PENDING |
| B02 | Buyer | /search | Search | Header, transmission, prices, filters, real images, location | PENDING |
| B03 | Buyer | /search/[vehicle] detail | Retail vehicle details | Image carousel, gearboxes, save/offer, no fee | PENDING |
| B04 | Buyer | /dashboard/saved or current Saved | Saved | Shared favourites and auction-role separation | PENDING |
| S01 | Private seller | /sell | SellLanding | VRM/manual data, valuation fallback, mode CTAs | PENDING |
| S02 | Private seller | Website listing wizard | SellCarFlow | Draft/resume, £0 auction vs £1 retail, upload and pricing | PENDING |
| X01 | Contractor | /services/jobs | PartnerDashboard/assigned jobs | Job acceptance, chat only when accepted, permissions | PENDING |
| X02 | Finance/insurance partner | Partner area | LegacyPartnerDashboard | Quotes and source permissions, no dealer bid gate bypass | PENDING |
| X03 | Dealer OWNER | /messages, /notifications | Messages, Notifications | Same-room messages, unread counts, push/deep links and safe area | PENDING |
| X04 | Dealer OWNER | Website MaziuM UI | Native MaziuM assistant/UI | Launcher position, panel, AI consent disclosure, no unconsented submission | PENDING |

Further states for the same pairs: 0/5/50 vehicles; empty/error/slow loading; manual/automatic/CVT/unknown transmission; new/draft/rejected/sold/provisional; bid outbid/highest; off-reserve offers; 1×/1.5×/2× text; Android gesture navigation/iOS notch, keyboard open/closed, dark and supported light theme, permission denied. If components don't exist on a platform, record a failed case, not a fabricated matching screenshot.

## Human QA checklist — PENDING (do not do these on production)

- **androidInstall**: build signed **internal** Android QA APK from exact SHA, install/relaunch on target Android model; capture startup and bottom-bar clearance
- **iosInstall**: signed approved internal iOS build or simulator runtime from same SHA; capture iOS notch/keyboard and navigation back
- **buyerCannotBid**: buyer must have no auction bid path; verified trader-only actions behind role/KYC; seller can list auction/retail
- **dealerKycAndStaffPermissions**: owner/ADMIN/SALES_AGENT with and without permission; blocked direct deep links and failed access check
- **auctionRetailPricing**: auction seller FREE, buyer platform £125, retail listing £1, no retail buyer fee; seller reward £100 only after approved auction handover
- **valuationAndListing**: DVLA missing model, VAT irrelevant here, valuation unavailable, vehicle details, draft, fee and listing moderation
- **wonAuctionHandover**: funds confirmation, inspection and resubmitted/rejected proof preserve buyer fee; staging only
- **savedAndChatCrossClient**: PostgreSQL same account and room, real unread/saved changes in synthetic staging, no unrelated customer records
- **notifications**: role-correct deep links/read states and delivery preferences, no false bell badges
- **talkBack**, **voiceOver**, **largeText200Percent**, **keyboardAndSafeAreas**: screen-reader focus, control labels, 44dp taps, no horizontal clipping or lost primary action
- **nativeLightTheme**: native app currently hard-wired dark, whereas website supports light/dark; requires actual supported implementation or an explicit product-level acceptance decision; do not silently pass
- **maziumDisclosureAndConsent**: actual website `src/components/features/MaziumWidget.tsx` and native `src/components/GlobalAIChatBot.tsx` (mounted globally in native `App.tsx`) are now source-identified. Both require explicit disclosure/consent before AI chat and support withdrawal/reporting; compare actual popup/mascot/navigation/UI and guest behaviour on device. Native currently hides chatbot when unauthenticated, unlike public website.
- **noDeadControls**: every visible action navigates or does its advertised operation; permissions and error retry visible in test state

**No production release.** The ten-block code programme does not authorise a Play Store, TestFlight, live backend, Vercel or EAS production submission. Source CI, public Playwright screenshots and old APK artifacts are not a substitute for the above checklist.

## Gate failures currently open

| Severity | Blocker | Needed before approval |
| --- | --- | --- |
| **BLOCKER** | No approved isolated synthetic staging API/database; preview points to live backend | Provision/configure dedicated staging without touching production |
| **BLOCKER** | No same-state authenticated website↔new native Android/iOS screenshot set | Produce 32 approved web+Android+iOS screen pairs at both viewports in private QA |
| **BLOCKER** | No installed post-Block-9 Android QA APK on test device; iOS signing/simulator access not verified | Generate exact SHA builds using owner-approved credentials and install |
| **BLOCKER** | Native light mode and full MaziuM assistant visual/consent parity not verified | Implement/compare with actual website source and approve separately; do not fake |
| **HIGH** | TalkBack/VoiceOver, 200% text, keyboard/screens with dealer permissions not exercised | Manual on-device test with synthetic users |
| **HIGH** | Cross-client CRUD, bid/inspection/reward workflows not tested on synthetic staging | Safe integration walkthrough, no production mutations |
| **MEDIUM** | Remaining inline seller auction controls, direct bid cancel and shortlist remove differ in navigation depth | Compare, prioritise remaining UX repairs with authenticated screenshots |

**Final decision as of 2026-10-10: RELEASE APPROVAL: BLOCKED. VISUAL SIGN-OFF: PENDING.** The work from 10 blocks is source implementation and acceptance-gate preparation, not a claimed 100% pixel-certified release.

## Revert, ownership and next permitted action

This Block 10 PR branches from main after merged **PR #486**. Revert **only Block 10 PR** to remove the private manifest evaluator, source tests and evidence documentation without disturbing Blocks 1–9. Do not revert the critical Block 9 KYC/staff protection. Existing Android preview workflow and current live backend credentials remain untouched.

To finish acceptance, a project owner must provide/approve isolated synthetic staging, device QA access and private consented screenshot evidence. Then run the gate and remediate true visual diffs in separately reviewed follow-up changes. If any requirement is unavailable, state it as a blocker and stop — no invented signoff.
