# Phase 10: Web Platform Quick Fixes — Research

**Researched:** 2026-06-20
**Domain:** NestJS/Prisma backend + Next.js 15 frontend — targeted fixes across 4 feature areas
**Confidence:** HIGH — all findings sourced directly from codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Number of Owners Dropdown**
- Options: 1, 2, 3, 4, 5+ (matches AutoTrader / UK standard)
- Field is required — seller cannot publish without selecting
- Displayed in the specs table only on the listing detail page (no special badge treatment)
- Existing free-text values migrated via best-effort script: `'1'→'1'`, `'2'→'2'`, etc. Unparseable values → null

**Departed Sale (Deceased Estate)**
- Checkbox below the owners dropdown: "This is a deceased estate sale"
- When checked, a free-text field appears: "Your relationship to the original owner"
- Shown to buyers on the listing detail page as a tasteful badge/note ("Deceased Estate")

**Photo Minimum & Encouragement**
- Minimum: 10 photos to publish — enforced on both frontend and backend
- Maximum: 100 photos (update from current 20/30)
- Frontend: Publish button disabled until 10 photos uploaded. Counter shown: '6/10 photos'
- Once minimum met: counter continues as a progress bar + motivational label
- Counter shown in the listing form only — not on draft inventory cards
- Photo minimum applies to all listing types — no exceptions
- Editing a published listing: minimum NOT enforced — edits are unrestricted

**Counter-Offer Limit**
- Limit: 5 counter-offers per side (buyer 5, seller 5 — up to 10 total rounds)
- When either side exhausts their 5 counters: thread locks for that party
- When limit is hit: banner + greyed counter input + 48h countdown timer shown
- Banner text: Buyer side: "Counter limit reached — awaiting seller's final decision." Seller side: "Counter limit reached — you must Accept or Decline."
- Remaining attempts counter shown visibly throughout the thread
- When limit is reached: push + in-app notification to both parties
- 48h window: if seller doesn't respond, offer auto-expires
- Once exhausted and seller decides: final — buyer cannot start a new offer on the same listing

**Sold Car Archiving & Display**
- Sold listings never deleted — status set to SOLD, deletedAt remains null
- In seller/dealer inventory: remain in the same list with a 'SOLD' badge (no separate tab)
- Seller can reactivate a sold listing ('Relist' action) — updates status back to ACTIVE
- Analytics: All SOLD status listings contribute to total income, transaction count, revenue charts
- Public listing page: SOLD listings accessible via URL with a 'SOLD' overlay — not searchable
- Buy-car search results: SOLD listings appear at the bottom of results with a 'SOLD' badge

### Claude's Discretion
- None specified — all items are locked

### Deferred Ideas (OUT OF SCOPE)
- Footer contact info — confirmed already correct, excluded from this phase
</user_constraints>

---

## Summary

Phase 10 makes four targeted changes to the web platform, all of which are surgical modifications to existing code rather than new subsystems. The codebase is well-structured and the findings below precisely identify where each change must be made.

**Feature 1 (Owners Dropdown):** The `owners` field already exists as `String?` on the `Listing` model in Prisma and propagates through `create-listing.dto.ts` and `ListingWizard.tsx`. The wizard currently renders a 3-option button group (1, 2, 3+). The change is: expand to 5 options (1, 2, 3, 4, 5+), add `isDepartedSale Boolean?` and `departedRelationship String?` columns via migration, add the conditional checkbox/text field in the wizard, and render on the detail page.

**Feature 2 (Photo Minimum):** `ImageUpload.tsx` currently has `maxImages = 30` default. The wizard passes no explicit max so it takes the default. `ListingWizard.tsx` step 2 validation is `formData.images.length > 0` — the entire min enforcement is absent. Changes are: update `maxImages` to 100, add a count display and progress bar in the wizard Step 2, enforce `>= 10` in the wizard's `isStepValid` function, and add a backend guard in `create-listing.dto.ts` + `listings.service.ts` `publishListing()`.

**Feature 3 (Counter-Offer Limit):** The `offers.service.ts` currently has no tracking of counter round counts. The `respondToOffer` and `respondToCounterOffer` methods work fine for 1-round counter-offers but do not accumulate attempt counts. The root of the "breaks after 1-2 interactions" bug is that after `respondToOffer` sets status=COUNTERED, `respondToCounterOffer` can only respond ACCEPT or REJECT — there is no path for the buyer to issue a new counter-offer amount back. The system is structurally a single back-and-forth, not a multi-round negotiation. Fixing this requires adding `counterAttemptsBuyer Int @default(0)` and `counterAttemptsSeller Int @default(0)` to the `Offer` model, a `counterExpiresAt DateTime?` field, and extending the service logic. A new `COUNTER_RECEIVED` notification type variant is needed for the 48h expiry.

**Feature 4 (Sold Car Archiving):** The DB and most service methods already handle SOLD correctly. `findAll()` already includes `status: { in: ['ACTIVE', 'SOLD'] }` and orders SOLD listings last via `{ status: 'asc' }`. The `updateStatus()` method already creates a `Sale` row on SOLD transition. The main gaps are: (a) `findMyListings()` defaults to `status: { not: 'SOLD' }` — the inventory tabs need to pass `includeSold: true`, (b) a "Relist" action is missing from the frontend inventory card, (c) the listing detail page needs a SOLD overlay when `listing.status === 'SOLD'`, and (d) analytics queries in `dashboard.service.ts` pull revenue from the `Sale` table (already correct) but the `getSellerStats` and `getUnifiedDashboard` need audit.

**Primary recommendation:** Execute as 4 independent waves, each with its own migration file. Waves do not depend on each other and can be developed in any order, but migrations must be applied sequentially.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | Already installed | DB migrations, ORM | Established pattern in this project |
| NestJS class-validator | Already installed | DTO validation | Existing pattern for backend guards |
| Next.js 15 | Already installed | Frontend framework | Existing |
| Tailwind v4 | Already installed | Styling | Existing |

### No New Dependencies Required
All four features are achievable with libraries already in the project. The counter-offer expiry via 48h timeout can be handled with a scheduled check using NestJS `@nestjs/schedule` (if installed) or a simpler approach: store `counterExpiresAt` on the offer and check it on every read/respond attempt. A cron approach is optional; check-on-read is sufficient for this phase.

**Check if @nestjs/schedule is already installed:**
```bash
grep "@nestjs/schedule" backend/package.json
```

---

## Architecture Patterns

### Recommended Project Structure for Changes

```
backend/prisma/
├── migrations/
│   └── YYYYMMDDHHMMSS_phase10_owners_departed_counter_tracking/
│       └── migration.sql

backend/src/
├── offers/
│   ├── offers.service.ts         ← counter attempt tracking, 48h expiry
│   └── dto/respond-offer.dto.ts  ← extend with counter amount for buyer re-counter
├── listings/
│   ├── listings.service.ts       ← photo min guard in publishListing()
│   ├── dto/create-listing.dto.ts ← isDepartedSale, departedRelationship fields
│   └── dto/update-listing.dto.ts ← same new fields

src/
├── components/listing/
│   ├── ListingWizard.tsx          ← owners dropdown, departed sale, photo min
│   └── ImageUpload.tsx            ← maxImages=100 default update
├── app/buy-cars/[slug]/page.tsx   ← SOLD overlay, departed sale badge, owners display
├── app/dashboard/user/page.tsx    ← Relist action, SOLD badge in inventory
├── app/dashboard/dealer/inventory/page.tsx ← Relist action, SOLD badge
```

### Pattern 1: Prisma Migration for New Columns

```prisma
// Add to Offer model in schema.prisma
counterAttemptsBuyer  Int       @default(0)
counterAttemptsSeller Int       @default(0)
counterExpiresAt      DateTime?

// Add to Listing model in schema.prisma
isDepartedSale        Boolean?
departedRelationship  String?
```

Migration command: `npx prisma migrate dev --name phase10_counter_tracking_departed_sale`

### Pattern 2: Counter Attempt Enforcement in offers.service.ts

The current `respondToOffer` (seller counters) and `respondToCounterOffer` (buyer responds) need to be extended. The core issue is that **buyer counter-offers are not currently supported** — `respondToCounterOffer` only allows ACCEPT or REJECT. To support up to 5 rounds per side, the flow needs to be:

```
Round N:
1. Seller counters → status=COUNTERED, counterAttemptsSeller++, counterExpiresAt = now+48h
2. Buyer can: ACCEPT, REJECT, or COUNTER (new path) → if COUNTER: status=COUNTERED, counterAttemptsBuyer++, counterExpiresAt = now+48h
3. Seller can: ACCEPT, REJECT, or COUNTER again (if < 5) → etc.
```

The existing `OfferStatus.COUNTERED` state is used by both sides. The direction of "whose turn it is" is not tracked in the current schema. Adding a `lastCounteredBy: 'BUYER' | 'SELLER'` field or using the existing `sellerCounterAmount` vs `buyerCounterAmount` fields as a proxy resolves this.

**Existing negotiation fields already on the Offer model:**
- `sellerCounterAmount Decimal?` — set when seller counters
- `buyerCounterAmount Decimal?` — exists but currently never set
- `counterAmount Decimal?` — legacy, kept for backwards compatibility
- `initialAmount Decimal?` — buyer's opening offer
- `finalAmount Decimal?` — set on acceptance

**Recommended approach:** Use `sellerCounterAmount` and `buyerCounterAmount` to determine whose turn it is. When `status=COUNTERED`, if `sellerCounterAmount` was last updated, it's buyer's turn and vice versa.

**New respondToCounterOffer flow (buyer re-counters):**
```typescript
// In respondToCounterOffer, add COUNTERED as valid buyer response
if (status === OfferResponseStatus.COUNTERED) {
  if (offer.counterAttemptsBuyer >= 5) {
    throw new BadRequestException('You have reached your counter-offer limit.');
  }
  return await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'COUNTERED',
      buyerCounterAmount: counterAmount,
      counterAmount: counterAmount,  // keep in sync
      counterAttemptsBuyer: { increment: 1 },
      counterExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    }
  });
}
```

**Expiry check — check-on-read pattern:**
```typescript
// At the top of respondToOffer and respondToCounterOffer:
if (offer.counterExpiresAt && offer.counterExpiresAt < new Date() && offer.status === 'COUNTERED') {
  await prisma.offer.update({ where: { id: offerId }, data: { status: 'REJECTED' } });
  throw new BadRequestException('This offer has expired after the 48-hour window.');
}
```

### Pattern 3: Photo Minimum in ListingWizard.tsx

Current step 2 validation is on line 482:
```typescript
case 2: return formData.images.length > 0
```

Change to:
```typescript
// When creating (not editing):
case 2: return editId ? formData.images.length > 0 : formData.images.length >= 10
```

Progress bar component to add above ImageUpload in step 2:
```tsx
const photoCount = formData.images.length
const MIN_PHOTOS = 10
const MAX_PHOTOS = 100
const isMinMet = photoCount >= MIN_PHOTOS
const progressPct = Math.min((photoCount / MAX_PHOTOS) * 100, 100)

// Counter label — "6/10 photos" until met, then motivational
const label = !isMinMet
  ? `${photoCount}/${MIN_PHOTOS} photos — ${MIN_PHOTOS - photoCount} more required to publish`
  : `${photoCount}/${MAX_PHOTOS} photos — More photos = more buyer trust. Keep going!`
```

### Pattern 4: Owners Dropdown — Expand to 5 Options

Current code in `ListingWizard.tsx` lines 1865-1881 renders 3 button options. Replace with 5:

```tsx
{(['1','2','3','4','5+'] as const).map(opt => (
  <button key={opt} onClick={() => set("owners", opt)} ...>
    {opt === '5+' ? '5+ Owners' : `${opt} Owner${opt !== '1' ? 's' : ''}`}
  </button>
))}
```

Also add below the owners section, conditionally:
```tsx
{/* Departed Sale */}
<div className="flex items-center gap-3 mt-3">
  <input type="checkbox" checked={formData.isDepartedSale}
    onChange={e => set("isDepartedSale", e.target.checked)} />
  <label>This is a deceased estate sale</label>
</div>
{formData.isDepartedSale && (
  <Input placeholder="Your relationship to the original owner (e.g. Son, Solicitor)"
    value={formData.departedRelationship}
    onChange={e => set("departedRelationship", e.target.value)} />
)}
```

### Pattern 5: Relist Action for SOLD Listings

The backend `update()` method in `listings.service.ts` already handles `status: 'ACTIVE'` transitions. The frontend just needs a "Relist" button in the inventory card when `listing.status === 'SOLD'`, calling `PATCH /listings/:id/status` with `{ status: 'ACTIVE' }`.

The `findMyListings` call needs `includeSold: true` added to the filter — this parameter already exists in `ListingFilterDto` and is already handled in the service:
```typescript
// Current default behaviour (line 1158-1160):
if (!filterDto?.includeSold) {
  where.status = { not: 'SOLD' };
}
```
So passing `?includeSold=true` from the frontend is all that's needed.

### Anti-Patterns to Avoid

- **Do NOT add a new `LOCKED` OfferStatus enum value.** The locked state is derived: `counterAttemptsBuyer >= 5` or `counterAttemptsSeller >= 5`. A new enum value would break existing offer status checks across 4+ files.
- **Do NOT enforce photo minimum on edits.** The CONTEXT.md explicitly says editing a published listing is unrestricted.
- **Do NOT use deletedAt for sold listings.** The phase decision is `deletedAt` remains `null` — the SOLD status alone signals the car is sold.
- **Do NOT create a new 'owners' Prisma enum.** The values '1', '2', '3', '4', '5+' are stored as strings in the existing `String?` column. No migration is needed for the column itself.
- **Do NOT add a separate analytics endpoint for SOLD.** Revenue already comes from the `Sale` table (correct). The fix is ensuring the inventory UI passes `includeSold=true`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 48h offer expiry timer | Background cron job / queue | Check-on-read in service methods | Cron requires @nestjs/schedule setup; check-on-read is zero infrastructure and sufficient for this volume |
| Counter attempt tracking UI | Complex state machine | Two Int columns + derived boolean | Simple and matches existing pattern of field-level tracking |
| SOLD badge styling | New CSS class | Existing `STATUS_COLORS.SOLD` in dealer inventory page (already defined: `"bg-blue-500/10 text-blue-400 border-blue-500/20"`) | Pattern already exists |
| Photo progress bar | Custom chart library | Native `<div>` with `style={{ width: progressPct + '%' }}` | No library needed for a simple progress bar |

---

## Common Pitfalls

### Pitfall 1: Migration Order Matters
**What goes wrong:** Deploying the backend code that reads `counterAttemptsBuyer` before the migration runs causes a Prisma runtime error (`Unknown field`).
**Why it happens:** Prisma generates the client at build time from the schema; if the DB doesn't have the column yet, queries fail.
**How to avoid:** Migration must be applied to the database before the backend is deployed. On Fly.io (`carmazium-hjoh9w.fly.dev`), run `npx prisma migrate deploy` in the release command or via `fly ssh console`.
**Warning signs:** `PrismaClientKnownRequestError: Unknown argument` in backend logs.

### Pitfall 2: Buyer Cannot Currently Re-Counter
**What goes wrong:** `respondToCounterOffer` only accepts ACCEPTED or REJECTED — passing COUNTERED will set the offer to COUNTERED but never update `counterAmount`, leaving an inconsistent state.
**Why it happens:** The original design was a single counter-offer exchange, not multi-round.
**How to avoid:** Add explicit handling for `OfferResponseStatus.COUNTERED` in `respondToCounterOffer` with a `counterAmount` parameter, parallel to `respondToOffer`.

### Pitfall 3: `findMyListings` Default Excludes SOLD
**What goes wrong:** After the "Relist" feature is added, a relisted car might not reappear in the seller's inventory because the frontend wasn't passing `includeSold=true` and filtered it out before relist.
**Why it happens:** Line 1158-1160 in `listings.service.ts`: `where.status = { not: 'SOLD' }` is the default.
**How to avoid:** Pass `?includeSold=true` when fetching inventory on the seller and dealer dashboard pages. On relist success, the status changes to ACTIVE — the listing will then naturally appear without `includeSold`.

### Pitfall 4: ImageUpload maxImages Prop Not Passed
**What goes wrong:** `ListingWizard.tsx` calls `<ImageUpload onImagesChange=... onDamageImageCountChange=...>` with no `maxImages` prop, so the component uses its `maxImages = 30` default. Raising max to 100 requires passing `maxImages={100}` explicitly from the wizard call site.
**Why it happens:** The prop is optional with a default; the wizard never overrides it.
**How to avoid:** Update the `<ImageUpload>` call in `ListingWizard.tsx` step 2 to include `maxImages={100}`.

### Pitfall 5: Counter Expiry Race Condition on Concurrent Responses
**What goes wrong:** Two simultaneous calls (buyer and seller both respond at the same ms) could both pass the expiry check, then both update the offer, leaving an inconsistent final state.
**Why it happens:** Optimistic check-then-write without a DB-level lock.
**How to avoid:** Wrap the expiry + update in a Prisma `$transaction`. This matches the existing pattern in `updateStatus()` and `recordSale()`.

### Pitfall 6: OfferStatus `COUNTERED` Ambiguity — Whose Turn?
**What goes wrong:** Both seller and buyer counters result in `status=COUNTERED`. Without tracking whose turn it is, both the seller and buyer could try to "respond" to a COUNTERED offer at the same time, causing double-counter.
**Why it happens:** The status field doesn't encode direction.
**How to avoid:** Check `sellerCounterAmount` vs `buyerCounterAmount` to determine the active side, or add an explicit `lastCounteredBy` string field. The simpler solution: only allow `respondToOffer` (seller endpoint) when the offer was countered by the buyer (`buyerCounterAmount` was just updated), and only allow `respondToCounterOffer` (buyer endpoint) when the offer was countered by the seller (`sellerCounterAmount` was just updated).

### Pitfall 7: Search Results Already Include SOLD — Verify Order
**What goes wrong:** `findAll()` already includes SOLD in the status filter and sorts SOLD last. If the SOLD overlay is added to the `CarCard` component but the card component doesn't receive `status` as a prop, the badge won't render.
**Why it happens:** The `CarCard` component may not currently render a SOLD badge.
**How to avoid:** Check `CarCard.tsx` to confirm it receives and renders `listing.status`. If not, add `status` to the card's displayed data.

---

## Code Examples

### Prisma Schema Additions

```prisma
// Offer model — add these three fields
model Offer {
  // ... existing fields ...
  counterAttemptsBuyer  Int       @default(0)
  counterAttemptsSeller Int       @default(0)
  counterExpiresAt      DateTime?
  lastCounteredBy       String?   // 'BUYER' | 'SELLER'
}

// Listing model — add these two fields
model Listing {
  // ... existing fields ...
  isDepartedSale       Boolean?
  departedRelationship String?
}
```

### Backend: Photo Minimum Guard (listings.service.ts publishListing)

The `publishListing` method at line 768 currently only checks listing tier/payment status. Add:

```typescript
// After the listing is fetched, before tier checks:
if (!editMode && listing.images.length < 10) {
  throw new BadRequestException(
    `Listings require at least 10 photos before publishing. You have ${listing.images.length}.`
  );
}
```

Note: `publishListing` is called by the Stripe webhook path and by the seller dashboard. The "not edit mode" check must be derived from context — the publish endpoint is only called for new publications, never for edits, so the guard can be unconditional on this endpoint.

### Frontend: SOLD Overlay on Listing Detail Page

In `src/app/buy-cars/[slug]/page.tsx`, add immediately after the hero image section:

```tsx
{listing.status === 'SOLD' && (
  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
    <div className="bg-blue-600/90 text-white font-black text-4xl px-10 py-5 rounded-2xl uppercase tracking-widest shadow-2xl border border-blue-400/30">
      SOLD
    </div>
  </div>
)}
```

### Frontend: Relist Action

In both `src/app/dashboard/user/page.tsx` (InventoryTab) and `src/app/dashboard/dealer/inventory/page.tsx`, add to the listing card action dropdown when `listing.status === 'SOLD'`:

```tsx
{listing.status === 'SOLD' && (
  <button onClick={() => handleRelist(listing.id)} className="...">
    <RefreshCw size={14} /> Relist
  </button>
)}
```

API call: `PATCH /listings/:id/status` with body `{ status: 'ACTIVE' }`. The existing `updateStatus` endpoint and service method already handle ACTIVE transitions from SOLD.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `images.length > 0` for step 2 validation | `images.length >= 10` (new) | Phase 10 | Sellers can no longer publish with 1 photo |
| 3-option owners widget (1, 2, 3+) | 5-option dropdown (1, 2, 3, 4, 5+) | Phase 10 | Closer to AutoTrader standard |
| Single-round counter-offer | Up to 5 rounds per side | Phase 10 | Multi-round negotiation enabled |
| SOLD listings excluded from seller inventory | SOLD listings shown with badge + Relist action | Phase 10 | Sellers can see full history and relist |

---

## Open Questions

1. **Does `@nestjs/schedule` need installing for the 48h offer expiry?**
   - What we know: Check-on-read pattern is sufficient for expiry enforcement
   - What's unclear: Whether the product wants proactive push notifications when offers expire (vs. discovering on next load)
   - Recommendation: Implement check-on-read first. If proactive expiry notifications are desired, add a cron task as a follow-up. The CONTEXT.md says "auto-expires after 48h" but doesn't specify a push notification for expiry itself — only for when the limit is first reached.

2. **Where is the buyer's counter-offer UI rendered?**
   - What we know: `respondToCounterOffer` is called from `src/app/dashboard/user/page.tsx` OutgoingOffersTab. The current UI shows ACCEPT/REJECT buttons for COUNTERED offers.
   - What's unclear: The exact component rendering those buttons needs to be found and extended with a counter-offer amount input.
   - Recommendation: Search `respondToCounterOffer` in the frontend and locate the component.

3. **CarCard component: does it currently render a SOLD badge?**
   - What we know: `CarCard` is used in search results. The `findAll()` query returns SOLD listings already.
   - What's unclear: Whether `CarCard.tsx` renders a status badge or not.
   - Recommendation: Read `src/components/features/CarCard.tsx` before planning the search results task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No automated test suite detected (no jest.config at project root, no test/ directory in frontend or backend) |
| Config file | None — Wave 0 should add at minimum smoke test scripts |
| Quick run command | Manual browser verification + API tool (curl/Postman) |
| Full suite command | Manual end-to-end verification checklist |

### Phase Requirements to Test Map

| Req | Behavior | Test Type | How to Verify |
|-----|----------|-----------|---------------|
| OWNERS-01 | Owners dropdown renders 5 options (1, 2, 3, 4, 5+) in wizard | Manual UI | Open /sell, reach Step 1, confirm 5 options present |
| OWNERS-02 | Owners field required — publish blocked without selection | Manual UI | Attempt to publish with no owners selected, expect publish button disabled |
| OWNERS-03 | Departed sale checkbox + relationship field renders | Manual UI | Check "deceased estate sale", confirm text field appears |
| OWNERS-04 | Departed estate badge shows on listing detail page | Manual UI | Create listing with isDepartedSale=true, view detail page |
| OWNERS-05 | Migration: isDepartedSale + departedRelationship columns exist | Backend | `SELECT column_name FROM information_schema.columns WHERE table_name='listings'` |
| PHOTO-01 | Photo counter shows X/10 before minimum met | Manual UI | Upload 6 photos in wizard, confirm "6/10 photos" counter |
| PHOTO-02 | Publish button disabled below 10 photos | Manual UI | Try to advance from Step 2 with 9 photos — should be blocked |
| PHOTO-03 | Progress bar + motivational label shown after 10 photos | Manual UI | Upload 12 photos, confirm motivational label and progress bar |
| PHOTO-04 | Backend rejects publish with < 10 photos | API | `POST /listings/:id/publish` with listing having 5 images → expect 400 |
| PHOTO-05 | Max raised to 100 — 31st photo accepted | Manual UI | Upload 31 photos (previously blocked at 30) |
| PHOTO-06 | Edit mode: no photo minimum enforced | Manual UI | Edit an active listing with 3 photos — should not block save |
| COUNTER-01 | counterAttemptsBuyer + counterAttemptsSeller columns exist | Backend | Check Prisma schema + DB column query |
| COUNTER-02 | Seller can counter up to 5 times | API | Call `PATCH /offers/:id/respond` with COUNTERED 6 times as seller → 6th should 400 |
| COUNTER-03 | Buyer can re-counter (new capability) | API | After seller counters, buyer can `PATCH /offers/:id/counter-respond` with COUNTERED + amount |
| COUNTER-04 | Remaining attempts count shown in thread UI | Manual UI | Open offer thread as buyer, confirm "X counter-offers remaining" text |
| COUNTER-05 | Banner shown when limit reached | Manual UI | Exhaust 5 counters as buyer, confirm greyed input + banner |
| COUNTER-06 | 48h countdown shown after limit reached | Manual UI | After limit reached, confirm countdown timer visible |
| COUNTER-07 | Push + in-app notification sent when limit hit | Manual + Backend logs | Exhaust counters, check notifications table and push delivery |
| COUNTER-08 | Offer auto-expires after 48h if no response | API | Set `counterExpiresAt` to past in DB, attempt to respond → expect 400 |
| COUNTER-09 | Buyer cannot make new offer on same listing after exhaustion | API | After exhaustion + seller decision, `POST /offers` on same listing as same buyer → 400 |
| SOLD-01 | Sold listings appear in seller inventory with SOLD badge | Manual UI | Mark listing as sold, open inventory — listing visible with SOLD badge |
| SOLD-02 | Relist action changes status back to ACTIVE | Manual UI + API | Click Relist on SOLD listing, confirm status becomes ACTIVE |
| SOLD-03 | Sold listing accessible via URL with SOLD overlay | Manual UI | Navigate directly to slug of SOLD listing — SOLD overlay visible, not 404 |
| SOLD-04 | Sold listings appear at bottom of search results | Manual UI | Search returns SOLD listing below ACTIVE ones |
| SOLD-05 | Analytics include SOLD listings in revenue | Manual UI | Check seller dashboard total revenue — includes SOLD listing values |
| SOLD-06 | SOLD listings excluded from searchable results (not indexed) | Manual | Search for the exact title of a SOLD car — should appear at bottom, not top |
| SOLD-07 | Dealer inventory also shows SOLD with badge + Relist | Manual UI | On dealer inventory page, SOLD listings visible with correct badge |

### Sampling Rate
- **Per task commit:** Manual smoke test of the specific feature changed (listed above per requirement)
- **Per wave merge:** Run full manual checklist across all 4 feature areas
- **Phase gate:** All 23 requirements pass manual verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/prisma/migrations/YYYYMMDD_phase10_*/migration.sql` — DB migration for new columns (OWNERS-05, COUNTER-01)
- [ ] Prisma client regenerated after migration (`npx prisma generate`)
- [ ] Verify `CarCard.tsx` renders `status` prop — needed for SOLD-04 implementation

---

## Sources

### Primary (HIGH confidence)
- `backend/prisma/schema.prisma` — Full Prisma schema; all model fields verified directly
- `backend/src/offers/offers.service.ts` — Full offers service; counter-offer flow analysed line by line
- `backend/src/listings/listings.service.ts` — Full listings service; findAll, findMyListings, updateStatus, publishListing all read
- `backend/src/listings/dto/create-listing.dto.ts` — DTO validation; owners field type confirmed as `String?` with `@IsOptional()`
- `backend/src/dashboard/dashboard.service.ts` — Dashboard queries; revenue source (Sale table) confirmed correct
- `backend/src/admin/admin.service.ts` — Admin analytics; getPlatformStats uses listing.count by status
- `src/components/listing/ListingWizard.tsx` — Wizard form; owners widget (lines 1862-1882), photo validation (line 482), step structure
- `src/components/listing/ImageUpload.tsx` — ImageUpload component; `maxImages=30` default confirmed
- `src/app/dashboard/seller/offers/page.tsx` — Seller offers UI; OfferStatus rendering confirmed
- `src/app/dashboard/user/page.tsx` — Unified user dashboard; InventoryTab, OutgoingOffersTab, OffersTab locations

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions — User-locked requirements, treated as specification

### Tertiary (LOW confidence — not needed, all findings from code)
- None

---

## Metadata

**Confidence breakdown:**
- DB schema changes needed: HIGH — all fields inspected, migration plan is precise
- Counter-offer bug root cause: HIGH — identified from service code; buyer re-counter path is absent
- Photo min enforcement location: HIGH — line 482 in ListingWizard.tsx confirmed
- Frontend inventory SOLD gap: HIGH — findMyListings defaulting confirmed at lines 1158-1160
- Relist API path: HIGH — updateStatus already handles ACTIVE from SOLD

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable codebase; only invalidated by changes to the files listed above)
