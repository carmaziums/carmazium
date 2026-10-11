# CarMazium Light/Dark/System — Block 8 of 10: messaging, MaziuM, settings

Date: 11 October 2026 · Parent: Issue #502 · **80% of staged source-migration blocks, NOT phone or release readiness.**

Stacked draft on Block 7 PR #509 (which includes earlier Blocks 1–6). Do not merge independently overlapping drafts.

## Migrated presentation, without changing business state or consent

- **MaziuM AI** `GlobalAIChatBot.tsx`: website-matched assistant modal foreground/surfaces, AI and user bubble contrast, assistant privacy/consent panel, quick prompts, filter results, report-response overlay, input/keyboard and floating greeting. The actual mascot asset, bubble placement/close button, OpenAI consent gate, opt-out, report submission, keyboard management and send-disable rules are unchanged.
- **Conversation inbox** `MessagesScreen.tsx`: unread conversation cells, contact names, car title, preview, search, counts, list and header. Memoised `ThreadRow` subscribes to native appearance directly; no socket/chat or unread-state change.
- **Individual threads** `ChatScreen.tsx`: source/recipient message bubbles, offer and counteroffer cards, £125 buyer-fee notice, safety reporting, blocked state, seller header, photo and message composer. Own red bubbles keep white foreground; received card uses the palette. Existing socket, transport, attachments, receipt, blocking, reporting, error handling, and access gating are unchanged.
- **Unified account settings** `SettingsScreen.tsx`: setting-category chooser, bank/payouts, password, verification, business and personal profile forms, Danger Zone and notification shortcuts. SectionHeader and FieldLabel subscribe to the theme, as do text fields; still one canonical Settings screen. Dealer staff cannot enter owner-only KYC/management. Appearance category remains informational; the user cannot enable Light/Dark yet.
- **Notification preferences** `NotificationSettingsScreen.tsx`: toggle cards, quiet-hours inputs, summaries and switch-off rails use the palette. Existing PATCH payload, cannot-save-unloaded guard and save confirmation retained.
- **Notification inbox** `NotificationsScreen.tsx`: unread, read, metadata, headings and reply actions use contrast-safe semantic tokens; memoised renderRow updates with palette via hook dependency while keeping routing, mark read/all read, and retry logic.
- All theme foreground mappings use `useNativeAppearance` and preserve legacy fallback styles. The shared Block 2 appearance state remains internal.

## Verification and boundaries

- Added `scripts/test-native-theme-messages-mazium-settings-block8.test.mjs` to Release Certification. Tests enforce source contracts for consent, withdraw, AI reporting, message/blocking actions, fee notice, role-sensitive settings, quiet-hours save and unread-state handling.
- Must pass final PR head Release Certification source tests, native/web/backend typecheck/build, product parity and mobile listing CI. CI **cannot** certify contrast visually on Android/iPhone.
- Remaining Block 9 includes KYC/registration/onboarding/dealer subfeatures, delivery and specialist screens, deeper conversations/alerts. The Appearance switch remains disabled until whole-app coverage, user-confirmed visual parity, and safe switching; public APK remains disabled.
- Block 10 must run actual Samsung and iPhone screenshots and large-text/keyboard/TalkBack/VoiceOver tests, verify '?'/X duplication, account/settings, changing appearance with system mode, and produce a verified internal-only QA APK before any release decision.
- No production mutation, auth/roles, chat access policy, payment fee, auction reserve, disclosure weakening, secret, keystore, or public website download change. No APK built or distributed in this block.

**Stop at 80%. Wait for explicit owner `proceed` before starting Block 9.**
