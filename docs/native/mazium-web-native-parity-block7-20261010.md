# Block 7 — Mazium website/native conversation parity
Date: 2026-10-10. Source implementation only; Android and iOS physical-device parity remains unverified.

## Website source of truth
- `src/components/features/MaziumWidget.tsx` (actual website UI).
- `carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx` (shared Android/iOS Expo component).
- `public/assets/images/mazium-bot-3d.png` and corresponding native asset have identical bytes, covered by the pre-existing visual parity test.
- Both send text to the `/ai/chat` backend via the web/native clients and require consent before sending.

## Fixes in this block
1. Match the website welcome text, visible assistant name, subtitle, same 12 rotating quick prompts and daily rotation logic, including ULEZ instead of "Best value".
2. Keep the four daily quick prompts in a persistent horizontal rail above the chat input, including after a conversation starts. Disable them while an AI answer is pending or before consent.
3. Match website 340px by 540px maximum chat footprint (subject to viewport, tab-bar and keyboard clearance), navy header gradient, green availability dot, input placeholder and circular send button.
4. Expose visible `AI privacy` and `Stop AI sharing` controls in the native chat footer, while retaining the existing native consent card and AI response reporting.
5. Correct the website's repeated user prompt in backend history: `handleSend` already adds the latest user message, so `processMessage` must not append it again. Both now send at most the last ten messages without duplicating that prompt.
6. Reset native chat history, report state and pending UI when switching user accounts. Ignore stale storage reads and AI answers from a previous signed-in account.

## CI contracts
- `scripts/test-mazium-web-native-conversation-parity.test.mjs` asserts shared prompt pool, welcome copy, privacy/consent controls, chat layout, backend message history and native account switching protection.
- `scripts/test-mazium-native-visual-parity.test.mjs` retains the exact website mascot byte check and updates width acceptance to 340px.
- Native TypeScript and existing Android/iOS/web release/product checks must pass on this review branch.

## Known differences and future acceptance checks
- The native chat remains gated to signed-in users, while the website widget can render for guests. The native shared `apiClient` intentionally rejects non-public API requests without an authenticated session. Do NOT bypass that security gate as a cosmetic parity fix; guest access needs a separately designed and tested public AI endpoint and abuse protections.
- Website has a periodically appearing greeting popover; native still uses its existing floating avatar without that popover.
- Website supports light/dark mode, while this native component currently follows the application's canonical navy palette. Physical-device comparison with representative phones and accessible font settings remains required.
- Confirm actual AI responses, result cards, login/account transitions, privacy consent and report actions on Android and iOS; static source tests alone do not validate screenshots or real functionality.
- All APK release security gates remain CLOSED, including owner-approved production signing identity and actual installed signed APK device QA. No downloads/website environment variables or live app data change in this block.
