# CarMazium Android vs mobile website — Cross-role tour, account, settings and notifications (80–90%)

Date: 21 November 2026. **90% is the ninth work-plan checkpoint, NOT a claim of 90% feature parity.**
**Stop requirement:** Pause here until the user explicitly says "proceed" for the final 90–100% build, device and release-readiness block.

## Device and account verification

- Same BlueStacks Samsung SM_S908E Android emulator on connected laptop DESKTOP-LPIB4R3, with app package `uk.carmazium.app` installed versionCode **121**, versionName 1.0.1.
- Live `https://carmazium.com` examined in Chrome inside that same emulator.
- Current Buyer/Seller account identity matched app and website in prior 60–80% checks. Browser and app were both in light mode.
- Source-based role catalogue and route checks covered dealer, admin, personal buyer/seller, contractor and finance/insurance-specialist flows. **This block did not sign into all those roles on both surfaces to visually verify the new tour**: existing installed build 121 has no new native tour.
- Private QA screenshots in `C:\Users\Dell\CarMazium-QA-Tools\`:
  - `parity8090-web-settings.png` and `parity8090-native-settings.png` — website and app settings on the same account.
  - `parity8090-web-notifications.png` and `parity8090-native-notifications.png` — website and app notifications. Both show the same MaziuM support events and message preview order.
- No live preference was toggled and no notification was marked read as part of this comparison. Existing data and sessions were not reset.

## Website/app parity differences confirmed

### Guided account tour
- Website: guided role-specific, page-by-page tour; Back, Next, Skip, Jump to a topic, optional spoken explanations and per-account replay via a prominent red button on Account Settings.
- Installed Android build 121: only preliminary welcome slides; no authenticated native step-through tour or replay.
- Earlier isolated source branch had a **short** native account tour, but it still lacked the website's topic jumping and many relevant user-role steps.
- This block expanded the native tour catalogue to real existing native routes for Admin, Dealer, Buyer/Seller, contractor and specialist. It includes account settings subpages, finance, service jobs, approval requirements and buyer/seller purchase-related pages.
- Added native **Jump to a topic** selector, Next, Back, Skip, optional offline speech via expo-speech, step index, and per-account local completion marker. The tour never clicks buttons or submits forms, bids, approvals, payments, messages or listings.
- Bumped the *native* tour content version to 2; it remains independent from website introduction acknowledgements. Tour replay clears only its current visual state, not account data.
- The native Account Settings **Replay App Tour** button is now red and prominent near the top (as website replay is); duplicate old button inside the Personal section removed.
- `Settings` route parameters now include the native existing Appearance, Reviews and Account type sections, not just the earlier narrow subset. Role-specific settings remain guarded by the existing Settings screen.

### Settings and appearance
- Same personal account exposed Account Settings, Personal details, Notifications, Payouts, Appearance, Security, Reviews and Account type in both surfaces. App also exposed some native-only quick tools and a Verification category; visual spacing/layout still differs.
- Current website and app are both in light mode. Settings' already-existing native appearance choices remain unchanged by this block. The native menu previously gained an Appearance option on the isolated source branch, not yet on installed build 121.
- Full cross-role settings visual acceptance (including dark mode and actual partner verification states) remains outstanding.

### Notifications
- Same account displayed matching recent support-notification titles and previews, but website has **Refresh**, **All/Unread** filter and **Email notifications** toggle in a separate control panel; installed build 121 mainly has grouped-by-day notifications and a Read all action.
- Added native All/Unread filter with website labels, Refresh button, unread-total display and a matching Email notifications preference switch.
- Email preference reads the `/users/me` profile and patches the same `preferences.notifications.email` field as website, preserving other account preferences. It is **disabled if the initial profile preferences failed to load**, preventing accidental loss of other preferences. The switch sends a PATCH **only when a real user taps it**; no such action was executed in this audit.
- Existing date-grouped notification list remains (website uses a flatter layout); exact row visuals and notification categories are not fully matched.
- Mark-all-read and row routing continue through existing, permission-aware native notification APIs. This audit did not change a production notification's state.

## Automated checks

- 55 Jest tests passed across 10 suites, including role-specific tour IDs, native-route allowlist checks, replay event subscription, account-specific storage keys, notification All/Unread filtering, non-destructive preference merging, prior gallery, dealer and admin regression tests.
- ESLint on all changed native TypeScript/TSX files passed.
- TypeScript `tsc --noEmit` passed.
- Staged Git diff verification and commit to be completed after writing this report.
- No replacement APK has been built or installed. The tour, topic selector, email toggle and notification layout **have not been visually accepted on BlueStacks**. This block does not establish feature-complete app parity.

## Remaining critical items for 90–100% QA and release gate

- Produce one update-compatible, signed QA build from this branch and compare the **new native** app against Chrome on the same emulator for every admin/dealer/buyer-seller workflow. Preserve the existing app database/session and verify restart login.
- Verify native tour first-login prompt, per-account skip/completion persistence, topic jumping, Back, Next, voice toggling, role-specific routes, settings replay and state after restart.
- Verify notification Refresh, All/Unread, email preference (using a safe test account; do not change production preferences), role-specific notification destinations and unread badges.
- Verify light/dark and small/large font-scale appearance in all three accounts. The tour spotlight is not yet an exact measured target highlight as on the website; it uses a coarse preview region.
- Recheck the fullscreen vehicle photo swipe and 1/N counter correction from prior block on the new build, including pinch/zoom and retaining the selected photo when closing.
- Review unresolved Admin Website fallbacks, dealer listing form, Buyer/Seller vehicle detail layout and contact controls, pricing/filter/warranty/finance/payment UX, real handovers and role-specific dashboard entry. Source-only fixes may pass unit tests yet still fail runtime or visual parity.
- Do not promote, replace the public website APK or claim 100% parity until version identity, signing, deep links, QA regressions and permission checks are verified. User's public download and installed build 121 are unchanged.

**STOP at 90% checkpoint pending explicit next "proceed".**
