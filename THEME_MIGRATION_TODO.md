# Dark/Light Theme Migration — Status

## Done

**Infrastructure**
- Removed `forcedTheme="dark"` from `src/components/providers/ThemeProvider.tsx`; kept `defaultTheme="dark"`.
- Added `@custom-variant dark (&:where(.dark, .dark *));` to `src/app/globals.css` (Tailwind v4 class-based dark mode).
- Added `ThemeToggle` component (`src/components/ui/ThemeToggle.tsx`), wired into `Header.tsx` (desktop + mobile) and `profile/page.tsx`.
- Made the shared CSS utilities theme-aware in `globals.css`: `.dealer-glass-card`, `.metallic-foil` (light gets a dark-graphite gradient, `.dark .metallic-foil` gets the original silver gradient), `.vip-table-header`. This single change fixed contrast across every component that uses them (MetricCard, KPIGrid, all `dealer/*` chart widgets, dashboard headers).

**Fully migrated and reviewed** (all marketing pages, all auth pages except the intentionally-dark cinematic ones below, all of `src/app/dashboard/**`, all shared dashboard/dealer/chat/listing/hpi components). This includes:
- Marketing: Home, About, Pricing, Contact, Search, Compare, How-it-works, Reviews, Services, Terms, Finance, Sell, Profile, `buy-cars/[slug]`, `vehicle/[id]`, `auctions`, `auctions/live/[id]`, `auctions/won/[id]`, `seller/[id]`, checkout success/cancel/page.
- Auth: `callback`, `accept-invite` (light-styled already).
- Dashboard: buyer, seller, finance, insurance, service, admin, user, and **dealer** (including the VIP-styled dealer dashboard — this now works because the underlying `dealer-glass-card`/`metallic-foil` CSS became theme-aware).
- Shared components: `ListingWizard.tsx`, `ImageUpload.tsx`, `DamageAnalysisTool.tsx`, `VehicleDamageMapper.tsx`, `CarDamageMap.tsx`, `ChatRoomList.tsx`, `ChatWindow.tsx`, `HpiReportModal.tsx`, `KycOverlayForm.tsx`, `ReceiptsTab.tsx`, `RecordSaleModal.tsx`, `NotificationBell.tsx`, `LoginWall.tsx`, `FinanceCalculator.tsx`, `ImportListingModal.tsx`, `DualRangeSlider.tsx`, all `src/components/dealer/*.tsx` chart/table components.

Real bugs found and fixed along the way (worth knowing about if similar patterns show up in new code):
- `Input.tsx`/`Textarea.tsx` initially used an inline `style` prop for theme colors — inline style always beats a caller's `className` override, which silently broke pages that pass custom background/text colors (e.g. the login page's frosted-glass input). Fixed by moving to Tailwind arbitrary-value classes (`bg-[var(--bg-input)]`) inside `cn()`, so `tailwind-merge` lets callers override them.
- Several pages had a `<select>`/heading with `text-white` sitting on an otherwise-theme-aware background — invisible in light mode, invisible from reading the code, only visible by actually loading the page.
- A few pages had *both* `style={{ background: 'var(--bg-body)' }}` (already theme-aware) *and* a leftover `text-white` class on the same root element — remnant from a partial earlier pass. `auctions/page.tsx`'s hero section needed `text-white` scoped back onto just the hero `<section>` (it has a real photo background with a dark gradient overlay), not the whole page.
- **`bg-[#0A0A0C]` (a raw hex arbitrary value) was used pervasively across the entire dealer dashboard** (`dashboard/dealer/page.tsx`, `analytics`, `auctions`, `crm`, `finance`, `inventory`, `messages`, `team`) as an "input/panel background" color — completely missed by the `bg-slate-900`/`bg-slate-800` regex sweep because it's not a named Tailwind color. Found this by actually logging in as a dealer and seeing the "Recent Leads" card render as a solid black box on an otherwise-light page. Fixed by converting all instances to `bg-[var(--bg-input)]`/`bg-[var(--bg-dropdown)]` plus the `text-white` that depended on it, across all 8 files. **Lesson: when auditing for hardcoded dark colors, grep for `bg-\[#` and `text-\[#` too, not just named Tailwind classes.**

## Deliberately left dark-only (design decision, not oversight)

- `src/components/layout/Footer.tsx` — fixed navy gradient brand footer, verified converting it to theme vars actually *reduces* contrast (the vars are tuned for the page background, not this fixed-dark footer).
- Auth pages `login`, `signup`, `onboarding`, `partners`, `forgot-password`, `reset-password` — full-bleed photo background + dark glass-card overlay, a deliberate cinematic "showroom" look consistent across the whole auth flow. Converting would be a redesign, not a styling fix.
- Cinematic hero sections with photo/video backgrounds (HomeClient, About, `auctions/page.tsx`) — dark overlay + white text over an image, by design.
- Small branded elements that are self-consistent regardless of theme: the `MaziumWidget` floating chat FAB, `CountdownTimer` digital-clock-style boxes, colored buttons/badges (`bg-primary text-white`, status pills, etc.), VIP intro cards in `ListingWizard`/`DealerQuickList` using solid `bg-black`/`bg-[#0A0A0C]`, 3D-viewer canvas loading screens (`ThreeDVehicleViewer`, `VehicleDamageMapper` 3D fallback).

## Not yet done

- No systematic pass was made for color-contrast edge cases inside third-party-rendered content (e.g. Stripe embedded elements, any WYSIWYG output) — those inherit their own styling and weren't part of this app's Tailwind classes.
- `src/app/admin/analytics/page.tsx` was fixed anyway even though it appears to have no incoming links (likely dead code superseded by `dashboard/admin/analytics`) — no reason left to flag it.

## Session 3: full-codebase audit for missed patterns

Went through every `.tsx` file specifically hunting for token *categories* my original regex passes didn't cover, rather than re-checking files. Found and fixed real bugs in each category:

- **Raw hex colors bypassing the `bg-slate-900`/`bg-slate-800` regex**: `bg-[#0A0A0C]` was used as a general-purpose "input/panel" dark background across nearly the entire dealer dashboard (`dashboard/dealer/page.tsx`, `analytics`, `auctions`, `crm`, `finance`, `inventory`, `messages`, `team`, plus `BulkImportModal.tsx`, `DealerQuickList.tsx`, `EnquireModal.tsx`) and in `ListingWizard.tsx`. **The single worst one: the main form-card wrapper that holds every step of the listing wizard (Vehicle Details → Photos → Pricing → Review) was still hardcoded near-black** — meaning `/sell` and both dealer/seller "Add Listing" flows looked broken past the first screen, and this was never caught because earlier browser testing only reached the method-selection screen, not the actual form steps.
- **Solid `bg-black` on ordinary form fields** (not video-embed containers, which are legitimately always black): the VRM registration lookup input in both `ListingWizard.tsx` and `DealerQuickList.tsx`, plus a "Download Template" button and a team-invite email/role form — none of these are styled like a UK number plate, so `bg-black` was just a leftover, not a design choice.
- **Two entire dashboard overview pages missed outright**: `dashboard/finance/page.tsx` and `dashboard/seller/page.tsx` — somehow excluded from every earlier batch script. Fixed identically to their sibling pages.
- **`text-slate-*` and `placeholder:text-slate-*`** — a second "gray" naming scheme the original safe-pass regex (which only matched `text-gray-400/500/300`) didn't catch. Found across `auctions/page.tsx` (the auction-card footer, which sits on a now-light card even though the image section above it is a legitimate dark photo overlay), `auctions/live/[id]/page.tsx`, `buy-cars/[slug]/page.tsx`, `KycOverlayForm.tsx`, `dealer-verification/page.tsx`, `dealer/inventory/page.tsx`, `NotificationBell.tsx`, `ListingWizard.tsx`.
- **Self-contradicting `bg-white/10 text-white` combos**: a couple of buttons (`dashboard/buyer/offers/page.tsx`'s "Browse Cars", `ListingWizard.tsx`'s step-navigation "Back" button) used a translucent-white pill design that's invisible against a light page background — the exact opposite of what a "frosted white pill" is supposed to look like once the page itself can also be white.
- **Regex-artifact cleanup**: an earlier automated pass (the "strip `text-white`" script from session 2) had a bug — it didn't special-case `hover:text-white`, so ~15 files ended up with dangling `hover:` / `dark:hover:` classes (missing the actual color) instead of the intended `hover:text-primary dark:hover:text-white`. These weren't contrast bugs (the elements just lost their hover color entirely, in both themes) but are now fixed for correctness. Also cleaned up ~20 instances of a harmless cosmetic double-space in class strings from the same script.

**Verification**: logged in as both a buyer/seller account and a dealer account (real production data) and walked the *entire* dealer "Add Listing" flow end-to-end — VRM lookup, DVLA data card, 3D damage mapper, description/video-links, photos, publish bar — plus the equivalent seller `ListingWizard` flow (intro cards → step 1 Vehicle Details, confirmed the form-card fix rendered correctly). Also re-verified `dashboard/seller` and re-checked `auctions`/`auctions/live/[id]` in the browser after the slate-color fixes. `npx tsc --noEmit` clean throughout.

## Verification performed
- `npx tsc --noEmit` passes clean after every batch of changes.
- Visually verified in both themes via the dev server + browser preview, logged in with real accounts (both a buyer/seller account and a dealer account), with real production data:
  - **Buyer/seller dashboard** (`dashboard/user`): overview metric cards, Inventory table, Offers (incoming, expanded row), My Offers table, Watchlist, Messages (chat list + open conversation with real messages both directions), Settings, Seller Auctions table, Seller Earnings (Sales History + Receipts tabs), Profile page (theme toggle), NotificationBell dropdown.
  - **Dealer dashboard** (`dashboard/dealer`): Overview (KPIGrid, Recent Leads table), Inventory (real vehicle cards + dark mode), Team, Leads/CRM (kanban board + Add Lead modal), Finance, Auctions (table + Create Auction form with 6 input fields), Analytics (KPI cards + RevenueAreaChart + OfferDonutChart with real data), Messages.
  - Public pages: Home, About, Pricing, Compare, How-it-works, Search (filters, sort, results, CTA), `buy-cars/[slug]`, `auctions`.
- Found and fixed one real bug during dealer login that the earlier code-review pass missed (`bg-[#0A0A0C]`, see above) — everything else held up correctly against real data in both themes.
