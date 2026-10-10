# Mazium web/native greeting parity — Block 8 / 10

Date: 2026-10-10. Draft source implementation for the shared Android/iOS Expo component, based on the actual current website `src/components/features/MaziumWidget.tsx`.

## Website behaviour observed
- 3D mascot at lower-right with a speech bubble above it.
- Greeting: "Hi, I'm Mazium!" and "How can I help you today?"
- Compact dark popup (max 260px), green status dot, small arrow and permanent-dismiss cross.
- First appears on mount; visibility toggles every 20 seconds until permanently dismissed.
- Opening the assistant hides the greeting; web stores `mazium_greeting_dismissed=true` in browser localStorage.
- Greeting is presentation only. It does not send AI prompts or constitute consent.

## Native changes
- Use the **identical bundled mascot** inside a 32px popup avatar, website wording and green dot.
- Position the dark, speech-arrow popup above the fixed 64px launcher at the app's existing safe-area/tab-bar position, limit width to 260px and available viewport.
- Match 20-second hide/show cadence when eligible. Pause entirely while backgrounded, on logout and after permanent dismissal; clean up timer and AppState subscription.
- Persist dismissal with **per-account native** `AsyncStorage` key `mazium_greeting_dismissed:<userId>` so multiple users sharing one device do not inherit each other's preference. Pending reads are cancelled on account change.
- Hide the popup while typing, when the full assistant is open, or when the route intentionally hides the assistant (`LiveAuctionDetailed`). Do not reveal prior-account chat or consent state.
- Animate entrance with native driver; respect the system's reduced-motion preference.
- The native popup has a visible, keyboard-independent dismiss button and accessible label. Opening the original mascot launches the real existing AI interface; all AI consent, privacy, report and authenticated API gates remain untouched.

## Verification
- `scripts/test-mazium-native-greeting-parity-block8.test.mjs` covers website copy, mascot, status, 20-second timer, per-user persistence, cleanups, reduced-motion, render restrictions and consent boundary.
- Native typechecking, web typechecking, source contracts and broader One Product Parity CI must pass.
- This is NOT proof of pixel-accurate screenshots or real-device behaviour. Check on Android and iPhone with 100%/200% text size, small viewport, OS light/dark settings, background/resume, switching user accounts, consent declined/accepted, dismiss and relaunch.

## Outstanding release blockers
- Website and native theme rendering still differ (native dark surfaces versus website's light/dark theme).
- Native guest AI access intentionally remains authenticated-only to preserve API security; a separate explicitly approved public AI endpoint would be required for safe guest parity.
- No physical device QA or signed APK has been verified. The release candidate is **NO-GO** and `www.carmazium.com/download-app` must not expose an internal/debug installer.
- All changes remain in a draft stacked review PR. No production data, signing secrets, authentication/payment rules or public download flags were modified.
