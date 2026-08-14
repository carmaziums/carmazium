# CarMazium Mobile — Overhaul Plan (2026-08-14)

Consolidated execution plan for the four problem areas raised by the client:
UI/UX quality, dealer-dashboard accuracy, navigation/user journeys, and
performance + notifications.

Evidence base — the four audits under `.parity/`:

| File | Scope |
|---|---|
| `.parity/01-ui-visual-audit.md` | Card system, tokens, web visual parity |
| `.parity/02-dealer-parity-audit.md` | Dealer routes vs web + backend contract |
| `.parity/03-navigation-journey-audit.md` | Route map, role gating, journey traces |
| `.parity/04-perf-notifications-audit.md` | Render/network/socket perf, push + in-app notifications |

Design source of truth: **`<repo-root>/CarMazium Design System/`** — specifically
`colors_and_type.css` (tokens) and `ui_kits/carmazium-mobile/` (a complete
React-concept mobile kit: `mobile-kit.jsx` atoms plus ~20 designed screens
including `screens-dealer-dashboard.jsx`, `screens-vehicle.jsx`,
`screens-auction.jsx`, `screens-sell.jsx`, `screens-empty-states.jsx`).
This kit did not exist when the previous UI passes were done — it supersedes
guesswork about "what should this look like."

---

## 0. Diagnosis — why the app "looks like a student project"

`CONTEXT.md` §0 already names the shape of the problem (prior passes fixed
*consistency*, never *design*). The audits pin down the mechanism:

**0.1 There is no palette — there are ~150 colours.**
`src/constants/colors.ts` was produced by a 2026-07-11 codemod that lifted every
raw hex literal in the codebase into a named token *without collapsing them*.
The result is 150+ entries like `deepBlue_1c1c22`, `deepBlue_1c1c24`,
`deepBlue_1c1d26`, `darkPink_521626`, `midOrange_a0783a`. Sixteen near-identical
dark blues, each used 2–7 times. That is not a design system; it is a hex dump
with names. Every surface in the app is a slightly different shade of nearly the
same colour, which is precisely what reads as amateur.

**0.2 There is no type scale — there are 14 arbitrary sizes.**
Same codemod, same outcome in `typography.ts`: `size7`, `size8`, `size9`,
`size10`, `size10_5`, `size11_5`, `size12`, `size14`, `size17`, `size19`,
`size22`, `size26`, `size30`, `size42` were appended alongside the real scale
(`xs`…`hero`). Usage counts: `size12` ×171, `size9` ×142, `size14` ×131,
`size10` ×109. The *majority* of text in the app is sized off the junk scale,
not the designed one.

**0.3 The one designed pass reached one screen.**
Commit `9d7ffa98` corrected the background ramp in `colors.ts` and restyled
`HomeScreen`'s three CTAs into a hierarchy (one accent-filled hero + a quiet
two-row utility list). Token consumers inherited the background fix for free —
but three high-traffic components bypass tokens entirely and still paint the
*pre-redesign* near-black:

- `src/components/VehicleCard.tsx:236` — `rgba(18, 18, 24, 0.8x)`
- `src/components/LiveBidCard.tsx:209` — same
- `src/components/GlassCard.tsx:70` — same

`VehicleCard` is the most-rendered component in the product (every grid on Home,
Search, Saved). `GlassCard` is a shared wrapper across many screens. So the
single most-visible surface in the app is still on the old palette.

**0.4 No elevation, no motion, no signature.**
Mobile cards carry zero shadow (only buttons do); web's card identity is an
explicit `box-shadow`. Mobile radius is 20px against web's 16px. The design
system's signature elements — chamfered primary CTA, mono gradient price,
uppercase tracked eyebrows, glass-blur surfaces, red glow — appear nowhere in
the app.

**Conclusion:** the fix is not "restyle 60 screens by hand." It is: rebuild the
foundation (0.1, 0.2), rebuild ~12 shared primitives against the design kit
(0.3, 0.4), then sweep screens onto those primitives. Most screens change by
virtue of what they already consume.

---

## Palette decision — flagged for the client

The design system's hard rule is: **primary brand red is `#FF0037`, not the old
`#ED1C24`.** The mobile app currently ships `#ED1C24`/`#DC1F26`, and web's
`globals.css` still defines `--color-primary: #ed1c24`.

Commit `9d7ffa98` recorded a client constraint of "no new colours, commit to the
web app's existing palette" — but that predates this design system, which is the
newer and more specific artefact and explicitly labels `#ED1C24` as *old*.

**Decision taken and since CONFIRMED by the client (2026-08-14):** `#FF0037` on
mobile. Web is **not** changed as part of this work, so the two platforms now
intentionally differ on the accent red until web adopts the design system too.

Similarly, the mobile kit specifies a deeper mobile-specific background
(`#0a0d14` body / `#13182a` elevated) rather than web's `#0f172a`. Adopted —
the kit is mobile-specific by design, and a phone screen in a dark room wants
the deeper ground.

---

## Phase 1 — Design foundation (tokens)

**Goal:** one palette, one type scale, real elevation/radius/motion tokens.
Nothing visual should regress; this phase is mechanical and total.

### 1.1 `src/constants/colors.ts` — collapse to a real palette

Rebuild around the design-system tokens:

```
Ground      bgBody #0a0d14 · bgElevated #13182a · bgCard rgba(20,26,42,0.78) · bgCardSolid #15192a
Brand       accent #ff0037 · accentDeep #d70030 · accentHot #ff4d6a · accentDark #9a0024
Support     secondary #2d3c63 (slate/blue) · silver #c0c0c0
Text        fg1 #ffffff · fg2 #d6dbe7 · fg3 #8a93a8 · fg4 #4b556b
Borders     border rgba(255,255,255,0.08) · borderHi rgba(255,255,255,0.16)
Semantic    success #10b981 · warning #f59e0b · info #3b82f6 · error #ef4444
            (+ their light variants, already present)
```

Then map every one of the ~150 junk tokens onto the nearest of these. Approach:

1. Keep the junk token *names* exported as deprecated aliases pointing at the
   new canonical values. This makes the change non-breaking in one commit and
   keeps `tsc` green.
2. Codemod call sites to the canonical names, file by file.
3. Delete the aliases once no call sites remain, and add an ESLint rule (or a
   simple `npm run lint:tokens` grep script) that fails on new raw hex.

Doing it in that order means the visual change lands atomically at step 1 and
the cleanup at step 3 is pure refactor.

### 1.2 `src/constants/typography.ts` — one type scale

Collapse `size7`…`size42` onto the semantic scale. Proposed mapping, derived
from the mobile kit's actual usage:

| Junk token | Uses | Maps to | Semantic role |
|---|---|---|---|
| `size7`, `size8`, `size9` | 189 | `eyebrow` = 10 | uppercase tracked labels |
| `size10`, `size10_5` | 110 | `micro` = 11 | badges, meta |
| `size11_5`, `size12` | 172 | `caption` = 12 | secondary/meta text |
| `size14` | 131 | `body` = 14 | default body |
| `size17`, `size19` | 8 | `h5` = 18 | card titles |
| `size22`, `size26` | 28 | `h3`/`h2` | section + screen titles |
| `size30`, `size42` | 2 | `h1`/`display` | hero |

Add the kit's missing text roles as presets: `eyebrow` (10px/800/0.18em/upper),
`monoPrice` (JetBrains Mono, 800, gradient-capable), `tabLabel`
(9.5px/700/0.06em/upper). Fonts already match the design system
(Poppins headings / Montserrat UI / JetBrains Mono numerics) — no font work needed.

### 1.3 `src/constants/spacing.ts` — add what's missing

Existing `Spacing` and `RowDensity` are sound. Add from the kit:

```
Radius     chip 8 · inline 12 · card 18 · sheet 22 · pill 9999
Elevation  card / cardHover / neon / neonHover  (RN shadow* + elevation pairs)
Motion     durFast 150 · durBase 300 · durSlow 500 · easeOut · easeSpring
Glass      blur 18 · blurStrong 24  (expo-blur intensities)
```

RN has no `box-shadow`; elevation tokens must ship both the iOS
`shadowColor/Offset/Opacity/Radius` set and the Android `elevation` number.

### 1.4 Verify

`npx tsc --noEmit` clean. No visual verification possible on this machine (no
Android SDK — `CONTEXT.md` §4); on-device check happens on the build machine.

---

## Phase 2 — Card & primitive component system

**Goal:** port the mobile kit's atoms into real React Native components, then
move every screen onto them. This is where the app stops looking generic.

### 2.1 New/rebuilt atoms (`src/components/ui/`)

Ported from `ui_kits/carmazium-mobile/mobile-kit.jsx`:

| Component | Kit source | Notes |
|---|---|---|
| `Eyebrow` | `CzEyebrow` | 10px/800/0.18em uppercase — used everywhere in the kit, absent from the app |
| `Price` | `CzPrice` | JetBrains Mono, 800, white→slate gradient text. Needs `expo-linear-gradient` + `maskedView`, or a solid fallback |
| `Badge` | `CzBadge` | live (pulsing dot + red glow) / featured (amber gradient) / premium / standard / verified / dark |
| `Chip` | `CzChip` | spec chips (year, mileage, fuel, body) — replaces `SpecBadge` |
| `GlassPill` | `CzGlassPill` | circular glass control for back/share/more — replaces ad-hoc `IconButton` uses |
| `Card` | `FeaturedCard`/`CompactCard` shells | the one card surface: `bgCard` + blur + 1px border + radius 18 + elevation |

### 2.2 Rebuilt existing components

- `VehicleCard.tsx` — **highest leverage in the app.** Drop the hardcoded
  `rgba(18,18,24,0.8x)`; rebuild against `Card` + `Eyebrow` + `Price` + `Chip`
  per the kit's `FeaturedCard`/`CompactCard`. Move price from a corner badge
  into the card body as a mono gradient price (kit + web both do this).
- `LiveBidCard.tsx`, `GlassCard.tsx` — same hardcoded-literal fix, onto `Card`.
- `HorizontalVehicleCard.tsx`, `SpecBadge.tsx`, `CategoryPill.tsx`,
  `GradeChip.tsx`, `AuctionCardBadges.tsx` — re-express on the new atoms.
- `Button.tsx` / `PrimaryCTA.tsx` — add the **chamfered signature shape** (the
  design system's single most identifiable element). RN has no `clip-path`;
  implement via `react-native-svg` clip or a masked container. Primary variant
  gets the red vertical gradient + neon shadow.
- `SectionHeader.tsx` — eyebrow + "See all" in accent, per the kit.
- `TabNavigator` tab bar — the kit's floating glass bar (inset 12px, radius 22,
  blur 24, active red dot + glow). Currently a standard opaque bar.

### 2.3 Screen sweep

Once 2.1/2.2 land, sweep screens in traffic order, applying the kit's designed
layouts where one exists:

1. Home (`screens-home.jsx`), Search (`screens-search.jsx`), Saved/Watchlist
2. Vehicle detail (`screens-vehicle.jsx`), Auction detail (`screens-auction.jsx`)
3. Sell flow (`screens-sell.jsx`), Messages (`screens-messages.jsx`)
4. Dashboards (`screens-dashboard.jsx`, `screens-dealer-dashboard.jsx`,
   `screens-dealer-listings.jsx`) — coordinate with Phase 3
5. Auth/onboarding, profile, settings, transaction, win-complete, empty states

`screens-empty-states.jsx` also closes the "empty states have no CTA" gap
already logged in `CONTEXT.md` §8.

---

## Phase 3 — Dealer dashboard parity

### The "hallucinated data" claim did not hold up

This needs saying plainly, because it changes what Phase 3 should be.

All 11 dealer screens were read in full and every displayed number, chart
series, list and status chip traced to its source, cross-checked against the
real NestJS services (`dealers.service.ts`, `dashboard.controller.ts`,
`listings.controller.ts`, `offers.controller.ts`, `finance.controller.ts`,
`users.controller.ts`, plus the DTOs). See `.parity/02-dealer-parity-audit.md`
for the provenance table.

**No fabricated data was found.** Every metric hits a real endpoint backed by a
real Prisma query. `DealerAnalyticsScreen`'s 13 KPIs, trends, funnel and chart
series are all computed server-side from live `Sale`/`Listing`/`Lead`/`Offer`
aggregates. A grep for `mock|dummy|sample|placeholder|fake|Math.random` across
all 11 files returned nothing but legitimate `TextInput` placeholder props.
Every checked POST/PATCH body matches its DTO's whitelisted fields, so there's
no `forbidNonWhitelisted` 400 risk either.

Two places where mobile is in fact *more* accurate than web:

- `DealerFinanceScreen` deliberately avoided copying web's `FUNDED`/`REVIEWING`
  statuses, which don't exist in the schema — the code comments say so.
- `DealerOffersScreen.tsx:536-562` gates "Mark as Sold" on
  `listing?.status !== 'SOLD'`. Web's equivalent page has no such check and
  still offers the action on an already-sold listing.

So what the dealer experience is actually suffering from is **navigation and
gating**, not invented numbers — which is consistent with the client's third
complaint rather than the second. That reframes Phase 3:

### What Phase 3 should actually be

- **P1 — dealer screens were unreachable.** `DealerEarnings` and `DealerFinance`
  were the only two dealer features missing from the drawer. **Done** — see
  Phase 4.
- **P1 — no KYC/verification gate.** Web hard-gates every `/dashboard/dealer/*`
  route behind KYC verification, a skipped-KYC wall, and a phone gate. Mobile
  registers every `Dealer*` screen bare. An unverified dealer-role user can
  reach the full dealer suite.

  **Done** (`e59d326c`), on instruction. The lock-out risk was handled rather
  than ignored:

  - **Staff members pass.** Someone who works for a verified dealership has no
    `dealerProfile` of their own, so their own `isVerified` is false — gating on
    it alone would have barred every employee of every verified dealer. Web uses
    `dealerProfile.isVerified || isStaffMember`; the backend has been returning
    `dealerStaffMemberships` (active only) on `/users/me` all along and mobile
    simply never read it. Now surfaced as `user.isDealerStaff`.
  - **The wall is always escapable** — Start KYC, or back to browsing.
  - Scope is the nine dealer *feature* screens. `DealerKYC` and
    `DealerOnboarding` stay open (they are how you get verified), and so does
    the dealer profile tab: web gates its dealer overview, but on mobile that
    screen is a bottom-tab destination *and* the route to KYC, so walling it
    risks stranding the user in their own profile tab.

  **Still wants an on-device pass** with three accounts — verified dealer,
  unverified dealer, and staff on a verified dealership — because the failure
  mode is locking out a real user.
- **P1 — missing dedicated routes.** Web has `add-listing` and `put-on-auction`
  as dealer routes; mobile reuses `SellCarFlow` and the seller auction flow.
  Confirm that reuse is intentional (it's plausible and may be fine) rather than
  a gap.
- **P2 — field-level divergence.** The audit spot-checked rather than
  exhaustively diffed CRM Kanban columns, team role enums, and inventory
  filters. Worth one narrow follow-up pass, folded into the Phase 2 sweep.

The backend controllers under `backend/src/` remain the arbiter throughout.

---

## Phase 4 — Navigation & user journeys

Driven by `.parity/03-navigation-journey-audit.md`. Confirmed headline findings:

- **7 built screens are unreachable** — registered in `MainStackNavigator` with
  zero in-app call site: `BuyerDashboard`, `BuyerBids`, `BuyerPurchaseHistory`,
  `BuyerDeliveryRequests`, `DealerEarnings`, `DealerFinance`, `AcceptInvite`.
  This is the single best effort-to-value fix in the whole plan: the screens
  exist and work, the drawer just never links to them. A dealer can reach
  Purchases but has no path to Earnings, one item further down the same list.
- **No broken navigate targets** — every `navigate('X')` resolves to a real
  registered screen. The breakage is all in the *unreached* direction.
- **~25 web routes have no mobile equivalent** — the entire admin dashboard and
  all three partner dashboards (finance/insurance/service), plus
  `/auth/partners`. `CONTEXT.md` §8 records these as deliberate omissions
  (those roles use web); confirming that decision still holds rather than
  building them.
- Role model on mobile only branches `buyer`/`seller`/`dealer`, consistent with
  the above.

### Dealer access gating — confirmed divergence

Web hard-gates **every** `/dashboard/dealer/*` route in
`src/app/dashboard/dealer/layout.tsx`: unverified dealers get a `KycOverlayForm`,
skipped-KYC dealers get a "Dealer Features Locked" wall, and even verified
dealers hit a `DealerPhoneGate` until a phone number exists. Children never
render until all three pass.

Mobile has **no equivalent gate**. `MainStackNavigator.tsx:169-220` registers
every `Dealer*` screen bare, with no guard. `GlobalDrawer.tsx` only branches on
`user?.isVerified` for its own "Become a Dealer" toggle; the `DEALER_ITEMS` rows
render unconditionally once `role === 'dealer'`. A dealer-role user who has not
completed KYC can reach the full dealer suite on mobile.

### Reverse-parity finding — web is the one that's wrong

Backend `offers.service.ts:798-842` returns `offer.listing.status`. Mobile's
`DealerOffersScreen.tsx:536-562` correctly gates "Mark as Sold" on
`listing?.status !== 'SOLD'` and shows a "Vehicle already sold" banner
otherwise. **Web's `dashboard/dealer/offers/page.tsx` does not check it at all**
and still offers "Mark as Sold" on an already-sold listing. Mobile is ahead
here — the guard should be ported *to web*, not away from mobile. Logged, not
actioned (this plan's scope is mobile).

- Dead routes (registered, never navigated to) and orphan targets (navigated to,
  never registered).
- Role-gated entry points that differ from web's sidebar/header.
- Post-mutation destinations — where mobile sends the user after offer sent,
  bid placed, listing published, payment success — against web, including
  missing `navigation.reset` and back-stack traps into completed wizards.
- The four end-to-end journeys (buyer retail, buyer auction, seller, dealer).
- Deep-link surface vs web URLs.

---

## Phase 5 — Missing surfaces & visual parity

Web sections with no mobile equivalent, from the visual audit:
`TestimonialsSection`, `FinanceCalculator`, `PromoCarousel`, `MarketingPopup`,
`DiscoverSection` — plus whatever the navigation audit's route diff turns up as
MISSING. Scoped and prioritised after Phases 1–4, since several may be
deliberate mobile omissions rather than gaps.

---

## Phase 6 — Performance & notifications

Driven by `.parity/04-perf-notifications-audit.md`. Confirmed headline findings:

**P0 — push notifications are dead end-to-end, on both sides.**
`src/lib/pushNotifications.ts` implements `registerForPushNotifications()` in
full — and **nothing in the app ever calls it**. Even if it were called, it
POSTs to `/users/push-token`, which **does not exist anywhere in
`backend/src`**; no route ever writes `expoPushToken` onto a user. The field
`notifications.service.ts:127` reads in order to send a push can therefore never
be populated. No user has ever received a push notification from this app.

> **This one needs a backend change** (a `POST /users/push-token` route plus the
> column/pref field to store it). `MOBILE_PARITY_PROMPTS.md` says not to touch
> `backend/`, so this is flagged for a decision rather than executed blind. The
> mobile half — calling the registration function on login — is ours and will be
> done regardless, but it stays inert until the endpoint exists.

Secondary, same area: the backend sends Android channel IDs
(`carmazium-bids`/`-messages`/`-default`) that match none of the channels the
client registers (`default`/`auctions`/`offers`). Moot until the above is fixed,
but must be fixed with it.

**P0 — startup blocks on 18 font variants.** `App.tsx` synchronously loads 18
font-family/weight combinations before first paint, holding the splash screen.

**In-app notifications are actually in good shape** — REST feed, unread badge,
single and bulk mark-read, and a solid `/notifications` Socket.IO gateway
(dual web/mobile auth, per-user rooms, reconnect catch-up) are all correctly
wired.

**Notification tap-routing is half-fixed.** Commit `d2d6b9eb` fixed
`OFFER_RECEIVED`/`OFFER_COUNTERED` (all three roles branch correctly), but the
same bug persists for `OFFER_ACCEPTED`/`REJECTED`/`WITHDRAWN` (hardcoded to
`BuyerOffers`) and `DEAL_CLOSED` (buyers land on a seller-scoped screen).
`KYC_APPROVED`/`KYC_REJECTED` and all four `DELIVERY_*` types have **no tap
destination at all**.

**Preferences are correct** — mobile's toggles map 1:1 to the real backend
gating fields. `newLot` has no backend event behind it; `sms` is honestly
disabled with "Coming soon".

**Perf is better than expected where audited.** `expo-image` carousels correctly
set `cachePolicy`/`contentFit`; `DealerLeadsScreen` shows real prior
remediation. Real issues found: `HomeScreen` renders rails via `.map()` inside a
`ScrollView` rather than `FlatList`; `VehicleCard` and `HorizontalVehicleCard`
subscribe to whole Zustand stores (every row re-renders on any store change —
compounding with `VehicleCard` being the most-rendered component in the app);
`AuctionDetailScreen`'s socket effect is keyed on `currentUser` by reference.

Caveat carried from the audit: only 4 of 58 list-bearing screens were swept, so
the perf list is a floor, not a ceiling.

- **Perf:** list virtualisation and `keyExtractor`/`getItemLayout`, memoisation
  and inline-prop churn in list rows, Zustand whole-store subscriptions,
  N+1 and sequential-await network patterns, `expo-image` cache policy and
  thumbnail sizing, socket listener cleanup and reconnect storms, startup
  work before first paint, non-native-driver animations.
- **Notifications:** establish whether push is actually wired end-to-end
  (permissions → token → backend storage → FCM config); then correct in-app
  notification copy, tap-routing per type, unread badging, realtime delivery,
  and preference-toggle mapping to real backend fields.

---

## Status — 2026-08-14

Branch: `mobile-overhaul-2026-08`. Every commit below is `tsc --noEmit` clean.
**Nothing here has been seen running.** This machine has no Android SDK
(`CONTEXT.md` §4), so all of it needs an on-device pass on the build machine
before release.

| | Work | State |
|---|---|---|
| ✅ | Phase 0 — four audits + this plan | done |
| ✅ | Phase 1 — palette, type scale, radius/elevation/motion tokens | done (`a53234f5`) |
| 🟡 | Phase 2 — primitives, palette, tab bar, radius scale, Home sweep | atoms + tab bar + radius codemod done; **per-screen layout sweep still outstanding** |
| 🟡 | Phase 3 — dealer | claim disproven; drawer fixed; **KYC gate deliberately not shipped** |
| 🟡 | Phase 4 — navigation | 2 wrong destinations + 5 dead screens fixed (`3f172026`); journey traces not re-run |
| ⬜ | Phase 5 — missing surfaces | not started |
| 🟡 | Phase 6 — perf + notifications | notification routing fixed (`a1c5537f`); **push still dead**; perf not started |

### Verify these first on the build machine

Ordered by how much damage a wrong guess would do:

1. **The tab bar floats now.** If any screen's bottom content padding assumed
   the old edge-to-edge bar, content will sit wrong. Most likely regression in
   this batch.
2. **The brand red changed** to `#FF0037`. Confirm the client wants it before it
   goes further than this branch.
3. **Deprecated colour aliases** collapsed ~150 shades onto a handful. Surfaces
   that relied on two near-identical darks reading as distinct will now match.
   Intended, but worth a look on dense dealer screens.
4. **Font sizes moved** up to 2px on the aliased scale. Check for clipped labels
   in tight rows.
5. **Notification tap destinations** — the offer/delivery routing now keys off
   the notification's `link`. Worth testing one real notification per type.

### The three systemic inconsistencies — all now closed

The same failure mode showed up in three places, and all three are fixed at the
token level rather than screen by screen:

| | Before | After |
|---|---|---|
| Colour | ~150 one-off tokens, 16 near-identical darks | one palette + deprecated aliases |
| Type | 14 arbitrary sizes carrying most of the app's text | one semantic scale |
| Radius | 16 different corner radii over 575 sites | `inline` / `card` / `sheet` on 394 surfaces |

The 142 circular elements were deliberately excluded from the radius pass —
snapping a 32×32 avatar's radius from 16 to 18 turns a circle into a lozenge,
which would be a bug rather than a restyle.

**What's genuinely left in Phase 2** is per-screen *layout* work — applying the
kit's designed compositions (`screens-vehicle.jsx`, `screens-auction.jsx`,
`screens-sell.jsx`, `screens-dealer-dashboard.jsx`, `screens-empty-states.jsx`)
to the corresponding screens, plus the chamfered `Button`/`PrimaryCTA`. That is
judgement work per screen, not a codemod, and it is the part that most wants a
device in hand.

### Blocked / needs a decision

- ~~Push notifications~~ — fixed (`f850c387`), and **no backend route was
  needed after all**. The sender reads `user.preferences.expoPushToken`;
  `preferences` is a JSON column and `PATCH /users/me` already shallow-merges
  into it, so mobile writes the token through the existing endpoint and the
  user's notification settings alongside it survive. Production backend
  untouched.

  Still required before it works in the wild: a **prebuild + fresh binary**
  (app.json changed, so OTA won't pick it up), and **FCM credentials on the
  Expo project** (`eas credentials`) — there's no `googleServicesFile` in
  app.json and no `google-services.json` in the repo, so whether that was ever
  set up could not be verified from this machine.
- ~~Dealer KYC gate~~ — shipped (`e59d326c`); still wants the three-account
  on-device check described above.

## Phase 7 — Web visual drift (`.parity/05-web-visual-drift.md`)

Web moved a long way since 2026-06-01 and mobile didn't follow. Admin, blog,
SEO and analytics-pixel work is excluded as web-only per `CONTEXT.md` §8.

**No P0s.** Specifically checked the privacy-sensitive ones: in every commit
where web started gating or hiding seller contact data (`732ef238`, `05cfe7e4`,
`25869c5d`, `8f54f6e9`), mobile either already gates it correctly via
`/sellers/{id}/phone` or never showed the field at all. Mobile is not leaking
anything web protects.

| # | Gap | State |
|---|---|---|
| P1 | Live-auction seller contact missing | **done** (`2b3aa480`) |
| P1 | "Call Seller" on the buyer's won-auction list | **done** (`b1472f24`) |
| P1 | Auction filter panel — web ported the full Buy Cars filter set to `/auctions`; mobile's `LiveScreen` had only a text query | **done** (`e798ba8e`) |
| P2 | Marketing popup absent on mobile | **won't build — see below** |
| P2 | How It Works fee ledger ported | **done** (`d39104d1`) |
| **P1** | Terms of Service badly out of date vs web's rewrite | **done** (`253508bd`) |

### Signup role — a divergence, not a defect

Web's `23920aa5` forced a deliberate role choice because its picker silently
defaulted to buyer. Mobile has no role picker and `authStore.signup` hardcodes
`role = 'BUYER'`.

That looks like the same bug but isn't. It is deliberate, and the code says why:
reading the local role there once wrote `DEALER` straight into the database for
fresh signups. Mobile grants dealer status only through `DealerOnboardingScreen`
→ `POST /users/elevate`, and buyer/seller are a single unified account on mobile
anyway (`CONTEXT.md` §1). So every mobile signup being a BUYER is coherent.

Left alone deliberately: changing signup role semantics blind would risk both
that historical data-sanitisation bug and bypassing the dealer KYC path.

## Phase 8 — Backend contract drift (`.parity/06-backend-drift.md`)

**No P0s.** The one that mattered most: a full field-by-field diff of
`CreateListingDto` against mobile's publish payload found no
`forbidNonWhitelisted` reject risk and no missing required field — the
2026-07-06 incident has **not** regressed.

| # | Gap | State |
|---|---|---|
| P1 | `SellerOffersScreen` never gated "Mark as Sold" on `listing.status` — the exact bug backend `11f96bf1` was fixing, fixed on the dealer screen but missed here | **done** (`2630c3c2`) |
| P1 | No mobile equivalent of web's one-time location/postcode prompt for *existing* accounts missing a postcode | **done** (`b1472f24`) |
| P2 | `notifStyle()` missing 10 emitted types, not just `AUCTION_WIN_EXPIRED` | **done** (`d39104d1`) |
| P2 | Photo tracker measured against 20 (the recommendation) not 100 | **done** (`d39104d1`) |

Auction re-review gating, payout tracking, chat room re-pointing, the chat
`otherUser` fix and refund-failure tracking are all either server-side and
transparent to mobile, or already consumed correctly.

### Terms of Service — a bigger gap than P2, and not one to fix by hand

Web rewrote its Terms in `8f54f6e9` and now carries **85 granular sections**
(Definitions, CarMazium's Role, Seller Authority to Sell, £125 Auction Buyer
Fee, Post-Auction Price Renegotiation, and so on). Mobile's `TermsScreen` still
has **10 broad ones** ("User Responsibilities", "Selling & Auction Rules") and
predates that rewrite entirely.

This is legal copy, and mobile is presenting materially different terms from
web for the same service. That is worth more than the P2 the audit assigned it.

**Ported** (`253508bd`), on instruction. The risk being managed was
mistranscription, so none of the text was written by hand: web's content model
and `SECTIONS` array were extracted programmatically into
`src/data/termsSections.ts` and then diffed against the source — the copy is
byte-for-byte identical to `src/app/terms/page.tsx` lines 14-856.

The text is a data module rather than screen content on purpose. `TermsScreen`
is presentation only, so when the terms change the file gets re-copied from web
wholesale instead of two copies being hand-edited in parallel and drifting
again — which is how this gap opened in the first place.

**Still needs the copy owner.** It is a faithful copy, but nobody with
authority over the legal content has reviewed it, and the mobile presentation
(83 cards in one scroll; web has a jump-to-section index mobile does not) has
not been seen on a device.

### The marketing popup is not a mobile gap

Web's `MarketingPopup` renders **only to signed-out users**
(`src/components/features/MarketingPopup.tsx:25,55`), and the backend DTO says
as much — "whether the popup shows to signed-out visitors".

Mobile gates the entire app behind `isAuthenticated` in `RootNavigator`; there
is no signed-out surface (`CONTEXT.md` §8 records guest browsing as a
deliberate, deferred gap). Porting the popup would therefore build a component
with no audience — it could never render.

Closed as not-applicable rather than outstanding. If guest browsing is ever
built, this comes back with it.

## Execution order and rationale

Phase 1 → 2 first: they are the client's loudest complaint, they are
self-contained, and every later phase's UI work lands on top of them (doing
Phase 3's dealer screens before Phase 2 would mean styling them twice).
Phases 3 and 4 are correctness work and can proceed in either order. Phase 6
is independent and can interleave. Phase 5 last, being additive.

Every phase ends with `npx tsc --noEmit` — the only automated gate this project
has (`CLAUDE.md`). Visual and on-device verification is **not possible on this
machine** (no Android SDK, `CONTEXT.md` §4) and must happen on the build machine
before release.
