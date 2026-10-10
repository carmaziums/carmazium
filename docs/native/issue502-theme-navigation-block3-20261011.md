# CarMazium native theme programme — Block 3/10 (navigation chrome)

Date: 11 October 2026. Issue #502. Stacked source changes based on Block 2 draft PR #504 and prior Blocks 1/menu fix. Not merged, no signed APK.

## Implemented
- `src/theme/nativeNavigationTheme.ts` maps the current semantic palette to React Navigation's DarkTheme/DefaultTheme, preserving native fonts and avoiding a theme-based navigator key/remount. Shared mapping also supplies tab/header chrome colours.
- `App.tsx` now memoises the navigation theme from the hydrated appearance provider and sets the root background and system status bar text/background accordingly. Auth and navigation state are unaffected.
- `RootNavigator.tsx` and `MainStackNavigator.tsx`: native stack transition backgrounds use the active website `bgBody` semantic token.
- `WebsiteTopBar.tsx`: header, buttons, borders and icons use `bgHeader`, `bgCard`, `borderDefault`, `textSecondary`, `textMuted`. Existing account-settings and notification navigation remain unchanged.
- `HamburgerButton.tsx`: top-right menu icon follows `textPrimary` if no explicit colour prop, while preserving legacy button defaults; previously repaired unknown-menu-as-question-mark mapping remains intact.
- `TabNavigator.tsx`: dealer and marketplace bottom tabs use semantic borders, background and inactive icon/text colour. All dealer permission guards, state, tab names and More-toggle logic remain unchanged.
- `GlobalDrawer.tsx`: actual native modal (restored in #501) uses themed panel/backdrop/background, borders and standard text/icon colours. The dealer staff permissions, support/chat, role switching, QA feedback and close controls are unchanged. Accent/status-specific colours remain in the original CarMazium palette.

## Verification
- `scripts/test-native-theme-navigation-block3.test.mjs`: verifies real chrome mapping in both modes, status bar/stack/header/tab/drawer contracts, role gating and no pretend Settings toggle.
- Existing Block 1 website token and Block 2 storage/system preference regression tests retained and updated for the new navigation scheme.
- Full native TypeScript, release certification, web/backend checks and One Product Parity to be verified for the exact PR head before block signoff.

## Boundaries and remaining work
- **No active Light/Dark/System picker yet.** The provider's resolved appearance may inform navigation chrome, but static screen styles still need migration in Blocks 4–9. Do not claim full app-wide visual consistency, contrast or real-device acceptance yet.
- The website-matched PNG logo is shared on both themes; actual logo legibility, modal contents, typography, wide/small screens and large-text are subject to visual testing.
- No changes to auth/roles, auctions, fees, payments, storage credentials, signing, live backend or website APK download configuration; public customer downloads remain disabled.
- **Stop at 30%** pending explicit approval for Block 4 (shared controls, cards, forms and overlays).
