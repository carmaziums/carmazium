# Issue #477 — Block 8/10: Unified Account Settings, Saved Cars, messages and notifications

Date: 2026-10-10. **80% means eight planned source implementation blocks of ten, not a measured visual similarity score.**

## Canonical website comparison

The website account destination is **/profile** (source: `src/app/profile/page.tsx`), not scattered separate profile forms. It has heading **Account Settings**, subtitle “One place for your profile, business, notifications, payouts and security,” account identity, and these settings categories: **Personal details, Business profile** (partner), **Verification** (partner), **Notifications & privacy, Payouts, Appearance, Security, Ratings & reviews, Account type**. Deep-link query parameter `section` selects a specific area; public reviews come from authenticated read-only `GET /profiles/:id`, `/profiles/:id/reviews?limit=20`, `/profiles/me/reviews/given?limit=20`.

Before Block 8 native `SettingsScreen` already covered personal details, dealership, verification, notifications/privacy, payouts/bank and security (including existing typed-DELETE account deletion), but only offered SIX categories. The user also reported tools scattered in More/drawer/dashboard. Existing SavedScreen is backend-hydrated and supports list/grid, sorting and proper auction vs retail deep links. MessagesScreen uses actual shared chat context, back-end refresh and real unread counts; NotificationsScreen uses the shared notification API, mark-as-read and deep-link resolver. Do not build second systems.

## Block 8 changes

- Native Account Settings now exposes all NINE canonical website section labels, while filtering partner business profiles to actual dealer accounts. Existing verification for consumer address remains available for account verification, even though the website category only shows business verification for partners.
- Account Settings has the shared global website top bar and website heading/subtitle. Removes extra independent Settings hamburger so native account pages no longer feel like a different navigation platform. Adds a Back link to preserve stack navigation.
- Adds a compact **Your account tools** area within Account Settings with direct, functional links to **Saved Cars, Messages, Notifications, Contact Support**. Saved navigates to existing shared watchlist tab and current account. Messages and Notifications use their existing stack screens. Support calls `getOrCreateSupportRoom()` (the same real backend support conversation as existing drawer) then opens ChatScreen; no fake support bot/local-only conversation.
- Adds real read-only **Ratings & reviews** panels under Account Settings, querying the website's three actual `/profiles` API endpoints, with average rating/count and received/given reviewer content. Loading/error states explicit; never invent testimonial counts, review text or profile data.
- Adds **Account type** area describing personal vs partner identities. For a dealer, the button opens existing Verification; for a personal account, **Explore Partner Account** opens the established PartnerDashboard/onboarding entry instead of directly mutating account role, ID/KYC, staff privileges or permissions. Switching dashboard preview is not role elevation.
- Adds an **Appearance** settings section that accurately states native currently uses website-aligned fixed dark palette: no fake toggle or silent attempt to change immutable Colors tokens. Website supports appearance switching; this native gap **remains open and is not claimed as completed parity**.
- Adds WebsiteTopBar to Saved Cars, Messages and Notifications (and relies on it for safe-area top instead of duplicating spacer/header margin). Saved retains real watchlist refresh and auction/retail routing. Messages retains real chat data/search/filter/unread count; removes forced automatic keyboard popup on opening Messages. Notifications retains read/mark-all and role-aware deep links. No new app/backend message send, marking or payment endpoint introduced.
- Existing account personal/business edits, Stripe payout setup, address verification, email/phone, notification preferences, password recovery and account-delete typed confirmation remain unmodified. No production user writes or real support threads were opened during this task.

## MaziuM assistant scope / exception

The roadmap also requested visual parity of the **MaziuM** assistant. A verified native assistant route or source counterpart was **not identified during Block 8 source inspection**; do not invent a functioning assistant chat or an external AI data call from Settings. Treat a genuine website/native paired MaziuM visual and consent check as **PENDING**, to be addressed during final parity/acceptance once the actual component and screen evidence are available. Previous user recordings' original files were not directly replayed in this task.

## Verification

- New `scripts/test-native-visual-parity-block8.test.mjs`, wired to Release Certification, asserts canonical sections, real review/support and tool destinations, navigation role isolation, unchanged account APIs and no fabricated theme toggle.
- **VISUAL SIGN-OFF PENDING**: authenticated same-user paired **360×800** and **390×844** Android/iOS app vs actual website Account Settings, Saved, Messages and Notifications screenshots **not acquired**. Pixel parity or keyboard/accessibility device parity cannot be inferred from passing source tests.
- In approved synthetic staging only, manually verify account Settings categories for a buyer, dealer owner and restricted staff; deep-linked section guards, error states, support entry, reviews received/given, Saved cross-client consistency (including trade auction gate), unread messages and notification marks, notifications preferences not auto-saved, phone/email/profile update and keyboard/VoiceOver/TalkBack. Never use real account deletion, payouts, real messages or customer IDs for QA.
- Confirm actual appearance in light/dark and dynamic text; native theme switching remains unsupported, so the Appearance section must not claim working dark/light toggles.

## Release boundary and rollback

Branched on main after merged **PR #476, PR #478, PR #479, PR #480, PR #481, PR #482, PR #483, PR #484**. Revert only the Block 8 PR without altering earlier blocks. No website/backend/schema/production database, account verification, business permissions, Stripe, money, bids, login, app-store binary/signing, OTP or production release modifications.

**STOP at 80%; leave PR open/unmerged and wait for next explicit user “proceed” before Block 9 (cross-platform QA and visual corrections).**
