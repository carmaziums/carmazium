# Issue #477 — Block 1/10: website ↔ native visual parity baseline
Date: 2026-10-10 (UK); scope: evidence inventory and reproducible screenshot capture, NOT a visual acceptance certificate.
Programme checkpoint: BLOCK 1 = 10% of the planned ten blocks; overall pixel equivalence is UNKNOWN.

## Baseline and evidence provenance (do not conflate sources)

| Ref | Evidence | What it establishes | What it does NOT establish |
| --- | --- | --- | --- |
| E01 | Production website https://www.carmazium.com/ inspected as public HTML on 10 Oct 2026 | Public home has “Sell Your Car Your Way”, “Auction FREE · Retail for £1”, conditional £100 reward, AI search, retail cards and category search | Visual measurements of logged-in dealer screens; website may be newer than cached HTML |
| E02 | docs/native/website-visual-parity-recordings-20261010.md | Written observations from az_recorder_20261010_140222.mp4 (native dealer app) and az_recorder_20261010_141055.mp4 (mobile dealer website), which motivated PR #476 | Direct frame-by-frame access to those two videos in this conversation; post-merge comparison |
| E03 | Merged PR #476, 28dcd9e6831a400e437436713d372abb89116186 | Dealer Home / Stock / Customers / Buy & Bid / More, shared WebsiteTopBar, drawer, dealer permissions and full-width navy bar are integrated in main | Pixel-level equivalence of tabs, Stock, CRM, user menus, forms or iOS |
| E04 | Android QA Actions run 38057186815, artifact CarMazium-QA-Emulator-Report (ID 11672235576) | Source SHA 28dcd9e, Android 15 emulator, successful launch of uk.carmazium.qa, logged-out-launch.png = 1080×2400 px | An authenticated dealer page; a matched web/native screenshot pair; iOS smoke |
| E05 | src/app/globals.css; src/components/layout/Header.tsx; src/components/dashboard/DashboardSidebar.tsx; src/config/dealerRouteConfig.ts; native TabNavigator.tsx and WebsiteTopBar.tsx | Exact current source tokens, routes and structure | Runtime styling under a real role/theme/dataset |
| E06 | Public-web screenshot job .github/workflows/carmazium-visual-baseline.yml (included in this block) | Can capture anonymous public pages at explicit browser viewports and upload dated CI evidence without a login | Authenticated dealer/buyer data or native equivalence |

### Screenshot accessibility / safety verdict

- Previous recordings are **reference observations only** through E02: original MP4 files are not directly accessible in this chat. Never describe their uninspected individual frames as re-reviewed.
- E04 supplies one **native onboarding** screenshot; it cannot be compared to /dashboard/dealer. Android screenshot pixel dimensions alone do not prove corresponding CSS viewport or density. The job captures public web screenshots, NOT login sessions.
- Desktop Commander target was offline; available live remote-web screenshot provider had insufficient credits; local browser container could not resolve the live domain. Thus **no authenticated paired captures are available** at Block 1 sign-off.
- Test account list: **none confirmed**. Do not assume a real dealer, seller or buyer account is safe for testing. If later approved, use synthetic staging role accounts with fake vehicles/leads; never perform bids, KYC, payments, listing writes, messages or admin mutations in production.
- No permission to screenshot private customer details for a public GitHub artifact has been established. Public-site captures only; keep authenticated evidence private and redact all personal information. iOS signing/device access is not established.

## Canonical tokens and structural measurements — SOURCE-READ ONLY

| Property | Website canonical source | Native baseline source | Assessment |
| --- | --- | --- | --- |
| Primary red | globals.css --color-primary #ed1c24 | colors.ts accent #ED1C24 | Matched token, rendered colour pending |
| Dark body | .dark --bg-body #1b2538 | colors.ts bgBody #1B2538 | Matched token, rendered surface pending |
| Dark panel/footer | .dark --bg-dropdown #243047 | TabNavigator.tsx full-width #243047 | Matched token after PR #476; image pending |
| Header | .dark --bg-header rgba(30,41,59,.84), responsive global Header | WebsiteTopBar.tsx #1E293B, minHeight 65 plus safe-area inset, 13dp horizontal padding | Semi-transparent web header vs opaque native; *candidate* visual difference, not yet measured |
| Light theme | :root body #eef5fb, dropdown #fff | Primarily dark RN screens, individually styled | Theme parity **not established**; not assume all routes support light mode |
| Heading/body font | globals.css Poppins headings / Montserrat body | typography.ts Poppins 700/800 and Montserrat 400/500/600 | Family choice aligned; sizes/weights and line-heights pending |
| Dealer page heading | PageHeader.tsx text-2xl (mobile), text-3xl (md), margin-bottom 7, subheading tracking 0.12em | Screen-local DealerProfile/Inventory/Leads text styles | Not yet measured or visually matched |
| Screen padding | Web dealer uses container px-5 (20 CSS px) at mobile; PageHeader and responsive layouts vary | spacing.ts screenH 24dp, cardPad 18dp, compact dealer rows 10dp | Candidate per-screen spacing difference, NOT an across-the-board bug |
| Bottom navigation | DashboardSidebar.tsx lg:hidden full width, five-column grid, safe-area bottom | TabNavigator.tsx #243047 edge-to-edge + safe area, dealer tabs | Structural mapping matched in source, visual pending |
| Breakpoints / safe areas | Responsive web Tailwind + CSS env(safe-area-inset-bottom) | React Native safe-area insets and system navigation bar | Requires 360dp/390dp, Android gestures and iOS checks |

Use website dark **and** light captures with identical content, mode and viewport. Do not treat colour tokens as a screenshot diff or invent tolerance scores.

## Prioritised screen-pair matrix (source ownership / evidence / risk)

Status legend: SOURCE = route/component inspected; VIDEO = older E02 mismatch evidence; PENDING = no same-state matched screenshot; DEFECT = source-proven semantic discrepancy requiring functional review.

| ID | Role + comparable state | Canonical website route and owner | Native tab/screen owner | Required controls to compare | Current status | Block |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | Verified owner: Home | /dashboard/dealer — src/app/dashboard/dealer/page.tsx | DealerHome — screens/main/DealerProfileScreen.tsx | account identity, KPI cards, period selector, Add Vehicle, spacing | SOURCE; PENDING matched screenshots | 3 |
| D02 | Verified owner: Stock, same sample vehicle | /dashboard/dealer/inventory — src/app/dashboard/dealer/inventory/page.tsx | DealerStock — screens/main/DealerInventoryScreen.tsx | search, filter/status counts, cards, images, transmission, price, Add Listing, empty state | SOURCE; PENDING | 4 |
| D03 | Verified owner: Customers, no PII | /dashboard/dealer/crm — src/app/dashboard/dealer/crm/page.tsx | DealerCustomers — screens/main/DealerLeadsScreen.tsx | search, list/board, CRM stages, KPIs, add lead; responsive kanban | SOURCE; PENDING, stage label discrepancy C02 below | 5 |
| D04 | Verified dealer: Buy & Bid | /dashboard/dealer/auctions — src/app/dashboard/dealer/auctions/page.tsx + dealerRouteConfig.ts | DealerBuyBid — screens/main/LiveScreen.tsx | own auctions vs trade marketplace, create/manage and bid affordances, shortlist, status | **DEFECT C01: different workflows at same tab label**; screenshots PENDING | 6 |
| D05 | Verified dealer: More | DashboardSidebar.tsx mobile More and global Header account menu | DealerMore opens GlobalDrawer.tsx (PR #476) | active nav, overflow, dealer-first links, non-duplicate tabs, back/close | VIDEO pre-merge difference; SOURCE corrected; PENDING post-merge | 2 |
| D06 | Verified dealer: Settings | /profile?section=business / dealer settings, Header.tsx | WebsiteTopBar.tsx → Settings, GlobalDrawer.tsx | single coherent settings location, profile/business/security, notifications | SOURCE; PENDING | 8 |
| D07 | Verified dealer: Auctions list/detail | /auctions plus /dashboard/dealer/auctions + /dashboard/dealer/bids | LiveScreen.tsx, auction detail stack | bidder gate, current bid, timers, fee disclosure, saved state, overflow | SOURCE; PENDING | 6 |
| B01 | Logged-out/buyer: Marketplace home | / — src/app/HomeClient.tsx, Header.tsx | Home — screens/main/HomeScreen.tsx | hero, nav, AI search, sell CTA, retail browse, conditional £100 wording | HTML E01; SOURCE copy; PENDING paired image | 7 |
| B02 | Buyer: Retail browse/filter | /buy-cars — web route and listings components | Search — screens/main/SearchScreen.tsx | search, sort/filter, price, photos, year, mileage, fuel, gearbox | PENDING; no same-listing pair | 7 |
| B03 | Buyer: Saved cars | /dashboard/user?tab=watchlist — src/app/dashboard/user/page.tsx | Saved — screens/main/SavedScreen.tsx | same saved inventory and route, no unrelated cards | SOURCE; PENDING | 8 |
| B04 | Buyer: Account menu | /dashboard/user?tab=overview + Header.tsx | Profile / account stack | account role, settings, verification, messages | SOURCE; PENDING | 8,9 |
| S01 | Seller: free auction vs retail £1 | /sell — web sell/valuation entry | SellCarFlow native stack | route choice, price rules, forms, AI, vehicle facts, optional HPI | E01 copy; PENDING paired image | 7 |
| S02 | Seller: Inventory/offers | /dashboard/user?tab=inventory / offers — user/page.tsx | UnifiedDashboardScreen native account stack | listings, offers, statuses, handover; no live write actions | SOURCE; PENDING | 7,9 |
| X01 | Logged-out onboarding | Web login/signup or public home, **not same workflow** | OnboardingScreen.tsx; E04 native screenshot | only visual identity/reference, **do not pixel-diff against homepage** | E04 native image only | 9 |
| X02 | Dealer employee restricted role | DealerRouteConfig.ts + dealer access gates | useDealerAccess + TabNavigator.tsx | least-privilege Stock/Customers/Buy & Bid, no unauthorized actions | SOURCE; PENDING staging actor | 9 |
| X03 | iOS same user states | Safari mobile web same URLs | iOS native same routes | safe area, font scale, gestures, keyboard, VoiceOver | NOT TESTED, signing/device unknown | 9,10 |

## Ranked findings / disposition

1. **C01 — P1, source-proven functional parity mismatch:** Website dealer bottom **Buy & Bid** links to /dashboard/dealer/auctions (web source manages a dealer's *own auctions* with Create Auction, handover stages); native DealerBuyBid renders LiveScreen, which fetches active/scheduled dealer auctions for bidding. A common label does not guarantee the same task. **Do not remove or revert merged #476**; reconcile website route intention and native destination in Block 6 with dealer permissions and backward-compatible links.
2. **C02 — P2, source-proven CRM stage wording:** Website CRM uses “Viewing / Qualified” for QUALIFIED whereas native BOARD_STAGES labels it “Qualified”. Inspect real cards/list/board and decide whether explanatory copy is missing in Block 5; preserve backend enum QUALIFIED.
3. **C03 — P2, plausible layout mismatch requiring measurement:** Native shared header is opaque #1E293B and its min height includes additional top safe-area padding; web header uses translucent --bg-header and its own fixed/sticky geometry. Also 24dp general native padding vs web dealer px-5 mobile; do not mass-replace before screenshots. Block 2/3/4.
4. **C04 — P2, visual sign-off blocked:** Logged-in screenshot pair, prior original MP4 frames, iOS screenshot, aligned datasets, account/theme/viewport details unavailable. A successful Android build is not screen-level parity. Blocks 2–10 must close their own evidence rows.
5. **C05 — P2, theme parity unproven:** web has explicit light and dark design tokens; native may render predominantly dark. Verify what themes are intentionally supported before changing palette (Block 9).
6. **C06 — regression risk only, not a proven defect:** #476 dealer tabs/deep links, drawer and permissions must remain intact. Preserve dedicated consumer tabs and auth/KYC/bid guards.

## Capture matrix and protocol

| Pair | Viewport (layout dimensions) | Theme/state | Acceptance condition | Evidence status |
| --- | --- | --- | --- | --- |
| W360 home / N360 Home | 360 × 800 CSS px / 360 × 800 RN dp, device density recorded separately | logged-out or synthetic buyer, same screen and scroll | side-by-side hero+header+tabs, image and text visual checks | WEB capture job available; NATIVE PENDING |
| W390 home / N390 Home | 390 × 844 | same as above | equivalent layouts; no clipped CTA or AI control | WEB capture job available; NATIVE PENDING |
| W360 dealer D01–D06 / N360 dealer | 360 × 800 | same synthetic verified owner and same fake records, dark | screenshots of header, first fold, whole screen, opened drawer, one card and empty state | BOTH PENDING |
| W390 dealer D01–D06 / N390 dealer | 390 × 844 | same as above | record exact x/y/width/height of header, tabs, headline, cards, CTA; check navigational effects | BOTH PENDING |
| W390 buyer/seller / N390 buyer/seller | 390 × 844 | authenticated staging/synthetic, light/dark only if supported | owner, route, same data, same filter/scroll state | BOTH PENDING |
| W390 iOS Safari / N390 iOS | 390 × 844 | same synthetic role | top/bottom safe areas, gestures, text scaling | BOTH PENDING |

Required screenshot manifest fields: reference_id, SHA/build, web URL/native route, account role and permission set, synthetic dataset ID, viewport width/height, DPR/density, theme, OS, timestamp UTC, scroll offset, state, screenshot file, redaction check and reviewer verdict. Align **content and state first**, then report card widths/padding/colour/text differences. Compare only screenshots from the *same* role/state and viewport; reject mismatched pairs. A screenshot proves pixels at capture time, not that buttons work: record separate navigation and read-only interaction results.

## Block 1 delivery / exit criteria

- [x] Confirm merged PR #476 and exact baseline commit on main; never overwrite it.
- [x] Inspect live anonymous website HTML plus web/native route files and shared source tokens.
- [x] Retrieve and inspect native Android QA launch evidence from merged source SHA.
- [x] Create explicit role/route/screen inventory, ranked defects, target measurements and screenshot plan.
- [x] Identify evidence gaps and unavailable staging/synthetic accounts without pretending visual acceptance.
- [ ] Authenticated paired website/Android screenshots at both sizes — **BLOCKED**, no approved synthetic session/assets.
- [ ] iOS paired screenshots and device smoke — **BLOCKED**, no iOS device/signing session.
- [ ] Frame-by-frame replay of prior MP4 files — **BLOCKED**, originals not available here; use earlier observations as E02.

**Revert:** This block changes documentation, a read-only public screenshot workflow and a source-inventory test only; revert the Block 1 PR to discard them. **No application UI, business logic, KYC, payment, OTA, app signing, seller fee, dealer permissions or production config is modified.** Do not start Block 2 without explicit user “proceed”.
