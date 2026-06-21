# Phase 13: Listing Form Enhancements — Departed Sale - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the listing creation/edit form's departed sale section and propagate the departed status across all buyer-facing surfaces. The `isDepartedSale` and `departedRelationship` DB fields already exist — this phase upgrades the form interaction, adds display of the relationship to buyers, and adds the Estate chip to listing cards on both web and mobile.

</domain>

<decisions>
## Implementation Decisions

### Relationship field — Structure
- **Replace free text input with a predefined dropdown.** Options (in this order): Son, Daughter, Sibling, Spouse, Executor of Will, Solicitor, Other
- **'Other' reveals inline text input** with placeholder "Please specify your relationship" — progressive disclosure pattern
- **Dropdown placeholder:** "Select your relationship to the owner" — no default pre-selected option
- **Required when isDepartedSale is checked** — seller cannot submit while relationship is empty or 'Other' without a text value
- **Client-side validation** — inline error message below the dropdown if the constraint is violated; catches it before the API call (server-side backup also enforced via existing backend DTO)
- **Editable at any listing status** (DRAFT, SCHEDULED, ACTIVE, ENDED) — relationship is administrative context, not a price signal

### Relationship field — Form placement & label
- **Keep current position** in the wizard (near bottom of general info step, by write-off/legal declarations)
- **Rename checkbox label** from "This is a deceased estate sale" to **"This is a departed/estate sale"**
- **Helper text below the checkbox** (visible always, not just when checked): "Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation."
- **No special visual distinction** for the departed section (no coloured border) — plain checkbox, blends with surrounding form fields
- **No warning dialog** when the seller toggles the flag on a live listing

### Buyer-facing display — Listing detail page
- **Show relationship inline near the Deceased Estate badge** — format: "Listed by [relationship]" (e.g. "Listed by Son", "Listed by Executor of Will")
- **Placement:** same badge area only — not in the specs/vehicle details table
- **Existing badge copy:** keep "Deceased Estate" as the primary badge label; "Listed by [relationship]" is a sub-label or inline suffix alongside it
- **Show exactly as typed** — if seller chose 'Other' and typed a value, display that verbatim ("Listed by Nephew")
- **No contextual copy** for buyers explaining estate sales — badge + relationship is sufficient transparency

### Buyer-facing display — Listing cards (web)
- **Neutral/grey 'Estate' chip** — NOT purple; lower visual weight, informational signal without shouting
- **Add `isDepartedSale` prop to `CarCard`** — chip appears in the badge row (where Verified / VIN Report badges sit) when prop is true
- **All card contexts**: Buy Cars grid, search results, seller profile page (`ListingCard`), watchlist, seller dashboard — one rule, no exceptions
- **Deprioritised if overflow** — Verified Dealer and KYC are trust-critical; Estate is informational; drop it if the badge row overflows on small screens

### Buyer-facing display — Mobile
- **Both web and mobile** — mobile listing cards also get the Estate chip
- **Same chip style** via the existing React Native card component in `carmazium app/`
- Planner to identify the correct mobile card component and apply the same neutral/grey chip pattern

### Seller guidance copy
- Checkbox label: "This is a departed/estate sale"
- Helper text: "Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation."
- Dropdown placeholder: "Select your relationship to the owner"

### Claude's Discretion
- Exact chip styling (colour value, size, font weight) for the grey 'Estate' chip — follow the existing badge pattern in `CarCard.tsx` for spacing and sizing
- Inline error message copy for the validation error
- Whether to use a native `<select>` or a custom styled dropdown — follow the existing form pattern in `ListingWizard.tsx`
- Mobile card component identification and exact prop threading

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/features/CarCard.tsx` — main listing card (used in Buy Cars grid, search, Home); needs `isDepartedSale?: boolean` prop added and Estate chip in the badge row (line ~135)
- `src/components/listing/ListingWizard.tsx` — existing `isDepartedSale` checkbox (line 1916) and `departedRelationship` text input (line 1926); upgrade to dropdown + inline text fallback
- `src/app/buy-cars/[slug]/page.tsx` — existing "Deceased Estate" badge at line 588; extend to show "Listed by [relationship]" alongside it
- `src/app/seller/[id]/page.tsx` — inline `ListingCard` component at line 436; also needs Estate chip
- `src/lib/listingApi.ts` — `isDepartedSale?: boolean` and `departedRelationship?: string` already in both `CreateListingInput` (line 72) and `Listing` type (line 189)

### Established Patterns
- `ListingWizard.tsx` form state: `formData.isDepartedSale` (boolean) and `formData.departedRelationship` (string) already tracked in state at line 139; dropdown value goes into the same `departedRelationship` field
- Badge row in `CarCard.tsx` is rendered around line 135 — the `badgeTier === 'STANDARD' || 'PREMIUM'` guard shows Verified / VIN badges; Estate chip slots into this same row using `isDepartedSale` prop
- Validation in the wizard follows existing client-side patterns (field-level error state); follow the same approach used for other required fields
- DB schema: `isDepartedSale Boolean?` and `departedRelationship String?` already on the Listing model — no migration needed

### Integration Points
- `src/app/search/page.tsx` — passes props to `CarCard` at lines 1113 and 1146; needs `isDepartedSale` passed through from the listing object
- `src/app/HomeClient.tsx` — passes props to `CarCard` at line 288; same prop thread needed
- Mobile app listing card component — planner to identify in `carmazium app/` directory and add Estate chip

</code_context>

<specifics>
## Specific Ideas

- The "Listed by [relationship]" copy sits inline beside or directly below the existing purple "Deceased Estate" badge on the listing detail page — not a separate section
- The 'Other' text input in the form should only appear when 'Other' is selected in the dropdown — conditional rendering on the selected value, not always-visible
- The neutral/grey Estate chip on listing cards should be visually lighter than the Verified/KYC badges to signal informational status rather than trust certification

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-listing-form-enhancements-departed-sale-option-with-relationship-field*
*Context gathered: 2026-06-21*
