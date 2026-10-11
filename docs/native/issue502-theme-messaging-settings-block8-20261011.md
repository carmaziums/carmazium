# CarMazium native theme parity — Block 8/10 (80% source checkpoint)

Date: 11 October 2026. Issue #502. This is a stacked draft branch from Block 7 PR #509 including earlier Blocks 1–7. The result is a **source/UI checkpoint, not physical Android or iOS certification**.

## Messaging, AI and account work

- `components/GlobalAIChatBot.tsx` now uses native semantic theme values for the website-style MaziuM chat panel, message thread, assistant replies, consent notice, horizontally scrolling quick replies, filter suggestions, prompt field, safety report modal, and floating website mascot greeting. Branded user message and red CTA contrast remain deliberately fixed. No change to actual AI endpoint, prompts, consent persistence, user-by-user sharing gate, withdrawal, moderation/reporting, keyboard anchoring or message submission permissions.
- `screens/main/MessagesScreen.tsx` uses semantic colours for conversation cards, vehicle context, unread indicators, inbox search and filters. Hoisted memoized `ThreadRow` subscribes to the theme and shows the same real room/message data.
- `screens/main/ChatScreen.tsx` now themes the header, vehicle context banner, conversation and seller messages, composer, attachment controls, offer/counter information, safety/report modal, and auction fee blocking panel. Current user's red messages **explicitly retain a white foreground**. The `£125 Buyer Fee Due` block, blocked-chat restrictions, real chat/photo upload/report callbacks and delivery receipts are unchanged.
- `screens/main/SettingsScreen.tsx`: one-stop profile, notification shortcut, ownership-controlled business profile, verification, payouts/bank detail forms, reviews, security and appearance *information* surfaces use theme-aware text/cards/fields. Existing `canManageBusiness = isDealerAccount && !isDealerStaff`, update/save, sign-out and deletion behaviour retained.
- `screens/main/NotificationSettingsScreen.tsx`: alert/quiet hours cards, time pickers, switches and labels follow semantic palette. Preference persistence remains server-backed; real quiet-hours controls still cycle times rather than presenting decorative pickers.
- `screens/main/NotificationsScreen.tsx`: notification list cards, timestamps, retry controls and role-aware routing surfaces theme-aware. No read-status or routing rule changes.

## Safety & scope

- Added `scripts/test-native-theme-messaging-settings-block8.test.mjs` and CI Release Certification job to verify all theme mappings plus **AI pre-send consent / withdrawal / report**, message attachment and blocked/fee-gated chat, role-specific account controls, notification save semantics and routing.
- All three GitHub workflows (Release Certification with native/web/backend checks and build; One Product Parity; Mobile Listing CI) must pass at the **exact final PR head**. Vercel preview is checked separately. These are source-level controls, not a substitute for testing the real installed native app and its appearance.
- Appearance selector deliberately **remains disabled**; text in Settings explains why. This programme does not claim the light-mode UI can already be switched on in a public APK.
- Remaining Block 9: secondary account and dealer screens, KYC/verification and residual light/dark/readability/contrast audit. Block 10: Android/iOS device acceptance, screenshots, accessibility, real builds/signing and release gate (only with owner sign-off). Dedicated production signing certificate is **not** generated or altered.
- Public first-party Android installer remains disabled; no APK, iOS build, merger, roles, API/DB, auction, payout, KYC or chat back-end change was made.

**Stop at 80% and await owner `proceed` before Block 9.**
