---
phase: mobile-app-parity
plan: "05"
type: execute
wave: 4
depends_on: ["01"]
files_modified:
  - "src/screens/main/AboutScreen.tsx"
  - "src/screens/main/PricingScreen.tsx"
  - "src/navigation/MainStackNavigator.tsx"
  - "src/components/GlobalDrawer.tsx"
  - "src/navigation/TabNavigator.tsx"
  - "src/screens/buyer/BuyerOffersScreen.tsx"
  - "src/screens/buyer/BuyerBidsScreen.tsx"
  - "src/screens/buyer/BuyerPurchaseHistoryScreen.tsx"
  - "src/components/PrimaryCTA.tsx"
  - "src/components/VehicleCard.tsx"
  - "src/components/HorizontalVehicleCard.tsx"
autonomous: true
requirements: []
must_haves:
  truths:
    - "AboutScreen and PricingScreen exist, are registered in the stack, and open from the GlobalDrawer (no more Alert.alert for About/Pricing)"
    - "BuyerOffersScreen, BuyerBidsScreen, and BuyerPurchaseHistoryScreen have skeleton loading, EmptyState, and an accent-tinted RefreshControl"
    - "expo-haptics fires on CTA button press (light) and on transaction-completing actions (medium/success) across buyer/offer flows"
    - "The active tab bar icon spring-scales (withSpring 1.2 then 1.0) on selection"
    - "All car images in VehicleCard/HorizontalVehicleCard use expo-image with transition=200 and a dark (#1E1E28 / Colors.bgTertiary) placeholder fallback"
    - "All prices and vehicle IDs across the screens addressed in this plan use FontFamily.mono; headings FontFamily.bold; body FontFamily.regular"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/screens/main/AboutScreen.tsx"
      provides: "About screen"
    - path: "src/screens/main/PricingScreen.tsx"
      provides: "Pricing screen"
  key_links:
    - from: "src/components/GlobalDrawer.tsx"
      to: "About / Pricing stack screens"
      via: "stackScreen route instead of action:'alert'"
    - from: "src/navigation/TabNavigator.tsx"
      to: "active tab icon"
      via: "Reanimated withSpring scale on focus"
---

<objective>
Wave 4/5 — Buyer flows, info screens, haptics, tab-bar spring, and image/typography polish. Create the missing About and Pricing screens and wire them into the drawer, standardise skeleton/empty/refresh across the buyer screens, add the haptics pass to CTAs and transaction actions, add the active-tab spring animation, and enforce expo-image placeholders and mono/Poppins/Montserrat typography across the shared card components.

Purpose: Close the last true feature gaps (About/Pricing), finish the consistency pass, and apply the tactile + typographic polish that defines the quality bar.
Output: Two new screens, polished buyer flows, app-wide haptics and tab spring, and consistent image/typography on cards.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md

<interfaces>
Shared (Wave 0): Skeleton, EmptyState, ErrorBanner from src/components/ui/*, haptics from src/lib/haptics (haptics.light/medium/success).
Tokens: Colors.accent='#DC1F26', Colors.bgPrimary, Colors.bgTertiary='#18181E', Colors.glassBg, Colors.textPrimary, Colors.textSecondary, Colors.textMuted. FontFamily.mono (prices/IDs), FontFamily.bold (Poppins headings), FontFamily.regular (Montserrat body).

GlobalDrawer facts (src/components/GlobalDrawer.tsx): ITEMS array has `pricing` and `about` entries currently using `action: 'alert'` with alertTitle/alertMsg (lines ~69-70). MenuItem type supports `stackScreen?: keyof MainStackParamList`. handleItem already navigates `navigation.navigate('Main', { screen: item.stackScreen } as never)`. Existing static screens (HowItWorks/Services/Terms) prove the pattern. The drawer uses local color constants `C.*` — for the new screens use the global Colors tokens.

Stack facts (src/navigation/MainStackNavigator.tsx): MainStackParamList is the union of route names. Static info screens (HowItWorks, Services, Terms) are registered with `options={{ animation: 'slide_from_right' }}`. Add `About: undefined;` and `Pricing: undefined;` to the param list and register both screens the same way.

TabNavigator facts (src/navigation/TabNavigator.tsx): bottom tabs with tabBarIcon. To spring-scale the active icon, wrap the icon in a Reanimated Animated.View whose scale shared value reacts to `focused`: on focus, `scale.value = withSequence(withSpring(1.2), withSpring(1.0))`. Reanimated v4 patterns: use useSharedValue + useAnimatedStyle + withSpring/withSequence (see CategoryPill.tsx / PrimaryCTA.tsx).

PrimaryCTA facts (src/components/PrimaryCTA.tsx): already has a Reanimated press-scale. Add haptics.light() in its onPress (or onPressIn) so every CTA built on PrimaryCTA gets a tap haptic automatically.

VehicleCard / HorizontalVehicleCard facts: listing card components; reference for consistent card UI; already may use expo-image — confirm transition={200} + dark placeholder. Prices rendered here must use FontFamily.mono.

SavedScreen / NotificationsScreen image note: these two screens (addressed for skeleton/empty/refresh in Plan 06) render car thumbnails. Per CONTEXT.md they must NOT show a white flash. Their car images should either reuse VehicleCard/HorizontalVehicleCard (which Task 3 fixes) or, if they call expo-image directly, get the same dark placeholder treatment — see Task 3 done criteria.

About/Pricing content: static marketing copy. Mirror the existing About/Pricing alert messages as the seed copy:
- About: "Carmazium is the UK's premium automotive marketplace — connecting buyers with curated, verified vehicle listings and live auction experiences."
- Pricing: "Premium dealer and private seller plans coming soon — priority listings, AI insights and more."
</interfaces>
</context>

<tasks>

<task type="create">
  <name>Task 1: Create AboutScreen + PricingScreen, register in stack, wire drawer</name>
  <files>src/screens/main/AboutScreen.tsx, src/screens/main/PricingScreen.tsx, src/navigation/MainStackNavigator.tsx, src/components/GlobalDrawer.tsx</files>
  <action>
    1) AboutScreen.tsx: A scrollable static screen styled like HowItWorks/Services (use those as a structural reference). Header with a back button + "About" title (FontFamily.bold). Sections: brand intro (seed copy above), a short "Why Carmazium" bullet list (verified listings, live auctions, transparent process), and a footer with the CARMAZIUM wordmark + tagline. Use Colors.* tokens and FontFamily.bold/regular. SafeArea-aware. Export named `AboutScreen`.

    2) PricingScreen.tsx: Same structural pattern. Header "Pricing". Show 2-3 plan cards (GlassCard style: Buyer / Private Seller / Dealer) with a "Coming Soon" badge, feature bullets, and any price values in FontFamily.mono. Seed copy above. Export named `PricingScreen`.

    3) MainStackNavigator.tsx: import both screens; add `About: undefined;` and `Pricing: undefined;` to MainStackParamList; register `<Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />` and the same for Pricing.

    4) GlobalDrawer.tsx: change the `pricing` item from `action: 'alert'` to `stackScreen: 'Pricing'` (remove alertTitle/alertMsg), and the `about` item to `stackScreen: 'About'`. Leave handleItem logic as-is (it already routes stackScreen items).
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Open drawer → tap About: AboutScreen opens (not an alert). Tap Pricing: PricingScreen opens. Both render styled content, back button works.</manual>
  </verify>
  <done>AboutScreen and PricingScreen exist, are registered, and open from the drawer; no Alert.alert remains for About/Pricing.</done>
</task>

<task type="modify">
  <name>Task 2: Buyer screens skeleton/empty/refresh + haptics on CTAs and transactions</name>
  <files>src/screens/buyer/BuyerOffersScreen.tsx, src/screens/buyer/BuyerBidsScreen.tsx, src/screens/buyer/BuyerPurchaseHistoryScreen.tsx, src/components/PrimaryCTA.tsx</files>
  <action>
    1) BuyerOffersScreen, BuyerBidsScreen, BuyerPurchaseHistoryScreen: Audit and standardise (keep API wiring intact). Add Skeleton list rows replacing spinners/blanks. Add an EmptyState with contextual icon + message + CTA where useful ("No active offers" → Browse listings; "No bids yet" → Browse auctions; "No purchases yet"). Add/confirm a RefreshControl with tintColor={Colors.accent} (BuyerBidsScreen is missing one per research). Replace any Alert.alert API-error with an ErrorBanner (retry). Ensure all £ values and bid amounts use FontFamily.mono.
    2) Transaction haptics: in the buyer/offer action handlers (submit offer, accept counter, withdraw, place bid where present on these screens), call haptics.medium() on submit success and haptics.success() on a completed/accepted transaction. Use the existing success/response branch of the handler — do not change the API calls.
    3) PrimaryCTA.tsx: add haptics.light() in the press handler so every CTA across the app triggers a tap haptic. Guard with the existing safe haptics wrapper (already try/catch'd) so simulators don't error.
    Use Colors.*/FontFamily.* tokens only.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>On a physical device: each buyer screen shows skeleton on load, EmptyState when empty, accent refresh on pull. Tapping any PrimaryCTA gives a light haptic; submitting an offer gives a medium haptic.</manual>
  </verify>
  <done>All three buyer screens have skeleton + EmptyState + accent RefreshControl + ErrorBanner; PrimaryCTA fires a light haptic; transaction actions fire medium/success haptics; prices in mono.</done>
</task>

<task type="modify">
  <name>Task 3: Tab-bar active-icon spring + expo-image/typography enforcement on shared cards</name>
  <files>src/navigation/TabNavigator.tsx, src/components/VehicleCard.tsx, src/components/HorizontalVehicleCard.tsx</files>
  <action>
    1) Tab-bar spring: In TabNavigator, replace the static tabBarIcon with a small Reanimated wrapper component (e.g. `AnimatedTabIcon`) that takes `focused`, `name`, `color`, `size`. Inside: `const scale = useSharedValue(1)`; useEffect on `focused` → if focused `scale.value = withSequence(withSpring(1.2, { damping: 12 }), withSpring(1, { damping: 12 }))`. useAnimatedStyle transform:[{scale}]. Wrap the Ionicons in Animated.View with that style. Apply for every tab's icon. Keep the existing icon names/colors and tabBar styling.

    2) expo-image + typography on cards: In VehicleCard.tsx and HorizontalVehicleCard.tsx — confirm car images use `Image` from 'expo-image'; if not, swap. Add `transition={200}` and a dark placeholder (style backgroundColor Colors.bgTertiary; if a listing.blurhash field exists use `placeholder={{ blurhash: listing.blurhash }}` else rely on the dark bg) so there is no white flash. Ensure the price Text uses FontFamily.mono and any heading/title uses FontFamily.bold, body/subtext FontFamily.regular. Do not bulk-replace fonts elsewhere — only these two card components in this task.

    Use Colors.* tokens only; no hardcoded hex (the dark placeholder should reference Colors.bgTertiary).
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Switch tabs: the newly-active icon spring-scales (1.2→1.0). Scroll listings on a slow connection: card images fade in over a dark placeholder (no white flash); prices render in JetBrains Mono.</manual>
  </verify>
  <done>Active tab icon spring-scales on selection; VehicleCard/HorizontalVehicleCard use expo-image with transition + dark placeholder and mono prices. Confirm SavedScreen and NotificationsScreen car image renders either use VehicleCard/HorizontalVehicleCard (already fixed here) or have a direct expo-image with transition={200} + a `backgroundColor: Colors.bgTertiary` ('#1E1E28') placeholder applied so neither screen shows a white image flash.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- About + Pricing screens exist, registered, and open from drawer (no alerts).
- Buyer screens: skeleton + EmptyState + accent refresh + ErrorBanner; PrimaryCTA + transaction haptics.
- Tab icon spring-scales on focus.
- VehicleCard/HorizontalVehicleCard use expo-image with dark placeholder + mono prices.
- SavedScreen/NotificationsScreen car thumbnails reuse the fixed cards or carry the dark expo-image placeholder (no white flash).
</verification>

<success_criteria>
The last feature gaps (About/Pricing) are closed, buyer flows are consistent, the app feels tactile (haptics + tab spring), and shared cards meet the image and typography quality bar.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-05-SUMMARY.md` documenting the new routes, the haptics integration points, and the tab-spring component. Note any remaining screens not yet typography-audited so a follow-up pass can finish the enforcement.
</output>
