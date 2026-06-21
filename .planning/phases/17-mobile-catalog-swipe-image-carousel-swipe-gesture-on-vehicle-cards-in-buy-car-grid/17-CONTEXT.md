# Phase 17: Mobile Catalog Swipe - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a swipe-left/right image carousel gesture to `VehicleCard.tsx` in the React Native app. Currently the card shows only `listing.images[0]`. This phase allows users to swipe through up to 5 images per card without leaving the grid. No new screens. No web changes.

</domain>

<decisions>
## Implementation Decisions

### Swipe mechanics
- **Snap mode** — each swipe advances exactly 1 image; not a free-scrolling carousel
- **Velocity-based trigger** — fast flick advances; slow drag without crossing threshold snaps back to current image
- **Rubber-band at boundaries** — at first or last image, user feels a slight drag resistance then spring-back; hard stop not used
- **Only cards with 2+ images** get the gesture; single-image cards have the gesture handler completely disabled (no unnecessary overhead or interference with parent scroll)
- **Cap at first 5 images** per card; full gallery is accessible via navigating to the listing detail page

### Tap vs swipe co-existence
- **Tap on image = navigate to listing detail** (unchanged from current behaviour)
- **Horizontal swipe = advance/retreat image** within the card
- Both gestures operate independently — the user can swipe and later tap the same card

### Indicator dots
- **Small dots always visible** at the bottom of the card image (not just during active swipe) — only rendered when card has 2+ images
- **Active dot = filled white**; inactive dots = translucent white outline
- **4px diameter dots**, horizontally centred at the bottom of the image, positioned above the existing gradient overlay
- Always show all dots (max 5, consistent with the 5-image cap) — no switch to text counter needed

### Grid scroll conflict resolution
- **Angle threshold method**: if the initial gesture movement is < 30° from horizontal, the pan gesture captures it as an image swipe; steeper angles are passed through to the parent FlatList vertical scroll
- **Simultaneous gesture recognizers** — the card gesture and the parent list gesture run concurrently; the angle on the first movement frame decides which wins
- On single-image cards: gesture handler not attached at all, so parent scroll is fully unimpeded

### Haptics
- **Light impact haptic** (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`) fires once per image change — only on advance/retreat, not on drag
- Uses `expo-haptics` which is already installed

### Animation
- **Slide transition**: the image translates horizontally with the user's finger during the gesture; on release it snaps to the new position (or springs back if threshold not met)
- **Card stays still** — only the image content area translates; card shadow, title, price, badges, dots all remain stationary
- No card scale or bounce on the overall card

### Image prefetch
- **Prefetch images at index 0, 1, 2** (first 3) using `Image.prefetch()` from `expo-image` on card mount
- Subsequent images (3, 4) load on first access — most users won't reach them anyway

### Claude's Discretion
- Exact spring physics constants for snap animation (stiffness, damping)
- Whether to use `react-native-gesture-handler` Pan gesture or Reanimated 2 `withSpring` for the snap
- Dot rendering implementation (absolute-positioned View, or overlay on the Image component)
- Exact rubber-band drag multiplier at boundaries

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VehicleCard.tsx` (`carmazium app/carmazium app/src/components/VehicleCard.tsx`) — current card component; image displayed at line 78 via `listing.images[0]`; `imageContainer` style block from line 179
- `expo-image` (`Image` component) — already imported in VehicleCard; supports `Image.prefetch()` for preloading
- `expo-haptics` — already in `package.json` at `~15.0.8`; pattern: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- `react-native-gesture-handler` — already in `package.json` at `~2.28.0`; `PanGestureHandler` or new RNGH v2 Gesture API available

### Established Patterns
- Card uses `expo-image` (not RN's Image) for disk+memory caching — carousel should continue using `expo-image` per component, not switch to `<Image>` from RN
- `StyleSheet` used throughout (not NativeWind/Tailwind in mobile components)
- `compact` prop on VehicleCard controls image height (140 vs 180) — carousel behaviour applies at both heights

### Integration Points
- `VehicleCard` is rendered in: `HomeScreen.tsx` (horizontal ScrollViews), `SearchScreen.tsx` (FlatList), and anywhere that uses VehicleCard directly — swipe behaviour is component-level, so all call sites get it automatically
- The card's `onPress` prop currently navigates to detail — this must be preserved; tap on the image should still trigger `onPress`

</code_context>

<specifics>
## Specific Ideas

- The gesture should feel like Instagram's explore grid image swiping — fast and tactile, not the heavy Airbnb-style card swipe
- Dots should be very small and understated — 4px is intentionally tiny to avoid visual clutter on a compact listing card
- The snap animation should be snappy (high stiffness) not floaty — this is a catalog browser, not a full-screen gallery

</specifics>

<deferred>
## Deferred Ideas

- Full-screen pinch-to-zoom gallery (mentioned in mobile-03 parity plan — separate from this phase)
- Video/360° view in the card carousel — future capability
- Web buy-cars grid image swipe (this phase is mobile only)

</deferred>

---

*Phase: 17-mobile-catalog-swipe*
*Context gathered: 2026-06-21*
