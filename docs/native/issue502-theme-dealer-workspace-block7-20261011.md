# CarMazium native theme parity — Block 7 of 10: Dealer workspace and account shells

Date: 11 October 2026 · GitHub Issue #502. **70% of source-migration blocks, NOT customer binary or phone testing**.

This review branch is stacked on Block 6 draft #508 and includes prior Blocks 1–6 and the Samsung navigation fix. Do not merge overlapping drafts independently.

## Theme-aware website-aligned dealer/account surfaces

- Dealer command centre `DealerWebParityOverview.tsx`: verified-dealer hero, custom days/months/years/all-time controls, comparison toggle, metric cards, task cards, labels and borders follow the actual semantic native light/dark palette. Backend reporting query, period semantics and permission-gated destinations unchanged.
- Dealer `DealerProfileScreen.tsx`, `PartnerDashboardScreen.tsx`: today/week profile, inventory/sales/leads metrics, partner-service cards, activation form fields and account headings. Original permissions, role switching, KYC and service workflows retained.
- `DealerInventoryScreen.tsx`: main stock filters/search/list/grid, memoised inventory rows and grid cards, selected listing detail and sold-price modal surfaces use theme-aware colours. Saved stock labels, transmission/specs, status and approved edit/publish/boost/mark-sold paths preserved; no listing mutation semantics altered.
- `DealerBuyBidScreen.tsx`: canonical web-aligned My Auctions / Live / Shortlisted / My Bids / Purchases view headings, tabs, auction cards and permission notices use semantic foregrounds and surfaces. `MANAGE_INVENTORY`, `VIEW_PURCHASES` and `PLACE_BID` remain required as before.
- `DealerTeamScreen.tsx`: list of staff, team cards, role chips, pending invites and labelled editable invite fields theme-aware. Hoisted/memoised staff and role-pill components subscribe to the current palette; actual role grants and `useDealerAccess` unchanged.
- `DealerLeadsScreen.tsx`: Customers/CRM board and list, filter tabs, lead cards, enquiry detail, buyer/contact fields and staff selection controls. Memoised `LeadRow` and `BoardCard` subscribe to theme changes without refreshing lead data or altering follow-up, stage, assignment and buyer messaging handlers.
- `DealerAnalyticsScreen.tsx`: analytical panels, KPI figures, funnel and comparison cards contrast on both themes; native chart library data, backend source, period and metrics are unchanged.
- `UnifiedDashboardScreen.tsx` and `AccountRoleHomeScreen.tsx`: unified account dashboard and non-buyer roles (contractor, finance partner, insurance partner, admin) use semantic backgrounds, cards, text and controls. Existing role-aware navigation and signout remain.

## Regression and rollout policy

- Added `scripts/test-native-theme-dealer-workspace-block7.test.mjs` to Release Certification; tests check semantic styling and contract preservation for dealer roles, access, inventory, CRM, team, analytics and accounts.
- Full release source tests, TypeScript checks, One Product Parity, Mobile Listing CI and Vercel preview statuses must be checked on the **exact final PR head** before confirming 70% source completion.
- All deeper individual dealer sub-screens (purchases, payouts, KYC, separate finance and trade reports) and conversation/MaziuM screens need continued theme auditing in Blocks 8–9; do not imply every screen is converted.
- App Appearance switch remains **disabled** until screens are completely migrated and real Samsung/iPhone tests pass. CI is not physical-device/screenshot or signing certification.
- No APK was built, signed, released or made public. No production API keys, database, payment, KYC, auction rules or releases touched. The customer-facing first-party APK gate remains disabled.

**Stop at Block 7 / 70% for explicit owner approval before Block 8.**
