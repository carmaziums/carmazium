# Phase 10: Web Platform Quick Fixes - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Five targeted web-platform fixes: (1) number of owners dropdown with departed sale option, (2) 10-photo minimum enforcement with 100-photo encouragement, (3) counter-offer 5-attempt limit per side with lock and 48h expiry, (4) sold car archiving bug — ensure sold listings feed analytics and appear correctly across the platform. Footer contact info confirmed already correct — excluded from this phase.

</domain>

<decisions>
## Implementation Decisions

### Number of Owners Dropdown
- Options: **1, 2, 3, 4, 5+** (matches AutoTrader / UK standard)
- Field is **required** — seller cannot publish without selecting
- Displayed in the **specs table only** on the listing detail page (no special badge treatment)
- Existing free-text values migrated via best-effort script: `'1'→'1'`, `'2'→'2'`, etc. Unparseable values → `null` (appears as empty dropdown on next seller edit)

### Departed Sale (Deceased Estate)
- **Checkbox below the owners dropdown**: "This is a deceased estate sale"
- When checked, a **free-text field** appears: "Your relationship to the original owner" (e.g. Son, Daughter, Solicitor)
- **Shown to buyers** on the listing detail page as a tasteful badge/note (e.g. "Deceased Estate")

### Photo Minimum & Encouragement
- Minimum: **10 photos** to publish — enforced on **both frontend and backend**
- Maximum: **100 photos** (update from current 20)
- Frontend: Publish button **disabled** until 10 photos uploaded. Counter shown: **'6/10 photos'**
- Once minimum met: counter continues as a **progress bar + motivational label** encouraging more (e.g. "Great start — 10/100 photos. More photos = more buyer trust. Keep going!")
- Counter shown **in the listing form only** — not on draft inventory cards
- Photo minimum applies to **all listing types** — no exceptions (retail, auction, imported)
- **Editing a published listing**: minimum NOT enforced — edits are unrestricted

### Counter-Offer Limit
- Limit: **5 counter-offers per side** (buyer gets 5, seller gets 5 — up to 10 total rounds)
- When either side exhausts their 5 counters: thread locks for that party, other side must **Accept or Decline** (no more counters from the locked side)
- When limit is hit: **banner + greyed counter input + 48h countdown timer** shown in the thread
- Banner text: Buyer side: "Counter limit reached — awaiting seller's final decision." Seller side: "Counter limit reached — you must Accept or Decline."
- **Remaining attempts counter** shown visibly throughout the thread (e.g. "3 counter-offers remaining")
- When limit is reached: **push + in-app notification** to both parties explaining the situation
- 48h window: if seller doesn't respond, offer **auto-expires**
- Once exhausted and seller decides: **final — buyer cannot start a new offer on the same listing**

### Sold Car Archiving & Display
- Sold listings **never deleted** — status set to `SOLD`, `deletedAt` remains `null`
- In seller/dealer inventory: remain in the **same list with a 'SOLD' badge** (no separate tab)
- Seller can **reactivate** a sold listing ('Relist' action) — updates status back to `ACTIVE`
- **Analytics**: All `SOLD` status listings contribute to total income, transaction count, and revenue charts — fix queries to include SOLD status
- **Public listing page**: SOLD listings accessible via URL with a **'SOLD' overlay** — not searchable
- **Buy-car search results**: SOLD listings appear at the **bottom of results with a 'SOLD' badge** (useful for price reference)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/layout/ConditionalFooter.tsx` — footer component (confirmed already correct, no changes needed)
- `backend/src/offers/offers.service.ts` — offers service with `respondToCounterOffer` and offer status logic; needs `counterAttempts` field tracking added
- `backend/src/listings/listings.service.ts` — `status: { in: ['ACTIVE', 'SOLD'] }` filter already exists; analytics queries need auditing
- `backend/src/listings/dto/create-listing.dto.ts` — `owners?: string` field needs to become a typed enum/dropdown value

### Established Patterns
- Offers use `OfferResponseStatus` enum (ACCEPTED, REJECTED, COUNTERED) — new LOCKED_PENDING_DECISION state may be needed
- Listing status uses `'ACTIVE' | 'SOLD' | 'DRAFT'` string enum — sold archiving already partially in place
- Frontend uses disabled button patterns with error states — photo counter follows same pattern

### Integration Points
- Counter attempt tracking: needs a new `counterAttemptsBuyer` and `counterAttemptsSeller` (or combined) column on the `offers` table — requires migration
- Owners dropdown: `owners` column in `listings` table is already a `String?` — dropdown values stored as strings ('1', '2', '3', '4', '5+')
- Departed sale: needs `isDepartedSale Boolean?` and `departedRelationship String?` on `listings` table — requires migration
- Analytics dashboard: `backend/src/dashboard/dashboard.service.ts` and `backend/src/admin/admin.service.ts` — queries need to include SOLD status

</code_context>

<specifics>
## Specific Ideas

- Counter-offer UI: when locked, replace the counter input with a "banner + greyed input + 48h countdown" — the user specifically requested a countdown clock visible to both parties
- Photo encouragement: progress bar + motivational copy ("More photos = more buyer trust") — energetic, not nagging. Max is 100.
- Sold badge on search results: positioned at bottom of search results, same card design as active listings, 'SOLD' badge overlaid

</specifics>

<deferred>
## Deferred Ideas

- None — all items discussed are within Phase 10 scope

</deferred>

---

*Phase: 10-web-platform-quick-fixes*
*Context gathered: 2026-06-20*
