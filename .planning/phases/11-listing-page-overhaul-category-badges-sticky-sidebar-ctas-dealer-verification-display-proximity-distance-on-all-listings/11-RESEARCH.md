# Phase 11: Listing Page Overhaul — Research

**Researched:** 2026-06-21
**Domain:** Next.js 14 App Router, React Context, browser Geolocation API, NestJS filter DTOs, Prisma, Tailwind CSS
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Category Badges (Listing Detail)**
- Position: Eyebrow position — small pill badges above the H1 title
- What is shown: bodyType + fuelType as two separate pills (e.g. "SUV | Electric"), each with a Lucide icon
- Auction listings only: show an additional "Auction" badge; Classified has no badge
- Visual style: small filled pill with icon — matches existing badges row style
- CarCard: no change — CarCard already renders a bodyType chip; this phase only adds badges to the detail page

**Sticky Sidebar CTAs**
- Improvement type: both new CTAs and visual hierarchy overhaul
- New CTAs added: Save/Watchlist (heart icon, toggled), Share (Web Share API or clipboard), Compare (addToCompare then navigate to /compare)
- Existing CTAs kept: Make an Offer (primary), Enquire (secondary)
- Mobile behaviour: sticky bottom action bar — `fixed bottom-0 left-0 right-0 lg:hidden z-50`; Save, Share, Compare as icon buttons in bar
- Compare flow: addToCompare(listing) then router.push('/compare'); if basket full (3 vehicles), CompareContext silently drops oldest

**Dealer / Seller Verification Display**
- Format: prominent trust panel inside existing seller info block at the top of sidebar
- Replaces: current tiny "Verified Dealer" text + CheckCircle
- What it shows: KYC verified badge (shield icon + "Verified" label), dealer name + logo, active listing count
- Backend: add `listingCount` to the seller object returned by GET /listings/:slug
- Private sellers: same "Verified" badge visual style — unified treatment
- Unverified state: does not occur — dealers cannot list without KYC
- Seller profile page /seller/:id: add KYC verified badge to profile header; surface totalListings prominently

**Proximity Distance**
- Location source: browser geolocation default; postcode entry field fallback if denied
- Storage: LocationContext + localStorage — persists across buy-cars pages
- Where distance appears: CarCard (distanceMi prop already defined — populate it), detail sidebar (next to MapPin), search results page (cards + distance filter)
- No location fallback: distance chip does not render if listing has no lat/lng
- Format: CarCard `~32 mi` (abbreviated), detail sidebar `32 miles away` (full text)

**Distance Filter (Search / Browse Page)**
- Control: preset radius chips — 10 / 25 / 50 / 100 / 200 miles
- Default sort when filter active: closest first
- Location persistence: LocationContext + localStorage

### Claude's Discretion
- None specified — all discussed items are within phase scope

### Deferred Ideas (OUT OF SCOPE)
- None — all discussed items are within phase 11 scope
</user_constraints>

---

## Summary

Phase 11 is a pure frontend + minor backend augmentation phase. The web app is a Next.js 14 App Router project using Tailwind CSS, Lucide icons, and a dark design system based on `bg-slate-800/slate-900`. All the data already exists — listings already have `latitude` / `longitude` fields geocoded on creation; the `Listing` type already carries `bodyType`, `fuelType`, and `type` (AUCTION/CLASSIFIED); `CompareContext` and `useUserLocation` / `haversineDistanceMiles` are already built and working. The phase is assembling these parts into the UI — no new data pipeline is needed except one backend addition: surfacing a `listingCount` field in `GET /listings/:slug` so the trust panel can display how many active cars this seller has.

The distance filter on the search/browse page is the only backend-touching feature beyond `listingCount`. The current `ListingFilterDto` has no `lat`, `lng`, or `maxDistanceMi` params. Distance filtering needs to happen either in the backend (Haversine SQL) or on the client after fetch. Given the preset chip UX and the small-to-medium dataset, client-side post-fetch filtering is the simpler and safer approach for the planner — it avoids a backend migration and avoids the complexity of raw SQL Haversine in Prisma. The client already has `haversineDistanceMiles` ready.

The `LocationContext` must be created new — currently the app has `useUserLocation` (a hook) but no context provider. A context is needed to share the user's resolved location across the buy-cars layout (search page, detail page) without re-prompting on each navigation.

**Primary recommendation:** Create `LocationContext` wrapping the buy-cars layout; wire CarCard `distanceMi` prop in search page using the already-built `haversineDistanceMiles`; add eyebrow badges above H1 in detail page; replace tiny seller verified label with a trust panel card; add mobile sticky action bar with Save/Share/Compare; add distance preset chip filter to search sidebar (client-side post-filter).

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js App Router | 14.x | Routing, layouts, server/client components | All pages are "use client" client components |
| React | 18.3.x | UI | useContext, useState, useEffect patterns throughout |
| Tailwind CSS | 3.x | Styling | Dark `bg-slate--` token system used consistently |
| Lucide React | Latest | Icons | All icons imported at top of page files |
| NestJS + Prisma | Latest | Backend API + ORM | findBySlug includes seller + dealerProfile already |

### Already Built — Key Files
| Asset | Path | What It Does |
|-------|------|-------------|
| CompareContext | `src/context/CompareContext.tsx` | addToCompare, isInCompare, localStorage, max 3 (drops oldest) |
| useUserLocation | `src/hooks/useUserLocation.ts` | Geolocation + localStorage cache (10 min TTL), returns `{lat, lng}` |
| haversineDistanceMiles | `src/lib/distance.ts` | Pure function: (lat1, lon1, lat2, lon2) → number miles |
| CarCard.distanceMi | `src/components/features/CarCard.tsx:41` | Prop already typed as `distanceMi?: number | null`, chip renders if provided |
| addToWatchlist / removeFromWatchlist | `src/lib/listingApi.ts` | Already exported; watchlist state managed in detail page |
| handleShare / handleWatchlist | `src/app/buy-cars/[slug]/page.tsx:378-418` | Already implemented — just need to surface in sidebar |
| handleCompare | `src/app/buy-cars/[slug]/page.tsx:342-345` | Currently pushes to /compare?slug=... — phase upgrades to addToCompare context |
| Listing.latitude / .longitude | `src/lib/listingApi.ts:163` | Both fields on the Listing type, backend geocodes on create |
| Listing.type | `src/lib/listingApi.ts:152` | 'AUCTION' | 'CLASSIFIED' |
| Listing.bodyType / .fuelType | `src/lib/listingApi.ts` | String enums matching BODY_TYPE_LABELS / FUEL_TYPE_LABELS maps |
| FUEL_TYPE_LABELS | `src/components/features/CarCard.tsx:21` | 7 entries covering all fuel types |
| BODY_TYPE_LABELS | `src/components/features/CarCard.tsx:14` | 13 entries covering all body types |
| BadgeCheck, ShieldCheck | imported in seller/[id]/page.tsx | Already available for trust panel |

---

## Architecture Patterns

### Recommended Project Structure for New Files
```
src/
├── context/
│   └── LocationContext.tsx       # NEW: wraps buy-cars layout
├── app/
│   └── buy-cars/
│       └── layout.tsx            # NEW: buy-cars layout to provide LocationContext
│   └── search/
│       └── page.tsx              # MODIFY: add distance filter UI + client-side distance sort
│   └── buy-cars/[slug]/
│       └── page.tsx              # MODIFY: eyebrow badges, trust panel, sidebar CTAs, mobile bar
│   └── seller/[id]/
│       └── page.tsx              # MODIFY: add KYC badge + totalListings display
```

### Pattern 1: LocationContext
**What:** React context that wraps `src/app/buy-cars/layout.tsx` and provides `{ lat, lng, postcode, source }`. On first render it calls `useUserLocation` internally; if geolocation is denied, the postcode fallback path can be triggered.
**When to use:** Any component inside the buy-cars route segment that needs the buyer's resolved location.
**Key insight:** The existing `useUserLocation` hook is self-contained — the LocationContext can call it internally and expose its results plus the postcode fallback. Components consume via `useContext(LocationContext)`.

```typescript
// src/context/LocationContext.tsx
"use client"
import React, { createContext, useContext, useState, useEffect } from "react"

export interface LocationState {
    lat: number | null
    lng: number | null
    postcode: string | null
    source: 'geo' | 'postcode' | null
}

const LocationContext = createContext<{
    location: LocationState
    setPostcode: (pc: string) => void
}>({
    location: { lat: null, lng: null, postcode: null, source: null },
    setPostcode: () => {},
})

const STORAGE_KEY = 'carmazium_user_location'
const POSTCODE_KEY = 'carmazium_user_postcode'

export function LocationProvider({ children }: { children: React.ReactNode }) {
    const [location, setLocation] = useState<LocationState>({
        lat: null, lng: null, postcode: null, source: null
    })

    useEffect(() => {
        // 1. Try cached geo coords
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const cached = JSON.parse(raw)
                if (Date.now() < cached.expiresAt) {
                    setLocation({ lat: cached.lat, lng: cached.lng, postcode: null, source: 'geo' })
                    return
                }
            }
        } catch { /* ignore */ }

        // 2. Try cached postcode
        try {
            const pc = localStorage.getItem(POSTCODE_KEY)
            if (pc) {
                geocodePostcode(pc).then(coords => {
                    if (coords) setLocation({ ...coords, postcode: pc, source: 'postcode' })
                })
                return
            }
        } catch { /* ignore */ }

        // 3. Try browser geolocation
        if (navigator?.geolocation) {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    const loc = { lat: coords.latitude, lng: coords.longitude }
                    setLocation({ ...loc, postcode: null, source: 'geo' })
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loc, expiresAt: Date.now() + 10 * 60 * 1000 }))
                },
                () => { /* denied — show postcode fallback UI */ },
                { timeout: 5000 }
            )
        }
    }, [])

    const setPostcode = async (pc: string) => {
        localStorage.setItem(POSTCODE_KEY, pc)
        const coords = await geocodePostcode(pc)
        if (coords) setLocation({ ...coords, postcode: pc, source: 'postcode' })
    }

    return (
        <LocationContext.Provider value={{ location, setPostcode }}>
            {children}
        </LocationContext.Provider>
    )
}

export function useLocation() {
    return useContext(LocationContext)
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
        if (!res.ok) return null
        const json = await res.json()
        return { lat: json.result.latitude, lng: json.result.longitude }
    } catch { return null }
}
```

### Pattern 2: Category Badge Eyebrow
**What:** A `<div>` row of pills placed immediately above the `<h1>` in `VehicleDetailsContent`.
**Where:** `src/app/buy-cars/[slug]/page.tsx` around line 488, before the `<h1>` element.
**Visual match:** Same Lucide + pill pattern already used in the badges row lower down.

```typescript
// Above <h1 className="text-3xl...">
<div className="flex flex-wrap items-center gap-2 mb-3">
    {listing.bodyType && BODY_TYPE_LABELS[listing.bodyType] && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1
                         bg-slate-700 border border-white/10 text-gray-200">
            <Car size={11} /> {BODY_TYPE_LABELS[listing.bodyType]}
        </span>
    )}
    {listing.fuelType && FUEL_TYPE_LABELS[listing.fuelType] && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1
                         bg-slate-700 border border-white/10 text-gray-200">
            <Fuel size={11} /> {FUEL_TYPE_LABELS[listing.fuelType]}
        </span>
    )}
    {listing.type === 'AUCTION' && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1
                         bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Gavel size={11} /> Auction
        </span>
    )}
</div>
```

Need to import `BODY_TYPE_LABELS`, `FUEL_TYPE_LABELS` from CarCard or re-define locally (prefer importing from a shared module or defining at the top of the detail page, since CarCard doesn't export them). Best approach: define constants at top of `page.tsx` — the same values are used in CarCard.tsx.

Also need `Fuel`, `Car` (as `CarIcon`), `Gavel` Lucide icons — `CarIcon` and `Gavel` are already imported; `Fuel` needs adding to the import list at line 12.

### Pattern 3: Trust Panel (Sidebar Seller Block)
**What:** Replace the existing `flex items-center gap-1` mini-badge (line ~1008-1020) with a structured card-like block inside the seller info block.
**Where:** `src/app/buy-cars/[slug]/page.tsx` seller info block, starting around line 991.
**Backend dependency:** The seller object returned by `GET /listings/:slug` must include `listingCount`. See Backend Changes section.

```typescript
// Trust panel — replaces the two-line CheckCircle + "Verified Dealer" text
<div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
        <ShieldCheck size={15} className="text-emerald-400" />
    </div>
    <div>
        <p className="text-xs font-bold text-emerald-400 leading-tight">Verified</p>
        {listing.seller?.listingCount != null && (
            <p className="text-[10px] text-gray-500 mt-0.5">
                {listing.seller.listingCount} active listing{listing.seller.listingCount !== 1 ? 's' : ''}
            </p>
        )}
    </div>
</div>
```

### Pattern 4: Mobile Sticky Bottom Bar
**What:** A `fixed` bar at the bottom of the screen on mobile only. Contains: Make an Offer (primary), Enquire (icon), Save (icon), Share (icon), Compare (icon).
**Tailwind pattern:** `fixed bottom-0 left-0 right-0 z-50 lg:hidden` with safe-area padding for iPhone home indicator.

```typescript
// Mobile sticky bar — added below the main return JSX, before closing </div>
<div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900/95 backdrop-blur-md border-t border-white/10 p-3 pb-safe">
    <div className="flex items-center gap-2">
        <Button className="flex-1 py-5" onClick={() => setShowOfferModal(true)}>Make an Offer</Button>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleEnquire}>
            <MessageCircle size={18} />
        </Button>
        <Button variant="outline" size="icon" className={`h-11 w-11 shrink-0 ${isWatchlisted ? 'text-red-400 border-red-500/40' : ''}`} onClick={handleWatchlist}>
            <Heart size={18} className={isWatchlisted ? 'fill-red-400' : ''} />
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleShare}>
            <Share2 size={18} />
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleCompareAndNavigate}>
            <Scale size={18} />
        </Button>
    </div>
</div>
```

`pb-safe` uses Tailwind's `paddingBottom: env(safe-area-inset-bottom)` — needs `content: ['env(safe-area-inset-bottom)']` in Tailwind config or use `pb-[env(safe-area-inset-bottom)]` (Tailwind v3 arbitrary value syntax).

### Pattern 5: Distance Filter — Preset Chips (Client-Side)
**What:** Adds `maxDistanceMi` to `FilterState` in `src/app/search/page.tsx`. When set, the fetched listings are post-filtered by `haversineDistanceMiles` against `userLocation`. Sort is changed to closest-first when filter is active.
**Why client-side:** No backend migration needed; Prisma raw SQL Haversine is complex; listing dataset is small-to-medium. The `haversineDistanceMiles` function is already available.

```typescript
// In FilterState interface (add field):
maxDistanceMi?: number | null

// Preset chip UI in filter sidebar:
const DISTANCE_CHIPS = [10, 25, 50, 100, 200]

<FilterSection title="Distance">
    {!userLocation.lat && (
        <p className="text-xs text-gray-500 mb-2">
            Allow location or enter postcode to filter by distance.
        </p>
    )}
    <div className="flex flex-wrap gap-2">
        {DISTANCE_CHIPS.map(d => (
            <button
                key={d}
                onClick={() => set('maxDistanceMi', filters.maxDistanceMi === d ? null : d)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                    ${filters.maxDistanceMi === d
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
            >
                {d} mi
            </button>
        ))}
    </div>
</FilterSection>

// Post-filter in fetchListings (after API response):
let data = response.data
if (state.maxDistanceMi && userLocation.lat && userLocation.lng) {
    data = data.filter(l =>
        l.latitude && l.longitude &&
        haversineDistanceMiles(userLocation.lat!, userLocation.lng!, l.latitude, l.longitude) <= state.maxDistanceMi!
    )
    // Sort closest-first
    data.sort((a, b) => {
        const dA = haversineDistanceMiles(userLocation.lat!, userLocation.lng!, a.latitude!, a.longitude!)
        const dB = haversineDistanceMiles(userLocation.lat!, userLocation.lng!, b.latitude!, b.longitude!)
        return dA - dB
    })
}
```

**Caveat:** Client-side filtering means pagination total will be inaccurate when distance filter is active. The planner should note this as acceptable for now (Phase 15 is the full delivery system which may do server-side distance).

### Pattern 6: Distance in Detail Sidebar
**What:** Append distance text to the existing location display at sidebar bottom (line ~1121).

```typescript
// Replace the existing location row:
<div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
    <MapPin size={14} />
    <span>
        {listing.location || 'Location not specified'}
        {distanceFromUser != null && (
            <> · <span className="text-primary font-semibold">{Math.round(distanceFromUser)} miles away</span></>
        )}
    </span>
</div>
```

Where `distanceFromUser` is derived from `useLocation()` + `haversineDistanceMiles(...)` in the component body.

### Anti-Patterns to Avoid
- **Importing from CarCard.tsx directly:** `BODY_TYPE_LABELS` and `FUEL_TYPE_LABELS` are not exported from CarCard. Redefine them at the top of `page.tsx` (or extract to a shared `src/lib/vehicleLabels.ts`) rather than importing from a component file.
- **Using navigator.geolocation outside useEffect:** Always wrap in useEffect — SSR will throw. The existing `useUserLocation` hook handles this correctly.
- **Calling postcodes.io for every render:** Cache the geocoded coordinates in `LocationContext` state and `localStorage`; never call the API on each render.
- **Blocking fetchListings while geocoding:** Geolocation is async. Fetch listings immediately; apply distance filter/sort once location resolves (or store in ref and re-apply).
- **Adding `pb-safe` to Tailwind without config:** Use the arbitrary value `pb-[env(safe-area-inset-bottom)]` which works in Tailwind v3 out of the box.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haversine distance | Custom implementation | `src/lib/distance.ts` already exists | Already verified against Earth's radius constant |
| Geolocation + caching | New hook | `src/hooks/useUserLocation.ts` or `LocationContext` (new) | 10-min TTL cache already implemented |
| UK postcode geocoding | Custom geocoder | `https://api.postcodes.io/postcodes/:postcode` | Free, no auth, returns lat/lng directly |
| Compare list state | Manual localStorage | `CompareContext.addToCompare()` | Already handles max-3 / drop-oldest |
| Watchlist state | Manual API calls | `addToWatchlist` / `removeFromWatchlist` from `src/lib/listingApi.ts` | Already wired in detail page |
| Web Share API fallback | Custom share modal | `navigator.share` with clipboard fallback | Already implemented as `handleShare` in detail page |

---

## Common Pitfalls

### Pitfall 1: BODY_TYPE_LABELS / FUEL_TYPE_LABELS Not Exported
**What goes wrong:** TypeScript import error because `CarCard.tsx` defines these as file-scope constants, not exports.
**Why it happens:** They were copy-and-paste added to CarCard for standalone use.
**How to avoid:** Define them at the top of `page.tsx` (same values) OR extract to `src/lib/vehicleLabels.ts` and update both CarCard and page.tsx to import from there. The planner should make this a Wave 0 task.
**Warning signs:** "Module ... has no exported member 'BODY_TYPE_LABELS'" TS error.

### Pitfall 2: `listingCount` not in Seller Prisma select
**What goes wrong:** `listing.seller.listingCount` is `undefined` at runtime — trust panel shows "0 active listings" or crashes.
**Why it happens:** The `findBySlug` include block (listings.service.ts ~line 506) selects specific fields from the seller via `include: { dealerProfile: true }` — it does not currently compute a count. Prisma does not automatically include relation counts without explicit `_count` select.
**How to avoid:** In `findBySlug`, add a `_count: { select: { listings: true } }` to the seller include. Then in the API response shape, map `seller._count.listings` to `listingCount` before returning. Also extend the `Listing.seller` type in `listingApi.ts` to include `listingCount?: number`.
**Warning signs:** `listing.seller?.listingCount` is `undefined` in the frontend after backend change.

The exact Prisma change needed:
```typescript
// In findBySlug seller include block (listings.service.ts):
seller: {
    include: {
        _count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } },
        dealerProfile: true,
        // ... existing includes
    }
}
// Then when returning, map:
// seller.listingCount = seller._count?.listings ?? 0
```

The controller/service must map `_count.listings` → `listingCount` since Prisma returns it as `_count.listings`, not `listingCount`.

### Pitfall 3: SSR Crash on navigator / localStorage Access
**What goes wrong:** `window is not defined` or `navigator is not defined` during Next.js server render.
**Why it happens:** `LocationContext` and `useUserLocation` access browser-only APIs.
**How to avoid:** Use `"use client"` on `LocationContext.tsx` and the buy-cars `layout.tsx`. Wrap localStorage access in `try/catch`. Check `typeof window !== 'undefined'` before accessing or wrap in `useEffect`.

### Pitfall 4: compare handleCompare Still Uses Query Param Pattern
**What goes wrong:** After phase 11, `handleCompare` in detail page currently does `router.push('/compare?slug=...')` — it does NOT call `addToCompare()` from context. The sidebar's new Compare button must call `addToCompare(listing)` then `router.push('/compare')`.
**Why it happens:** The original compare implementation was a URL-param approach; CompareContext was added later and the detail page never got wired.
**How to avoid:** In the phase plan, explicitly task the developer to replace `handleCompare` to use `useCompare().addToCompare(listing)` then navigate. The current `handleCompare` (line 342-345) is dead code after this change.

### Pitfall 5: Distance Filter Pagination Mismatch
**What goes wrong:** User sets "25 mi" filter. API returns 16 results. Only 3 have lat/lng within 25 miles after client-side filter. `totalCount` still shows the API total (e.g. 200), not 3.
**Why it happens:** Pagination count comes from the backend, distance filter is applied client-side.
**How to avoid:** When `maxDistanceMi` is active, hide the "showing X of Y" total or display "Filtered results" instead. Do not attempt to reconcile the count — acknowledge the limitation.

### Pitfall 6: Mobile Sticky Bar Overlaps Page Content
**What goes wrong:** The fixed bottom bar covers the last CTA or content on mobile.
**Why it happens:** Fixed elements don't take up document flow.
**How to avoid:** Add `pb-24 lg:pb-0` (or similar) to the main page `<div>` wrapper so content is not hidden under the bar. Already done for the footer in the project — same pattern.

### Pitfall 7: postcodes.io Rate Limits
**What goes wrong:** Postcode geocoding fails silently or returns 429 if user types many postcodes quickly.
**Why it happens:** postcodes.io has rate limits (not documented but enforced).
**How to avoid:** Debounce postcode input by 600ms before calling the API. Cache results in LocationContext state (session) and localStorage (persistent, with TTL).

---

## Code Examples

### Computing listingCount in Prisma (Backend)
```typescript
// listings.service.ts — findBySlug seller include block
seller: {
    include: {
        sellerProfile: { /* existing */ },
        dealerProfile: true,
        _count: {
            select: {
                listings: {
                    where: { status: 'ACTIVE', deletedAt: null }
                }
            }
        }
    }
}
// After query, before return:
const sellerWithCount = {
    ...listing.seller,
    listingCount: (listing.seller as any)._count?.listings ?? 0,
}
return { ...listing, seller: sellerWithCount }
```

### LocationContext consumption in detail page
```typescript
// src/app/buy-cars/[slug]/page.tsx — add at top of VehicleDetailsContent
const { location: userLoc } = useLocation()
const distanceFromUser = React.useMemo(() => {
    if (!userLoc.lat || !userLoc.lng || !listing?.latitude || !listing?.longitude) return null
    return haversineDistanceMiles(userLoc.lat, userLoc.lng, listing.latitude, listing.longitude)
}, [userLoc, listing])
```

### Seller profile page — KYC badge addition
```typescript
// src/app/seller/[id]/page.tsx — in the Identity section after the tier/reliability block
<div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-2.5">
    <ShieldCheck size={18} className="text-emerald-400" />
    <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500">Verified</p>
        <p className="text-sm font-bold text-emerald-400">KYC Verified</p>
    </div>
</div>
{totalListings > 0 && (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
        <Car size={18} className="text-gray-400" />
        <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Active Listings</p>
            <p className="text-xl font-black text-white">{totalListings}</p>
        </div>
    </div>
)}
```

Note: `totalListings` is already computed in the seller profile page via `getSellerActiveCount()` (line 107-117) and assigned at line 211. It is already available — just needs displaying.

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|-----------------|--------|
| handleCompare → URL param `/compare?slug=` | addToCompare(listing) → navigate /compare | CONTEXT.md decision: use addToCompare |
| Tiny CheckCircle + "Verified Dealer" text | Trust panel card with ShieldCheck + count | Phase 11 upgrade |
| No eyebrow badges on detail page | bodyType + fuelType + Auction pills above H1 | Phase 11 addition |
| Distance filter via text location field | Preset radius chips + client-side Haversine | Phase 11 addition |

**Deprecated approaches:**
- `handleCompare` at line 342-345 using `router.push('/compare?slug=...')` — replace entirely with `useCompare().addToCompare()` + `router.push('/compare')`
- The existing tiny verified seller badge block (lines 1006-1022) — replaced by trust panel

---

## Backend Changes Required

### 1. Add listingCount to GET /listings/:slug seller object (REQUIRED)
**File:** `backend/src/listings/listings.service.ts` — `findBySlug` method
**Change type:** Additive only — no schema migration needed. Prisma `_count` is computed at query time.
**Steps:**
1. Add `_count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } }` to the seller include block in `findBySlug`
2. Map `seller._count.listings` to `listingCount` in the return value
3. Extend `Listing.seller` type in `src/lib/listingApi.ts` with `listingCount?: number`

### 2. No other backend changes required
- Distance filtering: client-side post-fetch (Haversine in `src/lib/distance.ts`)
- Listing type (AUCTION/CLASSIFIED): already in `Listing.type`
- Lat/lng: already in `Listing.latitude` / `Listing.longitude`
- Seller verification: already in `dealerProfile` on the seller include

---

## Open Questions

1. **LocationContext placement — buy-cars layout vs root layout**
   - What we know: `src/app/buy-cars/` only has `[slug]/page.tsx`; there is no `layout.tsx` yet. The context is needed on both `/search` (which is `src/app/search/`) and `/buy-cars/[slug]`.
   - What's unclear: If LocationContext wraps only `src/app/buy-cars/layout.tsx`, it won't cover `/search/page.tsx`. It needs to either be in the root layout (`src/app/layout.tsx`) or a shared group layout.
   - Recommendation: Add `LocationProvider` to the root `src/app/layout.tsx` alongside the existing `CompareProvider`. This is the simplest solution. The context only activates its geolocation logic inside `useEffect` (client-only), so SSR is unaffected. Alternatively wrap the `/search` page independently — but root layout is simpler.

2. **Search page uses `useUserLocation` hook already — should it switch to LocationContext?**
   - What we know: `src/app/search/page.tsx` imports `useUserLocation` at line 17. The new LocationContext will encapsulate the same logic.
   - What's unclear: Whether the planner wants two location systems momentarily (hook + context) or replaces the hook usage with context in Phase 11.
   - Recommendation: Replace `useUserLocation` import in search page with `useLocation()` from LocationContext. Keeps a single source of truth. `useUserLocation` can remain for backward compatibility but should not be used in new code.

3. **Postcode geocoding API — postcodes.io vs Nominatim**
   - What we know: Backend already uses `https://nominatim.openstreetmap.org/search` for geocoding listing locations. The frontend could use either postcodes.io (UK-only, free, no key) or Nominatim.
   - Recommendation: Use `api.postcodes.io` for UK postcodes in LocationContext — it's purpose-built for this, returns instant results, and is free without registration. Nominatim is better for full address search (which the backend uses for listing locations).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not detected in web project — no jest.config.js, vitest.config, or `__tests__/` directory found in `src/` |
| Quick run command | Manual browser verification |
| Full suite command | Manual browser verification |

The web application (`src/`) has no automated test infrastructure. All validation is manual browser testing. The mobile app has Jest (configured in `jest.config.js` at the root of the mobile app directory), but Phase 11 is exclusively web platform work.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| BADGE-01 | Category badge eyebrow renders bodyType + fuelType pills above H1 on detail page | Manual browser | Navigate to any listing with bodyType + fuelType set |
| BADGE-02 | Auction badge renders on AUCTION listing, absent on CLASSIFIED | Manual browser | Compare an auction listing vs classified listing |
| SIDEBAR-01 | Save/Watchlist button in sidebar toggles correctly, persists state | Manual browser | Click heart, refresh page, heart should stay active |
| SIDEBAR-02 | Share button invokes Web Share API or copies URL | Manual browser | Click share on mobile (Share API) and desktop (clipboard) |
| SIDEBAR-03 | Compare button calls addToCompare and navigates to /compare | Manual browser | Click compare, verify /compare shows the vehicle |
| MOBILE-01 | Mobile sticky bar visible on small screens, hidden on lg+ | Manual browser | Resize viewport; bar should appear below lg breakpoint only |
| TRUST-01 | Trust panel shows ShieldCheck + "Verified" + listing count | Manual browser | Inspect sidebar seller block; count should be > 0 for active sellers |
| TRUST-02 | Seller profile page shows KYC badge + prominent totalListings | Manual browser | Visit /seller/:id; badge and count visible in header |
| PROX-01 | CarCard shows ~X mi chip when user location is set | Manual browser | Allow geolocation; browse /search; chips appear on cards |
| PROX-02 | Detail sidebar shows "X miles away" next to location | Manual browser | Visit a listing detail page with geolocation allowed |
| PROX-03 | Distance filter chips (10/25/50/100/200 mi) visible in search sidebar | Manual browser | Open filter panel on /search |
| PROX-04 | Selecting distance chip filters cards to only those within radius | Manual browser | Select 10 mi — verify only nearby listings appear |
| PROX-05 | Results sort closest-first when distance filter is active | Manual browser | Check order of cards against distance chip values |
| PROX-06 | Postcode fallback input appears when geolocation denied | Manual browser | Deny geolocation permission; postcode field should appear |
| PROX-07 | Distance chip does not render on CarCard when listing has no lat/lng | Manual browser | Check cards for listings without geocoded coordinates |

### Wave 0 Gaps
- [ ] Create `src/app/buy-cars/layout.tsx` if it does not exist (needed to scope the LocationContext OR add to root layout)
- [ ] Create `src/context/LocationContext.tsx` — new file
- [ ] Extract `BODY_TYPE_LABELS` and `FUEL_TYPE_LABELS` to `src/lib/vehicleLabels.ts` (optional but avoids duplication) OR define at top of `[slug]/page.tsx`

*(No test framework setup needed — web project has no automated tests)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/app/buy-cars/[slug]/page.tsx` — all current sidebar, badge, and header patterns
- Direct code inspection: `src/context/CompareContext.tsx` — addToCompare max-3 behaviour, localStorage persistence
- Direct code inspection: `src/hooks/useUserLocation.ts` — geolocation + 10-min TTL localStorage cache
- Direct code inspection: `src/lib/distance.ts` — haversineDistanceMiles implementation
- Direct code inspection: `src/components/features/CarCard.tsx` — distanceMi prop, BODY_TYPE_LABELS, FUEL_TYPE_LABELS, chip render pattern
- Direct code inspection: `src/app/search/page.tsx` — FilterState interface, useUserLocation usage, buildApiFilters, fetchListings flow
- Direct code inspection: `src/app/seller/[id]/page.tsx` — totalListings already computed, BadgeCheck/ShieldCheck already imported
- Direct code inspection: `backend/src/listings/listings.service.ts` — findBySlug seller include block, no listingCount currently
- Direct code inspection: `backend/src/listings/dto/listing-filter.dto.ts` — no lat/lng/maxDistanceMi params
- Direct code inspection: `src/lib/listingApi.ts` — Listing type (latitude, longitude, type, bodyType, fuelType confirmed)

### Secondary (MEDIUM confidence)
- postcodes.io public API — UK postcode geocoding, free, no auth required (standard approach for UK apps)
- Prisma `_count` select — documented feature for computing relation counts without separate queries

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all examined from source code directly
- Architecture: HIGH — patterns derived from existing code in the repository
- Pitfalls: HIGH — identified from direct code inspection, not assumptions
- Backend changes: HIGH — Prisma `_count` is an established pattern, confirmed no migration needed

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable codebase — no fast-moving external dependencies)
