# Issue #477 — Block 3/10 dealer Home website-to-native parity

Date: 10 October 2026. Checkpoint: **30% of ten planned blocks**, **NOT** measured pixel similarity. Website is canonical source at `src/app/dashboard/dealer/page.tsx`; native entry point remains `DealerHome` in `TabNavigator.tsx`. Uses PR #476 navigation changes, merged Block 1 PR #478 and merged Block 2 PR #479.

## Same product hierarchy, rather than a visual reskin

| Canonical dealer website (first fold) | Previous native Home | New native first-fold |
| --- | --- | --- |
| Dealer Command Centre, “Run your dealership from one place,” personal name and Verified Dealer status | Dealer/company mini-header with fabricated “PRO” label (not canonical) | Actual Dealer Command Centre title, real user's name, Verified Dealer only if backend says verified |
| Overview heading and reporting explanation | Today/This Week switch, no matching range | Overview and matching description |
| Presets 7D, 30D, 3M, 1Y, All; custom 1–10000 days/months/years; compare prior | analytics hardcoded to /dealers/analytics?range=7d | Matching presets/custom/compare controls tied to website /dashboard/dealer API query params |
| Active Stock, Vehicle Views, Active Leads (permission), Vehicles Sold | Inventory snapshot, live/units sold/average days/conversion (different reports) | Same KPI names and conditional lead permission, 2-column responsive cards; explicit unavailable-data placeholders |
| Main actions: Add vehicle, Customers, Buy & bid, Partner services, Performance; role filtered | “Needs attention” with many competing destinations; main actions not visually grouped | Same five job names, descriptions, and permission gating in simple stacked card hierarchy |
| Analytics error suppresses authoritative-looking zeroes | Legacy older analytics may render empty-looking zeroes | If web KPI endpoint fails, no fabricated zeroes; retain previous results with visible stale warning or show em dashes on first error |
| Phone/contact gate may be needed for dealers | Native phone banner | Preserved above overview; verification/business logic unchanged |

The original native Today/This Week, inventory health, top vehicles, attention items, funnel and sales report are **not deleted**. They are now in a collapsed **Additional insights** section after the website-matched Overview/Main actions. These existing panels still use their own legacy endpoints and will be fetched only upon expansion. The website-matched first fold uses the same authenticated read-only `GET /dashboard/dealer` service as web, with range and compare query.

## Action routes and policy safeguards

- **Add vehicle** → existing `SellCarFlow` (requires MANAGE_INVENTORY).
- **Customers / Active Leads** → `DealerLeads` (requires MANAGE_CRM).
- **Buy & bid** → existing `Tabs.DealerBuyBid` (requires VIEW_TRADE); the website own-auction vs native live-bidding route semantic discrepancy remains documented for **Block 6**, not secretly altered here.
- **Partner services** → existing `PartnerDashboard` (visible for dealer like web).
- **Performance** → existing `DealerAnalytics` (requires VIEW_ANALYTICS).
- **Active Stock / Vehicles Sold** → existing `DealerInventory` only when VIEW_INVENTORY (native doesn't yet accept website's URL filter); do not falsely claim it prefilters sold stock.
- **Vehicle Views** stays read-only and does not invent a click target.
- Existing dealer phone prompt, KYC/role enforcement, trial environments, native and web shared header/drawer, buyer role switch and all backend pricing/payment/bidding are untouched.

## Evidence and acceptance

Sources inspected: website `src/app/dashboard/dealer/page.tsx`, `src/components/dashboard/FlexiblePeriodControl.tsx`, `src/config/dealerRouteConfig.ts`, native `DealerProfileScreen.tsx`, `MainStackNavigator.tsx`, `useDealerAccess.ts`, `apiClient.ts`. Same-font Poppins/Montserrat and canonical dark brand tokens, 20dp web-matched mobile outer padding (website dealer container `px-5`). New native component `DealerWebParityOverview.tsx` keeps UI isolated from legacy advanced analytics.

Original MP4 recordings referenced in `docs/native/website-visual-parity-recordings-20261010.md` cannot be directly replayed here. Block 1 anonymous website captures are Home/Sell, **not the authenticated dealer Home**. This block **does not assert any screenshots were visually matched**.

### Required screenshot/interaction checklist still OPEN

- [ ] Authenticated synthetic approved dealer owner at 360×800 and 390×844 on both current website and current built Android app, dark theme and identical fake dataset.
- [ ] Header (PRs #476/#479), hero typography, KPI 2-column layout, 5 job rows, truncation, empty/error/loading, scroll, 200% font scale.
- [ ] Period presets, custom days/months/years and compare; validate same backend numbers and range labels with seeded fake values, no zero placeholders on errors.
- [ ] Restricted staff: MANAGE_INVENTORY, MANAGE_CRM, VIEW_TRADE, VIEW_ANALYTICS and VIEW_INVENTORY, including callbacks/deep links, checked against website.
- [ ] Buyer role unaffected, iOS safe-area/type scaling/VoiceOver and Android TalkBack.
- [ ] Current isolated QA APK install/screenshot capturing dealer Home; **prior QA emulator screenshot was only logged-out onboarding**. Avoid real payments, bids, customer data or modifications.
- [ ] Check visual style against the *current authenticated* website, which may support different light/dark appearance; do not claim all-state parity from dark source values alone.

**VISUAL SIGN-OFF: PENDING.** Test green means source/contract changes compile, not native pixel parity. Keep this Block 3 PR isolated, do not touch live website or release distribution. **Revert** only this PR to restore original native first-fold, preserving merged PRs #476, #478 and #479.

**Stop at 30% until user says “proceed.”**
