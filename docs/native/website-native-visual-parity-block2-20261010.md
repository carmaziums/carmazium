# CarMazium Website ↔ Native UI Parity — Block 2/10 (Issue #477)

Date: 2026-10-10. Programme checkpoint **20%** upon passing the source checks, NOT a measured pixel-similarity score.

## Scope and canonical evidence

- **Source basis:** `main` includes merged **PR #476** (commit `28dcd9e6831a400e437436713d372abb89116186`) and merged Block 1 **PR #478** (commit `472a85786dc79b34ad7aa1cfc3bab27ab366d7f8`). Do not revert either.
- **Website:** `src/components/layout/Header.tsx` uses the original branded logo asset (160px declared image width) and a menu/close icon at 28px. `src/components/dashboard/DashboardSidebar.tsx` shows five dealer bottom tabs and opens More as a full-width `bottom-[72px] left-0 right-0 rounded-t-2xl` panel, with a backdrop, close toggle and active More styling. Theme-sensitive header remains a separate theme-parity decision.
- **Historical user recordings:** `az_recorder_20261010_140222.mp4` (native), `az_recorder_20261010_141055.mp4` (web); prior review is recorded in `docs/native/website-visual-parity-recordings-20261010.md`. Originals are not accessible in this chat; no claim of having re-reviewed frame-level differences.
- **Actual public website images:** Block 1 Actions artifact `11672582561` at 360×800 / 390×844 shows light-mode homepage logo/hamburger and Sell/Valuation header. Not authenticated dealer screenshots, therefore **not** a valid pair for these dealer-menu changes.

## Specific observed/source-confirmed differences fixed

| Area | Before (merged PR #476) | Website reference | Block 2 implementation | Acceptance |
| --- | --- | --- | --- | --- |
| Dealer More | GlobalDrawer opens a full-height 340dp RIGHT sliding panel for every role | Dealer dashboard More opens bottom rounded full-width overlay above nav | `GlobalDrawer.tsx` dealer-only full-width bottom sheet using vertical animation; nondealer remains right drawer | Source check; screenshots pending |
| More state | Pressed More opens menu but never makes More active and cannot close using More again | More highlights and shows X when expanded, second tap closes | `TabNavigator.tsx` subscribes to drawer open state, marks selected/expanded and swaps menu→close, second tap closes | Source check; runtime pending |
| Top mobile menu icon | Nonstandard three staggered horizontal bars inside bordered capsule | Web `Menu/X` 28px icons without border/pill | `HamburgerButton websiteStyle` 28px menu/close; legacy hamburger elsewhere unchanged | Source check; screenshot pending |
| Header brand | Native header `Logo size=sm` forced width 120dp | Web image width 160px, screenshot confirms much larger mark on mobile | Header computes a responsive max 160dp and shrinks below tight widths, while using existing real PNG asset | Source check; screenshot pending |
| Header account/notifications | Shared PR #476 header shortcuts open central Settings and Notifications | Web has bell, avatar/account and menu for authenticated users | Preserve existing targets, buttons, IDs, role context; no auth/account changes | Regression |
| Dealer tabs / staff roles | Home/Stock/Customers/Buy & Bid/More with VIEW_INVENTORY / MANAGE_CRM / VIEW_TRADE gates | Website filtered dealer links | Unchanged; native tab target for Buy & Bid remains LiveScreen until **Block 6** role-semantic parity | Regression |
| Theme/header surface | Native uses dark slate header and dark logo asset; website supports light and dark | Light public screenshot vs dark authenticated dealer route unknown | **Not changing theme without equivalent-state evidence**; track under Block 9 | PENDING |

### Implementation notes

- `GlobalDrawer` uses `useWindowDimensions` and the existing `useSafeAreaInsets`. Dealer sheet height = min(720dp, 82% of app window); panel is flush left/right with rounded top corners. Its backdrop, Android back dismissal, user identity, sections, account settings, support, sign-out, buyer preview and permissions logic remain intact.
- Dealer More is an **inline absolute overlay**, NOT a full-screen RN Modal: its backdrop/sheet stop above the existing 64dp bottom navigation (+ system safe area). The original bottom tabs remain visible and tappable (including the More close toggle), without adding any duplicate nav; hardware-back, backdrop and close button all dismiss the panel. Non-dealer roles continue to use the original RN Modal and right drawer.
- `TabNavigator` More uses the existing drawer context, not a new tab screen. The previously visited dealer tab stays mounted and its state persists.
- `HamburgerButton` gains an optional `websiteStyle` prop only for `WebsiteTopBar`; other button usages keep their exact original appearance.
- `Logo` gains an optional `width` override. Normal size presets elsewhere are unchanged; the same bundled website PNG is used (no external image URL).
- No website production code, native backend/data, payments, pricing, messages, KYC, bids or API calls changed.
- Source assertion `scripts/test-native-website-ui-parity.test.mjs` updated for the header prop change; added `scripts/test-native-visual-parity-block2.test.mjs` to lock the improved shell and all existing dealer routes and role gates.

## Evidence and acceptance matrix

| Check | 360×800 | 390×844 | Android 15 read-only QA | iOS | Status |
| --- | --- | --- | --- | --- | --- |
| Website dealer header/top menu (same verified synthetic owner and theme) | Need capture | Need capture | N/A | N/A | PENDING |
| Native dealer header and logo (same screen/role) | Need capture | Need capture | Need authenticated fixture | Need device/test session | PENDING |
| Bottom More sheet / backdrop / close icon / More selected | Need pair | Need pair | Need authenticated fixture | Need device/test session | PENDING |
| Back gesture and backdrop closure | N/A | N/A | Need emulator interaction with role fixture | Need device | PENDING |
| Dealer staff restricted menu (each role permission) | Need synthetic data | Need synthetic data | Source checks | Need synthetic data | Source only |
| Existing buyer tab/deep links | Need synthetic data | Need synthetic data | Source checks | Need device | Source only |
| Source tests and native TS / release checks | same code | same code | Github CI | TS cross platform | Await results |

**VISUAL SIGN-OFF: PENDING.** Green CI and an existing logged-out onboarding screenshot do NOT establish same-state dealer UI parity. No synthetic staging credentials are available here. Never use live customer records, bids, KYC, payment or mutable listing operations to test. When available, obtain paired screenshots on the **same** fake dealer account and fake data state at 360×800 and 390×844, matching system font scale and dark/light theme; then verify native gestures, Accessibility/TalkBack, overflow and sheet scroll. Public website screenshots from PR #478 are reference for header proportions only.

## Revert and 20% stop rule

The dedicated Block 2 PR changes only the shared native header, original/logo sizing option, hamburger button, dealer drawer presentation, native tab UI state and static tests/documentation. To **revert**, revert the Block 2 PR merge commit or discard its feature branch. **PR #476 and PR #478 must remain intact**, along with existing signed Android/iOS releases. Do not start Block 3 or claim full parity until explicit user **proceed**.
