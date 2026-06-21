# Phase 13: Listing Form Enhancements — Departed Sale — Research

**Researched:** 2026-06-21
**Domain:** React/Next.js form upgrade, prop threading, React Native badge addition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Relationship field — Structure**
- Replace free text input with a predefined dropdown. Options (in order): Son, Daughter, Sibling, Spouse, Executor of Will, Solicitor, Other
- 'Other' reveals inline text input with placeholder "Please specify your relationship" — progressive disclosure
- Dropdown placeholder: "Select your relationship to the owner" — no default pre-selected option
- Required when isDepartedSale is checked — seller cannot submit while relationship is empty or 'Other' without a text value
- Client-side validation — inline error message below the dropdown if constraint violated; server-side backup also enforced
- Editable at any listing status (DRAFT, SCHEDULED, ACTIVE, ENDED)

**Relationship field — Form placement & label**
- Keep current position in the wizard (near bottom of general info step, by write-off/legal declarations)
- Rename checkbox label from "This is a deceased estate sale" to "This is a departed/estate sale"
- Helper text below the checkbox (visible always, not just when checked): "Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation."
- No special visual distinction for the departed section (no coloured border) — plain checkbox, blends with surrounding form fields
- No warning dialog when the seller toggles the flag on a live listing

**Buyer-facing display — Listing detail page**
- Show relationship inline near the Deceased Estate badge — format: "Listed by [relationship]"
- Placement: same badge area only — not in the specs/vehicle details table
- Existing badge copy: keep "Deceased Estate" as the primary badge label; "Listed by [relationship]" is a sub-label or inline suffix
- Show exactly as typed — if seller chose 'Other' and typed a value, display that verbatim
- No contextual copy for buyers explaining estate sales

**Buyer-facing display — Listing cards (web)**
- Neutral/grey 'Estate' chip — NOT purple; lower visual weight
- Add `isDepartedSale` prop to `CarCard` — chip appears in badge row when prop is true
- All card contexts: Buy Cars grid, search results, seller profile page (ListingCard), watchlist, seller dashboard — one rule, no exceptions
- Deprioritised if overflow — Verified Dealer and KYC are trust-critical; Estate is informational; drop it if badge row overflows

**Buyer-facing display — Mobile**
- Both web and mobile — mobile listing cards also get the Estate chip
- Same chip style via existing React Native card component in `carmazium app/`

**Seller guidance copy**
- Checkbox label: "This is a departed/estate sale"
- Helper text: "Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation."
- Dropdown placeholder: "Select your relationship to the owner"

### Claude's Discretion
- Exact chip styling (colour value, size, font weight) for the grey 'Estate' chip — follow the existing badge pattern in `CarCard.tsx`
- Inline error message copy for the validation error
- Whether to use a native `<select>` or a custom styled dropdown — follow the existing form pattern in `ListingWizard.tsx`
- Mobile card component identification and exact prop threading

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 13 is a targeted enhancement to the existing departed/estate sale feature. The DB fields (`isDepartedSale`, `departedRelationship`) already exist on the Listing model and are already in the API type definitions — no migrations or backend changes are required. The work is entirely frontend: upgrade the wizard form interaction, propagate a new `isDepartedSale` prop through all listing card call sites (web + mobile), and extend the listing detail badge to include "Listed by [relationship]".

The existing wizard uses `hasAttemptedNext` + border-red-500 as the validation pattern. The dropdown must hook into this same mechanism. The existing `SelectField` component in ListingWizard already supports an `error` boolean prop that flips the border to red — the departed relationship dropdown can reuse it directly.

The mobile app has a separate `ApiListing` → `CarListing` mapping layer in `listingsApi.ts`. The `CarListing` type and the `mapApiListingToCarListing` function need `isDepartedSale` added so the data flows through to `VehicleCard`. Both `VehicleCard` and `HorizontalVehicleCard` accept a `listing: CarListing` prop — the Estate chip must be added to both.

**Primary recommendation:** Execute in three focused tasks: (1) wizard form upgrade + validation, (2) web prop threading + CarCard chip + detail page "Listed by", (3) mobile type extension + VehicleCard/HorizontalVehicleCard chip.

---

## Standard Stack

### Core (already in use — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React / Next.js | 14 (App Router) | Web wizard and listing pages | Project standard |
| Tailwind CSS | 3.x | Web chip styling | Project standard |
| React Native / Expo | SDK 54 / Expo Router 4 | Mobile card components | Project standard |
| TypeScript | 5.x | Type-safe prop additions | Project standard |

### No new dependencies needed
All changes reuse existing UI patterns and no new packages are required.

---

## Architecture Patterns

### Web — Existing Form Validation Pattern
The wizard uses a single `hasAttemptedNext` boolean (set on failed "Next" attempt, cleared on successful advance) to trigger inline error states. Error display is `border-red-500` on inputs or a `<p className="text-red-400 text-xs mt-1">` below the field. The `SelectField` component at line ~162 already accepts `error?: boolean` — this is the right component to reuse for the relationship dropdown.

```typescript
// Pattern from ListingWizard.tsx (existing)
// error prop turns border red; label + required asterisk handled automatically
<SelectField
    label="Relationship to owner"
    required
    error={hasAttemptedNext && formData.isDepartedSale && !formData.departedRelationship}
    value={formData.departedRelationship ?? ''}
    onChange={(v) => set('departedRelationship', v)}
    options={RELATIONSHIP_OPTIONS}
/>
```

The `isStepValid` function that guards step advancement must include the new condition:
```typescript
// Add to step 1 isStepValid (existing function around line 493)
if (formData.isDepartedSale && !departedRelationshipIsValid) return false
```

Where `departedRelationshipIsValid` means: `departedRelationship` is a non-empty string AND if the dropdown value is 'Other', the supplementary text input is also non-empty.

### Web — Estate Chip in CarCard
The badge row in `CarCard.tsx` currently lives at lines 136–145 (top-right corner of the image area — Verified + VIN Report badges). The Estate chip should be added to the **card body badge section** near line 225–238 (where Premium/Standard tier labels sit), not in the image corner, to keep trust badges visually separated from informational signals.

```typescript
// Add isDepartedSale to CarCardProps interface
isDepartedSale?: boolean

// Add chip in the card body, after badgeTier block (~line 238)
{isDepartedSale && (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide
        bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
        Estate
    </span>
)}
```

The grey `bg-white/5 text-gray-400 border-white/10` styling matches the existing spec tag style (lines 244–271) — lower visual weight than the PREMIUM amber or STANDARD blue badges.

### Web — Listing Detail "Listed by" Pattern
The existing Deceased Estate badge is at `buy-cars/[slug]/page.tsx` line 588–592. Extend it inline:

```tsx
{listing.isDepartedSale && (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
        bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
        <span>Deceased Estate</span>
        {listing.departedRelationship && (
            <span className="text-purple-400/70">· Listed by {listing.departedRelationship}</span>
        )}
    </div>
)}
```

### Web — Prop Threading Call Sites
`isDepartedSale` must be threaded from the listing object into `<CarCard>` at these existing call sites:
- `src/app/search/page.tsx` — lines 1113 and 1146 (two `<CarCard>` renders)
- `src/app/HomeClient.tsx` — line 288
- `src/app/seller/[id]/page.tsx` — `ListingCard` inline component at line 436 (this is a custom component, not `CarCard` — add the Estate chip directly inside `ListingCard`)

The watchlist page (`src/app/dashboard/buyer/watchlist/page.tsx`) uses a custom card layout (not `CarCard`) — the planner should check whether `WatchlistItem.listing` includes `isDepartedSale` and add the chip inline in the same custom card structure if the field is present.

### Mobile — Type Extension Pattern
The mobile `CarListing` type does NOT currently have `isDepartedSale`. Two additions are needed:

1. Add to `ApiListing` in `listingsApi.ts`:
```typescript
isDepartedSale?: boolean | null;
```

2. Add to `CarListing` in `data/listings.ts`:
```typescript
isDepartedSale?: boolean;
```

3. Propagate in `mapApiListingToCarListing`:
```typescript
isDepartedSale: l.isDepartedSale ?? false,
```

### Mobile — Estate Chip in VehicleCard
`VehicleCard.tsx` has an `imageBadgeRow` (absolute top-left of image) with `featuredBadge` and `newBadge`. The Estate chip slots into this same row using the existing badge shape:

```typescript
// In VehicleCard imageBadgeRow (after existing badges ~line 88)
{listing.isDepartedSale && (
    <View style={styles.estateBadge}>
        <Text style={styles.estateText}>ESTATE</Text>
    </View>
)}

// In StyleSheet
estateBadge: {
    backgroundColor: 'rgba(160, 160, 171, 0.20)',  // neutral grey, matches Colors.textSecondary at 20% opacity
    borderWidth: 1,
    borderColor: 'rgba(160, 160, 171, 0.30)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
},
estateText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textSecondary,  // '#A0A0AB'
    letterSpacing: 0.8,
},
```

### Mobile — Estate Chip in HorizontalVehicleCard
`HorizontalVehicleCard` shows a `premiumBadge` in the image area. The Estate chip follows the same absolute-positioned badge pattern but with neutral grey styling (same as VehicleCard above). The `HorizontalVehicleCardProps` interface only takes `listing: CarListing` — after `CarListing` is extended, the prop is available automatically.

### Anti-Patterns to Avoid
- **Do not add isDepartedSale to the image-corner trust badges area** in `CarCard.tsx` — that area (lines 136–145) is for Verified/VIN Report trust signals. Estate is informational and belongs in the card body.
- **Do not create a separate validation state** for departedRelationship — reuse the existing `hasAttemptedNext` boolean. Adding a second error state variable would break consistency with the rest of the wizard.
- **Do not add isDepartedSale to the wizard's `isStepValid` without also guarding on `isDepartedSale === true`** — the relationship is only required when the checkbox is checked.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Styled dropdown | Custom dropdown component | Reuse `SelectField` (already in ListingWizard) | Already handles error state, label, required asterisk |
| Error display | New error state variable | `hasAttemptedNext` boolean (already exists) | Consistent with all other wizard fields |
| Grey chip | New component | Inline `<span>` with existing spec-tag Tailwind classes | Same pattern used for year/mileage/fuel tags |
| Mobile badge | New badge component | Inline `<View>/<Text>` with StyleSheet entry | Same pattern as `featuredBadge`/`newBadge` in VehicleCard |

---

## Common Pitfalls

### Pitfall 1: 'Other' validation edge case
**What goes wrong:** Seller selects 'Other' in the dropdown, types a value, then clears it — `departedRelationship` is now 'Other' (from the select) but the supplementary text is empty. The form submits "Other" as the relationship string.
**Why it happens:** If the dropdown value and the freetext value are stored in the same `formData.departedRelationship` field, switching back to 'Other' after typing leaves stale data.
**How to avoid:** Use a local `departedRelationshipSelect` state (the dropdown value: 'Son', 'Daughter', ... 'Other') and `departedRelationshipOther` (the freetext). The actual `formData.departedRelationship` is set to the select value unless select === 'Other', in which case it's set to the freetext value. This keeps the DB field clean.
**Warning signs:** QA testing 'Other' with empty supplementary text getting through validation.

### Pitfall 2: Forgetting the seller dashboard card context
**What goes wrong:** The `ListingCard` inside `src/app/seller/[id]/page.tsx` is a local inline component (not `CarCard`) — it has its own JSX structure. Adding `isDepartedSale` to `CarCard` won't affect it.
**How to avoid:** The planner must treat `ListingCard` in `seller/[id]/page.tsx` as a separate change target. Inspect the `Listing` type used there — `isDepartedSale` is already present in `src/lib/listingApi.ts` `Listing` type at line 189, so it will be in scope.

### Pitfall 3: Mobile mapping bypass
**What goes wrong:** `isDepartedSale` is added to `ApiListing` but not to `mapApiListingToCarListing` return object. The field is silently dropped and the Estate chip never renders.
**How to avoid:** Add the field to all three places: `ApiListing`, `CarListing`, and `mapApiListingToCarListing`.

### Pitfall 4: Badge row overflow on small screens
**What goes wrong:** On narrow mobile web viewports, a listing with PREMIUM tier + isDepartedSale shows too many badges and overflows.
**How to avoid:** The decisions specify "deprioritised if overflow" — the Estate chip should have `flex-shrink` behaviour that hides it before Verified/VIN badges disappear. Use `order-last` or `min-w-0 flex-shrink` in the flex row. Alternatively, simply add it last in DOM order (CSS flex already drops trailing items when wrapping is off).

### Pitfall 5: Step validation not reached
**What goes wrong:** `isStepValid` is called inside the "Next" click guard. If `isDepartedSale` validation is only in the submit guard (final step), the user can advance through steps with an invalid relationship.
**How to avoid:** The relationship is on step 1 (general info). The step 1 `isStepValid` block (around line 493 in ListingWizard) is where the guard belongs — not just the submit guard.

---

## Code Examples

### Relationship dropdown constant (place before component, after existing constants)
```typescript
const RELATIONSHIP_OPTIONS = [
    { value: 'Son',               label: 'Son' },
    { value: 'Daughter',          label: 'Daughter' },
    { value: 'Sibling',           label: 'Sibling' },
    { value: 'Spouse',            label: 'Spouse' },
    { value: 'Executor of Will',  label: 'Executor of Will' },
    { value: 'Solicitor',         label: 'Solicitor' },
    { value: 'Other',             label: 'Other' },
] as const
```

### Validation logic addition to isStepValid (step 1 block)
```typescript
// Within step 1 validation block in isStepValid():
if (formData.isDepartedSale) {
    const rel = formData.departedRelationship?.trim() ?? ''
    if (!rel || rel === 'Other') return false  // 'Other' sentinel means freetext not yet set
}
```

The implementation stores the resolved value (freetext if Other) in `formData.departedRelationship`, so 'Other' in that field means the user hasn't provided a freetext value yet.

### Grey Estate chip for CarCard.tsx (web)
```tsx
// After the badgeTier block (~line 238), before specs tags:
{isDepartedSale && (
    <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide
            bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
            Estate
        </span>
    </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Free text "relationship" input | Predefined dropdown + Other escape hatch | Consistent data in DB; buyer display becomes reliable |
| No relationship shown to buyers | "Listed by [relationship]" inline with badge | More transparency for buyers about who is selling |
| No Estate chip on listing cards | Grey chip in card body | Estate sales visible in grids without opening detail page |

---

## Open Questions

1. **Watchlist page card structure**
   - What we know: `/dashboard/buyer/watchlist/page.tsx` uses a custom card layout (not `CarCard`), and the `WatchlistItem.listing` object may or may not include `isDepartedSale`
   - What's unclear: Whether the `getWatchlist` API call returns `isDepartedSale` in the listing payload; if the `WatchlistItem` type in `listingApi.ts` includes it
   - Recommendation: Planner should check `WatchlistItem` type and `getWatchlist` response shape. If `isDepartedSale` is present, add a simple text label inside the existing card. If not present in the API response, treat watchlist as out of scope for this phase (data not available).

2. **Seller dashboard listings page**
   - What we know: The `src/app/dashboard/dealer/` and `src/app/dashboard/seller/` areas have listing tables/rows, not CarCard components
   - What's unclear: Whether the decisions' "seller dashboard" reference means the seller profile public page (`seller/[id]/page.tsx`) or the authenticated seller listings dashboard
   - Recommendation: Based on CONTEXT.md which references "seller profile page (`ListingCard`)", scope is `seller/[id]/page.tsx` inline `ListingCard` only. The authenticated seller dashboard uses tabular/row layout and was not called out — treat as out of scope.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No web test framework detected (no jest.config at web root, no vitest.config) |
| Config file | None found at project root |
| Quick run command | N/A — see Wave 0 |
| Full suite command | N/A — see Wave 0 |

Note: The mobile app has Jest (jest.config.js with jest-expo preset). Web changes in this phase are UI-only React component edits. The most practical validation is visual/functional manual testing for the web side.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| FORM-01 | Relationship dropdown renders with 7 options | manual | Visual inspection in wizard |
| FORM-02 | 'Other' reveals freetext input | manual | Click 'Other', check conditional render |
| FORM-03 | Submit blocked when isDepartedSale=true and relationship empty | manual | Attempt step advance without filling |
| FORM-04 | Error message shown inline below dropdown | manual | Trigger validation, verify red border |
| BADGE-01 | Estate chip visible on CarCard when isDepartedSale=true | manual | Load listing card for departed listing |
| BADGE-02 | "Listed by [relationship]" shown on detail page | manual | Open detail page for departed listing |
| MOBILE-01 | Estate chip in VehicleCard (React Native) | manual | Run mobile app, view departed listing card |

### Wave 0 Gaps
- No web test infrastructure exists — no action needed for this phase (all changes are UI/visual)
- Mobile Jest infrastructure exists but these badge/chip additions are purely visual — manual testing sufficient

*(If automated tests are desired in a future phase, the mobile pattern would be: mock `listingsApi` to return `isDepartedSale: true`, assert `getByText('ESTATE')` in VehicleCard render)*

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `src/components/features/CarCard.tsx` — full component, badge patterns, props interface
- Direct code reading: `src/components/listing/ListingWizard.tsx` lines 134–153, 280, 493–514, 1913–1934 — form state, validation pattern, existing departed section
- Direct code reading: `src/app/buy-cars/[slug]/page.tsx` lines 587–592 — existing Deceased Estate badge
- Direct code reading: `src/app/seller/[id]/page.tsx` lines 436–460 — ListingCard structure
- Direct code reading: `src/app/search/page.tsx` lines 1113–1134, 1146+ — CarCard call sites
- Direct code reading: `src/app/HomeClient.tsx` lines 288–302 — CarCard call site
- Direct code reading: `src/lib/listingApi.ts` lines 72–73, 189–190 — isDepartedSale/departedRelationship already in types
- Direct code reading: `carmazium app/carmazium app/src/components/VehicleCard.tsx` — full component, badge patterns
- Direct code reading: `carmazium app/carmazium app/src/components/HorizontalVehicleCard.tsx` — full component
- Direct code reading: `carmazium app/carmazium app/src/lib/listingsApi.ts` — ApiListing, mapApiListingToCarListing
- Direct code reading: `carmazium app/carmazium app/src/constants/colors.ts` — colour tokens

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions — locked by user in discuss-phase session
- STATE.md Phase 10 Plan 02 notes — confirms isDepartedSale checkbox + departedRelationship were added in that phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all changes use existing patterns verified by reading source files
- Architecture: HIGH — exact file locations, line numbers, and existing component APIs confirmed by direct code reading
- Pitfalls: HIGH — derived from actual code structure (validation pattern, mapping layer, component tree)

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable codebase, no fast-moving dependencies)
