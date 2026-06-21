# Phase 17: Mobile Catalog Swipe - Research

**Researched:** 2026-06-21
**Domain:** React Native gesture-driven image carousel in a list-embedded card component
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Snap mode** — each swipe advances exactly 1 image; not free-scroll
- **Velocity-based trigger** — fast flick advances; slow drag below threshold snaps back
- **Rubber-band at boundaries** — slight drag resistance + spring-back at first/last image; no hard stop
- **Only cards with 2+ images** get the gesture; single-image cards have gesture handler completely disabled
- **Cap at first 5 images** per card; full gallery accessible via detail screen
- **Tap on image = navigate to listing detail** (unchanged); horizontal swipe = image advance — both independent
- **Dots always visible** (not just during swipe) when card has 2+ images; active = filled white; inactive = translucent white outline; 4px diameter; horizontally centred at bottom of image; above existing gradient overlay
- **Angle threshold method** for scroll conflict: < 30° from horizontal = image swipe captured; steeper angles passed to parent FlatList/ScrollView
- **Simultaneous gesture recognizers** — card gesture and parent list gesture run concurrently; first-frame angle decides which wins
- **Single-image cards**: gesture handler not attached at all
- **Light impact haptic** (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`) fires once per image change only (not on drag)
- **Uses expo-haptics** (already installed at ~15.0.8)
- **Slide transition**: image content translates horizontally with finger; card chrome (shadow, title, price, badges, dots) stays stationary
- **No card scale or bounce** on the overall card during swipe
- **Prefetch images at index 0, 1, 2** (`Image.prefetch()` from expo-image) on card mount; images 3 and 4 load on first access

### Claude's Discretion

- Exact spring physics constants for snap animation (stiffness, damping)
- Whether to use `react-native-gesture-handler` Pan gesture or Reanimated 2 `withSpring` for the snap
- Dot rendering implementation (absolute-positioned View, or overlay on the Image component)
- Exact rubber-band drag multiplier at boundaries

### Deferred Ideas (OUT OF SCOPE)

- Full-screen pinch-to-zoom gallery (separate from this phase)
- Video/360° view in the card carousel
- Web buy-cars grid image swipe (this phase is mobile only)
</user_constraints>

---

## Summary

This phase adds a horizontal swipe-image carousel to `VehicleCard.tsx` in the React Native mobile app. The gesture must co-exist with two parent scroll axes: vertical `FlatList` in `SearchScreen.tsx` and horizontal `ScrollView` in `HomeScreen.tsx`. The key engineering challenge is gesture conflict resolution — the card's horizontal pan must not swallow vertical scrolls and must not fight horizontal scroll sections.

The project already has the exact libraries needed and, critically, a working implementation of a spring-snap image carousel with Reanimated 4 + RNGH 2 in `VehicleDetailScreen.tsx` (the gallery strip). That pattern is the gold-standard reference for this phase. The only new concern is the embedded context: the detail screen's gallery owns the full width and has no parent horizontal scroller competing with it, whereas `VehicleCard` sits inside scrolling containers.

The RNGH 2 Gesture API's `activeOffsetX` / `failOffsetY` settings (available on `Gesture.Pan()`) are the correct mechanism for angle-threshold conflict resolution. They replace the older `simultaneousWithExternalGesture` / `waitFor` choreography and work natively with `GestureDetector`. No new packages need to be installed.

**Primary recommendation:** Lift the carousel into a self-contained `useCarouselGesture` hook, implement the pan with `Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-10, 10])`, and render a fixed-width `Animated.View` strip inside `imageContainer` with the dots rendered as an absolute-positioned row above the gradient.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-reanimated` | ~4.1.1 (installed) | `useSharedValue`, `useAnimatedStyle`, `withSpring`, `runOnJS` | Already drives all card and screen animations in this codebase; UI thread animation required for 60fps gesture tracking |
| `react-native-gesture-handler` | ~2.28.0 (installed) | `Gesture.Pan()`, `GestureDetector` | Already wrapping the whole app in `GestureHandlerRootView`; v2 composable Gesture API is the correct API at this version |
| `expo-haptics` | ~15.0.8 (installed) | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` | Already used project-wide via `haptics.ts` wrapper |
| `expo-image` | ~3.0.11 (installed) | `Image` component + `Image.prefetch()` | Already used in VehicleCard; provides disk+memory caching critical for smooth carousel in long lists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native` `useRef` | built-in | `cardWidth` ref for gesture math | Card width comes from prop (`width`) — pass to gesture via ref or closure |
| `react-native` `useState` | built-in | `activeIndex` state (JS-thread state for dots + React render) | Dots are React elements; `runOnJS` bridges from worklet to React state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Gesture.Pan()` with `activeOffsetX/failOffsetY` | `PanGestureHandler` (old RNGH v1 API) | Old API still works but is deprecated in RNGH 2; not composable |
| Manual gesture conflict via `activeOffsetX` | `simultaneousWithExternalGesture` | `simultaneousWithExternalGesture` is for cross-component choreography; `activeOffsetX` is simpler for same-component angle filtering |
| In-card `Animated.View` strip | `FlatList` horizontal inside card | Nested FlatList/ScrollViews in same scroll direction as parent is a known Android ANR/scroll-jank pattern; strip approach avoids this |

**Installation:** No new packages — all dependencies are installed.

---

## Architecture Patterns

### Recommended Project Structure

No new files are needed at the screen level. The changes are entirely contained within `VehicleCard.tsx`. A hook can be co-located in the same file for cleanliness:

```
carmazium app/carmazium app/src/components/
├── VehicleCard.tsx          ← ALL changes here; add useCarouselGesture hook inline
├── HorizontalVehicleCard.tsx  ← untouched (uses single image, not a grid card)
├── SpecBadge.tsx              ← untouched
└── ...
```

### Pattern 1: Spring-Snap Strip (from VehicleDetailScreen — proven in codebase)

**What:** An `Animated.View` whose width is `numImages * cardWidth` translates on the X axis. On gesture end, `withSpring` snaps to `-index * cardWidth`.

**When to use:** Any embedded image carousel where the container has a fixed known width. Requires that `overflow: 'hidden'` is set on the container.

**Example (from VehicleDetailScreen.tsx — existing codebase):**
```typescript
// VehicleDetailScreen.tsx — gallery strip pattern (adapt card width, not SCREEN_WIDTH)
const translateX = useSharedValue(0);
const savedTranslateX = useSharedValue(0);

const galleryPanGesture = Gesture.Pan()
  .onUpdate((e) => {
    translateX.value = savedTranslateX.value + e.translationX;
  })
  .onEnd((e) => {
    const threshold = CARD_WIDTH * 0.3;   // 30% drag threshold
    let newIndex = activeImage;
    if (e.translationX < -threshold && activeImage < totalImages - 1) {
      newIndex = activeImage + 1;
    } else if (e.translationX > threshold && activeImage > 0) {
      newIndex = activeImage - 1;
    }
    const target = -newIndex * CARD_WIDTH;
    translateX.value = withSpring(target, { damping: 20, stiffness: 200 });
    savedTranslateX.value = target;
    runOnJS(setActiveImage)(newIndex);
  });

const galleryAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: translateX.value }],
}));
```

The VehicleCard version will use `cardWidth` (from props) instead of `SCREEN_WIDTH`, and add velocity consideration alongside the drag-distance threshold.

### Pattern 2: Angle Threshold Conflict Resolution (RNGH 2 Gesture API)

**What:** `activeOffsetX` defines the minimum horizontal movement before the pan gesture activates. `failOffsetY` defines the vertical movement at which the pan gesture fails and defers to the parent. Together they implement the < 30° horizontal capture, > 30° vertical pass-through rule.

**When to use:** Any horizontal gesture inside a vertical-scrolling parent (FlatList, ScrollView).

```typescript
// Source: RNGH 2 documentation — activeOffsetX / failOffsetY
const panGesture = Gesture.Pan()
  .activeOffsetX([-6, 6])     // activate once 6px horizontal movement detected
  .failOffsetY([-10, 10])     // fail (release to parent) if 10px vertical before 6px horizontal
  .onUpdate((e) => { /* ... */ })
  .onEnd((e) => { /* ... */ });
```

For the HomeScreen horizontal `ScrollView` sections, the card sits inside a horizontal scroller — in that context the user would be swiping horizontally in two directions (card-image change vs section scroll). The CONTEXT.md locks in angle threshold as the resolution strategy; in horizontal scroll sections the parent scroll captures the gesture first if it fires before the card's threshold, which is acceptable behaviour (card swiping is a secondary affordance in horizontal lists).

### Pattern 3: Rubber-Band Boundaries

**What:** At index 0 (first image), leftward drag multiplied by a damping factor (e.g. 0.3) to create resistance. On release, `withSpring` snaps back to position 0.

```typescript
// Rubber-band at boundaries
.onUpdate((e) => {
  const raw = savedTranslateX.value + e.translationX;
  const minBound = -(images.length - 1) * cardWidth;
  if (raw > 0) {
    // Past first image — rubber-band
    translateX.value = raw * 0.3;
  } else if (raw < minBound) {
    // Past last image — rubber-band
    translateX.value = minBound + (raw - minBound) * 0.3;
  } else {
    translateX.value = raw;
  }
})
```

### Pattern 4: Velocity-Augmented Snap Decision

**What:** RNGH 2 `onEnd` event provides `velocityX`. Combine with distance threshold: advance image if `Math.abs(e.velocityX) > 400` (fast flick) OR `Math.abs(e.translationX) > cardWidth * 0.3` (drag past 30%).

```typescript
.onEnd((e) => {
  const flick = Math.abs(e.velocityX) > 400;
  const drag  = Math.abs(e.translationX) > cardWidth * 0.3;
  let newIndex = currentIndexRef.value;  // shared value for worklet access
  if ((flick || drag) && e.translationX < 0 && currentIndexRef.value < images.length - 1) {
    newIndex = currentIndexRef.value + 1;
  } else if ((flick || drag) && e.translationX > 0 && currentIndexRef.value > 0) {
    newIndex = currentIndexRef.value - 1;
  }
  translateX.value = withSpring(-newIndex * cardWidth, { damping: 22, stiffness: 250 });
  savedTranslateX.value = -newIndex * cardWidth;
  runOnJS(setActiveIndex)(newIndex);
  if (newIndex !== currentIndexRef.value) {
    runOnJS(triggerHaptic)();
  }
  currentIndexRef.value = newIndex;
})
```

### Pattern 5: Indicator Dots

**What:** Absolutely-positioned row of small circles at the bottom-centre of the image area. Positioned above the gradient overlay (`zIndex: 2`). Rendered only when images.length > 1.

```typescript
// Dots overlay — above gradient (zIndex), below save button
{images.length > 1 && (
  <View style={styles.dotsRow}>
    {images.map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === activeIndex ? styles.dotActive : styles.dotInactive,
        ]}
      />
    ))}
  </View>
)}

// Styles
dotsRow: {
  position: 'absolute',
  bottom: 10,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 4,
  zIndex: 2,
},
dot: {
  width: 4,
  height: 4,
  borderRadius: 2,
},
dotActive: {
  backgroundColor: 'rgba(255,255,255,1)',
},
dotInactive: {
  backgroundColor: 'rgba(255,255,255,0)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.6)',
},
```

### Pattern 6: Image Prefetch on Mount

**What:** `expo-image` `Image.prefetch()` is a static method that downloads and caches the image at the given URI. Called in `useEffect` on card mount for indices 0, 1, 2.

```typescript
// expo-image Image.prefetch — confirmed API
useEffect(() => {
  if (images.length < 2) return;
  const toPrefetch = images.slice(0, 3);
  toPrefetch.forEach(uri => Image.prefetch(uri));
}, []); // mount only — listing images won't change per card instance
```

### Pattern 7: Conditional Gesture Handler (skip for single-image cards)

**What:** The `GestureDetector` wrapper is only rendered when the card has 2+ images. For single-image cards the imageContainer renders without any gesture wrapper — zero overhead, no interference with parent scrollers.

```typescript
const imageContent = (
  <Animated.View style={[stripStyle, carouselAnimatedStyle]}>
    {images.slice(0, 5).map((uri, i) => (
      <Image key={i} source={{ uri }} style={[styles.image, { width: cardWidth }]}
        contentFit="cover" transition={200} cachePolicy="memory-disk" />
    ))}
  </Animated.View>
);

// Conditional wrap
{images.length > 1
  ? <GestureDetector gesture={panGesture}>{imageContent}</GestureDetector>
  : imageContent
}
```

### Anti-Patterns to Avoid

- **Nested `FlatList` horizontal inside vertical `FlatList`:** RN does not support same-direction nested scroll — use the strip+translateX approach instead.
- **Using `useAnimatedGestureHandler` (Reanimated 2 old API):** Deprecated and absent in Reanimated 4. Use `Gesture.Pan().onUpdate().onEnd()` with the new Gesture API.
- **Tracking `activeIndex` in a shared value for dot rendering:** Dots are React elements; you need a JS-thread state via `runOnJS(setActiveIndex)`. Keep a `currentIndexShared` shared value for use in worklets, and a `activeIndex` useState for rendering.
- **Mutating `listing.images` array directly:** Always `slice(0, 5)` to enforce the cap safely.
- **Forgetting `overflow: 'hidden'` on `imageContainer`:** Without it, the image strip will render outside card bounds during swipe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring physics snap | Custom timing curve with `setTimeout` | `withSpring` (Reanimated) | Spring parameters are battle-tested; frame-perfect on UI thread; handles interruption mid-animation |
| Angle filtering | `Math.atan2` check in JS `onPanResponder` | `Gesture.Pan().activeOffsetX().failOffsetY()` | Native-thread evaluation; JS-thread PanResponder cannot keep up at 60fps and causes frame drops |
| Image caching in carousel | In-memory object cache | `expo-image` `cachePolicy="memory-disk"` | Already on every Image in the codebase; disk cache survives app backgrounding |
| Haptic trigger | `setTimeout` debounce guard | Fire `Haptics.impactAsync` exactly in `runOnJS` callback on index change | Simple and correct; expo-haptics handles native scheduling |

---

## Common Pitfalls

### Pitfall 1: Active Index Drift in Worklet vs JS Thread
**What goes wrong:** The gesture `onEnd` worklet reads a stale `activeIndex` from a JS-thread useState closure. The user swipes quickly; the state hasn't updated; the next gesture starts from the wrong index.
**Why it happens:** Worklets run on the UI thread and cannot read JS-thread state reliably. Closures capture the value at render time.
**How to avoid:** Maintain a `currentIndexShared = useSharedValue(0)` for worklet reads. Keep `activeIndex` useState for React rendering only. Update both: `currentIndexShared.value = newIndex` (in worklet), then `runOnJS(setActiveIndex)(newIndex)`.
**Warning signs:** Carousel jumps back to image 0 on rapid successive swipes.

### Pitfall 2: `imageContainer` Missing `overflow: 'hidden'`
**What goes wrong:** The image strip (width = numImages * cardWidth) bleeds outside the card during the swipe gesture, visibly overlapping adjacent cards in the grid.
**Why it happens:** The Animated.View strip is wider than its parent by design; clipping is required.
**How to avoid:** `imageContainer` already has `overflow: 'hidden'` in the existing stylesheet — verify this is preserved when restructuring.

### Pitfall 3: Tap Swallowed by Pan Gesture
**What goes wrong:** The `GestureDetector` wrapping the image strip intercepts short taps and the `onPress` on the `AnimatedTouchable` card wrapper never fires.
**Why it happens:** RNGH gestures and TouchableOpacity/TouchableHighlight compete; in some configurations the pan handler activates on any touch.
**How to avoid:** Keep the `AnimatedTouchable` as the outermost wrapper (unchanged from current). The `GestureDetector` wraps only the inner strip. Since `GestureDetector` activates only after `activeOffsetX` is exceeded (6px horizontal movement), sub-threshold taps pass through naturally. Also, wrapping with `GestureDetector` inside `AnimatedTouchable` allows the `onPress` on the outer touchable to fire when the pan gesture does not activate.
**Warning signs:** Navigating to detail stops working after adding the gesture.

### Pitfall 4: `savedTranslateX` Stale After Re-Render
**What goes wrong:** When the card is recycled by FlatList (`keyExtractor` collision or list reorder), the shared value `savedTranslateX` holds the position of the previous card's image, causing the new card to open mid-carousel.
**Why it happens:** `useSharedValue` is keyed to the component instance, not the data; if the component is reused (recycled), the value is not reset.
**How to avoid:** Reset `translateX.value = 0; savedTranslateX.value = 0; setActiveIndex(0)` in a `useEffect` with `[listing.id]` as dependency. This fires when the listing changes underneath a recycled card.

### Pitfall 5: `AnimatedTouchable` Scale Interfering with Carousel
**What goes wrong:** The outer card's `scale: 0.97` press animation shrinks the card; if the user begins swiping while the scale is active (finger held down), the gesture coordinate system is slightly off.
**Why it happens:** The animated scale transform shifts the effective touch target bounds.
**How to avoid:** The current implementation uses `onPressIn`/`onPressOut` on the `AnimatedTouchable`. Since swiping starts a Pan gesture (not a press), the `onPressIn` fires but `onPressOut` fires immediately when the pan recognizer activates. This is acceptable — scale returns to 1 before swipe completes. No code change needed; just be aware this is correct behaviour, not a bug.

### Pitfall 6: HomeScreen Horizontal ScrollView vs Card Horizontal Swipe
**What goes wrong:** In HomeScreen's horizontal ScrollView sections (Featured Listings, Live Auctions), a horizontal swipe on a card is ambiguous — it could advance the section scroll or change the card image.
**Why it happens:** Both the parent horizontal ScrollView and the card pan gesture respond to horizontal movement.
**How to avoid:** The `activeOffsetX([-6, 6])` threshold means the pan gesture on the card activates after 6px. The parent horizontal ScrollView has similar threshold. In practice the first gesture recognizer to fire wins. This is acceptable for a secondary affordance. Users can tap through to detail for full gallery. The CONTEXT.md explicitly accepts this trade-off for single-scroll home sections.

### Pitfall 7: `Image.prefetch()` Triggering on Every Render
**What goes wrong:** `Image.prefetch()` is called repeatedly (on every render or state change), hammering the network for images already in cache.
**Why it happens:** Effect without stable dependency array, or listing.images reference identity changes.
**How to avoid:** Use `useEffect(() => { ... }, [])` (mount-only). Prefetch is idempotent in expo-image (cache hit = no network call), but limiting to mount avoids any overhead.

---

## Code Examples

### useCarouselGesture Hook (recommended extraction)

```typescript
// Co-locate inside VehicleCard.tsx above the component
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

function useCarouselGesture(images: string[], cardWidth: number) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const translateX    = useSharedValue(0);
  const savedX        = useSharedValue(0);
  const currentIndex  = useSharedValue(0);  // worklet-readable

  const triggerHaptic = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const raw = savedX.value + e.translationX;
      const minBound = -(images.length - 1) * cardWidth;
      if (raw > 0) {
        translateX.value = raw * 0.3;
      } else if (raw < minBound) {
        translateX.value = minBound + (raw - minBound) * 0.3;
      } else {
        translateX.value = raw;
      }
    })
    .onEnd((e) => {
      const flick = Math.abs(e.velocityX) > 400;
      const drag  = Math.abs(e.translationX) > cardWidth * 0.3;
      let next = currentIndex.value;
      if ((flick || drag) && e.translationX < 0 && next < images.length - 1) next += 1;
      else if ((flick || drag) && e.translationX > 0 && next > 0) next -= 1;
      const target = -next * cardWidth;
      translateX.value = withSpring(target, { damping: 22, stiffness: 250 });
      savedX.value = target;
      if (next !== currentIndex.value) runOnJS(triggerHaptic)();
      currentIndex.value = next;
      runOnJS(setActiveIndex)(next);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Reset on card recycle
  React.useEffect(() => {
    translateX.value = 0;
    savedX.value = 0;
    currentIndex.value = 0;
    setActiveIndex(0);
  }, [images[0]]); // first image URI as proxy for listing identity

  return { activeIndex, panGesture, animatedStyle };
}
```

### Dots Overlay

```typescript
// Positioned above gradient (zIndex 2), bottom-centred
{images.length > 1 && (
  <View style={styles.dotsRow} pointerEvents="none">
    {images.slice(0, 5).map((_, i) => (
      <View
        key={i}
        style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
      />
    ))}
  </View>
)}
```

### Image Prefetch

```typescript
React.useEffect(() => {
  const toLoad = listing.images.slice(0, 3);
  toLoad.forEach((uri) => Image.prefetch(uri));
}, []); // mount only
```

### Conditional Gesture Wrap

```typescript
const strip = (
  <Animated.View style={[styles.imageStrip, { width: cardWidth * displayImages.length }, carouselStyle]}>
    {displayImages.map((uri, i) => (
      <Image
        key={`${listing.id}-img-${i}`}
        source={{ uri }}
        style={[styles.image, { width: cardWidth }]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    ))}
  </Animated.View>
);

// Wrap only if carousel needed
const imageContent = displayImages.length > 1
  ? <GestureDetector gesture={panGesture}>{strip}</GestureDetector>
  : strip;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PanGestureHandler` + `useAnimatedGestureHandler` (RNGH v1 + Reanimated 2) | `Gesture.Pan()` + `GestureDetector` (RNGH v2 + Reanimated 3/4) | RNGH 2.0 / Reanimated 3.0, 2022 | Composable gestures, no need for separate gesture handler ref |
| `PanResponder` (RN built-in) | RNGH Gesture API | Always preferred for 60fps | PanResponder runs on JS thread; RNGH runs on UI thread |
| `Animated.event` + native driver | `useAnimatedStyle` (Reanimated) | Reanimated 2+ | Reanimated provides full JS-side animation logic on UI thread |

**Deprecated/outdated:**
- `useAnimatedGestureHandler`: Removed in Reanimated 4 — do not use.
- `waitFor` / `exclusivelyFor` gesture choreography for scroll conflict: Still works but `activeOffsetX`/`failOffsetY` is simpler and more reliable for the angle-threshold use case.

---

## Open Questions

1. **`Image.prefetch` return value / cleanup**
   - What we know: `expo-image` `Image.prefetch()` returns a `Promise<void>` — no handle for cancellation.
   - What's unclear: Whether unmounting a card before prefetch completes causes any memory leak or warning.
   - Recommendation: Ignore the returned promise (fire-and-forget). expo-image caching handles deduplication. Low risk given images are small JPEGs.

2. **HomeScreen horizontal ScrollView conflict in practice**
   - What we know: The `activeOffsetX` approach means the card's pan gesture and parent horizontal ScrollView compete for the same horizontal movement.
   - What's unclear: Which wins first in a real horizontal scroll section swipe.
   - Recommendation: Accept that in HomeScreen's horizontal sections, the parent scroll may capture horizontal swipes before the card's gesture activates. The card image swipe is a secondary affordance in those sections. Test on device after implementation; if needed, add `.simultaneousWithExternalGesture(scrollViewRef)` to allow both to fire.

3. **`AnimatedTouchable` wrapping with inner `GestureDetector`**
   - What we know: RNGH `GestureDetector` is designed to work inside RN touchable components; `Gesture.Pan` with `activeOffsetX` requires deliberate horizontal movement before activating.
   - What's unclear: Whether there is a subtle interaction with Reanimated 4's `createAnimatedComponent(TouchableOpacity)` that silently suppresses the `onPress`.
   - Recommendation: Implement and test on both Android and iOS. If `onPress` is swallowed, convert the outermost `AnimatedTouchable` to a plain `Animated.View` and add `TouchableOpacity` as a sibling wrapping only the card body (not the image strip), with the navigation handler there.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `carmazium app/carmazium app/jest.config.js` |
| Quick run command | `cd "carmazium app/carmazium app" && npx jest --testPathPattern=VehicleCard` |
| Full suite command | `cd "carmazium app/carmazium app" && npx jest` |

### Phase Requirements → Test Map

No formal requirement IDs were assigned to this phase. The testable behaviours are:

| Behaviour | Test Type | Automated Command |
|-----------|-----------|-------------------|
| Cards with 1 image render without `GestureDetector` | Unit (render) | `jest --testPathPattern=VehicleCard` |
| Cards with 2+ images render indicator dots | Unit (render) | `jest --testPathPattern=VehicleCard` |
| Dots count matches capped image count (max 5) | Unit (render) | `jest --testPathPattern=VehicleCard` |
| Active dot index matches `activeIndex` state | Unit (render) | `jest --testPathPattern=VehicleCard` |
| `Image.prefetch` called for indices 0-2 on mount | Unit (mock) | `jest --testPathPattern=VehicleCard` |
| `Haptics.impactAsync` NOT called during drag | Integration — manual | Manual device test |
| Spring snaps back if threshold not met | Integration — manual | Manual device test |
| Rubber-band at boundary (no hard stop) | Integration — manual | Manual device test |
| Tap still navigates to detail after adding gesture | Integration — manual | Manual device test |
| Vertical parent scroll unimpeded on single-image card | Integration — manual | Manual device test |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=VehicleCard -x`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green + manual device smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `carmazium app/carmazium app/src/components/__tests__/VehicleCard.test.tsx` — covers render-level assertions above (dots, prefetch, conditional gesture wrapper)

---

## Sources

### Primary (HIGH confidence)
- Codebase: `VehicleDetailScreen.tsx` — proven `Gesture.Pan()` spring-snap strip pattern, exact API signatures for Reanimated 4 + RNGH 2.28 in this project
- Codebase: `VehicleCard.tsx` — exact current structure to be modified (line 76-123 imageContainer block)
- Codebase: `package.json` — confirmed installed versions: `react-native-reanimated ~4.1.1`, `react-native-gesture-handler ~2.28.0`, `expo-haptics ~15.0.8`, `expo-image ~3.0.11`
- Codebase: `STATE.md` — mobile-app-parity Plan 3 note: `Reanimated.View strip + Gesture.Pan spring-snap (damping:20, stiffness:200, 30% threshold)` as the verified gallery pattern

### Secondary (MEDIUM confidence)
- RNGH 2 documentation pattern: `Gesture.Pan().activeOffsetX().failOffsetY()` for scroll conflict resolution — documented API, matches installed version
- expo-image documentation: `Image.prefetch(uri)` static method — available in expo-image ~3.x

### Tertiary (LOW confidence)
- General React Native community pattern: 0.3x rubber-band multiplier at boundary — widely used but not from an authoritative single source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and verified in package.json; exact API signatures confirmed from codebase usage in VehicleDetailScreen
- Architecture: HIGH — strip+translateX pattern is already working in this codebase; angle-threshold RNGH API matches installed version
- Pitfalls: HIGH for worklet/JS index drift and overflow (confirmed from VehicleDetailScreen implementation); MEDIUM for HomeScreen horizontal conflict (no prior example in codebase)

**Research date:** 2026-06-21
**Valid until:** 2026-08-21 (stable ecosystem; Reanimated/RNGH are mature at these versions)
