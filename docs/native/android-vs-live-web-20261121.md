# CarMazium Android versus mobile website parity — evidence-led review

Date: 21 November 2026. Device: BlueStacks Android emulator SM_S908E on DESKTOP-LPIB4R3 (reported installed Android package `uk.carmazium.app`, versionCode **121**, versionName **1.0.1**). Reference: live `https://carmazium.com` in Chrome on the **same emulator**. Buyer/seller was signed in on both. Do not conflate the mobile website with the laptop desktop viewport.

## Comparison status

| Scenario | Android build 121 | Live mobile website | Difference | Priority |
|---|---|---|---|---|
| Home | Same 'Your car. Your choice.', red/white campaign hero and £1/free auction CTAs; persistent bottom marketplace tabs and AI welcome bubble can cover CTA | Same hero and CTAs; no persistent marketplace tabs on home screenshot | Extra app bottom navigation; chat bubble overlays CTAs | High |
| Buyer/seller dashboard | Same 'My Dashboard', attention card, coloured dashboard tiles | Same wording and tiles; fixed dashboard shortcut nav: **Home / My cars / Offers Received / Messages** | App nav is **Home / Buy Cars / Auctions / Saved / Dashboard**. Header theme toggle also differs | Critical |
| Search (signed in) | 716 vehicles; same BMW 7 Series 2018 first featured listing; separate white search input, Search button, 'Newest first' pill and Filters button | 716 vehicles; same BMW listing; pale-blue search field inside a bordered search panel; dropdown sort selector, different spacing and no separate visible Filters button in captured viewport | Search field, control hierarchy, spacing and first-card position visibly differ | High |
| Main menu | Full-height pale blue menu with common links and sign-out, resources footer | White menu with an **Appearance** card at the top, common links and app download CTA; underlying page visible below menu | Appearance missing from build 121; header has extra theme button; native menu background and height differ | High |
| Guided account walkthrough | Only pre-sign-in welcome slides; no equivalent native guided introduction or replay in Settings | Guided page-by-page introduction, role-aware steps, voice, skip/back/next and replay under Account Settings | Entire native account-tour experience missing from build 121 | Critical |

Screenshots captured locally for QA only in `C:\Users\Dell\CarMazium-QA-Tools\`: `native-home.png`, `web-mobile.png`, `android-current.png`, `web-dashboard.png`, `native-search.png`, `web-search.png`, `app-menu.png`, `web-menu.png`. These screenshots are not part of the public app and must not be uploaded or published.

## Work on isolated branch `fix/native-app-tour-20261121`

1. Add a **native** post-sign-in walkthrough, distinct from the pre-auth onboarding carousel. It uses the real native navigation stack rather than website pages. Safe steps do not mutate listings, bids, purchases, payments, or settings.
2. Show the tour once per user account on this release, with local acknowledgement for completed/skipped and permanent replay under Settings > Personal details. Preserve existing session and install data.
3. Role-aware coverage for dealers, personal buyers/sellers, partners and admins; Back, Next, Skip and optional on-device spoken English narration.
4. Align main-menu Appearance control and move the redundant top-bar theme control into the menu as on web.
5. New test coverage for role steps, replay subscription, storage-key scoping and no destructive tour destinations.

**Important:** Code edits are not proof of visual correctness, passing tests are not proof of emulator acceptance, and `Expo Speech` requires a new native build. Until a matching-signature QA APK is built and verified on the emulator, these changes are **not available** in the public download or the installed build 121. The rollout remains on hold.

## Next comparison and release gates

- Native-versus-Chrome captures at identical device orientation, system font scale, session, light/dark theme and viewport for every user-visible route.
- Inventory, listing creation/edit, auction and retail purchase, bidding, offers, filters, settings, saved vehicles, messaging, billing, seller incentives, notifications, services, warranty/finance, admin and dealer views; verify functional outcomes and permission gates, not only visuals.
- Resolve mismatched navigation hierarchy: website's fixed dashboard-specific bottom bar is not the native global tab bar.
- Test signed-in dealer and buyer/seller journeys independently; cover session persistence and tour replay/skip after restart.
- Use live data read-only during comparison. Do not submit test offers, bids, payments or publish listings on production without explicit authorisation for a safe test case.
- Ensure correct package/signing, update manifest and preserved on-device data; complete Android QA and regression before changing the public download. The public website remains at build 111 per the last approved release hold.
- Use diff-based screenshot review and executable assertions for exact text/controls. No assertion of '100%' or '0.01% difference' until full coverage and platform-specific exceptions are documented.

## Remaining status

This is **an initial, evidence-backed parity sample**, not a 157-route validation. The 157 `src/app/**/page.tsx` source files and 101 `src/screens/**/*.tsx` files do not map one-to-one; raw file-count ratios are not meaningful progress percentages. Dealer/admin/provider authenticated screenshot coverage, low-level actions, payment behaviour and the release candidate are still unverified.
