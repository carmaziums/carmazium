# Phase 11: Listing Page Overhaul - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul the car listing detail page and related buyer-facing surfaces: add category badges near the title, improve the sidebar CTAs with new actions, upgrade the dealer/seller verification display to a prominent trust panel, and add proximity distance across CarCards, the detail sidebar, and search results. Also add a distance filter to the search/browse page and bring the seller profile page in line with the new trust signals.

</domain>

<decisions>
## Implementation Decisions

### Category Badges (Listing Detail)
- **Position:** Eyebrow position — small pill badges above the H1 title (first thing buyers see, before reading the car name)
- **What's shown:** bodyType + fuelType as two separate pills (e.g. "SUV | Electric"), each with a Lucide icon
- **Auction listings:** Show an additional "Auction" badge in the eyebrow row — only auction listings get this badge; Classified is the default and needs no badge
- **Visual style:** Small filled pill with icon — matches the existing badges row style (rounded pill, muted background, icon + text)
- **CarCard:** No change — CarCard already renders a bodyType chip; this phase only adds badges to the detail page

### Sticky Sidebar CTAs
- **Improvement type:** Both new CTAs and visual hierarchy overhaul
- **New CTAs added:**
  - **Save / Watchlist** — `addToWatchlist` API already exists; add heart icon button to sidebar (toggled state)
  - **Share listing** — copy URL or native Web Share API; `Share2` icon already imported in the page
  - **Compare** — calls `addToCompare(listing)` from existing `CompareContext`, then navigates to `/compare` immediately
- **Existing CTAs kept:** Make an Offer (primary), Enquire (secondary)
- **Mobile behaviour:** Sticky bottom action bar on small screens — primary "Make an Offer" button + secondary "Enquire" button. Sidebar remains desktop-only (lg:block). Save, Share, Compare can appear as icon buttons in the sticky bar.
- **Price:** Stays as the first element in the sidebar — price is the buyer's primary reference
- **Compare flow:** Click → `addToCompare(listing)` → navigate to `/compare`. If basket is already full (3 vehicles), CompareContext silently drops the oldest (existing behaviour, no warning needed).

### Dealer / Seller Verification Display
- **Format:** Prominent trust panel inside the existing seller info block at the top of the sidebar — replaces the current tiny "Verified Dealer" text + CheckCircle
- **What it shows:**
  - KYC verified badge (shield icon + "Verified" label) — the core trust signal
  - Dealer name + logo (already there — just make layout more polished)
  - Active listing count (backend adds `listingCount` to the seller object returned by `GET /listings/:slug`)
- **Private sellers:** Same "Verified" badge visual style — unified treatment, no role distinction in the badge label
- **Unverified state:** Doesn't occur — dealers cannot list without passing KYC
- **Seller profile page (/seller/:id):** Also add the KYC verified badge to the profile header; surface `totalListings` from the existing `SellerProfileStats` object more prominently (already in the data, just needs display)

### Proximity Distance
- **Location source:** Browser geolocation as default; if denied or unavailable, show a postcode entry field as fallback
- **Storage:** Store buyer's lat/lng in a `LocationContext` + `localStorage` — persists across buy-cars pages without re-prompting
- **Where distance appears:**
  - **CarCard:** Alongside the mileage/fuel/year specs row (distanceMi prop already defined on the component — just needs to be populated)
  - **Listing detail sidebar:** Next to the `MapPin` location text — e.g. "Manchester · 32 miles away"
  - **Search results page:** Shown on cards (via CarCard prop) + distance filter controls
- **No location fallback:** Distance chip simply doesn't render if the listing has no lat/lng — clean, no placeholder text
- **Format:**
  - CarCard: `~32 mi` (abbreviated chip — space-constrained)
  - Detail sidebar: `32 miles away` (full text — more room)

### Distance Filter (Search / Browse Page)
- **Control:** Preset radius chips — 10 / 25 / 50 / 100 / 200 miles — in the filter panel
- **Default sort when filter active:** Closest first (results re-sort when a distance filter is applied)
- **Location persistence:** `LocationContext` + `localStorage` — buyer's location survives page navigation without re-prompting

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/context/CompareContext.tsx` — `addToCompare()`, `removeFromCompare()`, `isInCompare()`, localStorage persistence; up to 3 vehicles, silently drops oldest on 4th. Ready to wire.
- `src/app/compare/page.tsx` — Compare page exists; navigate here after `addToCompare()`
- `src/lib/listingApi.ts` — `addToWatchlist()` / `removeFromWatchlist()` / `checkWatchlist()` already exported; watchlist state already managed in the listing detail page
- `src/components/features/CarCard.tsx` — `distanceMi?: number` prop already defined; `BODY_TYPE_LABELS` map already exists; chip renders if prop is provided
- `src/app/buy-cars/[slug]/page.tsx` — 1145 lines; sidebar at line 986 (`sticky top-28`); seller info block from line ~993; location display at bottom of sidebar card; `Share2` icon already imported
- `src/app/seller/[id]/page.tsx` — Server component; `SellerProfileStats` has `totalListings` field; `BadgeCheck` icon already imported; `ShieldCheck` icon also imported
- `src/components/ui/DualRangeSlider.tsx` — Existing slider component (could be adapted for single-thumb distance slider, but preset chips are preferred)

### Established Patterns
- Badges: `inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-1 font-bold` pattern used throughout the listing detail page
- Sidebar card: `bg-slate-800 rounded-xl border border-white/10 shadow-2xl` — match this for trust panel
- Lucide icons: All icon imports consolidated at top of listing detail page; add `Fuel`, `BarChart2`, `Users` as needed
- Mobile sticky bar: Tailwind `fixed bottom-0 left-0 right-0 lg:hidden z-50` pattern — standard in this codebase

### Integration Points
- Backend `GET /listings/:slug` — seller join already includes `dealerProfile`; add `listingCount: Int` to the returned seller object (count of ACTIVE listings by that seller)
- `LocationContext` — new context to create; wraps buy-cars layout; stores `{ lat, lng, postcode, source: 'geo' | 'postcode' | null }`
- Search page filters — extend existing filter state with `maxDistanceMi?: number`; filter API call adds `lat`, `lng`, `maxDistanceMi` params

</code_context>

<specifics>
## Specific Ideas

- Category badge eyebrow: place above the H1 in the same flex row as listing type indicator — "SUV · Electric · Auction" in a single horizontal strip of pills
- Sidebar trust panel: styled mini-card within the seller block — shield icon on the left, "Verified" text, dealer name, listing count in muted text. Closer to an ID card than a simple label
- Distance on CarCard: append to the existing specs row as the last chip — `~32 mi` in the same style as mileage/fuel chips
- Postcode fallback: small inline input field in the search filter panel with a "Use my location" link alongside it

</specifics>

<deferred>
## Deferred Ideas

- None — all discussed items are within phase 11 scope

</deferred>

---

*Phase: 11-listing-page-overhaul*
*Context gathered: 2026-06-21*
