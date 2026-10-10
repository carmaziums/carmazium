# Issue #477 — Block 4/10: Dealer Stock website-to-native UI parity

Date: 2026-10-10. **40% checkpoint = four planned blocks, NOT a measured visual similarity score.**

## Canonical sources and baseline

- Website: `src/app/dashboard/dealer/inventory/page.tsx` and `src/config/dealerRouteConfig.ts` on main. Website authenticated mobile Stock has a left-aligned Inventory heading, description “Manage live, draft and sold stock,” Add Vehicle/Import Listing/Bulk Import actions beside header, search “Search by make, model, VRM...,” status order ALL / ACTIVE / PENDING_REVIEW / REJECTED / DRAFT / SOLD, mobile cards with 80×64 photos and a 2-column price/status/engagement/hot-leads grid, and desktop table.
- Native: `carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx` is the existing dealer Stock tab. The Block 4 PR is based on main after merged **PR #476** (dealer permissions/navigation), **PR #478** (inventory/evidence), **PR #479** (shared header and More), and **PR #480** (dealer Home).
- Previous user recordings: `az_recorder_20261010_140222.mp4` (native) and `az_recorder_20261010_141055.mp4` (website); prior observations are in `docs/native/website-visual-parity-recordings-20261010.md`. Originals were not directly accessible during this task; do NOT claim any post-change frame comparison.
- Block 1 public website captures are anonymous homepage/valuation; they are NOT authenticated Stock evidence.

## Source-level fixes in Block 4

| Target | Website canonical | Before | Block 4 | Risk / acceptance |
| --- | --- | --- | --- | --- |
| Page title / introduction | Inventory, “Manage live, draft and sold stock” left aligned | Centred Inventory with back circle and dealer count | Left-aligned title/description, view-mode toggle remains right | Source done; authenticated screenshot pending |
| Add / Import | Add Vehicle, Import Listing, Bulk Import in page heading, MANAGE_INVENTORY only | Fixed footer CTA obscured bottom stock rows/dealer navigation | Three permission-gated actions at top, wrapped at narrow widths, no fixed footer | Source done; tap and overflow verification pending |
| Search | Make, model, VRM search | “Search vehicle or registration” and local matching | Website placeholder and local search across title/registration/make/transmission/price/status; full owned listings loaded across pages | Source done; matching dataset needed |
| Status filters | ALL, ACTIVE, PENDING_REVIEW, REJECTED, DRAFT, SOLD | All, Live, Drafts, Review, Sale pending, Rejected, Sold, Other | First six are All, Live, Under Review, Rejected, Draft, Sold; Sale pending/Other preserved behind optional More. Raw statuses map precisely; no provisional state mistaken for SOLD | Source done; filtered fixture counts pending |
| Photo / car facts | 80×64 image, title, VRM, make, mileage | Compact row with 92×68 thumbnail and missing mileage/make | Website-like 80×64 photo with placeholder fallback and title/VRM/make/mileage facts | Source done; image fixture pending |
| Gearbox | User explicitly requires transmission in vehicle cards | No gearbox text in dealer inventory list/grid | Use canonical `formatTransmission(l.transmission)`, showing Manual / Automatic / CVT / Semi-Automatic / **Not specified** (never invent Automatic); list and grid | Source done; compare same record |
| Price/status/engagement/leads | 2-column Market Price, Status, Engagement, Hot Leads grid | Small inline price/view/leads below title | 2×2 metric tiles in list card, status outlined with website labels, rejected reason displayed | Source done; visual pending |
| Hot Leads | Website mobile currently hardcodes “0”, not a trustworthy count | Native already reads real `_count.leads` | Preserve real count rather than introduce website's placeholder zero. **Intentional truthfulness difference** needing web correction separately, not a visual pass | Data correctness protected |
| Sort/list/grid | Desktop table, mobile cards | Native toggle list/grid + price sort | Keep optional native view/price sort for dealer workflows, but DEFAULT list adopts website mobile card pattern; grid now also shows gearbox, registration, mileage, photo fallback | Optional power-user feature; screenshots pending |
| Detail/manage | Existing native detail + edits, auction linked actions, mark-sold confirmation, imports | Working route and role gate | Preserved; no mutation/payment/bidding/verification code changed | Functional regression tests pending |

## Security/data and reversibility

- The existing `fetchAllMyListings` read-only paginated loader is retained; no API routes are changed and all writes still go through the prior role-guarded editor/confirmation flow.
- Stock navigation and access keep `VIEW_INVENTORY` for seeing inventory, `MANAGE_INVENTORY` for adding/editing/importing/auction actions. Do not grant anyone new privileges.
- Actual values for gearbox/mileage/price are mapped from API, not guessed. Unknown gearbox is **Not specified**, no fictitious sales/lead counts. New image fallback shows a car icon, not a broken image or stock photo.
- Existing native item detail, auction cross-link, inline grid mode, sorting, error/retry and pull-to-refresh remain. No changes to production web, backend, KYC, bidding, payment, customer identities, app signing or release distribution.
- **Revert:** revert ONLY this Block 4 PR (or discard its branch); merged PRs #476, #478, #479 and #480 remain untouched.

## Verification

- Node source-contract test: `scripts/test-native-visual-parity-block4.test.mjs` wired to `Release Certification`. It asserts data mapping, primary filters, website text, permissions, action placement, list/grid facts and URL/mutation protections. Typecheck and existing release jobs via GitHub CI.
- **VISUAL SIGN-OFF: PENDING.** There is no approved synthetic authenticated dealer website+native pair at 360×800 and 390×844. iOS screenshots and installed after-change Android screenshots are also unavailable. Passing source tests does NOT prove touch behaviour, exact pixels, or device parity.

### Manual QA acceptance (open)

- [ ] Paired website/native 360×800 and 390×844 captures using SAME synthetic dealer account, identical seed vehicles, Android and iOS, matching theme/scale/scroll.
- [ ] Long titles, private registrations, absent photo/gearbox/mileage, manual/automatic/CVT, large amounts and thousands separators.
- [ ] 6 primary status filters plus two extras, rejected reasons, sold and provisional statuses; counts reflect all fetched paginated records.
- [ ] Text search by make/model/VRM, clear, empty states, network error/retry and pull-to-refresh.
- [ ] View-mode switch/default list layout and optional grid, 200% text scaling and narrow-screen button wrapping; VoiceOver/TalkBack labels.
- [ ] One authenticated synthetic dealer with VIEW_INVENTORY only (cannot mutate), one with MANAGE_INVENTORY (Add/Import actions) and nondealer route refusal.
- [ ] Dealer bottom nav accessible while scrolling; no reintroduced fixed CTA or obscured rows.
- [ ] Test existing draft edit/complete, links and mark-sold **only with disposable staging listings and written approval for those mutations**. Never operate on real customers, KYC, bids or payments.

**STOP at 40%** until next explicit user **proceed**. No Block 5 work in this PR.
