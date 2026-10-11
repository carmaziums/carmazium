# CarMazium native UX — Issue #537 release-readiness record

**Scope:** Android and iOS native navigation / account settings / MaziuM overlays.
**Prepared:** 11 October 2026.
**Status:** source implementation review only; **NOT approved for merge, deployment or public APK download**.
**QA build:** must be generated from the exact final integration commit and verified on device, not assumed from a prior draft's CI results.

## Source chain (do not flatten or merge without an integration review)

The work is stacked and each PR targets the previous block's branch:

- PR #530: ten public Menu entry points
- PR #534: five consumer bottom tabs
- PR #538: labelled Menu and dedicated profile/settings action (Block 1)
- PR #539: unique dealer tools More and no closed drawer layer (Block 2)
- PR #540: scrollable, contrasting Sign Out (Block 3)
- PR #541: compact, owner/staff-aware Account Settings (Block 4)
- PR #542: MaziuM protected screens, keyboard-aware launcher and tab clearance (Block 5)
- PR #543: small-screen header, screen-reader controls and role-aware tabs (Block 6)
- PR #544: stale menu navigation and identity-scoped dealer access (Block 7)
- PR #545: settings scrolling, 200% text and contrast (Block 8)
- PR #546: close Menu on session expiry; scrollable branding and safe deferred AI actions (Block 9)
- Final Block 10 draft: Settings Back fallback, release regression gates and this QA/revert plan.

The original branches remain intact. **No PR should be merged individually from the middle of this stack.**
Confirm the cumulative patch against the current integration base, resolve any newer conflicts and re-run CI on the merged candidate before release.

## Automated gates (must be green on the exact integration SHA)

- [ ] Product contract parity including the cumulative #537 native tests
- [ ] Mobile TypeScript / Mobile Listing CI
- [ ] Website TypeScript
- [ ] Backend TypeScript and authorization regressions
- [ ] PR mergeability / review of the *cumulative* diff and unchanged business rules
- [ ] Re-run integration checks if any base commit, dependency, or navigation file changes

**Source contract tests are not emulator, accessibility or device interaction evidence.**

## Real-device acceptance matrix (pending; use synthetic test accounts)

| Scenario | Android (gesture navigation) | iOS (safe area) | Acceptance criterion |
|---|---|---|---|
| 320dp or narrower screen; 100% and 200% text | [ ] | [ ] | Logo, bell, Profile Settings and labelled Menu remain separate and accessible |
| Buy Cars and Sell Cars accordion | [ ] | [ ] | Exactly two choices each; reopen Menu to collapsed state |
| Menu close via X, backdrop, hardware Back (Android) | [ ] | [ ] | No hidden sheet blocks the page; bottom tabs respond immediately |
| Scroll Menu in landscape / short viewport | [ ] | [ ] | All 10 destinations accessible; branding scrolls at end |
| Buyer tab bar | [ ] | [ ] | Home, Buy, Sell, Saved, Dashboard; Live Auctions via Buy |
| Dealer and staff tabs | [ ] | [ ] | Only permitted Stock/Customers/Buy & Bid visible; More uniquely opens dealer tools |
| Avatar and Notifications | [ ] | [ ] | Avatar = Account Settings; bell = Notifications; neither duplicates global Menu |
| Owner/dealer personal view switch | [ ] | [ ] | Owner switching is deliberate and uses verified backend role; staff cannot obtain owner forms |
| Settings deep link or restored session | [ ] | [ ] | Back leads to previous page, or Tabs when history is absent |
| Settings / Account Type / Sign Out at 200% text | [ ] | [ ] | Sign Out readable, scroll-reachable, tap target works, confirmation required |
| Sign out while Menu is open or AI chat is closing | [ ] | [ ] | Login is unobstructed; stale drawer/chat timers cannot reopen a protected destination |
| MaziuM on Settings, KYC or payment flow | [ ] | [ ] | No floating assistant over critical actions; consent/withdrawal intact |
| MaziuM message entry, keyboard open | [ ] | [ ] | Open conversation remains open; trigger hides while typing; safe-area tabs unobstructed |
| System dark and light appearance | [ ] | [ ] | Native dark palette legible; **no working native light theme is claimed** |
| TalkBack / VoiceOver | [ ] | [ ] | All controls read their unique intent and expanded/selected states; touch targets >=44dp |
| Offline / slow network / role switch | [ ] | [ ] | Do not display prior dealer's cached permissions; signed-out state fails closed |

Run each relevant case with a synthetic **buyer**, verified **dealer owner**, **dealer staff with limited permissions**, and **unverified dealer**. Never test unauthorized dealer privileges using live customer data.

## Private Android QA APK gate

- [ ] GitHub Actions standalone QA APK workflow completed successfully from the **final** SHA
- [ ] Workflow artifact exists and contains an installable APK (do not interpret queued/pending as success)
- [ ] Artifact SHA/build metadata and installed app version recorded; not a morning/stale build
- [ ] Confirm QA-only/read-only configuration; never execute actual bids, paid listings, transfers, or customer-facing writes during testing
- [ ] Owner installs the exact private build and provides screenshot/video feedback
- [ ] **Website public APK download remains disabled** until separate explicit authorization

iOS requires an appropriately signed/installed TestFlight or private test build and device checks; Android source parity alone is not iOS device proof.

## Independent release blockers (not closed by this issue)

1. **Issue #521:** Damage-save listing ownership / evidence security work remains draft. Before a customer release, staging tests using separate real synthetic identities, independent security review, backend deployment and verification are required. Source tests do not close this.
2. Native light-mode toggle is not implemented; Appearance explicitly describes current dark-only native behavior. A supported light mode is a separate approved feature, not a hidden Block 10 scope change.
3. Actual Android/iOS device checks, visible screenshots and final APK verification are pending.
4. Changes under other active development branches (especially damage work #516 and theme work #512) must be integrated without conflicts and with independent regression testing.

## Reversible integration / owner sign-off

1. Obtain explicit permission for integration/merge **after** reviewing the source changes and screenshots; this Block 10 'proceed' is only approval to implement/audit this block.
2. Record the final SHA, tag or branch snapshot and existing production release identifier. Prepare a non-destructive rollback to the previous known-good app/web/backend release.
3. Merge in dependency order on a controlled integration branch; do not auto-publish APKs or deploy production during QA.
4. Validate all role-dependent navigation and safety gates on the merged artifact. Fix any failures in a reviewed follow-up PR.
5. Publish only after **separate owner approval**, signed-off private QA, security clearance (#521), and independently verified deployment/rollback procedures.
6. If rejected, revert the integration commit(s) in reverse dependency order, keep user data/migrations unchanged, then rerun tests; never roll back an unrelated concurrent feature.

**Do not merge or deploy** Issue #537 changes until all device, security and owner approval gates are satisfied.

**Owner approval:** pending. **Android device QA:** pending. **iOS device QA:** pending. **Production release:** prohibited until gates above are met.
