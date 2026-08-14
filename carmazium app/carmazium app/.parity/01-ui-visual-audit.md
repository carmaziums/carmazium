# Mobile vs Web — UI/Visual Parity Audit

Scope: does the palette/card pattern established in `9d7ffa98` ("redesign(mobile): match web's exact dark-theme palette, restyle Home CTAs for hierarchy") actually propagate through the rest of the mobile app, and how does mobile's visual language compare to web's. Read-only audit, no edits made.

---

## 1. What `9d7ffa98` actually established

Commit touched exactly two files: `src/constants/colors.ts` and `src/screens/main/HomeScreen.tsx`.

**Palette tokens changed** (`src/constants/colors.ts`):
- `bgPrimary`: `#0A0A0C` → `#0f172a` (Tailwind slate-900, matches web's `--bg-body` dark value, `src/app/globals.css:77`)
- `bgSecondary`: `#111115` → `#1e293b` (slate-800, matches web's `--color-secondary`, `globals.css:7`)
- `bgTertiary`: `#18181E` → `#334155` (slate-700 — one step further down the ramp than web needs, added for RN's opaque-surface requirement)
- `borderMuted`: `#404050` → `rgba(255, 255, 255, 0.20)` (matches web's `--border-hover`, `globals.css:88`)
- `borderSubtle`: `#2A2A32` → `rgba(255, 255, 255, 0.10)` (matches web's `--border-default`, `globals.css:87`)
- `tabBarBg`: `rgba(10, 10, 12, 0.92)` → `rgba(15, 23, 42, 0.92)` (slate-900 base)

**Card/CTA treatment established on HomeScreen** (the "pattern" to roll out):
- One hero moment per screen: `sellCta` restyled to `backgroundColor: Colors.accentAlpha12` (accent wash fill, not a bg-card+thin-border card), `borderRadius: 20`, `borderColor: Colors.accentAlpha25`, watermark icon, trailing-arrow pill button (`sellCtaBtn`) instead of a boxed "START" label.
- Everything else demoted to quiet utility rows inside one container: `secondaryRows` — `backgroundColor: Colors.bgSecondary`, `borderRadius: 16`, `borderColor: Colors.borderSubtle`, rows separated by a single internal divider, `chevron-forward` affordance instead of a boxed button.
- Rule stated in the commit body: "at most one primary accent-filled action per view" — restraint/hierarchy, not a blanket recolor.

**Not changed by this commit and NOT part of the established pattern:** radius values elsewhere, shadow/elevation, typography scale, image treatment, or any other screen/component. This was scoped to Home's bottom CTAs plus the token file.

---

## 2. Card-like component inventory

| Component | File | Current styling | Palette conformance |
|---|---|---|---|
| `VehicleCard` (main listing card, Home/Search/Saved) | `src/components/VehicleCard.tsx:236` | `backgroundColor: 'rgba(18, 18, 24, 0.85)'`, `borderRadius: 20`, `borderColor: Colors.glassBorder` | **NOT conformant.** Hardcoded `rgba(18,18,24,…)` is a literal leftover of the pre-9d7ffa98 near-black scale (`#18181E`≈rgb(24,24,30), close to this literal) — bypasses the `bgTertiary`/`bgSecondary` tokens entirely, so it did not inherit the slate palette fix even though it's a token-driven file otherwise. |
| `LiveBidCard` (auction card, Live tab) | `src/components/LiveBidCard.tsx:209` | `backgroundColor: 'rgba(18,18,24,0.90)'`, `borderRadius: 20`, `borderColor: Colors.glassBorder` | **NOT conformant.** Same hardcoded near-black literal as VehicleCard. |
| `GlassCard` (generic wrapper, used across screens) | `src/components/GlassCard.tsx:70` | `baseFill: backgroundColor: 'rgba(18, 18, 24, 0.82)'` | **NOT conformant.** Same literal; every screen using `<GlassCard>` inherits the pre-redesign near-black instead of the slate palette. |
| `HorizontalVehicleCard` (compact row card) | `src/components/HorizontalVehicleCard.tsx:171` | `backgroundColor: Colors.bgSecondary`, `borderColor: Colors.borderSubtle`, `borderRadius: 16` | **Conformant** — references tokens directly, so it inherited the slate-800 palette automatically when `colors.ts` changed. No code change was needed here, it was already correct by construction. |
| `AuctionCardBadges` (chip/badge row + trust badges) | `src/components/AuctionCardBadges.tsx` | All backgrounds via `Colors.whiteAlpha06/10`, `Colors.infoBlueAlpha14`, etc. — token-driven | Conformant (badges never had a base-fill color to drift). |
| `SpecBadge` | `src/components/SpecBadge.tsx:47` | `Colors.whiteAlpha06` / `Colors.accentSubtle` fills, token-driven | Conformant. |
| `GradeChip` | `src/components/GradeChip.tsx:29,37` | Fill/border built from `${cfg.color}1A` / `${cfg.color}55` where `cfg.color` is one of 5 hardcoded hex literals (`#10b981`,`#84cc16`,`#f59e0b`,`#f97316`,`#ef4444`) — these are semantic grade colors (emerald/lime/amber/orange/red), not part of the dark-theme background/border system 9d7ffa98 touched. Not a palette violation in the 9d7ffa98 sense, but is the only component file with raw hex outside `colors.ts`. | N/A (semantic, not surface color) |
| `CategoryPill` | `src/components/CategoryPill.tsx:47` | `Colors.whiteAlpha05` / `Colors.accentSubtle`, token-driven | Conformant. |
| `SectionHeader` | `src/components/SectionHeader.tsx` | No background/card fill — text-only, token-driven colors | Conformant / not applicable (no card surface). |
| `PrimaryCTA` | `src/components/PrimaryCTA.tsx:161-179` | `filled` variant: `Colors.accent` solid fill; `outline`: transparent+border; `ghost`: `Colors.accentSubtle` — no bgSecondary/bgTertiary surface used | Conformant (doesn't touch the changed tokens). |
| `Button` | `src/components/Button.tsx:150` (`dark` variant) | `backgroundColor: Colors.bgTertiary`, `borderColor: Colors.glassBorder` | Conformant — token-driven. |
| Inline card styles in screens | 60 of 60 files under `src/screens/**/*.tsx` use `borderRadius` (i.e. every screen defines at least one card/box style) | Not individually audited line-by-line here (out of budget), but the 3 hardcoded `rgba(18,18,24,…)` occurrences in the whole `src/` tree are **only** in `VehicleCard.tsx`, `LiveBidCard.tsx`, `GlassCard.tsx` — no screen file hardcodes this literal directly. However, because dozens of screens compose `VehicleCard`/`GlassCard` internally, the old near-black surface still shows up pervasively across Home, Search, Saved, Live, and any detail screen using `GlassCard` sections. | Partially conformant by inheritance, undermined by the 3 files above |

**Bottom line on §2:** the redesign pattern from 9d7ffa98 propagated correctly to every component that already referenced `Colors.bgSecondary`/`Colors.bgTertiary`/`Colors.borderSubtle` as tokens — no extra work was needed there. It did **not** propagate to the three components (`VehicleCard`, `LiveBidCard`, `GlassCard`) that hardcode the old near-black as an inline `rgba(18,18,24,…)` literal instead of a token reference — and because `VehicleCard` is the single most-rendered component in the app (every listing grid on Home/Search/Saved) and `GlassCard` is a shared wrapper used across many screens, this is the highest-impact remaining gap, not a cosmetic one.

Also note: HomeScreen's own CTA hierarchy pattern (one accent-fill hero + quiet utility-row list) was applied to exactly one screen. No other screen (Search, Live, Sell flow, Vehicle Detail, dashboards) has been audited/rebuilt against that hierarchy rule — CONTEXT.md itself says this explicitly ("needs a real look... before this pattern rolls out to the other ~50 screens").

---

## 3. Mobile vs web card comparison (concrete divergences)

Web's canonical listing card is `src/components/features/CarCard.tsx`; its base surface class is `.glass-card` (`src/app/globals.css:123-135`):

```css
.glass-card {
  background: var(--bg-card);              /* dark: rgba(15, 23, 42, 0.6) — slate-900 @ 60% */
  backdrop-filter: blur(var(--glass-blur)); /* 16px */
  border: 1px solid var(--border-default);  /* dark: rgba(255,255,255,0.1) */
  box-shadow: var(--shadow-card);           /* dark: 0 4px 20px rgba(0,0,0,0.3) */
  border-radius: 1rem (rounded-2xl = 16px, applied via @apply);
}
.glass-card:hover {
  border-color: rgba(237, 28, 36, 0.2);
  box-shadow: var(--shadow-card-hover);     /* dark: 0 8px 40px rgba(0,0,0,0.5) */
  translate-y: -2px;
}
```

Dashboard stat card equivalent: `.dealer-glass-card` (`globals.css:206-221`) — same `var(--bg-card)` / `var(--border-default)` / `var(--shadow-card)`, `border-radius: 1rem`, plus a spring-easing hover lift (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).

Divergences found:

| Attribute | Web (`.glass-card` / `.dealer-glass-card`) | Mobile (`VehicleCard`, `LiveBidCard`, `GlassCard`) | Divergence |
|---|---|---|---|
| Base fill color | `rgba(15, 23, 42, 0.6)` — translucent **slate-900**, i.e. the same hue family as the new `bgPrimary` token | `rgba(18, 18, 24, 0.82–0.90)` — near-black, no blue-slate hue at all | Card surface color is off-palette even after 9d7ffa98, because these 3 files never switched to token references |
| Border radius | `1rem` = 16px (both card types) | `20px` (VehicleCard, LiveBidCard); `borderRadius` prop defaults to `20` in GlassCard | Mobile cards run 4px larger radius than web's equivalent |
| Elevation/shadow | Explicit `box-shadow: 0 4px 20px rgba(0,0,0,0.3)`, brightens to `0 8px 40px rgba(0,0,0,0.5)` on hover | No `shadowColor`/`shadowOpacity`/`elevation` set on `VehicleCard`'s `card` style, `LiveBidCard`'s `card` style, or `GlassCard`'s `wrapper` — only `PrimaryCTA`'s filled variant and `LiveBidCard`'s `bidBtn` set shadow props | Web's card system has a defined elevation identity; mobile's card *containers* have none (only buttons do) — cards read visually flat |
| Border treatment | 1px solid `rgba(255,255,255,0.1)`, brightens to accent red @ 20% on hover | 1px `Colors.glassBorder` = `rgba(255,255,255,0.12)` (close), no hover/press state equivalent (RN has no hover; `activeOpacity`/scale-spring substitutes but there's no border-color shift on press) | Close on the number, but the interaction-state color shift (border → accent tint) that signals "this is interactive" on web has no mobile analog |
| Backdrop blur | `backdrop-filter: blur(16px)` — real frosted-glass | `GlassCard` simulates via 3 stacked opacity layers (`baseFill`, `shimmer` at `rgba(255,255,255,0.042)`, `topHighlight` 1px line) — comment in file admits "reserved for native blur in production builds", i.e. never wired to `expo-blur` | Visually different technique entirely; mobile's approximation is a flat translucent stack, not a blur |
| Image aspect / treatment | Fixed `h-[240px]` box, `object-contain` (car floats on a gradient background, not full-bleed), hover scale+rotate micro-interaction | `imageHeight = compact ? 140 : 180`, `ImageCarousel` fills the container (full-bleed cover-style), no hover equivalent (no hover on touch) | Web deliberately shows the car "floating" on a slate gradient backdrop (product-shot styling); mobile crops to a full-bleed photo — different visual language, not just a sizing difference |
| Price treatment | `text-2xl font-bold font-mono`, gradient-clipped text (`bg-clip-text` slate/white gradient) | `priceTag` is a discrete pill overlaid bottom-right on the image (`Colors.blackAlpha75` bg, bordered), separate from the body — price is NOT inside the card body text at all | Structurally different placement: web treats price as the dominant in-body typographic element; mobile treats it as a badge on the photo |
| Badge placement | Featured badge top-area via `<FeaturedBadge/>`, trust badges top-right stacked, banner ribbon along card bottom edge of the image | Badges stacked top-left (`imageBadgeRow`), save button top-right, price bottom-right | Different corners used for the same badge types — not necessarily wrong, but not matched 1:1 |
| Typography scale for title | `text-lg md:text-xl font-bold font-heading` (title), `text-xs uppercase` (make/model subline) | `make`: `FontSize.xs` uppercase; `model`: `FontSize.md bold` — model is the dominant text, no separate "title" line (web's `title` prop is often the full make+model+variant string, so this may be a false divergence — flagging as unverified) | Partially unverified — the two components don't map field-for-field cleanly enough to compare scale precisely without seeing real screen data |

---

## 4. Remaining hardcoded hex colors / off-token values

**Raw 6-digit hex outside `colors.ts`** (`grep -rn "#[0-9a-fA-F]{6}" src/`, excluding `colors.ts` itself which is the token file and expected to contain hex):

| File | Count | Notes |
|---|---|---|
| `src/components/GradeChip.tsx` | 5 | Lines 10-14: `#10b981`, `#84cc16`, `#f59e0b`, `#f97316`, `#ef4444` — semantic grade-color scale (emerald→red), used to build `${color}1A`/`${color}55` alpha variants inline. Matches web's `GRADE_STYLES` in `CarCard.tsx:41-47` (`emerald-500`/`lime-500`/`amber-500`/`orange-500`/`red-500`) conceptually, though web uses Tailwind's fixed hex for those same named colors — so this is likely intentional parity, not drift, but it is still off-token (no `Colors.grade1`..`grade5` tokens exist). |
| `src/assets/3d/viewer.html` | 2 | Static HTML asset for the Three.js damage viewer WebView — not a React Native style file, out of scope for the token system. |

That's the complete list — **the July 2026 token codemod referenced in CONTEXT.md §0.1 ("1,600+ raw hex literals" eliminated) is holding**; there is no meaningful raw-hex regression in screens/components. The real non-conformance is the **inline rgba() literal** pattern documented in §2 (`rgba(18, 18, 24, ...)` in 3 files), which a hex-only grep does not catch since it's not 6-digit hex — grep for `rgba(18` confirms exactly 3 hits, matching §2's inventory: `VehicleCard.tsx`, `LiveBidCard.tsx`, `GlassCard.tsx`.

**Non-token `fontSize` numeric literals:** `grep -rn "fontSize:\s*\d+" src/` returns **zero matches** across the entire mobile `src/` tree. Every `fontSize:` usage goes through the `FontSize.*` token object (confirmed by spot-checking `VehicleCard.tsx`, `HorizontalVehicleCard.tsx`, `LiveBidCard.tsx` above — all use `FontSize.xs`/`.md`/`.size9` etc., including one arithmetic case `FontSize.xs - 2` in `HorizontalVehicleCard.tsx:242` which is token-derived, not a raw literal). Typography tokenization is fully compliant; no work needed here.

---

## 5. Web visual elements/sections with no mobile equivalent

Grepped `src/components/features/` and `src/components/ui/` (web) against mobile's `src/components/` — the following have **no mobile equivalent file or usage found**:

- **`TestimonialsSection.tsx` / `TestimonialCard.tsx`** — reviews/testimonial carousel. No mobile screen renders anything similar; no `Testimonial*` file exists under mobile `src/`.
- **`PromoCarousel.tsx`** — promotional banner carousel (distinct from `HeroCarousel` which mobile does have, per `src/components/HeroCarousel.tsx` — that one likely covers the hero but not a secondary promo carousel; unverified whether `HeroCarousel` covers this ground or is a separate concern).
- **`FinanceCalculator.tsx`** — finance/loan calculator widget. No mobile equivalent found anywhere in `src/screens` or `src/components`.
- **`DiscoverSection.tsx`** — no mobile equivalent by name; contents not inspected, flagging as unverified what it renders.
- **`BrowseByCategory.tsx`** and **`BrowseByBodyType.tsx`** — mobile's `HomeScreen.tsx` does have its own `BODY_TYPES` array and a "BROWSE BY TYPE" `Section` (line 271, 600) implemented inline rather than as a shared component — so body-type browsing does exist on mobile, just not as a matching componentized equivalent. Category browsing (as opposed to body type) is unverified.
- **`MarketingPopup.tsx`** — promotional popup/modal. No equivalent found in mobile.
- **`DealerCtaButton.tsx`** — dedicated dealer CTA component on web; mobile's dealer CTA is hand-rolled inline inside `HomeScreen.tsx`'s `secondaryRows` (per the 9d7ffa98 diff) rather than a shared component — functionally present, not componentized.
- **Skeleton vs. spinner parity** — already flagged as a known gap in `CONTEXT.md` §8 ("mobile uses `<Skeleton>` on auction and chat screens; web uses `Loader2` overlays. No single pattern.") Mobile does have `src/components/ui/Skeleton.tsx` and `src/components/ui/EmptyState.tsx`, so skeleton/empty-state *components* exist, but CONTEXT.md itself says the application of them is inconsistent — not independently re-verified here beyond confirming the files exist.
- **Comparison tables / stat tiles** — web's `MetricCard.tsx` (dashboard stat tile with sparkline SVG, icon chip, `dealer-glass-card` surface) has no confirmed mobile equivalent by name; mobile dashboards were not individually opened in this pass to confirm whether an inline equivalent exists — flagging as unverified rather than asserting absence.
- **Hero treatment** — web's `CarCard` "car floats on a slate gradient product-shot background" treatment (§3 above) has no mobile equivalent; mobile always full-bleeds the photo.

---

## 6. Summary of what needs to happen for the pattern to actually go "global"

1. **Highest-impact fix:** `VehicleCard.tsx:236`, `LiveBidCard.tsx:209`, `GlassCard.tsx:70` all hardcode `rgba(18, 18, 24, …)` instead of referencing `Colors.bgSecondary`/`Colors.bgTertiary` (or a new translucent token matching web's `--bg-card: rgba(15, 23, 42, 0.6)`). These three components are the most-instantiated card surfaces in the app (every listing grid + every `GlassCard`-wrapped section), so fixing just these three literals would propagate the palette fix to the overwhelming majority of visible card surfaces app-wide.
2. Mobile card containers have no shadow/elevation styling at all (only buttons do) — web's `.glass-card` has a defined `box-shadow` identity mobile never adopted, even as an `elevation`/`shadowOpacity` RN equivalent.
3. Mobile card radius (20px) vs. web's (16px, `rounded-2xl`/`1rem`) is a minor but real, consistent 4px divergence across every observed card type.
4. HomeScreen's "one hero + quiet utility rows" CTA hierarchy pattern has been applied to exactly 1 of ~60 screens — no other screen has been touched for that specific pattern.
5. Several whole web sections (testimonials, finance calculator, promo carousel, marketing popup) have no mobile equivalent at all — these are feature gaps, not styling drift, and are a separate, larger scope than the palette rollout.
