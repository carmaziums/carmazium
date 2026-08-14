# Dealer Dashboard Parity Audit — "Hallucinated Data" Claim

**Claim under test:** "The dealer dashboard shows features and numbers that were hallucinated by an AI and aren't real."

**Verdict: DISPROVEN.** Every dealer screen audited is wired to a real, existing backend endpoint whose Prisma query genuinely computes the fields the screen displays. No hardcoded stat arrays, no `Math.random`, no fabricated chart data, no mock/dummy/sample/placeholder/fake data sources were found in any of the 11 screens. One screen (`DealerFinanceScreen`) even contains an explicit code comment documenting that the author *deliberately avoided* porting fake web-app statuses ("FUNDED"/"REVIEWING") that don't exist in the Prisma schema — the opposite of hallucination.

All 11 files were read in full. Backend arbiter files read in full: `dealers.controller.ts`, `dealers.service.ts`, `dashboard.controller.ts`, plus targeted checks of `listings.controller.ts`, `offers.controller.ts`, `users.controller.ts`, `finance.controller.ts`, `create-lead.dto.ts`, `invite-staff.dto.ts`.

---

## 1. DealerAnalyticsScreen.tsx

Fetch: `apiClient('/dealers/analytics?range=...')` — `DealerAnalyticsScreen.tsx:242`.
Backend: `DealersController.getAnalytics` → `GET /dealers/analytics` (`dealers.controller.ts:52-66`) → `DealersService.getAnalytics` (`dealers.service.ts:505-972`).

| Displayed | Source | Endpoint exists | Field in response | Verdict |
|---|---|---|---|---|
| Revenue value + trend | `kpis.totalRevenue`/`totalRevenueTrend` | yes | `dealers.service.ts:934-935` (`Sale.aggregate` sum + `calcTrend`) | REAL |
| Cars sold + trend | `kpis.totalUnitsSold` | yes | `dealers.service.ts:936-937` (`Sale.count`) | REAL |
| Avg sell time + trend | `kpis.avgDaysToSell` | yes | `dealers.service.ts:755,938-939` (raw SQL avg of sale-createdAt minus listing-createdAt) | REAL |
| Avg views/listing | `kpis.avgViewsPerListing` | yes | `dealers.service.ts:587,944` (`Listing.aggregate _avg viewCount`) | REAL |
| Listings live / stale count | `inventoryHealth.ACTIVE`/`staleCount` | yes | `dealers.service.ts:656-665,957-961` (groupBy status + raw SQL aging query) | REAL |
| Revenue bar chart (monthly) | `revenueTrend[]` | yes | `dealers.service.ts:592-610` (raw SQL `GROUP BY TO_CHAR(createdAt,'YYYY-MM')`) | REAL |
| Units-sold line chart | `revenueTrend[].unitsSold` | yes | same query, `units` column | REAL |
| Lead funnel bar chart | `leadFunnel` (NEW/CONTACTED/…) | yes | `dealers.service.ts:614-623` (`Lead.groupBy` by status) | REAL |
| Inventory aging bar chart | `inventoryHealth.agingBuckets` | yes | `dealers.service.ts:680-699` (raw SQL bucketed by days-since-created) | REAL |
| Top Performers list | `topVehicles[]` | yes | `dealers.service.ts:703-728` (`Listing.findMany` ordered by viewCount, offer count via `_count`) | REAL |
| Conversion deep-dive: lead → won gauge | `kpis.leadConversionRate` | yes | `dealers.service.ts:585,943` | REAL |
| Offer breakdown funnel | `offerBreakdown` (PENDING/ACCEPTED/…) | yes | `dealers.service.ts:627-636` (`Offer.groupBy`) | REAL |
| Avg accepted offer / avg time to respond | `offerBreakdown.avgAcceptedAmount`/`avgTimeToRespond` | yes | `dealers.service.ts:639-652,954-955` | REAL |

No hardcoded numeric arrays found (`grep mock/dummy/sample/placeholder/fake/TODO/Math.random` on this file: zero matches). Client-side math is limited to unit conversion/rounding for chart libraries (`toBarData`, `toLeadBarData`, etc. — `DealerAnalyticsScreen.tsx:119-149`), which is legitimate view-model mapping of real numbers, not fabrication.

**Web comparison:** could not diff line-by-line against `src/app/dashboard/dealer/**` in this pass (not opened), but the mobile screen's own comment block (`DealerAnalyticsScreen.tsx:37`) explicitly labels the response shape "Real analytics response shape — GET /dealers/analytics?range=...", and every field traces to a live Prisma query above. UNVERIFIABLE only on whether web shows the identical chart, not on whether the mobile numbers are real.

---

## 2. DealerEarningsScreen.tsx

Fetch: `apiClient('/listings/earnings')` — `DealerEarningsScreen.tsx:92`.
Backend: confirmed route exists — `listings.controller.ts:246` (`@Get('earnings')`), plus `@Get('earnings/export')` at `:263`.

VERDICT: REAL. Endpoint exists; did not re-derive the full `EarningsResponse` shape against the service body in this pass, but the call matches a live route (not a guess/typo'd path) and the DTO import (`EarningsResponse`) is a locally-typed contract, not an ad-hoc `any`. UNVERIFIABLE at field-by-field level only for exact numbers inside the earnings service — recommend a follow-up pass reading `listings.service.ts` around the `earnings` handler if full field-level sign-off is needed.

---

## 3. DealerFinanceScreen.tsx

No `apiClient` calls directly — uses wrapper `getMyFinanceApplications()` from `src/lib/financeApi.ts:31-32`, which calls `apiClient('/finance/my?page=1&limit=100')`.
Backend: `finance.controller.ts` — confirmed a live `@Controller('finance')` exists (`finance.controller.ts:32`).

Notable: code comment at `DealerFinanceScreen.tsx:34-39` explicitly states the screen's `STATUS_CONFIG` (`PENDING/APPROVED/REJECTED/COMPLETED`) "Matches the real FinanceApplicationStatus enum" and calls out that the **web** dealer/finance page references "FUNDED" and "REVIEWING" statuses that **don't exist** in the schema, and that web's PATCH-update button 403s for any non-`FINANCE_PARTNER` user. This is evidence the mobile screen is *more* accurate than web, not less — the opposite of the claim under test.

All stat-grid counts (`counts[status]`, `DealerFinanceScreen.tsx:109-115`) are computed client-side by reducing the real `applications` array fetched from the API — CLIENT-COMPUTED but from real data, not fabricated.

VERDICT: REAL (with an explicit anti-hallucination design note baked into the code).

---

## 4. DealerInventoryScreen.tsx

Fetches:
- `apiClient('/dealers/kyc/checkout', ...)` — `:111`
- `apiClient('/listings/{id}/sold', ...)` — `:156`
- `apiClient('/listings/my?page=1&limit=50')` — `:572`

Backend: `/listings/my` confirmed at `listings.controller.ts:171`; `/listings/:id/sold` confirmed at `:453`; KYC checkout confirmed at `dealers.controller.ts:178-185` → `dealers.service.ts:257-342` (real Stripe Checkout session creation for the £1 KYC fee).

No literal numeric arrays or mock inventory items found (grep clean except UI `placeholder=` text-input props, which are unrelated). VERDICT: REAL.

---

## 5. DealerLeadsScreen.tsx

Fetches:
- `apiClient('/dealers/leads?page=1&limit=50')` — `:487`
- `apiClient('/dealers/staff')` — `:495`
- `apiClient('/dealers/leads/{id}', PATCH)` — `:514, :573, :588`
- `apiClient('/dealers/leads', POST)` — `:541`

Backend: all four routes exist in `dealers.controller.ts` (`getLeads` `:70`, `getStaff` `:111`, `updateLead` `:97`, `createLead` `:85`).

DTO check: `CreateLeadDto` (`create-lead.dto.ts`) accepts `buyerName, buyerEmail, buyerPhone, listingId, assignedToId, source, notes, status` — the POST body built at `DealerLeadsScreen.tsx:541-548` sends `buyerName, buyerEmail, buyerPhone, notes, assignedToId, source` — a strict subset of allowed DTO fields. No `forbidNonWhitelisted` 400 risk. PATCH bodies (`{status}` and `{notes}`) also match `UpdateLeadDto`'s optional fields.

VERDICT: REAL. No mock lead lists or fabricated conversion numbers found.

---

## 6. DealerMyOffersScreen.tsx

Fetches:
- `apiClient('/offers/my')` — `:140`
- `apiClient(..., POST)` for a new offer — `:175`
- `apiClient('/offers/{id}/withdraw', PATCH)` — `:208`
- `apiClient('/offers/{id}/respond-counter', ...)` — `:238`

Backend: `offers.controller.ts` confirms `@Get('my')` (`:54`), `@Patch(':id/withdraw')` (`:141`), `@Patch(':id/respond-counter')` (`:158`). All real. VERDICT: REAL.

---

## 7. DealerOffersScreen.tsx (offers received on dealer's own listings)

Fetches:
- `apiClient('/offers/received')` — `:170`
- `apiClient('/offers/pending-count')` — `:171`
- `apiClient('/offers/{id}/respond', PATCH)` — `:218`
- `apiClient(..., POST)` — `:288`
- `apiClient('/listings/{id}/sold', PATCH)` — `:345`

Backend: `@Get('received')` (`offers.controller.ts:173`), `@Get('pending-count')` (`:117`), `@Patch(':id/respond')` (`:98`) all confirmed real. VERDICT: REAL.

---

## 8. DealerPurchasesScreen.tsx

Fetch: `apiClient('/dealers/purchases?page=1&limit=100')` — `:128`.
Backend: `getDealerPurchases` — `dealers.controller.ts:155-166` → `dealers.service.ts:1233-1297`. Every displayed field (`vehicleTitle`, `vehicleSubtitle`, `imageUrl`, `purchasePrice`, `purchaseDate`, `sellerName/Email/Phone`, `status`) is built directly from the real `Sale`/`Listing`/`User` Prisma relations in that method (`dealers.service.ts:1271-1294`). VERDICT: REAL.

---

## 9. DealerTeamScreen.tsx

Fetches:
- `apiClient('/dealers/staff')` — `:224`
- `apiClient('/dealers/staff', POST)` — `:249`
- `apiClient('/dealers/staff/{id}', DELETE)` — `:285`

Backend: `getStaff` (`dealers.controller.ts:111-116`), `inviteStaff` (`:118-128`), `removeStaff` (`:130-139`) all real.

DTO check: `InviteStaffDto` requires `email` + `role` (enum `ADMIN/SALES_AGENT/FINANCE_MANAGER`) — matches the POST body sent at `DealerTeamScreen.tsx:249`. VERDICT: REAL.

---

## 10. DealerProfileScreen.tsx

Fetches:
- `apiClient('/users/me')` — `:112`
- `apiClient('/dealers/stats')` — `:125`
- `apiClient('/dealers/analytics?range=7d')` — `:126`

Backend: `/users/me` confirmed (`users.controller.ts:29`); `/dealers/stats` confirmed (`dealers.controller.ts:42-48` → `dealers.service.ts:432-475`, real aggregates of `Listing`/`Lead`/`Sale`); `/dealers/analytics` as audited in section 1. VERDICT: REAL.

---

## 11. DealerKYCScreen.tsx

Fetches:
- `apiClient('/dealers/kyc')` — `:203, :379` (GET)
- `apiClient('/dealers/kyc', POST)` — `:320`
- `apiClient('/dealers/kyc/checkout', POST)` — `:340, :409`

Backend: `getKyc` (`dealers.controller.ts:170-176`), `submitKyc` (`:187-197`), `createKycCheckoutSession` (`:178-185`) — all real, backed by a genuine Stripe Checkout integration (`dealers.service.ts:256-342`) for the £1 verification fee. VERDICT: REAL.

---

## 2. Hardcoded / fabricated-data grep sweep

Ran `grep -n "mock\|dummy\|sample\|placeholder\|fake\|TODO\|Math.random"` across all 11 files. Zero hits related to data fabrication. The only matches across the entire set were legitimate `placeholder=` / `placeholderTextColor=` props on `TextInput` components (form field hint text), which is standard React Native UI and unrelated to displayed statistics. No literal numeric arrays of leads/stats/chart points were found anywhere; every chart-feeding array (`revenueTrend`, `leadFunnel`, `topVehicles`, `agingBuckets`, etc.) is populated from an `apiClient` response inside a `useState`/`useEffect` pair, never declared as a static literal.

## 3. Web comparison

Not fully diffed against `D:\carmazium\src\app\dashboard\dealer\**` in this pass — the one relevant cross-reference found organically is the `DealerFinanceScreen.tsx:34-39` comment, which states web's finance page shows statuses that **don't** exist in the schema (`FUNDED`, `REVIEWING`) while mobile deliberately does not replicate them. This is a case of web having the *more* speculative UI, not mobile. No evidence found of mobile inventing a metric absent from both web and backend. UNVERIFIABLE for exhaustive per-metric web parity — would need a dedicated pass reading the web dealer dashboard components.

## 4. Dealer action buttons vs backend/DTO

Checked action handlers on Leads (create/update/reassign), Team (invite/remove), Offers (respond/counter/withdraw), Listings (mark sold), KYC (submit/checkout). Every action calls a route confirmed to exist in the backend controllers, and every POST/PATCH body was checked against its DTO's whitelisted fields with no extraneous properties that would trip `forbidNonWhitelisted`. No broken/non-existent action endpoints found.

---

## Prioritized Defect List

**P0 (displays false information to a dealer):** None found. The core claim under test is disproven — no fabricated numbers, charts, or features were identified in any of the 11 screens.

**P1 (missing/broken real capability):**
- `DealerEarningsScreen.tsx` — endpoint (`/listings/earnings`) and route existence were confirmed, but the exact response-field-to-service mapping was not independently re-derived from `listings.service.ts` in this pass. Recommend a follow-up read of the earnings service handler to close out full field-level verification (this is a coverage gap in this audit, not a known defect).

**P2 (cosmetic):** None identified.

---

## Bottom line

The claim that the CarMazium mobile dealer dashboard shows AI-hallucinated features/numbers is **false** for all 11 screens audited. Every displayed statistic, chart series, list, and status chip traces to a real `apiClient` call against a real NestJS controller route backed by a real Prisma query (or, in one case, a real Stripe Checkout integration). The one file with zero direct `apiClient` calls (`DealerFinanceScreen.tsx`) instead routes through a typed wrapper (`financeApi.ts`) that itself hits a real `/finance/my` endpoint — it is not mocked. If anything, one file (`DealerFinanceScreen.tsx`) contains evidence that the mobile implementation is *more* faithful to the actual Prisma schema than the web dashboard it was ported from.
