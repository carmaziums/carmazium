---
phase: mobile-app-parity
plan: "01"
type: execute
wave: 0
depends_on: []
files_modified:
  - "src/components/ui/Skeleton.tsx"
  - "src/components/ui/EmptyState.tsx"
  - "src/components/ui/ErrorBanner.tsx"
  - "src/lib/haptics.ts"
  - "src/screens/vehicle/AuctionDetailScreen.tsx"
  - "src/components/GlobalToastProvider.tsx"
  - "App.tsx"
  - "package.json"
autonomous: true
requirements: []
must_haves:
  truths:
    - "A shared <Skeleton w h r /> component exists in src/components/ui and renders the same pulse as HomeScreen"
    - "A shared <EmptyState> component exists (icon + heading + subtext + optional CTA)"
    - "A shared <ErrorBanner> component exists (message + Try again button)"
    - "expo-haptics, react-native-gifted-charts, react-native-gesture-handler, and a confetti library are installed and importable"
    - "GestureHandlerRootView wraps NavigationContainer in App.tsx"
    - "AuctionDetailScreen navigates to the chat screen with route name 'ChatScreen' and param key 'threadId'"
    - "GlobalToastProvider subscribes to the /notifications Socket.IO namespace (reusing a singleton) and shows a slide-down toast on new notification events"
    - "npx tsc --noEmit passes with zero errors"
  artifacts:
    - path: "src/components/ui/Skeleton.tsx"
      provides: "Shared skeleton component used by all screens"
    - path: "src/components/ui/EmptyState.tsx"
      provides: "Shared illustrated empty-state component"
    - path: "src/components/ui/ErrorBanner.tsx"
      provides: "Shared inline error banner with retry"
    - path: "src/lib/haptics.ts"
      provides: "Safe cross-platform haptics wrapper"
  key_links:
    - from: "src/screens/vehicle/AuctionDetailScreen.tsx"
      to: "ChatScreen route"
      via: "navigation.navigate('ChatScreen', { threadId })"
    - from: "src/components/GlobalToastProvider.tsx"
      to: "/notifications Socket.IO namespace"
      via: "io singleton subscription"
---

<objective>
Wave 0 — Shared infrastructure that every subsequent wave depends on. Extract the reusable UI primitives (Skeleton, EmptyState, ErrorBanner), install all missing native packages, fix the blocking Chat navigation bug, add the gesture-handler root, and extend the global toast to react to real-time socket events.

Purpose: Unblock Waves 1–5. Skeleton, gesture-handler, haptics, and the toast extension are required by auction polish, the photo gallery, charts, and the haptics pass. The Chat nav bug currently breaks the post-auction "Message Seller" flow.
Output: Three shared UI components, one haptics helper, four installed packages, a gesture-handler root, an extended toast provider, and a fixed Chat navigation call.
</objective>

<execution_context>
@C:/Users/Airaf/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Airaf/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/mobile-app-parity/mobile-CONTEXT.md
@.planning/phases/mobile-app-parity/mobile-RESEARCH.md

<interfaces>
Reference Skeleton implementation (already in src/screens/main/HomeScreen.tsx, lines 28-39) — extract this verbatim into the shared component:

```typescript
const Skeleton: React.FC<{ w: number; h: number; r?: number }> = ({ w, h, r = 14 }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [opacity]);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: '#1E1E28', opacity }} />;
};
```

Tokens (src/constants/colors.ts): Colors.bgTertiary='#18181E', Colors.accent='#DC1F26', Colors.textSecondary='#A0A0AB', Colors.textMuted='#5C5C6B', Colors.error='#EF4444'.
Fonts (src/constants/typography.ts): FontFamily.bold (Poppins headings), FontFamily.regular (Montserrat body), FontFamily.mono (JetBrains Mono).
Icons: import { Ionicons } from '@/components/BrandIcon'.

Existing Toast API (src/components/Toast.tsx): `useToast()` returns `{ toast, show, hide }` where `show(message: string, type: 'success'|'error'|'info'|'saved')`. Toast already animates translateY from -100 to 0 with spring. Reuse `show` — do NOT build a second toast UI.

Chat nav bug facts:
- Stack registers route name `ChatScreen` with param `{ threadId: string }` (MainStackNavigator.tsx lines 54, 143-146).
- ChatScreen.tsx consumes `route.params.threadId` in 15+ places (line 98 onward) — do NOT rename the param inside ChatScreen.
- AuctionDetailScreen.tsx currently calls `navigation.navigate('Chat' as any, { roomId: room.id })` at lines ~418 and ~770. These are the bug. Fix the CALLERS, not ChatScreen.

Socket facts:
- ChatContext.tsx already opens `io(\`${API_URL}/chat\`)`. Follow that exact connection pattern (transports: ['websocket'], auth token).
- A /notifications namespace exists on the backend. Do NOT create a duplicate connection if one already exists — check src/lib/pushNotifications.ts and src/context for an existing /notifications socket first; if none manages it, create a single module-level singleton inside GlobalToastProvider.
</interfaces>
</context>

<tasks>

<task type="install">
  <name>Task 1: Install missing native packages</name>
  <files>package.json</files>
  <action>
    From the target app root `D:\carmazium\carmazium app\carmazium app`, run these installs (use expo install so versions match SDK 54):
      npx expo install expo-haptics
      npx expo install react-native-gifted-charts
      npx expo install react-native-gesture-handler
      npx expo install react-native-confetti-cannon
    Notes:
    - react-native-svg (15.12.1) is already installed — peer dep for gifted-charts is met, do NOT reinstall.
    - If react-native-confetti-cannon shows a React 19.1 peer-dep warning, install with --legacy-peer-deps; if it errors at import time later, Wave 1 falls back to a Reanimated particle system (documented there). Do not block on it here.
    - Do NOT touch babel.config.js — babel-preset-expo applies the Reanimated plugin automatically in SDK 54.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Confirm all four packages appear in package.json dependencies; app still boots in Expo dev client.</manual>
  </verify>
  <done>expo-haptics, react-native-gifted-charts, react-native-gesture-handler, and react-native-confetti-cannon are in package.json and import without resolution errors.</done>
</task>

<task type="create">
  <name>Task 2: Create shared Skeleton, EmptyState, ErrorBanner, and haptics helper</name>
  <files>src/components/ui/Skeleton.tsx, src/components/ui/EmptyState.tsx, src/components/ui/ErrorBanner.tsx, src/lib/haptics.ts</files>
  <action>
    Create the `src/components/ui/` directory if it does not exist.

    1) src/components/ui/Skeleton.tsx — Export a named `Skeleton` component matching the HomeScreen reference verbatim (props `{ w: number; h: number; r?: number }`, default r=14, pulse via Animated.loop opacity 0.35→0.7→0.35 over 700ms each, backgroundColor Colors.bgTertiary). Import Colors from '../../constants/colors' and use Colors.bgTertiary instead of the hardcoded '#1E1E28'. Export default and named.

    2) src/components/ui/EmptyState.tsx — Export `EmptyState` with props `{ icon: keyof typeof Ionicons.glyphMap | string; title: string; subtitle?: string; ctaLabel?: string; onCtaPress?: () => void; }`. Layout: centered column, large Ionicons (size 48, color Colors.textMuted) inside a 96x96 rounded glass circle (backgroundColor Colors.glassBg, borderColor Colors.glassBorder), title in FontFamily.bold (FontSize.lg, Colors.textPrimary), subtitle in FontFamily.regular (FontSize.sm, Colors.textSecondary, textAlign center). If ctaLabel + onCtaPress provided, render a pill TouchableOpacity (backgroundColor Colors.accent, FontFamily.bold white label). All StyleSheet.create, zero hardcoded hex.

    3) src/components/ui/ErrorBanner.tsx — Export `ErrorBanner` with props `{ message: string; onRetry?: () => void; }`. Layout: horizontal row, alert-circle Ionicon (Colors.error), message text FontFamily.regular FontSize.sm Colors.textPrimary flex:1, and a "Try again" TouchableOpacity (FontFamily.bold, Colors.accent) when onRetry provided. Container: backgroundColor 'rgba(239,68,68,0.10)' — express as a constant derived in styles (acceptable rgba); border Colors.error at low opacity. Use StyleSheet.create.

    4) src/lib/haptics.ts — Export `haptics` object wrapping expo-haptics with try/catch and Platform guards so simulator/emulator never throws:
       - `light()` → Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
       - `medium()` → Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
       - `success()` → Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
       Each wrapped in try/catch that silently swallows errors. Import * as Haptics from 'expo-haptics'.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Temporarily render &lt;Skeleton w={200} h={40} /&gt; and &lt;EmptyState icon="car-outline" title="No data" /&gt; on HomeScreen; confirm pulse and layout render.</manual>
  </verify>
  <done>All four files exist, export their named members, compile clean, and use only Colors.*/FontFamily.* tokens (no hardcoded hex except the unavoidable rgba overlays).</done>
</task>

<task type="fix">
  <name>Task 3: Fix Chat navigation bug in AuctionDetailScreen</name>
  <files>src/screens/vehicle/AuctionDetailScreen.tsx</files>
  <action>
    There are two calls that navigate to chat using the wrong route name AND wrong param key (lines ~418 and ~770):
      navigation.navigate('Chat' as any, { roomId: room.id });
    Replace BOTH with:
      navigation.navigate('ChatScreen' as any, { threadId: room.id });
    Rationale: the stack route is named 'ChatScreen' and ChatScreen.tsx reads route.params.threadId. Do NOT modify ChatScreen.tsx or the MainStackParamList — only fix the two caller sites here. Leave the `navigation.navigate('Messages' ...)` fallback lines unchanged.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>From a post-auction win state, tap "Message Seller" — the chat conversation opens (not a blank screen or crash).</manual>
  </verify>
  <done>Both chat navigation calls use route 'ChatScreen' with param threadId; no remaining `navigate('Chat'` or `roomId:` references in this file.</done>
</task>

<task type="modify">
  <name>Task 4: Add GestureHandlerRootView and extend GlobalToastProvider with /notifications socket</name>
  <files>App.tsx, src/components/GlobalToastProvider.tsx</files>
  <action>
    Part A — App.tsx:
    - Import { GestureHandlerRootView } from 'react-native-gesture-handler' at the TOP of the import list (gesture-handler requires being imported first).
    - Wrap the returned tree: GestureHandlerRootView with style={{ flex: 1 }} must be the OUTERMOST wrapper around StripeProvider (or directly inside it but above SafeAreaProvider). Place it so it contains NavigationContainer. Do not change any existing providers' order otherwise.

    Part B — GlobalToastProvider.tsx:
    - Keep the existing watchlist toast behavior intact.
    - Add a Socket.IO subscription to the /notifications namespace. First check whether an existing singleton manages /notifications (search src/context and src/lib/pushNotifications.ts). If one exists, subscribe to it; if not, create a module-level singleton socket: `io(\`${API_URL}/notifications\`, { transports: ['websocket'], auth: { token } })` mirroring the ChatContext.tsx connection pattern (pull API_URL and the auth token the same way ChatContext does). Connect inside a useEffect that runs once when the user is authenticated; disconnect on unmount/logout.
    - On a 'notification:new' (or the backend's documented new-notification event — confirm the event name against notificationsApi/pushNotifications; if unknown, listen for the generic 'notification' event) call the existing `show(payload.title ?? payload.message, 'info')` from useToast. Do NOT build a new toast UI — reuse the existing Toast component already rendered by this provider.
    - Guard against double-connection: store the socket in a useRef and only create it once.
  </action>
  <verify>
    <automated>cd "D:\carmazium\carmazium app\carmazium app" && npx tsc --noEmit</automated>
    <manual>Trigger a notification on the backend while the app is foregrounded; a slide-down toast appears at top. Confirm only ONE /notifications socket connection is opened (check network/socket logs).</manual>
  </verify>
  <done>GestureHandlerRootView wraps the navigation tree; GlobalToastProvider opens exactly one /notifications socket and shows a toast on new notification events while preserving watchlist toasts.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes.
- src/components/ui/ contains Skeleton.tsx, EmptyState.tsx, ErrorBanner.tsx.
- src/lib/haptics.ts exports the haptics wrapper.
- No `navigate('Chat'` or `roomId` references remain in AuctionDetailScreen.tsx.
- App.tsx imports gesture-handler first and wraps the tree in GestureHandlerRootView.
- GlobalToastProvider subscribes to /notifications without a duplicate connection.
</verification>

<success_criteria>
All four packages installed; three shared UI components + haptics helper created; Chat nav bug fixed; gesture-handler root added; toast extended to real-time notifications. TypeScript clean.
</success_criteria>

<output>
After completion, create `.planning/phases/mobile-app-parity/mobile-app-parity-01-SUMMARY.md` documenting the shared component APIs, the haptics helper signature, the chosen confetti library, and the /notifications socket event name used (so Wave 1 can reuse it).
</output>
