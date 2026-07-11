# Carmazium Mobile — UI/UX Improvement Plan

Staged execution plan derived from `mobile-ui-ux-audit.md` (2026-07-10). Complements `mobile-audit-plan.md` (performance & correctness). Same format — one focused session per stage, ready-to-paste prompt each.

## Coordination with the performance/correctness plan

Two plans exist. They touch different concerns but share a couple of files. Do them in this coordinated order:

1. `mobile-audit-plan.md` **Stage 1** (real vehicle data wired into `VehicleDetailScreen`) — do this **before** UI/UX Stage 1, because UI/UX Stage 1 removes the fake "always ✓ VERIFIED / Clear HPI / 4.5 stars" decorations; if you remove them before the real data is wired, the screen looks empty.
2. `mobile-audit-plan.md` **Stage 2** (socket auth stability) — self-contained, do whenever.
3. UI/UX **Stage 1** (trust chrome cleanup) — depends on perf Stage 1.
4. UI/UX **Stage 2** (design tokens enforcement) — do before UI/UX Stage 6 because the dealer density preset relies on real tokens.
5. UI/UX **Stages 3–5** — largely independent; do in the listed order for clean review boundaries.
6. `mobile-audit-plan.md` **Stages 3–5** — do in whatever order matches your risk appetite.
7. UI/UX **Stage 6** (dealer density preset) — do after tokens (Stage 2) and after the perf plan's virtualization sweep (its Stage 4), so the dealer inventory transformation happens on already-`FlatList`ed screens.

Every stage's acceptance criteria include `npx tsc --noEmit` clean and on-device verification of the touched flows.

> **STATUS AS OF 2026-07-12** (verified by direct code inspection — see `mobile-production-readiness-plan.md`):
> - **Stage 1 (trust chrome, C5) — DONE.** VERIFIED chips/badges throughout (`VehicleDetailScreen`, `VehicleCard`, `ProfileScreen`, `GlobalDrawer`) are all gated on real fields (`isSellerVerified`, `isAddressVerified`) — none render unconditionally anymore. `VehicleCard`'s tier badge and the real VERIFIED chip are correctly split into two separate elements.
> - **Stage 2 (design tokens, C1/C11/C14) — DONE.** `grep -rE '#[0-9a-fA-F]{3,8}' src/screens src/components` returns zero hits.
> - **Stage 3 (BottomSheet migration, C2) — DONE as of 2026-07-12.** 14 files now use `BottomSheet` (up from 2). `SellerAuctionsScreen.tsx`'s schedule-auction modal (called out in the original plan as "biggest single win," ~250 lines) migrated 2026-07-12 — see `mobile-production-readiness-plan.md`'s Section 1 status for the details on how the two-step wizard's custom header/step-indicator was preserved as sheet content rather than using `BottomSheet`'s own `title` prop. `VehicleDetailScreen.tsx`'s remaining `<Modal>` usage checked and confirmed correct as-is: it already has 4 `<BottomSheet>` uses plus `<StripeCheckoutModal>` for HPI, and the one raw `<Modal>` left is a fullscreen pinch-to-zoom photo lightbox — gesture-driven, can't function inside a bounded bottom sheet, correctly excluded. `BulkImportModal.tsx`, `GlobalAIChatBot.tsx`, `GlobalDrawer.tsx`, `ImportListingModal.tsx`, `StripeCheckoutModal.tsx` remain hand-rolled by design (full-screen or custom-gesture modals, explicitly excluded from this migration in the original plan). No hand-rolled modal sites remain that should be migrated.
> - **Stage 4 (form UX, C8/SE1/SE8/A1) — DONE (spot-checked).** `Alert.alert('Required', ...)` is gone from `SellCarFlowScreen.tsx`.
> - **Stage 5 (accessibility, C3/C4/C6/C13) — DONE.** `components/IconButton.tsx` exists; 126 `accessibilityLabel` occurrences in `src/` (was 0).
> - **Stage 6 (dealer density + Alerts dedup, C9/C10) — DONE.** `AlertsScreen.tsx` deleted; `RowDensity` tokens exist in `constants/spacing.ts`.

---

## Stage 1 — Trust chrome cleanup (audit §C5, most quick wins)

**Why first (after perf Stage 1):** the app currently shows "✓ VERIFIED" chips, `4.5` star ratings, "Clear HPI", "None owed", "No marker", "1 owner (Full FSH)", "VERIFIED BUYER/SELLER/DEALER" on **every** listing and profile regardless of the underlying truth. Once buyers notice, every visible signal loses meaning. Small diff, huge trust impact.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C5 and the "Quick wins" section. This stage removes or conditionalizes every always-on trust signal in the app. Assume `mobile-audit-plan.md` Stage 1 has already landed, so `CarListing` now carries real `motStatus`, `owners`, `isSellerVerified`, `writeOffCategory`, etc. — you're wiring the visual chrome to those fields, not adding new backend fields.
>
> Do this:
> 1. **`VehicleDetailScreen.tsx:577-579`** — the `✓ VERIFIED` chip is hardcoded. Gate on `listing.isSellerVerified === true`; if false or missing, do not render the chip. Do not fall back to a "Not verified" label — just omit.
> 2. **`VehicleDetailScreen.tsx:682-685`** — delete the fake description fallback (`"${listing.colour} over black Merino leather. Carbon bucket seats, M Driver's package..."`) and render `"No description provided"` in a muted style when `listing.description` is empty.
> 3. **`HomeScreen.tsx:86` and `lib/listingsApi.ts:175`** — remove the hardcoded `rating: 4.5`. `CarListing.rating` becomes optional. Every rating badge (`VehicleCard.tsx:162-166`, wherever else it renders) must handle `rating == null` by hiding the star row entirely — not by showing "0" or "—".
> 4. **`VehicleCard.tsx:113-118`** — the current `VERIFIED` badge fires on `badgeTier === 'STANDARD' || 'PREMIUM'`. Rename it (in code + display) to something honest like `PREMIUM` / `STANDARD` / `FEATURED` — because it's a paid-tier indicator, not a verification signal. Then wire a **separate** `VERIFIED` chip that only shows when `listing.isSellerVerified === true`.
> 5. **`ProfileScreen.tsx:277-283`** — the `VERIFIED BUYER/SELLER/DEALER` badge fires purely on `role`. Gate on `user.isAddressVerified === true` (or whatever the real verification flag is per Supabase user metadata — check `authStore.ts`). If not verified, hide.
> 6. **`ProfileScreen.tsx:238-241`** — the decorative avatar checkmark: same rule as #5.
> 7. **`GlobalDrawer.tsx:370-372`** — the small verified dot on the avatar in the drawer: same rule.
>
> Explicitly out of scope: adding a verification flow, adding a KYC prompt, redesigning the profile card. Only conditional-render the chrome that already exists.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - A brand-new account (not verified, no address, no listings) shows zero "verified" / "cleared" / "featured" chrome anywhere.
> - A verified dealer with real listings shows the chrome only on their own profile card and on their listings.
> - No literal string `"✓ VERIFIED"`, `"Clear"`, `"None owed"`, `"No marker"`, `"4.5"`, or the "Merino leather / M Driver's package" copy remains anywhere in the render tree.

---

## Stage 2 — Enforce design tokens (audit §C1, C11, C14)

**Why second:** ~50 source files use raw hex (1,600+ occurrences), two files (`SettingsScreen.tsx`, `GlobalDrawer.tsx`) shadow the design system with their own local `C = { … }` colour maps, and hardcoded font sizes are the norm. Fixing one visual thing globally is currently impossible because every screen re-invents its shade. This is a foundation stage — everything after it (modal consolidation, dealer density preset, accessibility) benefits.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C1, §C11, §C14. Goal: **every colour in a `.tsx` file must come from `Colors` (`src/constants/colors.ts`), every font size from `FontSize` (`src/constants/typography.ts`), every font family from `FontFamily`.** No local shadow palettes.
>
> Do this:
> 1. **Audit the two local shadow palettes and delete them.** `SettingsScreen.tsx:20-30` (`const C = { bg, card, border, accent, muted, sub, text, red, radius }`) and `GlobalDrawer.tsx:30-43` (drawer palette). For every key: if a matching token already exists in `Colors`, replace inline; if it doesn't, **add the token to `Colors`** (with a sensible name — e.g. `Colors.drawerActiveRow`, `Colors.glassBorder` if not already defined) and use that. Do not port the hex to a new local constant.
> 2. **Codemod pass on hex literals.** For every hex or `rgba()` literal in `src/screens/`, `src/components/`, `src/context/`, replace with the nearest `Colors.*` token. If there is no reasonable match, extend `Colors` — do not leave a hex in place. Ranked-by-hex-density targets first (from the audit): `VehicleDetailScreen.tsx` (188), `AuctionDetailScreen.tsx` (162), `HomeScreen.tsx`, `DealerProfileScreen.tsx` (86), `SearchScreen.tsx` (66), `SellerListingsScreen.tsx` (51), `BuyerDashboardScreen.tsx` (35), `GlobalAIChatBot.tsx` (33). Same for hardcoded font sizes: 8/9/10/11/12/13/14/16/17 → nearest `FontSize` token (add `FontSize.caption` = 11 and `FontSize.tiny` = 10 if genuinely needed — the audit found many under-token sizes).
> 3. **Convert inline styles to `StyleSheet.create` in `DealerKYCScreen.tsx`.** The `FormField` component at `:50-80` uses `style={{ ... }}` with raw hex — move to `StyleSheet.create` at the bottom of the file, using tokens.
> 4. **Add an ESLint rule that fails CI on raw hex in `.tsx`.** Use `no-restricted-syntax` with a regex against string literals matching `/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i` and `/^rgba?\(/`, excluding `constants/colors.ts` itself. Add to `.eslintrc.js` (or wherever lint config lives). Same rule for numeric literal `fontSize` values outside `constants/typography.ts`.
> 5. **Do NOT change any visual output.** This stage is pure refactor. If a token match rounds slightly (e.g. `#111115` → `Colors.bgSecondary` which is `#111115` anyway), that's the goal. If a screen looks different after your pass, you made a real visual change and should stop and check.
>
> Explicitly out of scope: redesigning any component, adding new tokens for the sake of it, changing `Colors` values, changing icon sets (§C6 is Stage 5).
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - `grep -RE '#[0-9a-fA-F]{3,8}' src/screens src/components` returns zero hits (except inside `Colors` and any deliberately embedded SVG paths — those are content, not styling).
> - Every `.tsx` file's `StyleSheet.create` uses `Colors.*` and `FontSize.*` only.
> - ESLint fails on a test file that hardcodes `color: '#ED1C24'`.
> - Visual diff on every screen: no perceptible change (side-by-side screenshots before/after).

---

## Stage 3 — Finish the `BottomSheet` migration (audit §C2)

**Why third:** the shared `BottomSheet` component was built exactly to consolidate modal chrome ("EnquireModal, DealerLeadsScreen's create-lead sheet, SearchScreen filters, etc." per its own header comment) — but the migration was abandoned at 2 of ~20 callers. Every hand-rolled modal has a slightly different backdrop opacity, sheet radius, close-button treatment. Reads like several products stitched together.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C2. The shared `BottomSheet` at `src/components/BottomSheet.tsx` is currently used by 2 callers (`components/listing/EnquireModal.tsx`, `screens/main/DealerLeadsScreen.tsx`); ~18 other `Modal` sites hand-roll their sheet. Migrate them.
>
> Priority order (highest-traffic first — do these in this order in one PR, verify each on-device before moving on):
> 1. `screens/main/SearchScreen.tsx:522-566` (AI Search modal) and `:568-…` (Filters modal).
> 2. `screens/main/CompareScreen.tsx:583-698` (car-picker modal).
> 3. `screens/main/ProfileScreen.tsx:477-538, 592-698` (settings, verify, payment, help modals — four separate).
> 4. `screens/seller/SellerListingsScreen.tsx:521-563, 568-627, 779-880` (action, mark-sold, also-auction).
> 5. `screens/seller/SellerAuctionsScreen.tsx:895-1145` (schedule-auction — 250 lines, biggest single win).
> 6. `screens/seller/SellerOffersScreen.tsx:496-543` and `screens/main/DealerOffersScreen.tsx:462-…` (counter-offer modals — likely same shape, consider extracting a shared `CounterOfferSheet`).
> 7. `screens/main/DealerInventoryScreen.tsx`, `screens/main/DealerTeamScreen.tsx`, `screens/main/DealerPurchasesScreen.tsx`, `screens/sell/MyListingDashboardScreen.tsx` (action modals).
> 8. `screens/vehicle/VehicleDetailScreen.tsx:1300-1600` (HPI report modal, thumbnail viewer, offer modal — HPI stays a `WebView`-hosted flow, but the wrapping sheet can be `BottomSheet`).
>
> Explicitly **not** migrated (they're intentionally custom):
> - `components/GlobalDrawer.tsx:330-…` — slide-from-right drawer, not a bottom sheet.
> - `components/GlobalAIChatBot.tsx:210-…` — custom floating sheet with its own gesture model.
> - `components/ImportListingModal.tsx`, `BulkImportModal.tsx`, `StripeCheckoutModal.tsx` — full-screen modals, not bottom sheets. Leave alone.
>
> For each migration:
> - Preserve the inner content verbatim; only the outer overlay + sheet + handle + close-button chrome moves to `BottomSheet`.
> - Set `avoidKeyboard` on any sheet that contains a `TextInput` (this triggers the `KeyboardAvoidingView` inside `BottomSheet` — critical for Android per its inline comment).
> - Pick `maxHeightPercent` per sheet based on its current visual height (default is 92, which is fine for most; use 60 for short action-list sheets).
> - Delete the now-unused local `styles.overlay`, `styles.sheet`, `styles.handle`, `styles.closeBtn` from each migrated screen.
>
> Explicitly out of scope: refactoring the internal sheet content, adding new sheets that don't exist today, redesigning `BottomSheet` itself.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - Every listed screen opens/closes its sheets with the same animation, backdrop, and close-button treatment as `EnquireModal` (visual parity check).
> - Every migrated sheet's backdrop is `rgba(0,0,0,0.75)` (the `BottomSheet` overlay value) — no more per-screen backdrop variance.
> - Every sheet with text inputs no longer covers the input with the keyboard on Android.
> - Repo grep for `<Modal[^>]*visible=` in `src/screens/`/`src/components/` returns only the intentionally-custom modals listed above.

---

## Stage 4 — Form UX: inline errors, hardware back, save-and-exit (audit §C8, SE1, SE8, A1)

**Why fourth:** every form in the app (Sell flow, Dealer KYC/Onboarding, Login, Signup) surfaces validation errors as full-screen `Alert.alert()` popovers instead of inline field-level errors. Combined with the Sell flow's Android hardware-back bug (drops the whole flow, doesn't step back), this is the single biggest friction source for private sellers and dealers filling out any form.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C8, screen findings SE1, SE2, SE8, and the auth-section findings A1. Do these together — they're all "forms should feel like forms, not native OS dialogs":
>
> 1. **Introduce a shared `FieldError` component.** Small red text row below an input, using `Colors.error` + `FontSize.xs`. Add an optional `error?: string` prop to whatever input primitives are used across the codebase (`FieldInput`, `TextInput`, `SL` label wrapper — check `SellCarFlowScreen.tsx`). If there's no primitive input component, create a simple `<Field label={} error={} required={}>{children}</Field>` wrapper in `src/components/Field.tsx`.
>
> 2. **`SellCarFlowScreen.tsx` — convert every `Alert.alert('Required', …)` / `Alert.alert('Missing details', …)` to inline errors.** In particular:
>    - `:759` (`'Please select your relationship to the owner.'`), `:996-1008` (missing-details bundle), and every other similar site in the file.
>    - Each `handleNext()` validation should set a `Record<fieldName, string>` of errors, render red text under each field, scroll the first error into view, and NOT show a native alert.
>    - The single blocking modal remains only for genuinely destructive confirmations (e.g. cancel-listing, delete-draft).
>
> 3. **Same for `LoginScreen.tsx:69`, `SignupScreen.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`.** An `ErrorBanner` (or a top-of-form `<FieldError>`) instead of `Alert.alert('Login Failed', err.message)`.
>
> 4. **Same for `DealerOnboardingScreen.tsx:50`, `DealerKYCScreen.tsx`, `NotificationSettingsScreen.tsx`, `ProfileScreen.tsx:99-100, 156, 164-165, 174`.**
>
> 5. **Android hardware-back intercept on the Sell flow.** In `SellCarFlowScreen.tsx` (around `:1011-1014` where `handleBack()` is currently only wired to the header chevron and BACK button), add:
>    ```ts
>    useFocusEffect(useCallback(() => {
>      const sub = BackHandler.addEventListener('hardwareBackPress', () => { handleBack(); return true; });
>      return () => sub.remove();
>    }, [step]));
>    ```
>    Verify on Android: hardware back on step 3 goes to step 2, not out of the flow.
>
> 6. **Save-and-exit affordance on the Sell flow (SE8).** `useSellWizardStore` already persists in-progress state. Surface it: on any step ≥ 2, put a small "Save draft & exit" button in the header. Tapping it saves + navigates back to wherever the user came from. On next `SellCarFlow` entry, offer "Continue your draft" as the first prompt. Don't build any new persistence — the store already does it.
>
> Explicitly out of scope: redesigning the Sell flow's step structure, adding new fields, changing validation rules.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - Repo grep: `Alert.alert\('Required'` and `Alert.alert\('Missing details'` and `Alert.alert\('Login Failed'` all return zero hits in `src/`.
> - Test flow: leave Make blank in Sell step 1, tap NEXT — a red "Required" line appears under Make and the view scrolls to it. No native alert.
> - Test flow: hardware back on Sell step 3 → step 2 (not out of flow). Repeat until step 1, then hardware back exits.
> - Test flow: on step 3, tap "Save draft & exit", relaunch app, open Sell → prompted to continue draft.

---

## Stage 5 — Accessibility + icon-button consolidation (audit §C3, C4, C6, C13)

**Why fifth:** zero `accessibilityLabel` / `accessibilityRole` in the entire codebase — every icon-only button (bell, hamburger, heart, share, close, trash, chevron, tab icons) is silent to VoiceOver/TalkBack. Many are under the 44 pt tap target. Dynamic Type isn't respected. Some `TouchableOpacity`s exist that literally do nothing (dead controls). This is one PR because the fixes share a single shared `IconButton` component.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C3, §C4, §C6, §C13, and the full "Accessibility findings" section.
>
> 1. **Create a shared `IconButton` component** at `src/components/IconButton.tsx`. Signature:
>    ```ts
>    interface IconButtonProps {
>      icon: ComponentType<any> | ReactNode;  // Ionicons/MCI element or a render prop
>      accessibilityLabel: string;  // REQUIRED — TypeScript-enforced
>      onPress: () => void;
>      size?: number;  // icon size, default 20
>      variant?: 'ghost' | 'solid' | 'circle';
>      disabled?: boolean;
>    }
>    ```
>    The container is always ≥ 44×44 pt (via padding), `accessibilityRole="button"`, `accessible={true}`. `hitSlop` filled in automatically to guarantee 44 pt even for small icons.
>
> 2. **Replace every icon-only `TouchableOpacity` with `IconButton`** across the codebase. Specific known-bad spots from the audit:
>    - `SellCarFlowScreen.tsx:389-391` (trash, 8dp hitSlop)
>    - `SellerOffersScreen.tsx:457` (close, no hitSlop)
>    - `SearchScreen.tsx:404` (AI banner close, no hitSlop)
>    - `CompareScreen.tsx:294-301, 329-336` (car-card close, no hitSlop)
>    - `DealerTeamScreen.tsx:178` (trash)
>    - `HomeScreen.tsx:196` (heart)
>    - `HorizontalVehicleCard.tsx` (heart)
>    - `VehicleDetailScreen.tsx:534-563` (floating back/share/save)
>    - `SavedScreen.tsx:132-141` (grid-view heart)
>    - Every tab icon, hamburger, notifications bell — wrap or replace.
>
> 3. **Delete the dead controls** flagged in §C13. Either wire them or remove:
>    - `SavedScreen.tsx:251-253` (no-op filter icon) — remove.
>    - `SavedScreen.tsx:265-278` (decorative filter tabs) — remove.
>    - `ChatScreen.tsx:382-385` (voice call → alert-only) — remove until it's real.
>    - `ChatScreen.tsx:391-395` (listing banner → alert-only) — wire to `navigation.navigate('VehicleDetail', { id: threadListingId })`.
>    - `VehicleDetailScreen.tsx:657-677` (Also-in-Live-Auction banner → alert-only) — wire to `navigation.navigate('LiveAuctionDetailed', ...)`.
>    - `CompareScreen.tsx:252-258` (Share → alert-only) — remove until it's real.
>    - `DealerInventoryScreen.tsx:395-407` (sort funnel → alert with `() => {}` handlers) — remove until wired.
>
> 4. **Dynamic Type.** Create a small helper `scaledFontSize(base: number)` in `src/constants/typography.ts` that multiplies by `PixelRatio.getFontScale()`. Use it inside the `FontSize` exports (or provide a `useScaledFontSize()` hook). Verify by cranking Android font scale to 130% and 180%.
>
> 5. **Colour contrast fixes.** From the audit:
>    - `Colors.textMuted` (`#5C5C6B`) on `Colors.bgSecondary` (`#111115`) — 3.9:1, under AA. Bump `textMuted` to at least `#787888` (verify contrast with any real contrast tool). Same colour on `bgPrimary` is 4.7:1 borderline — pushing `textMuted` fixes both.
>    - `Colors.textDisabled` (`#3A3A47`) — only use for genuinely disabled controls, not muted text. Audit every usage.
>
> 6. **Standardize body-type icons (§C6).** `SearchScreen.tsx:55-64` uses emoji; `HomeScreen.tsx:241-250` uses Ionicons; `SellCarFlowScreen.tsx:90-102` uses MaterialCommunityIcons. Consolidate on the `SellCarFlowScreen` MCI set — extract to `src/constants/bodyTypes.ts` and import from all three screens.
>
> 7. **Fix `GlobalAIChatBot.tsx:217`** — change `undefined` to `'height'` on the KeyboardAvoidingView's Android branch. One-line fix, same class of bug the codebase otherwise avoids.
>
> 8. **Hide decorative icons from screen readers.** Every SVG chevron, decorative pill icon (e.g. `Ionicons name="information-circle"` inside a disclosure banner): add `accessibilityElementsHidden={true}` and `importantForAccessibility="no"`.
>
> Explicitly out of scope: full VoiceOver/TalkBack audit (that's a follow-up), redesigning any screen, adding new features.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - Repo grep for `<TouchableOpacity` wrapping a bare `<Ionicons` or `<MaterialCommunityIcons` returns zero hits outside `IconButton` and intentionally non-button icon usages (chevrons in list rows are fine — they're decorative).
> - Every `IconButton` has an `accessibilityLabel` — TypeScript enforces this via the required prop.
> - Android font scale at 180% doesn't clip any critical text.
> - No control in the app opens an `Alert.alert()` on tap when the alert's only purpose is to say "coming soon" or "sharing…".
> - Body-type icons look identical across Home, Search, and Sell flow.

---

## Stage 6 — Dealer visual-density preset + drop `AlertsScreen` duplicate (audit §C9, C10)

**Why last:** two independent cleanups that touch the same screens. Dealer surfaces currently reuse buyer-card padding/radius/spacing, which reads amateurish for a power user managing 30+ listings. And `AlertsScreen` + `NotificationsScreen` are near-duplicates reached from different bells — keeping both permanently drifts them further apart. Do this after the token system (Stage 2) is enforced so the dense preset just adds tokens, not new hex.

**Prompt to paste:**

> Read `carmazium app/carmazium app/mobile-ui-ux-audit.md` §C9, §C10. Two independent tasks, one PR:
>
> 1. **Consolidate on `NotificationsScreen`, delete `AlertsScreen`.**
>    - `AlertsScreen.tsx` and `NotificationsScreen.tsx` both fetch from `getNotifications()` and render very similar feeds — the audit notes `NotificationsScreen` has cleaner grouping (`Today / Yesterday / date`) and better token discipline.
>    - Delete `src/screens/main/AlertsScreen.tsx`.
>    - Repoint every `navigate('Alerts')` / `<Notifications-adjacent Alerts button>` to `Notifications`. Confirmed call sites from the audit: `SearchScreen.tsx:364`, `BuyerDashboardScreen.tsx:330`, `DealerProfileScreen.tsx:479, 516`, `MyListingDashboardScreen.tsx:175, 213`.
>    - Remove the `Alerts` entry from `MainStackParamList` (`src/navigation/MainStackNavigator.tsx`) per CLAUDE.md.
>
> 2. **Add a dealer-density preset to the design tokens.**
>    - In `src/constants/spacing.ts` (create if it doesn't exist; else in `constants/typography.ts`), add:
>      ```ts
>      export const RowDensity = {
>        comfortable: { padding: 16, gap: 12, borderRadius: 18, rowHeight: 76 }, // buyer
>        compact:     { padding: 10, gap: 8,  borderRadius: 10, rowHeight: 56 }, // dealer / power-user
>      };
>      ```
>    - Add `FontSize.rowLabel` = 13, `FontSize.rowMeta` = 11 to `constants/typography.ts` if not already present.
>    - Apply `RowDensity.compact` to:
>      - `DealerInventoryScreen.tsx:437-484` (inventory row).
>      - `DealerLeadsScreen.tsx:610-651` (lead row).
>      - `DealerAnalyticsScreen.tsx` KPI cards (audit §DA1 — cards are half-screen wide with buyer-style padding).
>    - Do NOT change any buyer card's density — buyers should still see `comfortable`.
>
> 3. **Add a list/grid view toggle to `DealerInventoryScreen`** — a compact rows layout for scanning many listings. `SavedScreen` already has a grid/list toggle you can crib the interaction pattern from. Persist the choice in local Zustand or `AsyncStorage`.
>
> Explicitly out of scope: adding bulk-select, column sort, or CRM-style shortcuts to dealer screens. Those are follow-ups.
>
> Acceptance criteria:
> - `npx tsc --noEmit` clean.
> - Only one route reachable from any bell in the app; it's `Notifications`.
> - `AlertsScreen.tsx` file is gone; `Alerts` is no longer in `MainStackParamList`.
> - Dealer inventory row height at compact density is 56 px (vs. 76 for the same buyer card component). Side-by-side comparison shows visibly denser dealer rows.
> - Dealer with 30+ listings can scan the list at compact density without endless scrolling.

---

## After Stage 6

Combined with the correctness/performance work in `mobile-audit-plan.md`, the app should be at a launchable UX baseline. Remaining follow-ups worth naming but not staging (either low value or design-blocked):

- Dealer bulk actions (multi-select + batch edit / delete / archive) — needs product design input.
- Filterable dealer analytics with custom date range (audit §DA2) — needs product design.
- Onboarding role-picker at signup (audit §A4) — needs product design + backend field.
- Extract `Button.tsx` / `PrimaryCTA.tsx` / `SpecBadge.tsx` / `GlassCard.tsx` / `SectionHeader.tsx` / `CategoryPill.tsx` as an internal Storybook — makes tokens enforceable at review time.
- Reduce-motion honouring on the tab-bar spring animation (audit §A8).
- Full VoiceOver/TalkBack walkthrough with a real screen-reader user.

Track these in `CONTEXT.md` under a "UX follow-ups" heading rather than a new plan — most need product/design decisions before code can start.
