# Carmazium Mobile — UI/UX Audit

**Date:** 2026-07-10
**Scope:** Read-only static audit of `carmazium app/carmazium app`, focused strictly on UI/UX (visual design, interaction, information architecture, audience fit, accessibility). Correctness/data-integrity issues already flagged in `mobile-audit.md` (hardcoded fake HPI data, fake ratings, stale-token socket, unvirtualized lists) are deliberately not re-listed here except where the *user-facing UX consequence* is a UI/UX issue in its own right.

> **This is a point-in-time snapshot — most findings below are now fixed.** See `mobile-ui-ux-plan.md`'s status banner (updated 2026-07-12) for a per-stage done/open breakdown. Only Stage 3 (BottomSheet migration) has meaningful remaining work — `SellerAuctionsScreen.tsx`'s schedule-auction modal.

---

## 1. Executive Summary

The app is visually cohesive at first glance — dark background, red accent, Poppins/Montserrat pairing — but that consistency is skin-deep. Underneath, three problems recur so widely that they define the product's UX character:

1. **The design tokens (`Colors`, `FontSize`, `FontFamily`) are used as suggestions, not rules.** Roughly 50 source files contain raw hex literals (over 1,600 occurrences), most screens hard-code font sizes as numeric literals (8, 9, 10, 11, 12, 13, 14, 15, 16, 17...) that bypass the `FontSize` scale entirely, and two files even define their own local `C = { ... }` colour map that shadows the design system (`SettingsScreen.tsx:20-30`, `GlobalDrawer.tsx:30-43`). The token layer exists but is not enforced, so every new screen re-invents shades and sizes. The tokens rule in `CLAUDE.md` is not being followed.
2. **The shared `BottomSheet` component (`src/components/BottomSheet.tsx`) was introduced explicitly to fix modal fragmentation across the app (see its own header comment) — but it is only imported by 2 files** (`components/listing/EnquireModal.tsx`, `screens/main/DealerLeadsScreen.tsx`). The other ~18 `Modal` sites (`SearchScreen`, `CompareScreen`, `ProfileScreen`, `SellerListingsScreen`, `SellerAuctionsScreen`, `DealerOffersScreen`, `DealerInventoryScreen`, `DealerTeamScreen`, `DealerPurchasesScreen`, `MyListingDashboardScreen`, `VehicleDetailScreen`, `GlobalDrawer`, `GlobalAIChatBot`, `ImportListingModal`, `BulkImportModal`, `StripeCheckoutModal`, etc.) still hand-roll their own overlay + sheet + handle + close-button. The consolidation was started and abandoned.
3. **Accessibility is effectively absent.** There is not a single `accessibilityLabel`, `accessibilityRole`, or `accessible=` prop anywhere in `src/`. Icon-only buttons (heart, trash, share, close, hamburger, bell) are unlabelled for screen readers. Dynamic Type is not respected — every font size in the app is a fixed pixel literal.

Per audience:
- **Buyers:** The Home / Search / Vehicle Detail flow reads as a curated marketplace on first paint, but trust-building falls apart under scrutiny — every listing shows a "✓ VERIFIED" chip, every listing shows a `4.5` star rating, every listing shows a "Clear HPI / None owed / No marker / 1 owner" history block. Buyers habituate to those signals meaning nothing. The compare, saved, and search screens are otherwise solid.
- **Private sellers:** The consolidated Sell flow (`SellCarFlowScreen`) is well-structured — 4 or 5 steps, clear stepper, per-step validation. Two problems undercut it for a once-in-a-lifetime user: Android hardware back drops the whole flow instead of stepping back a screen (no `BackHandler` interception), and errors surface as `Alert.alert()` popovers instead of inline field-level errors. Everything else in the flow is fine.
- **Dealers:** The dealer surface is broad — Inventory, Leads (with CRM), Analytics, Team, Offers, My Offers, Purchases, KYC, Onboarding — and each screen individually reads as a dealer tool. But they use **the same card density and padding as the buyer screens**. A power user managing a 50-vehicle inventory sees the same 76 px card + 14 px padding + soft border as a buyer browsing five listings. That's not right for the audience. Dealer screens also do not offer bulk actions, keyboard-friendly navigation, or list-view toggles — the buyer-oriented visual language has been reused wholesale.

**Top 5 UI/UX issues to fix first:**
1. Enforce design tokens (`Colors`, `FontSize`, `FontFamily`) via lint or a codemod pass — the current 1,600+ raw-hex occurrences, two shadow-`C` maps, and hard-coded font sizes mean every screen drifts slightly from the system. The rule is on paper (`CLAUDE.md`) but not applied.
2. Finish the `BottomSheet` migration to the ~18 remaining hand-rolled modals so they share backdrop / border-radius / close-button / keyboard-avoiding behaviour instead of each looking subtly different.
3. Remove or condition-render the always-on trust signals (`✓ VERIFIED` on every listing, `4.5` star badge, `VERIFIED BUYER/SELLER/DEALER` on every profile — see `ProfileScreen.tsx:277-283`). A trust chip that everyone gets is not a trust chip.
4. Add a `BackHandler` intercept to the Sell flow (`SellCarFlowScreen.tsx:1011-1014`) so Android hardware back decrements `step` instead of popping the navigator — this was reported as a real bug by the user during their own testing.
5. Give dealer screens their own visual density preset (denser rows, smaller card radius, table-style separators, list-view toggle) — reusing the buyer card style makes dealer inventory feel amateurish at scale.

---

## 2. Cross-cutting UI/UX issues

These are patterns that recur across many screens. Ranked by user impact.

### C1 — Design tokens bypassed everywhere; hardcoded hex + hardcoded font sizes are the norm
**Impact:** The whole product drifts from a single visual system. Fixing one colour never fixes it globally, because every screen re-hardcodes its own shade.

Raw-hex literals exist in ~50 source files (over 1,600 total occurrences per repo grep). Highest concentrations:
- `HomeScreen.tsx:578, 593, 617-663` — the entire `StyleSheet.create()` at the bottom uses raw hex (`#111115`, `#2A2A32`, `#18181E`, `#8A8A93`, `#A0A0AB`, `#505060`, `#606070`, `#FFFFFF`) instead of `Colors.bgSecondary`, `Colors.textMuted`, etc. And hardcoded font sizes (`fontSize: 8, 9, 10, 11, 12, 13, 14, 16, 17`) instead of `FontSize.xs/sm/base/md/lg`.
- `SellCarFlowScreen.tsx:346, 367, 390, 1527, 1602, 1841` — inline hex (`'#ED1C24'`, `'#404050'`) in JSX literals.
- `DealerInventoryScreen.tsx:62-66` — `STATUS_STYLE` map defines its own `#22C55E`/`#F59E0B`/`#6B7280` instead of `Colors.success`/`Colors.warning`.
- `DealerLeadsScreen.tsx:62-68, 587` — `STATUS_OPTIONS` and filter dot colours all hardcoded.
- `VehicleDetailScreen.tsx` — 188 hex literals in a single file (grep count).
- `AuctionDetailScreen.tsx` — 162 hex literals.
- `SearchScreen.tsx` — 66 hex literals.

Two files define **local colour constants that shadow the design system**:
- `SettingsScreen.tsx:20-30` — `const C = { bg: '#0A0A0C', card: '#111115', border: 'rgba(255,255,255,0.07)', accent: '#ED1C24', … }`. Six of these keys already exist in `Colors`.
- `GlobalDrawer.tsx:30-43` — `const C = { bg: '#13131A', accent: '#ED1C24', accentLight: 'rgba(220,31,38,0.14)', grey1: '#E2E2EA', grey2: '#A8A8B3', grey3: '#606070', activeRow: 'rgba(220,31,38,0.10)', … }`. This one at least has a comment ("Colour palette used exclusively inside the drawer"), but it means the drawer visually drifts from every other surface.

Font-size violations are just as bad — most screens hard-code numeric literals rather than importing `FontSize.xs`/`sm`/`base` etc. Random spot check in `HomeScreen.tsx` styles: `fontSize: 8, 9, 10, 11, 12, 13, 14, 16, 17, 28` — the token scale is `FontSize.xs (11), sm (13), base (15), md (16), lg (18)`, so half of these have no token equivalent and were simply eyeballed.

**Fix:** ESLint rule against hex literals in `.tsx` files, add a codemod pass to replace them by `Colors.*`, delete the two local `C` maps, and force `FontSize.*` (add a token for 9/10/11-caption if genuinely needed).

### C2 — `BottomSheet` migration is 2/20 done; modals still hand-roll their own shell
**Impact:** Modals read as several products stitched together — different backdrop opacity, different sheet radius, different close-button treatment.

The header comment of `BottomSheet.tsx` explicitly says it was created to standardize *"EnquireModal, DealerLeadsScreen's create-lead sheet, SearchScreen filters, etc."* — but only two callers actually adopted it (`EnquireModal.tsx`, `DealerLeadsScreen.tsx`).

Hand-rolled `Modal` still lives in:
- `screens/main/SearchScreen.tsx:523-566` (AI search modal), `:569-761` (filters modal) — both re-implement overlay + sheet + handle + close-button locally.
- `screens/main/CompareScreen.tsx:583-698` (car picker modal) — same.
- `screens/main/ProfileScreen.tsx:477-538, 592-698` (settings, verify, payment, help modals — four separate modals).
- `screens/seller/SellerListingsScreen.tsx:521-563, 568-627, 779-880` — action sheet + mark-sold + also-auction modals.
- `screens/seller/SellerAuctionsScreen.tsx:895-1145` — schedule-auction modal.
- `screens/seller/SellerOffersScreen.tsx:496-543` — counter-offer modal.
- `screens/main/DealerOffersScreen.tsx:462-...` — counter modal.
- `screens/main/DealerInventoryScreen.tsx` — sub-screen renderer used as a full-screen modal.
- `screens/main/DealerTeamScreen.tsx`, `DealerPurchasesScreen.tsx` — inline sheets.
- `screens/sell/MyListingDashboardScreen.tsx` — action modal.
- `screens/vehicle/VehicleDetailScreen.tsx:1300-1600` — HPI report modal, thumbnail viewer, offer modal.
- `components/GlobalDrawer.tsx:330-...` — slide-in drawer (correctly custom for a slide-from-right pattern, not really a bottom sheet — acceptable).
- `components/GlobalAIChatBot.tsx:210-...` — floating chat sheet (also custom by design — acceptable).
- `components/ImportListingModal.tsx`, `BulkImportModal.tsx`, `StripeCheckoutModal.tsx` — full-screen modals; borderline whether `BottomSheet` fits.

Backdrop opacity in these varies visibly: `SearchScreen.tsx` filters use `rgba(0,0,0,0.6)`-ish tones, `SellerListingsScreen`'s action sheet uses a different overlay, `VehicleDetailScreen`'s HPI modal has yet a third, and `BottomSheet` itself uses `rgba(0,0,0,0.75)`. Backdrop tap-to-close behaves differently in each.

**Fix:** Migrate the sheets in `SearchScreen`, `CompareScreen`, `ProfileScreen`, and the three Seller screens to `BottomSheet` first — those are the highest-traffic modals.

### C3 — Small icon touch targets, `hitSlop` inconsistently applied
**Impact:** Small icon-only buttons (14–18 px `Ionicons`) inside a `TouchableOpacity` are effectively unreachable on the first tap for a large chunk of users. iOS HIG is 44 pt, Material is 48 dp.

Only 20 of 75 files that use `TouchableOpacity` also use `hitSlop`. Concrete failures:
- `SellCarFlowScreen.tsx:389-391` — `hitSlop` on the trash-outline (size 16) is present but only 8 dp all around, giving ~32 dp effective target vs. the 44 pt requirement.
- `SellerOffersScreen.tsx:457` — size 14 close, no `hitSlop`.
- `SearchScreen.tsx:404` — size 14 close on AI banner, no `hitSlop`.
- `CompareScreen.tsx:294-301, 329-336` — size 16 close-circle on the car cards has no `hitSlop`.
- `DealerTeamScreen.tsx:178` — size 16 trash on team-member rows.
- `HomeScreen.tsx:196` — heart size 15 on featured/latest cards with only 8 dp hitSlop.
- `HorizontalVehicleCard.tsx` — heart button no `hitSlop`.
- `VehicleDetailScreen.tsx` — three icon buttons in floating header (share, save) at ~34 px containers — borderline OK, but no hitSlop.
- `DealerLeadsScreen.tsx:629` — size 10 price-tag icon inside the lead card, correctly not tappable, but sits next to tappable regions and can confuse tap targets.

**Fix:** Add a shared `IconButton` component that enforces a ≥ 44 pt tap area (via padding or `hitSlop`) and use it for every icon-only button.

### C4 — Zero accessibility hooks anywhere
**Impact:** The app is unusable with VoiceOver / TalkBack. Icon-only buttons are unlabeled; role information is missing; images have no alt text.

`grep -r "accessibilityLabel|accessibilityRole|accessible="` returns zero matches in `src/`. Every icon-only button in the app — hamburger, notifications bell, heart, share, close, back-chevron, trash, filter, sort, all four bottom-tab icons — is silent to screen readers.

Additionally, all fixed `fontSize` literals mean Dynamic Type / OS font scaling is not respected — the app renders at 15 px whether the user has "Larger Text" enabled or not.

**Fix:** Global sweep to add `accessibilityLabel` + `accessibilityRole="button"` to every icon-only `TouchableOpacity`; hide decorative icons with `accessibilityElementsHidden={true}`; and route font sizes through a helper that multiplies by `PixelRatio.getFontScale()`.

### C5 — Always-on trust signals that mean nothing
**Impact:** Every listing shows the same "verified / cleared / featured / rated 4.5 stars" chrome regardless of the underlying data. Buyers notice and disengage.

- `VehicleDetailScreen.tsx:577-579` — `<Text style={styles.verifiedText}>✓ VERIFIED</Text>` is hardcoded, shown on every listing.
- `VehicleCard.tsx:113-118` — `VERIFIED` badge conditional on `badgeTier === 'STANDARD' || 'PREMIUM'` (paid tier), which is a paid-signal not a trust-signal but visually reads like verification.
- `HomeScreen.tsx:86` and `lib/listingsApi.ts:175` — `rating: 4.5` hardcoded for every mapped listing. The rating badge inside `VehicleCard.tsx:162-166` renders the same value on every card.
- `VehicleDetailScreen.tsx:736-800` — SPECIFICATION and VEHICLE HISTORY blocks are hardcoded strings (`1 (Full FSH)`, `Clear`, `Mar 2026`, `None owed`, `No marker`, `5 clean`, `Present`). *Full trust/legal-integrity discussion is in `mobile-audit.md` W1; here it's a UX consequence — a buyer eventually notices and stops trusting every visible signal.*
- `ProfileScreen.tsx:277-283` — every profile shows "VERIFIED BUYER" / "VERIFIED SELLER" / "VERIFIED DEALER" purely based on `role`, unrelated to `isAddressVerified` (that is displayed separately below). The badge is meaningless.
- `ProfileScreen.tsx:238-241` — decorative "checkmarkBadge" over the avatar, shown always.

**Fix:** Gate every verification signal on real data (`user.isAddressVerified`, `listing.isSellerVerified`, `listing.rating != null`), and fall back to `"Not verified"` / no badge otherwise. Do not decorate every card with the language of trust.

### C6 — Iconography drift: emoji, Ionicons, MaterialCommunityIcons mixed
**Impact:** Body-type pickers, category chips, and status pills look like they were assembled by different designers on different days.

- `SearchScreen.tsx:55-64` — body types use emoji (`🚙`, `🚗`, `🚘`, `🚐`, `🏎️`, `🌅`, `🚌`, `🛻`) *right next to* Ionicons chevron/close icons.
- `HomeScreen.tsx:241-250` — body types use `car-outline`, `car-sports` (Ionicons) with per-body-type colours.
- `SellCarFlowScreen.tsx:90-102` — body types use MaterialCommunityIcons (`car-hatchback`, `car-limousine`, `car-estate`, `car-suv`, `car-sports`, `car-convertible`, `van-utility`, `truck`).

So the same conceptual "body type" is rendered three different ways depending on which screen the user is on. `CLAUDE.md` says `Ionicons`/`MaterialCommunityIcons` from `@/components/BrandIcon` only — the emoji use in `SearchScreen` violates that.

**Fix:** Standardize body-type icons on the `SellCarFlowScreen` MaterialCommunityIcons set (they're the most legible and specific), and thread the same map through `HomeScreen` and `SearchScreen`.

### C7 — Loading / empty / error state coverage is uneven
**Impact:** Some screens gracefully degrade; others go blank or silently swallow errors.

Positive: `SearchScreen`, `NotificationsScreen`, `AlertsScreen`, `MessagesScreen`, `DealerLeadsScreen`, `DealerInventoryScreen`, `HomeScreen`, `LiveScreen`, `SavedScreen` all have skeleton loaders and `EmptyState` fallbacks.

Negative:
- `SavedScreen.tsx:64` — comment says `"Tab filter — only 'All' is functional until backend provides richer data"` and the "Price drops / Auctions / Sold" tabs are shown but do nothing. Tapping them updates local state but never filters. This is worse than not showing the tabs.
- `SavedScreen.tsx:251-253` — the top-right filter icon is a bare `TouchableOpacity` with no `onPress`. It looks tappable and does nothing.
- `ProfileScreen.tsx:87-96` — API failure silently keeps stats at zero, no error banner. The stats show "0" indistinguishable from an actual empty account.
- `AlertsScreen.tsx:70-72` — catch block is empty (`// keep existing`), so a load failure just hides the change silently.
- `NotificationsScreen.tsx` — same pattern.
- `ChatContext` and other socket screens — reconnection failures on stale token (see `mobile-audit.md` P1) are invisible to the user; no toast, no banner, no reconnect button.
- `HomeScreen` — no error state at all. Every `Promise.allSettled` result that rejects silently disappears; the sections just stay empty with the "No listings found" empty state.
- `SellCarFlowScreen.tsx:903` — `saveDamageRecords(...).catch(() => {})` swallows the damage-save failure so a listing publishes without its damage disclosure and shows "Published!" (already flagged in `mobile-audit.md` W7 as a correctness bug; the UX consequence is the misleading success state).

**Fix:** Show `ErrorBanner` at the top of the screen when a load fails, offer retry, and never render dead controls (`SavedScreen` filter tabs, filter icon).

### C8 — Errors shown as `Alert.alert()` popovers instead of inline field errors
**Impact:** In multi-field forms (Sell flow, Dealer KYC, Dealer Onboarding, Login, Signup) an error kicks up a full-screen native alert that has to be dismissed before the user can see which field to fix.

- `SellCarFlowScreen.tsx:759, 996-1008` — `Alert.alert('Required', 'Please select your relationship to the owner.')`, `Alert.alert('Missing details', ...)`. The Sell flow has ~15 fields per step, so an `Alert` gives you the error phrase but not the field.
- `DealerOnboardingScreen.tsx:50` — `Alert.alert('Missing details', 'Trading name and VAT number are required to verify your dealership.')`.
- `LoginScreen.tsx:69` — `Alert.alert('Login Failed', err.message)`.
- `ProfileScreen.tsx:99-100, 156, 164-165, 174` — every save/verify path uses `Alert.alert`.
- `Compare / VehicleDetail / Chat` — routine "action complete" or "operation failed" all Alert.

There's already a `GlobalToastProvider` in the codebase and an `ErrorBanner` component — they're just not used for form validation. For per-step validation, inline red-below-field text (or the red border on `contactOptionSelected`-style pattern used in `EnquireModal`) is the right pattern.

**Fix:** Every form field should own its own error state and render it inline. Reserve `Alert.alert` for destructive confirmations (delete, sign out, cancel listing).

### C9 — Duplicate / redundant screens reachable from the same UI
**Impact:** Two bells → two different screens showing the same data.

`AlertsScreen.tsx` and `NotificationsScreen.tsx` both call `getNotifications()` from `lib/notificationsApi.ts` and render essentially the same feed — grouped by "Today / Earlier" (Alerts) vs. "Today / Yesterday / [date]" (Notifications). They differ only cosmetically (icon shapes, section headers, action row style).

They are reached from different places:
- Home bell (`HomeScreen.tsx:321`) → `Notifications`
- Search bell (`SearchScreen.tsx:364`) → `Alerts`
- Buyer dashboard bell (`BuyerDashboardScreen.tsx:233`) → `Notifications`, but same screen has another button (`:330`) → `Alerts`
- Dealer profile bell (`DealerProfileScreen.tsx:479, 516`) → `Alerts`
- Sell flow dashboard (`MyListingDashboardScreen.tsx:175, 213`) → `Alerts`
- Seller dashboard (`SellerDashboardScreen.tsx:255`) → `Notifications`

So depending on which screen you tap the bell on, you land on a different UI for the same data.

**Fix:** Delete one (probably `AlertsScreen` since `NotificationsScreen` has cleaner grouping and correct spacing tokens), repoint all navigators, and keep a single canonical route.

### C10 — Dealer screens use buyer-screen visual density
**Impact:** Dealers who manage many listings see the same low-density card treatment as a buyer browsing five options. Feels amateurish at scale.

Concrete evidence:
- `DealerInventoryScreen.tsx:437-484` — inventory rows use ~76 px card height, 14 px inner padding, soft-glass background, chevron on the right — visually identical to a buyer's `HorizontalVehicleCard`. There's no table view, no compact list view, no sort-by-column, no batch-select.
- `DealerLeadsScreen.tsx:610-651` — lead rows are 84 px cards with rounded avatar and multi-line meta — the same visual weight as a chat thread row for a buyer. No CRM-style density option.
- `DealerAnalyticsScreen.tsx` — uses the same padded, generously spaced KPI-card treatment as `BuyerDashboardScreen.tsx` — no dense table for revenue trend, no scannable data grid for top vehicles.

Compare buyer's `HomeScreen` card padding (16) with `DealerInventoryScreen`'s card padding — they're the same. But the dealer's screen is meant to be scanned quickly across dozens of rows.

**Fix:** Introduce a "dense" preset in the design tokens (`Spacing.rowDense: 10`, `FontSize.rowLabel: FontSize.sm`, borderRadius reduced from 18 → 10) and apply it to dealer surfaces. Add a list/grid toggle to `DealerInventoryScreen`.

### C11 — Inline styles instead of `StyleSheet.create` in one screen
**Impact:** `CLAUDE.md` convention violation, and every keystroke re-instantiates the style object.

`DealerKYCScreen.tsx:50-80` — the `FormField` component uses inline `style={{ ... }}` for every field label and input, with hardcoded `#111115`, `#2A2A32`, `#A0A0AB`, `#FFFFFF`, `#5C5C6B` and hardcoded `fontSize: 9, 15`. That's both a convention violation and a token violation in one place.

**Fix:** Move to `StyleSheet.create()` using `Colors`/`FontSize`.

### C12 — `KeyboardAvoidingView` in the AI chat has the Android bug the codebase otherwise avoids
**Impact:** On Android, the AI chat input is covered by the keyboard.

Every other `KeyboardAvoidingView` in the repo correctly uses `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. One exception:
- `GlobalAIChatBot.tsx:217` — `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. `undefined` on Android is a no-op, so the input goes under the keyboard when the user is chatting to the AI assistant.

**Fix:** Change `undefined` to `'height'` to match the codebase pattern.

### C13 — Dead controls in the UI
**Impact:** Users tap things that look interactive and get no feedback.

- `SavedScreen.tsx:251-253` — top-right filter icon: bare `TouchableOpacity` with no `onPress`.
- `SavedScreen.tsx:265-278` — tab bar (`All / Price drops / Auctions / Sold`) updates local `activeTab` state but the state is never used to filter the list (see the comment at `:64`). Every tab shows the same result.
- `ChatScreen.tsx:382-385` — voice-call icon opens `Alert.alert('Voice Call', 'Initiating call to ${displayName}…')` and does nothing else. It looks like a call button.
- `ChatScreen.tsx:391-395` — the listing banner is a `TouchableOpacity` whose `onPress` opens `Alert.alert('Listing Details', 'Redirecting to listing details for ...')`. Same problem — looks like a link, is not.
- `VehicleDetailScreen.tsx:659-666` — "Also in Live Auction" banner opens `Alert.alert('Live Auction Available', 'This vehicle is also running in a live auction. View auctions in the Live tab.')` — meaningful information, but the UI reads like a tap should navigate to the auction and it doesn't.
- `DealerInventoryScreen.tsx:395-407` — funnel/filter icon opens `Alert.alert` with hardcoded stubs "Most views / Most offers" whose `onPress` handlers are `() => {}` (i.e. tapping any option does nothing).

**Fix:** Either wire them up or remove the affordance. A tap that opens an alert saying "coming soon" is worse than no tap.

### C14 — Duplicated in-file color/style objects
Same as C1 but worth calling out separately because it's a specific pattern to be codemodded away:
- Local `C` maps in `SettingsScreen.tsx:20-30` and `GlobalDrawer.tsx:30-43`.
- `STATUS_STYLE` local maps in `DealerInventoryScreen.tsx:62-66` and `STATUS_CONFIG` in `SellerListingsScreen.tsx:62-91`.
- `SOURCE_LABELS` / `STATUS_OPTIONS` in `DealerLeadsScreen.tsx:62-76` — reasonable to keep local *labels*, but the colours attached should route through `Colors`.

---

## 3. Screen-by-screen findings

### Buyer surfaces

#### `HomeScreen.tsx`
- The visual language works — hero greeting, live-auction / featured / latest / by-type / recently-added horizontal rails. Skeleton loading is present and correct.
- **S1** — Section title colours (`#FFFFFF`) and body-text colours (`#8A8A93`, `#A0A0AB`, `#505060`) all bypass `Colors.textPrimary`/`Colors.textSecondary`/`Colors.textMuted`. `styles.sectionTitle` uses `fontSize: 11` — no `FontSize` token.
- **S2** — "See all" (`:220-224`) is a text link with only `activeOpacity`, no visible pressed state; on a real device this makes it hard to tell it was tapped.
- **S3** — `BODY_TYPES` (`:241-250`) uses `car-outline` for six of eight body types; only Coupé and Convertible use `car-sports`. From a distance the whole row looks identical since the icons don't disambiguate.
- **S4** — Sell-CTA card (`:544-557`) is prominent but the primary "START" button is oddly small (`paddingHorizontal: 16, paddingVertical: 10`) and off-brand vs. `PrimaryCTA`.
- **S5** — No error state; if all four `Promise.allSettled` promises reject, the user sees an entirely empty screen.

#### `SearchScreen.tsx`
- Solid overall: `FlatList` used for results, skeleton loading, empty state, refresh control all present.
- **S6** — Body-type filter emoji (`:55-64`) — see C6.
- **S7** — Both AI Search modal (`:522-566`) and Filters modal (`:568-...`) hand-roll their sheets instead of `BottomSheet` — see C2. AI Search modal has an `aiModalOverlay` styled as `rgba(0,0,0,0.55)`-ish; Filters modal uses a different overlay style; effect is two visibly different backdrops back-to-back.
- **S8** — "Sort" and "Filter" chip labels on `:439-451` use hex `#A0A0AB` and `#FFFFFF` hardcoded instead of `Colors.textSecondary`/`Colors.textPrimary`.
- **S9** — Sort dropdown (`:455-469`) is a floating box positioned absolutely below the sort button — good pattern, but not dismissed on outside-tap (no backdrop overlay). Tapping anywhere else on the screen leaves it visible.

#### `VehicleDetailScreen.tsx`
- Gallery gesture handler is excellent (spring-snap, pinch-zoom in fullscreen). Thumbnails, page dots, photo counter, floating actions all work.
- **V1** — Always-on `✓ VERIFIED` chip (`:577-579`) — see C5.
- **V2** — Fake description fallback (`:682-685`): `"${listing.colour} over black Merino leather. Carbon bucket seats, M Driver's package and full ${listing.make} main-dealer service history…"`. This literal fake description ships as the copy whenever `listing.description` is empty — a Ford Fiesta gets "M Driver's package" copy. Real UX bug: users see a description that doesn't match the car.
- **V3** — Specification / History cards are entirely hardcoded strings (`:736-800`) — see `mobile-audit.md` W1 for the data-integrity angle; the UX angle here is that a buyer opening two different listings sees exactly the same "1 (Full FSH) / Clear / Mar 2026" trio each time.
- **V4** — HPI callout card (`:840-...`) is well-designed — icon, description, £9.99 badge. The disconnect between this real, paid HPI report and the fake "HPI Clear" copy two cards above is confusing and undermines the CTA.
- **V5** — Floating header buttons (`:544-563`) are ~34 × 34 px — under 44 pt, no `hitSlop`.
- **V6** — "Also in Live Auction" banner (`:657-677`) is tappable but only opens an Alert (C13).
- **V7** — Enquire modal is now properly delegated to `EnquireModal` component (uses `BottomSheet`) — this is good.

#### `SavedScreen.tsx`
- Grid + list toggle is a nice touch, and the empty state is well-designed with a real CTA.
- **SV1** — Filter tabs `Price drops / Auctions / Sold` (`:265-278`) are decorative — see C13.
- **SV2** — Top-right filter icon (`:251-253`) has no handler — see C13.
- **SV3** — Grid-view heart button (`:132-141`) is 30 × 30 px in a 34 × 34 background — under 44 pt; no `hitSlop`.
- **SV4** — Text meta uses fixed pixel sizes (`fontFamily: FontFamily.medium, fontSize: 10-13`) that bypass `FontSize.xs/sm`.

#### `BuyerDashboardScreen.tsx`
- Good dashboard shape: KPI row + active bids / offers / recommendations sections.
- **BD1** — Bell icon (`:233`) goes to `Notifications`; a second bell-adjacent affordance (`:330`) goes to `Alerts`. Same-screen inconsistency — see C9.
- **BD2** — Cards use `#111115`, `#A0A0AB` hardcoded (35 raw-hex literals in this file). Same tokens are already in `Colors`.

#### `BuyerOffersScreen.tsx` / `BuyerBidsScreen.tsx` / `BuyerPurchaseHistoryScreen.tsx` / `BuyerDeliveryRequestsScreen.tsx`
- Structurally reasonable; the correctness/performance issues (unvirtualized `ScrollView` + `.map()`, un-memoized `renderOfferCard`/`renderBidCard`) are covered in `mobile-audit.md` P3.
- **BO1** — `BuyerOffersScreen` has 21 raw hex literals and 21 `TouchableOpacity`s — several small icon buttons (accept, decline, counter) sit at 14-16 px without `hitSlop`.
- **BB1** — `BuyerBidsScreen` — bid rows lack a clear "won / lost / active" visual differentiation beyond a small badge; the whole card should tint by state.

#### `AlertsScreen.tsx` / `NotificationsScreen.tsx`
- Redundant screens — see C9. `NotificationsScreen` has cleaner grouping (`Today / Yesterday / date`) and uses `Spacing.iconBtn` (correct token discipline); `AlertsScreen` has `Today / Earlier` and uses raw hex. Keep `NotificationsScreen`, retire `AlertsScreen`.

#### `CompareScreen.tsx`
- Solid comparison table, "Highlight winners" toggle is a nice touch. Ships avatar colours by index (`#ED1C24`, `#1E40AF`, `#A21CAF`) which are hardcoded (`:213-217`).
- **CO1** — Share button (`:252-258`) only fires `Alert.alert('Share', 'Sharing comparison report...')`. Dead — see C13.
- **CO2** — Car-picker modal (`:583-698`) hand-rolls its sheet — see C2.

### Seller / Sell surfaces

#### `SellCarFlowScreen.tsx`
- Step 1 → 5 is well-structured; the stepper (`:1022-...`) is one of the best-designed pieces of chrome in the app. DVLA prefill flow is a good UX shortcut.
- **SE1** — Android hardware-back bug: `handleBack()` (`:1011-1014`) is wired only to the header chevron and bottom-bar BACK button. Hardware back triggers React Navigation's default `pop`, which drops the whole flow instead of decrementing `step`. Add `useFocusEffect(useCallback(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleBack(); return true; }); return () => sub.remove(); }, [step]))`.
- **SE2** — Errors are `Alert.alert` — see C8. The `Alert.alert('Required', 'Please select your relationship to the owner.')` at `:759` is a clear example: the user is on step 1 with ~15 fields and gets a full-screen popover naming one of them.
- **SE3** — Inline hex literals in JSX (`'#ED1C24'`, `'#404050'`, `'#FFF'`) at `:346, 367, 390, 1527, 1602, 1841` — see C1.
- **SE4** — 3D damage viewer overlay (custom zone chips) uses `Ionicons` + inline hex — several ~10-13 px close icons without `hitSlop`.
- **SE5** — Damage record trash button (`:389-391`) is size 16 with 8 dp hitSlop — under 44 pt.
- **SE6** — `BADGES` array (`:105-138`) uses hex accents (`'#F97316'`, `'#3B82F6'`, `'#F59E0B'`, `'#FFFFFF'`) inline instead of `Colors`.
- **SE7** — Auction / Classified branching in the stepper is well-handled — different labels ("NEXT · AUCTION" vs. "REVIEW LISTING") at `:2141-2145`. Good.
- **SE8** — There is no in-flow save-and-exit affordance. A private seller who has to answer the door mid-flow loses everything — the `useSellWizardStore` exists but isn't surfaced to the user as "your draft is saved."

#### `MyListingDashboardScreen.tsx`
- One-off dashboard for a private seller. Simple and clean.
- **ML1** — Bell → `Alerts` (twice, `:175, 213`). See C9.

#### `SellerListingsScreen.tsx` / `SellerAuctionsScreen.tsx` / `SellerOffersScreen.tsx` / `SellerDashboardScreen.tsx` / `SellerPerformanceScreen.tsx` / `SellerProfileScreen.tsx` / `EarningsScreen.tsx`
- Reasonably-designed seller tools. `FlatList` is used correctly on `SellerListingsScreen` and `SellerAuctionsScreen`.
- **SL1** — `SellerListingsScreen` has 51 raw hex literals; `STATUS_CONFIG` (`:62-91`) hardcodes chip colours.
- **SA1** — `SellerAuctionsScreen.tsx:898-1145` — schedule-auction modal is a 250-line hand-rolled sheet. Prime C2 candidate.
- **SO1** — `SellerOffersScreen` counter-offer modal (`:496-543`) — same pattern.

### Dealer surfaces

#### `DealerInventoryScreen.tsx`
- Filter tabs (All / Live / Pending / Sold), add-listing CTA, per-listing card with status badge, days-listed, views, leads, offers. Correct structure.
- **DI1** — Card padding (16), border-radius (18), background (`rgba(18,18,24,0.85)`-ish) match buyer cards. See C10.
- **DI2** — `STATUS_STYLE` map (`:62-66`) hardcodes colours.
- **DI3** — Sort funnel `Alert.alert` (`:395-407`) — see C13.
- **DI4** — No bulk-select or multi-action controls — dealers with 30+ listings can't edit them in batches.

#### `DealerLeadsScreen.tsx`
- Correctly uses `BottomSheet` for the create-lead form. Good filter tabs, avatar-per-lead, HOT/WARM/COLD tags, unread badge on the lead card.
- **DL1** — Source picker missing for manual leads (see `mobile-audit.md` W6) — the UX consequence is that all manually-added leads look like "Walk-in" in the source column, degrading the analytics view over time.
- **DL2** — Lead card is high-visual-density (avatar + 3 rows + tags) but still uses 84 px height. Fine, but no compact list-view alternative.
- **DL3** — `STATUS_OPTIONS` and filter dot colours (`:62-68, 587`) hardcoded.

#### `DealerAnalyticsScreen.tsx`
- Real data wired to `/dealers/analytics`. `react-native-gifted-charts` used. KPI cards + trend badges + revenue chart + lead funnel + inventory health.
- **DA1** — KPI cards padded like buyer cards. See C10. Half-card width is `HALF_CARD` (`(SCREEN_WIDTH - 48 - 12) / 2`) — visually a lot of whitespace for a data-dense screen.
- **DA2** — No date-range custom picker beyond the preset chips; a dealer trying to compare a specific quarter can't.

#### `DealerKYCScreen.tsx`
- **DK1** — `FormField` component uses inline styles + raw hex — see C11.
- **DK2** — Long form with many fields — errors are `Alert.alert` — see C8.

#### `DealerOnboardingScreen.tsx`
- Good — form starts empty (the fake-prefill regression was already fixed with a comment explaining why at `:28-32`). Correct KeyboardAvoidingView behaviour.
- **DO1** — Alert.alert for missing details (`:50`).

#### `DealerProfileScreen.tsx`
- KPI grid, top-vehicles list, share/settings actions.
- **DP1** — 86 raw hex literals in this file. Trend colours hardcoded at `:77-79` (`'#22C55E'`, `'#EF4444'`, `'#9CA3AF'`).
- **DP2** — Bell → `Alerts` twice (`:479, 516`). See C9.

#### `DealerTeamScreen.tsx` / `DealerOffersScreen.tsx` / `DealerMyOffersScreen.tsx` / `DealerPurchasesScreen.tsx`
- Reasonably functional. `DealerTeamScreen` trash icon (`:178`) at size 16, no `hitSlop`.

### Shared / Chrome

#### `GlobalDrawer.tsx`
- Slide-in drawer with role-based sections. Well-organized, with clear grouping (NAVIGATION → SELLER TOOLS / DEALER CONTROLS → dealer-toggle CTA).
- **GD1** — Local `C` map at `:30-43` — see C1/C14.
- **GD2** — Menu row labels use `fontSize` derived from `styles.rowLabel` — check for `FontSize` token usage.
- **GD3** — Dealer's "Dealer auction manager" menu item honestly says "Coming Soon" via `Alert.alert` — that's fine, but an inline "Coming Soon" badge inside the drawer row would be less disruptive than an alert.
- **GD4** — Verified dot on the avatar (`:370-372`) uses `role`-based colour but is always shown regardless of `isVerified`. Same as C5.

#### `GlobalAIChatBot.tsx`
- Floating red-accent AI chat button. Sheet slides up from the bottom.
- **GA1** — `KeyboardAvoidingView` uses `undefined` on Android (`:217`). See C12 — likely the "keyboard covers the input" bug the pre-compaction summary mentioned.
- **GA2** — Uses hardcoded `#FFFFFF`, `#0084FF`-style hex; 33 raw-hex literals in the file.

#### `TabNavigator.tsx`
- Well-implemented custom tab bar with animated icon spring on focus and memoized press handlers. 44 × 32 tap zones (borderline, since `adjustsFontSizeToFit` also expands the label into a second tappable region, so real tap area is roughly 60 px tall — acceptable).
- Icons use `Ionicons` outline / filled variants for buyer tabs and MaterialCommunityIcons `gavel` for Live. Consistent.

#### `HamburgerButton.tsx`
- 38 × 38 with 10 dp `hitSlop` all around → effective 58 × 58 tap zone. Correctly sized.

#### `Button.tsx` / `PrimaryCTA.tsx`
- Not audited in detail; if they set the button system for the rest of the app, they should be reviewed for `activeOpacity`, focus rings, disabled state, loading indicator.

### Auth surfaces

#### `LoginScreen.tsx` / `SignupScreen.tsx` / `ForgotPasswordScreen.tsx` / `VerifyEmailScreen.tsx` / `ResetPasswordScreen.tsx` / `PostSignupOnboardingScreen.tsx` / `OnboardingScreen.tsx`
- Correct `KeyboardAvoidingView` behaviour on all of these (iOS `'padding'`, Android `'height'`).
- **A1** — Errors are `Alert.alert('Login Failed', err.message)` (LoginScreen `:69`) rather than inline field errors. Same for signup / forgot password.
- **A2** — Apple sign-in is correctly labeled "Coming Soon" per `mobile-audit.md`; that's fine.
- **A3** — Password fields have show/hide toggles (`showCurrentPwd`, `showNewPwd` in Settings) — good pattern. Not sure whether Login / Signup do the same — worth verifying.
- **A4** — Onboarding carousel (3 slides) is generic. No role selector at entry — a first-time dealer starts as a buyer and has to find "Apply for dealer account" in the drawer to elevate. That's a lot of clicks for a target audience.

---

## 4. Accessibility findings

Section 3 flagged these inline; consolidating here since accessibility often gets skipped:

- **A1** — Zero `accessibilityLabel` / `accessibilityRole` / `accessible` props in `src/`. Every icon-only button (bell, hamburger, heart, save, share, close, back-chevron, trash, filter, sort, tab icons) is invisible to VoiceOver / TalkBack.
- **A2** — Dynamic type: every `fontSize` is a fixed pixel literal. `allowFontScaling` defaults are inherited but nothing tests at 200% scale.
- **A3** — Colour contrast: `Colors.textMuted` (`#5C5C6B`) on `Colors.bgSecondary` (`#111115`) — 3.9:1, under WCAG AA (4.5:1). Same colour on `Colors.bgPrimary` (`#0A0A0C`) — 4.7:1, borderline. `textDisabled` (`#3A3A47`) fails on both.
- **A4** — Touch targets under 44 pt: see C3 for the full list. Specifically the heart on `VehicleCard.tsx:132-142` (34 × 34, no `hitSlop`), heart on `HomeScreen.tsx:196` (heart size 15 in a 30 × 30 button), delete on `DealerTeamScreen.tsx:178` (16 px icon, no `hitSlop`), close on `SellerOffersScreen.tsx:457` (14 px), trash on `SellCarFlowScreen.tsx:389-391` (16 px + 8 dp hitSlop = ~32 dp effective).
- **A5** — No visible focus indicator anywhere (bare `TouchableOpacity` with `activeOpacity` only — provides opacity feedback but no focus ring for keyboard/external-keyboard users on tablet).
- **A6** — `ChatScreen.tsx:432` "Seen" indicator is a two-character glyph (`✓✓`) with no screen-reader label — the semantics of "message read" are lost.
- **A7** — Loading spinners (`ActivityIndicator`) inside buttons have no `accessibilityLabel="Loading"`, so screen readers announce nothing while a form is submitting.
- **A8** — Reanimated `withSequence(withSpring(1.2), withSpring(1.0))` on tab icon focus (`TabNavigator.tsx:75-82`) runs every focus and does not honour `AccessibilityInfo.isReduceMotionEnabled`.

---

## 5. Quick wins (≤ 1 line-per-fix each)

- Change `undefined` to `'height'` on `GlobalAIChatBot.tsx:217` — fixes AI chat keyboard-covers-input on Android.
- Add `BackHandler` intercept in `SellCarFlowScreen.tsx` around the existing `handleBack()` — fixes the "hardware back drops out of the flow" bug.
- Delete `AlertsScreen.tsx` and repoint every `navigate('Alerts')` call to `Notifications` — removes the duplicate-bell-two-destinations problem.
- Remove the always-on `✓ VERIFIED` chip in `VehicleDetailScreen.tsx:577-579` (or gate on `listing.isSellerVerified`).
- Gate the `VERIFIED BUYER/SELLER/DEALER` badge in `ProfileScreen.tsx:277-283` on `user.isAddressVerified` (or delete it).
- Remove the decorative filter tabs and the no-op filter icon from `SavedScreen.tsx:251-253, 265-278`.
- Replace `rating: 4.5` in `HomeScreen.tsx:86` and `listingsApi.ts:175` with `undefined` and render "No rating" instead of a hardcoded star.
- Delete the two local `C = { ... }` maps in `SettingsScreen.tsx:20-30` and `GlobalDrawer.tsx:30-43` and use `Colors.*`.
- Wire `ChatScreen.tsx:391-395` listing banner tap to `navigation.navigate('VehicleDetail', ...)` instead of `Alert.alert`.
- Wire `VehicleDetailScreen.tsx:657-677` "Also in Live Auction" banner to `navigation.navigate('LiveAuctionDetailed', ...)` instead of `Alert.alert`.
- Migrate `SearchScreen`'s AI Search modal (`:522-566`) to `BottomSheet` — highest-traffic hand-rolled sheet.
- Add `accessibilityLabel` + `accessibilityRole="button"` to the four icon-shaped buttons in `VehicleDetailScreen.tsx:534-563` (back, share, save, thumbnail).
- Wrap `HamburgerButton`, tab-bar icons, and the notification bell in a shared `IconButton` component that enforces `accessibilityLabel` at the type level.
- Delete the fake-description fallback at `VehicleDetailScreen.tsx:683-685` (Merino leather / M Driver's package copy) — show "No description provided" instead.
- Move `Alert.alert('Login Failed', ...)` in `LoginScreen.tsx:69` to an inline `ErrorBanner` above the form.
- Swap the emoji body-type icons in `SearchScreen.tsx:55-64` for the `SellCarFlowScreen` MaterialCommunityIcons body-type set to make iconography consistent across screens.

---

## Notes on scope

- All performance and correctness findings (unvirtualized `ScrollView`+`.map()`, stale-token socket, hardcoded fake HPI/rating/spec data, `Damage record save failure swallowed`, dealer-source hardcoded to `walk_in`, Supabase session size, `pushNotifications.ts` bypasses `apiClient`) belong to `mobile-audit.md` — I only referenced them here where the *visible UX consequence* is a separate issue.
- I did not audit `Button.tsx`, `PrimaryCTA.tsx`, `SpecBadge.tsx`, `GlassCard.tsx`, `SectionHeader.tsx`, or `CategoryPill.tsx` in detail; if any of these ship the app's shared visual primitives, they warrant a separate short pass.
- I did not device-test. Every finding above is derived from static code inspection cross-checked against `CLAUDE.md`'s conventions.
