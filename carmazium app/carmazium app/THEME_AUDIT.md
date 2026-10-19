# CarMazium mobile — light/dark readability audit and repair

Branch `fix/light-mode-contrast-audit-20261018`, based on `71373ef` (head of `fix/native-qa-restore-approved-navigation-20261018`, PR #626; upstream re-checked 2026-10-19 and unchanged).

## 1. Summary

| | Count |
|---|---|
| Registered navigation routes (Auth, Root, Tab, Main stacks) | 85 (83 unique names) |
| Screen source files under `src/screens` | 81 |
| Shared components audited (`src/components`, incl. modals/sheets) | 54 |
| Files individually inspected by the static contrast audit, both modes | 135 |
| Light-mode contrast defects (text/icon/placeholder below AA), before → after | **1559 → 0** |
| Static light-content status bars, before → after | **72 → 1** (remaining: SplashScreen, dark by design) |
| Dark-mode defects below 3:1 (non-brand), before → after | **150 → 0** |
| Dark-mode minor shortfalls 3.0–4.49:1 (non-brand), before → after | 87 → 15 |
| Brand-red cases (white on #ED1C24 = 4.4:1; red text on navy = 3.3–3.5:1), both modes | 142 light / 366 dark — **design decision, not changed** (§5.1) |
| Files changed | 127 (8 added) |

"Defect" = a foreground drawn on a background below WCAG 2.2 AA (4.5:1 text, 3:1 large text and icons), measured by evaluating the real StyleSheets, light maps and tokens and walking each JSX tree (`scripts/theme-audit/contrast-audit.cjs`). Counts are per element per mode; a screen with one bad style used in five places counts five.

## 2. What was and was not verified

- **Static, both modes, every file:** colour contrast of text, icons and placeholders against the background they sit on; static status bars; dark labels left on saturated fills. This is the basis of every PASS below.
- **Not rendered.** This session has no Android emulator, no iOS simulator and no npm registry access, so no screen has been visually verified, no screenshot taken, and no APK built. Every row is therefore marked *Visual: PENDING*. Per your instruction nothing is marked visually verified.
- **TypeScript:** full `npm run typescript` could not run (dependencies not installable). Every changed file was syntax-checked with TypeScript 6, and a whole-project type-check against stubbed modules showed no new errors in changed code apart from stub artefacts (React/RN types unavailable). CI must run the real `tsc`; note `mobile-listing-ci.yml` already documents pre-existing tsc errors on the base branch.
- **Repository regression suites:** all 67 `scripts/*.test.mjs` suites run on both commits. 17 already fail on `71373ef`; on this branch 17 of those fail identically and 0 new failures (§7).
- **Not statically checkable:** text over photos (hero, listing cards, onboarding), API-supplied colours, keyboard-open layouts, larger font scales, clipping. Listed per row and in §5.

## 3. Design-system changes (shared, reusable)

| Token / component | Purpose |
|---|---|
| `appearancePalette()` — new `disabled` (#5B6B82, 5.4:1), `icon`, `switchTrackOff` (3.5:1), `accentSolid`/`onAccent`, `skeleton`, `statusBar` tokens; explicit `AppearancePalette` type | One semantic palette per mode |
| `themedColor()` / `useAppearance().tc` | Inline colours: identity in dark mode, readable light role in light mode (white→#0F172A, #E2E8F0→#334155, muted→#526177, semantic hues→readable variants) |
| `tbg` / `tfill`, `lightStrongText`, `lightSolidFill` | Dark surfaces → light cards; saturated fills that carry white labels; deep text on tinted chips |
| `ThemedStatusBar` | Replaces static `barStyle="light-content"` (63 call sites) |
| `ThemedSwitch` | Appearance-aware switch tracks (12 switches) |
| `Colors.successSolid / warningSolid / infoSolid` | Fills behind white labels (#10B981 green was 2.5:1) |
| `Colors.inputPlaceholder` #4B556B→#94A3B8, `Colors.textDisabled` #4B556B→#8A97AB | Dark placeholders/disabled text were 1.7–2.0:1 |
| Theme-aware shared primitives | HamburgerButton, EmptyState, Skeleton (light default only), Chip, Eyebrow, Price, Badge, SectionHeader, CategoryPill, ErrorBanner, OfflineBanner, PrimaryCTA disabled state |

## 4. Route-by-route QA matrix

Columns: light/dark = defects before → after (dark = non-brand items below 4.5:1, of which <3:1 are failures). SB = static light-content status bar before → after. Keyboard = static check for inputs and keyboard handling. Visual render is PENDING for every row (§2).

| Stack | Route | Screen file | Role | Light | Dark (<4.5) | SB | Keyboard | Fix commits | Result | Visual |
|---|---|---|---|---|---|---|---|---|---|---|
| Auth | Onboarding | onboarding/OnboardingScreen.tsx | Signed-out / new user | 0 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d 8f71bc1 04df9e3 | PASS (static) | PENDING |
| Auth | Login | auth/LoginScreen.tsx | Signed-out / new user | 6 → 0 | 2 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 9dbfc03 | PASS (static) | PENDING |
| Auth | Signup | auth/SignupScreen.tsx | Signed-out / new user | 16 → 0 | 5 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Auth | ForgotPassword | auth/ForgotPasswordScreen.tsx | Signed-out / new user | 6 → 0 | 2 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 9dbfc03 52a8421 | PASS (static) | PENDING |
| Auth | ResetPassword | auth/ResetPasswordScreen.tsx | Signed-out / new user | 11 → 0 | 4 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 9dbfc03 52a8421 | PASS (static) | PENDING |
| Auth | Terms | main/TermsScreen.tsx | All | 10 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d | PASS (static) · brand-red decision | PENDING |
| Auth | PrivacyPolicy | main/PrivacyPolicyScreen.tsx | All | 1 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Root | VerifyEmail | auth/VerifyEmailScreen.tsx | Signed-out / new user | 7 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) | PENDING |
| Root | PostSignupOnboarding | auth/PostSignupOnboardingScreen.tsx | Signed-out / new user | 19 → 0 | 10 → 0 | 0 → 0 | handled | 69e57bf 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Tab | Home | main/HomeScreen.tsx | All | 26 → 0 | 4 → 0 | 1 → 0 | check on device | 69e57bf 0a59db8 b99604d 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Tab | Search | main/SearchScreen.tsx | All | 48 → 0 | 23 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 52a8421 9bff7e8 | PASS (static) · brand-red decision | PENDING |
| Tab | Sell | sell/SellLandingScreen.tsx | Buyer-seller (private) | 3 → 0 | 3 → 1 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 52a8421 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Tab | Live | main/LiveScreen.tsx | All | 17 → 0 | 0 → 0 | 0 → 0 | check on device | 69e57bf b99604d 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Tab | Saved | main/SavedScreen.tsx | All | 3 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Tab | Profile | role-selected dashboard (see below) | All (role dashboard: buyer / dealer / contractor / finance / insurance / admin) | — → — | — → — | — → — | — | — | — | PENDING |
| Tab | DealerHome | main/DealerProfileScreen.tsx | Trader/dealer (+ staff) | 28 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d | PASS (static) · brand-red decision | PENDING |
| Tab | DealerStock (gated) | main/DealerInventoryScreen.tsx | Trader/dealer (+ staff) | 27 → 0 | 5 → 0 | 0 → 0 | handled | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| Tab | DealerCustomers (gated) | main/DealerLeadsScreen.tsx | Trader/dealer (+ staff) | 53 → 0 | 1 → 1 | 1 → 0 | handled | 69e57bf 0a59db8 9dbfc03 52a8421 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Tab | DealerBuyBid (gated) | main/DealerBuyBidScreen.tsx | Trader/dealer (+ staff) | 9 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| Tab | DealerMore (gated) | main/DealerMoreScreen.tsx | Trader/dealer (+ staff) | 2 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| Main | VehicleDeepLink | vehicle/VehicleDeepLinkScreen.tsx | All | 0 → 0 | 0 → 0 | 1 → 0 | no inputs | 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | AuctionDeepLink | vehicle/AuctionDeepLinkScreen.tsx | All | 0 → 0 | 0 → 0 | 1 → 0 | no inputs | 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | VehicleDetail | vehicle/VehicleDetailScreen.tsx | All | 96 → 0 | 15 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | LiveAuctionDetailed | vehicle/AuctionDetailScreen.tsx | All | 113 → 0 | 10 → 2 | 0 → 0 | handled | 69e57bf 9dbfc03 52a8421 | PASS (static) · 2 minor dark, brand-red decision | PENDING |
| Main | Messages | main/MessagesScreen.tsx | All | 7 → 0 | 1 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | ChatScreen | main/ChatScreen.tsx | All | 31 → 0 | 7 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | Compare | main/CompareScreen.tsx | All | 24 → 0 | 3 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 e8c90ae | PASS (static) · brand-red decision | PENDING |
| Main | Settings | main/SettingsScreen.tsx | All | 33 → 0 | 5 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 52a8421 9bff7e8 04df9e3 | PASS (static) · brand-red decision | PENDING |
| Main | DealerAnalytics (gated) | main/DealerAnalyticsScreen.tsx | Trader/dealer (+ staff) | 13 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) | PENDING |
| Main | DealerInventory (gated) | main/DealerInventoryScreen.tsx | Trader/dealer (+ staff) | 27 → 0 | 5 → 0 | 0 → 0 | handled | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | DealerLeads (gated) | main/DealerLeadsScreen.tsx | Trader/dealer (+ staff) | 53 → 0 | 1 → 1 | 1 → 0 | handled | 69e57bf 0a59db8 9dbfc03 52a8421 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Main | DealerKYC (gated) | main/DealerKYCScreen.tsx | Trader/dealer (+ staff) | 17 → 0 | 1 → 0 | 0 → 0 | handled | 69e57bf b99604d 9dbfc03 52a8421 53f71db | PASS (static) | PENDING |
| Main | DealerTeam (gated) | main/DealerTeamScreen.tsx | Trader/dealer (+ staff) | 15 → 0 | 1 → 0 | 1 → 0 | handled | 0b817b5 52a8421 53f71db | PASS (static) | PENDING |
| Main | DealerOnboarding | main/DealerOnboardingScreen.tsx | Trader/dealer (+ staff) | 25 → 0 | 2 → 0 | 2 → 0 | handled | 69e57bf 0a59db8 52a8421 9bff7e8 | PASS (static) · brand-red decision | PENDING |
| Main | DealerOffers (gated) | main/DealerOffersScreen.tsx | Trader/dealer (+ staff) | 20 → 0 | 6 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | DealerMyOffers (gated) | main/DealerMyOffersScreen.tsx | Trader/dealer (+ staff) | 9 → 0 | 3 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | DealerPurchases (gated) | main/DealerPurchasesScreen.tsx | Trader/dealer (+ staff) | 10 → 0 | 1 → 0 | 0 → 0 | no inputs | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | DealerEarnings (gated) | main/DealerEarningsScreen.tsx | Trader/dealer (+ staff) | 17 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d | PASS (static) | PENDING |
| Main | DealerFinance (gated) | main/DealerFinanceScreen.tsx | Trader/dealer (+ staff) | 1 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Main | Services | main/ServicesScreen.tsx | Buyer | 6 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| Main | CustomerServiceJobs | main/CustomerServiceJobsScreen.tsx | Buyer | 9 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | CustomerServiceJobDetail | main/CustomerServiceJobDetailScreen.tsx | Buyer | 18 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | PartnerDashboard | main/PartnerDashboardScreen.tsx | Provider / contractor | 25 → 0 | 3 → 1 | 1 → 0 | check on device | 69e57bf 0a59db8 e8c90ae | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Main | ProviderCapabilities | main/ProviderCapabilitiesScreen.tsx | Provider / contractor | 10 → 0 | 1 → 1 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Main | ProviderVerification | main/ProviderVerificationScreen.tsx | Provider / contractor | 15 → 0 | 0 → 0 | 1 → 0 | check on device | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | ProviderMatching | main/ProviderMatchingScreen.tsx | Provider / contractor | 7 → 0 | 0 → 0 | 1 → 0 | check on device | 69e57bf 0a59db8 9bff7e8 | PASS (static) · brand-red decision | PENDING |
| Main | ProviderJobs | main/ProviderJobsScreen.tsx | Provider / contractor | 9 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | ProviderJobDetail | main/ProviderJobDetailScreen.tsx | Provider / contractor | 18 → 0 | 3 → 2 | 1 → 0 | check on device | 69e57bf 0a59db8 e8c90ae | PASS (static) · 2 minor dark, brand-red decision | PENDING |
| Main | ProviderLeads | main/ProviderLeadsScreen.tsx | Provider / contractor | 7 → 0 | 1 → 1 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Main | ProviderLeadDetail | main/ProviderLeadDetailScreen.tsx | Provider / contractor | 19 → 0 | 0 → 0 | 1 → 0 | check on device | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | ProviderMessages | main/ProviderMessagesScreen.tsx | Provider / contractor | 10 → 0 | 0 → 0 | 1 → 0 | check on device | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | Terms | main/TermsScreen.tsx | All | 10 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d | PASS (static) · brand-red decision | PENDING |
| Main | PrivacyPolicy | main/PrivacyPolicyScreen.tsx | All | 1 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Main | HowItWorks | main/HowItWorksScreen.tsx | All | 8 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | About | main/AboutScreen.tsx | All | 2 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | Contact | main/ContactScreen.tsx | All | 2 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Main | Pricing | main/PricingScreen.tsx | All | 8 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Main | Reviews | main/ReviewsScreen.tsx | All | 4 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Main | Finance | main/FinanceScreen.tsx | All | 4 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Main | AuctionComplete | main/AuctionCompleteScreen.tsx | Buyer | 19 → 0 | 2 → 0 | 2 → 0 | check on device | 69e57bf 0a59db8 b99604d 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | Notifications | main/NotificationsScreen.tsx | All | 2 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | NotificationSettings | main/NotificationSettingsScreen.tsx | All | 20 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 9bff7e8 | PASS (static) | PENDING |
| Main | MyListingDashboard | sell/MyListingDashboardScreen.tsx | Buyer-seller (private) | 27 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| Main | PurchaseFlow | main/PurchaseFlowScreen.tsx | Buyer | 14 → 0 | 0 → 0 | 3 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Main | SellLanding | sell/SellLandingScreen.tsx | Buyer-seller (private) | 3 → 0 | 3 → 1 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 52a8421 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| Main | SellCarFlow | sell/SellCarFlowScreen.tsx | Buyer-seller (private) | 116 → 0 | 25 → 0 | 0 → 0 | handled | 69e57bf b99604d 9dbfc03 52a8421 9bff7e8 | PASS (static) · brand-red decision | PENDING |
| Main | SellerListings | seller/SellerListingsScreen.tsx | Buyer-seller (private) | 31 → 0 | 7 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 b99604d 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | SellerAuctions | seller/SellerAuctionsScreen.tsx | Buyer-seller (private) | 78 → 0 | 9 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | BuyerDashboard | buyer/BuyerDashboardScreen.tsx | Buyer | 13 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | SellerDashboard | seller/SellerDashboardScreen.tsx | Buyer-seller (private) | 32 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | UnifiedDashboard | account/UnifiedDashboardScreen.tsx | All | 4 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | SellerOffers | seller/SellerOffersScreen.tsx | Buyer-seller (private) | 28 → 0 | 6 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | BuyerOffers | buyer/BuyerOffersScreen.tsx | Buyer | 34 → 0 | 9 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | Earnings | seller/EarningsScreen.tsx | Buyer-seller (private) | 17 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 b99604d | PASS (static) | PENDING |
| Main | BuyerBids | buyer/BuyerBidsScreen.tsx | Buyer | 22 → 0 | 5 → 0 | 0 → 0 | no inputs | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | BuyerPurchaseHistory | buyer/BuyerPurchaseHistoryScreen.tsx | Buyer | 8 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 52a8421 | PASS (static) | PENDING |
| Main | BuyerDeliveryRequests | buyer/BuyerDeliveryRequestsScreen.tsx | Buyer | 7 → 0 | 3 → 0 | 0 → 0 | no inputs | 69e57bf 52a8421 | PASS (static) | PENDING |
| Main | SellerProfile | seller/SellerProfileScreen.tsx | Buyer-seller (private) | 7 → 0 | 0 → 0 | 3 → 0 | no inputs | 69e57bf 0a59db8 9bff7e8 | PASS (static) · brand-red decision | PENDING |
| Main | SellerPerformance | seller/SellerPerformanceScreen.tsx | Buyer-seller (private) | 2 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| Main | PaymentHistory | account/PaymentHistoryScreen.tsx | All | 4 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) | PENDING |
| Main | SaleCancellations | account/SaleCancellationsScreen.tsx | Buyer-seller (private) | 10 → 0 | 2 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| Main | AcceptInvite | main/AcceptInviteScreen.tsx | Trader/dealer (+ staff) | 5 → 0 | 0 → 0 | 1 → 0 | handled | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |

**Screens reached without their own route** (role dashboards behind the Profile tab, embedded sections, splash):

| Screen file | Reached from | Light | Dark (<4.5) | SB | Keyboard | Fix commits | Result | Visual |
|---|---|---|---|---|---|---|---|---|
| account/AccountRoleHomeScreen.tsx | Profile tab (contractor, finance, insurance, **admin**) | 1 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| account/LegacyPartnerDashboardScreen.tsx | Profile tab (legacy partner roles) | 18 → 0 | 0 → 0 | 2 → 0 | check on device | 69e57bf 0a59db8 b99604d | PASS (static) · brand-red decision | PENDING |
| account/UnifiedDashboardScreen.tsx | Profile tab (signed-in default) / UnifiedDashboard route | 4 → 0 | 0 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 | PASS (static) · brand-red decision | PENDING |
| buyer/BuyerDashboardScreen.tsx | Profile tab (buyer) / BuyerDashboard route | 13 → 0 | 1 → 0 | 1 → 0 | no inputs | 69e57bf 0a59db8 52a8421 | PASS (static) · brand-red decision | PENDING |
| loading/SplashScreen.tsx | App launch (dark brand artwork by design) | 0 → 0 | 0 → 0 | 1 → 1 | no inputs | — | PASS (static) · fixed dark artwork + light status bar by design | PENDING |
| main/DealerAuctionBuyingSections.tsx | Embedded in dealer Buy/Bid | 8 → 0 | 0 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| main/DealerWebParityOverview.tsx | Embedded in dealer dashboard | 4 → 0 | 0 → 0 | 0 → 0 | check on device | 69e57bf 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| main/PartnerDashboardScreen.tsx | Profile tab (provider) / PartnerDashboard route | 25 → 0 | 3 → 1 | 1 → 0 | check on device | 69e57bf 0a59db8 e8c90ae | PASS (static) · 1 minor dark, brand-red decision | PENDING |

**Shared components, modals, sheets and overlays**

| Component | Light | Dark (<4.5) | Keyboard | Fix commits | Result | Visual |
|---|---|---|---|---|---|---|
| AuctionCardBadges.tsx | 5 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| BottomSheet.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| BrandIcon.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| BulkImportModal.tsx | 10 → 0 | 0 → 0 | no inputs | 69e57bf 9dbfc03 | PASS (static) | PENDING |
| Button.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| BuyerVehicleFacts.tsx | 3 → 0 | 3 → 1 | no inputs | 69e57bf 52a8421 | PASS (static) · 1 minor dark | PENDING |
| CategoryPill.tsx | 1 → 0 | 1 → 0 | no inputs | 69e57bf b99604d 52a8421 | PASS (static) · brand-red decision | PENDING |
| DealerGate.tsx | 0 → 0 | 0 → 0 | no inputs | 0a59db8 | PASS (static) · brand-red decision | PENDING |
| GlassCard.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| GlobalAIChatBot.tsx | 11 → 0 | 0 → 0 | handled | 69e57bf 9dbfc03 53f71db | PASS (static) · brand-red decision | PENDING |
| GlobalDrawer.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| GlobalToastProvider.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| GradeChip.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| HamburgerButton.tsx | 1 → 0 | 0 → 0 | no inputs | f21f061 69e57bf b99604d 9dbfc03 | PASS (static) | PENDING |
| HeroCarousel.tsx | 5 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) · brand-red decision | PENDING |
| HorizontalVehicleCard.tsx | 3 → 0 | 1 → 1 | no inputs | 69e57bf 9dbfc03 | PASS (static) · 1 minor dark, brand-red decision | PENDING |
| IconButton.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| ImageCarousel.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| ImageLightbox.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| ImportListingModal.tsx | 10 → 0 | 7 → 0 | handled | 69e57bf b99604d 52a8421 9bff7e8 | PASS (static) | PENDING |
| KeyboardStickyView.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| LiveBidCard.tsx | 6 → 0 | 1 → 0 | no inputs | 69e57bf b99604d e8c90ae | PASS (static) · brand-red decision | PENDING |
| LocationPromptSheet.tsx | 1 → 0 | 3 → 0 | handled | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| Logo.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| OfflineBanner.tsx | 2 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) | PENDING |
| PrimaryCTA.tsx | 0 → 0 | 0 → 0 | no inputs | 52a8421 | PASS (static) | PENDING |
| ProfileCompletionPromptSheet.tsx | 1 → 0 | 4 → 0 | handled | 69e57bf 52a8421 | PASS (static) | PENDING |
| SaleCancellationSheet.tsx | 11 → 0 | 1 → 0 | handled | 69e57bf 52a8421 | PASS (static) · brand-red decision | PENDING |
| SectionHeader.tsx | 3 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) · brand-red decision | PENDING |
| SpecBadge.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| StatusBarSpacer.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| StripeCheckoutModal.tsx | 2 → 0 | 0 → 0 | no inputs | 9dbfc03 | PASS (static) | PENDING |
| ThemedStatusBar.tsx | — → 0 | — → 0 | no inputs | f21f061 8f71bc1 | PASS (static) | PENDING |
| ThemedSwitch.tsx | — → 0 | — → 0 | no inputs | 9bff7e8 | PASS (static) | PENDING |
| Toast.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| VehicleCard.tsx | 10 → 0 | 5 → 4 | no inputs | 69e57bf 9dbfc03 52a8421 | PASS (static) · 4 minor dark, brand-red decision | PENDING |
| WebsiteTopBar.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) | PENDING |
| WishlistHeart.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) | PENDING |
| damage/BuyerDamageViewer.tsx | 10 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) | PENDING |
| damage/DamageViewerErrorBoundary.tsx | 2 → 0 | 0 → 0 | no inputs | 69e57bf b99604d 9dbfc03 | PASS (static) | PENDING |
| damage/ThreeDVehicleViewer.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) · brand-red decision | PENDING |
| delivery/ReceivedDeliveryRequestsPanel.tsx | 5 → 0 | 3 → 0 | no inputs | 69e57bf 52a8421 | PASS (static) | PENDING |
| filters/AuctionFilterSheet.tsx | 1 → 0 | 10 → 0 | handled | 69e57bf b99604d 52a8421 | PASS (static) · brand-red decision | PENDING |
| listing/EnquireModal.tsx | 5 → 0 | 1 → 0 | handled | 69e57bf 9dbfc03 52a8421 | PASS (static) · brand-red decision | PENDING |
| offers/CounterLedger.tsx | 4 → 0 | 0 → 0 | no inputs | 69e57bf | PASS (static) · brand-red decision | PENDING |
| ui/Badge.tsx | 0 → 0 | 0 → 0 | no inputs | 52a8421 | PASS (static) | PENDING |
| ui/Card.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| ui/Chip.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) · brand-red decision | PENDING |
| ui/EmptyState.tsx | 5 → 0 | 1 → 0 | no inputs | f21f061 69e57bf b99604d 04df9e3 | PASS (static) · brand-red decision | PENDING |
| ui/ErrorBanner.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) | PENDING |
| ui/Eyebrow.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) | PENDING |
| ui/GlassPill.tsx | 0 → 0 | 0 → 0 | no inputs | — | PASS (static) | PENDING |
| ui/Price.tsx | 1 → 0 | 0 → 0 | no inputs | 69e57bf b99604d | PASS (static) | PENDING |
| ui/Skeleton.tsx | 0 → 0 | 0 → 0 | no inputs | f21f061 53f71db | PASS (static) | PENDING |

## 5. Outstanding items and decisions needed

### 5.1 Brand red (needs a design decision — deliberately not changed)

- **White on #ED1C24** (CTAs, live pills, own chat bubbles): 4.38:1 in both modes. Passes for bold ≥14 px (large text) but not for smaller labels; the audit reports 142 small-label cases (identical in dark). Options: use `Colors.accentDeep` #CC1820 for solid fills (5.65:1, already `palette.accentSolid` in light mode), or keep #ED1C24 and make every CTA label ≥14 px bold.
- **#ED1C24 text/icons on navy** (dark mode): 3.3–3.5:1 on the page, 2.4:1 on #334155 cards — 217 cases. A dark-mode text-only accent such as #FF5C66 (5.1:1) or #F87171 (5.6:1) would fix them. `CLAUDE.md` says the design system has retired #ED1C24 for #FF0037 (3.9:1 on navy — still short), while `colors.ts` ships #ED1C24; this needs a brand owner's call before a global change.

### 5.2 Minor dark-mode shortfalls (3.0–4.49:1)

- `components/BuyerVehicleFacts.tsx:154` text #F87171 on #293549 = 4.46:1
- `components/HorizontalVehicleCard.tsx:121` text #FFFFFF on #3A7CE6 = 4.05:1
- `components/VehicleCard.tsx:137` text #FFFFFF on #3A7CE6 = 4.05:1
- `components/VehicleCard.tsx:156` text #60A5FA on #344A6C = 3.52:1
- `components/VehicleCard.tsx:164` text #60A5FA on #344A6C = 3.52:1
- `components/VehicleCard.tsx:230` text #60A5FA on #2B3D5A = 4.31:1
- `screens/main/DealerLeadsScreen.tsx:524` text #F87171 on #393648 = 4.21:1
- `screens/main/PartnerDashboardScreen.tsx:301` text #F87171 on #334155 = 3.74:1
- `screens/main/ProviderCapabilitiesScreen.tsx:180` text #F87171 on #334155 = 3.74:1
- `screens/main/ProviderJobDetailScreen.tsx:549` text #A3B1C4 on #3F4C5F = 3.98:1
- `screens/main/ProviderJobDetailScreen.tsx:560` text #A3B1C4 on #3F4C5F = 3.98:1
- `screens/main/ProviderLeadsScreen.tsx:144` text #F87171 on #464153 = 3.53:1
- `screens/sell/SellLandingScreen.tsx:240` text #F87171 on #293549 = 4.46:1
- `screens/vehicle/AuctionDetailScreen.tsx:1437` text #FFFFFF on #3676DF = 4.35:1
- `screens/vehicle/AuctionDetailScreen.tsx:1782` text #60A5FA on #2A3B55 = 4.47:1

### 5.3 Not statically verifiable — needs device QA

- Text and icons over photos: HeroCarousel, listing-card wishlist hearts and trust badges, Onboarding slides (dark by design), Home heart button. Marked `theme-audit-ignore` in code with the reason.
- Keyboard-open layouts: rows marked "check on device" have text inputs without a recognised keyboard-avoidance construct in the same file (many sit inside `BottomSheet avoidKeyboard`, which the check cannot see across files).
- Larger font scale, compact Android (360×800), Samsung-size (412×915) and iOS rendering; clipping and scrolling.
- Disabled controls elsewhere still dim via opacity (e.g. IconButton 0.4); PrimaryCTA and the Team switches were fixed explicitly.

### 5.4 Release steps still required

1. Apply the patch / push this branch; let CI run `npm run typescript`, `npm run test:theme-contrast`, `npm run test:theme-tokens` and the existing suites.
2. Build the Android QA APK (`carmazium-android-offline-qa-apk.yml` or `npm run android:release` on the build machine) — not built here.
3. On-device pass of every route above in both modes on a compact Android, a Samsung-size Android and an iPhone, with keyboard open and at 130% font scale; attach before/after screenshots to the rows.
4. Decide §5.1. 5. iOS: same pass on a simulator/device; no iOS-specific code was changed apart from `ios_backgroundColor` on switches.

## 6. Commits (in order)

- `f21f061` feat(theme): semantic light/dark tokens, useAppearance hook and ThemedStatusBar
- `0b817b5` fix(team): repair Team screen light-mode contrast
- `3935492` feat(theme): themedColor()/tc for inline colours and static contrast audit tooling
- `69e57bf` fix(light-mode): audit-driven contrast repairs across screens and shared components
- `0a59db8` fix(status-bar): replace static light-content status bars with ThemedStatusBar
- `b99604d` fix(light-mode): shared primitives, legal text, sub-components and fill regressions
- `9dbfc03` fix(light-mode): remaining light-mode defects found by state-consistent audit
- `52a8421` fix(dark-mode): placeholders, disabled text, semantic text and weak fills
- `9bff7e8` fix(controls): ThemedSwitch, import modal background, review avatar
- `53f71db` fix(theme): keep existing parity test contracts; AI chat header stays navy
- `8f71bc1` test(theme): contrast regression gate, npm scripts and CI workflow
- `e8c90ae` fix(dark-mode): semantic text on lighter dark cards
- `04df9e3` chore(theme): trim trailing blank lines added at end of three files

## 7. Automated test results (this session)

- Repository suites `node --test scripts/*.test.mjs`: 67 suites. Failing on `71373ef`: 17. Failing on HEAD: 17. Newly failing: 0. Newly passing: 0.
  - Pre-existing failures (unchanged, not caused by this work): `test-admin-exclusive-dashboard-routing.test.mjs`, `test-backend-connection-recovery.test.mjs`, `test-desktop-dealer-auth-loading.test.mjs`, `test-google-ads-qualified-seller.test.mjs`, `test-login-session-rebridge.test.mjs`, `test-mazium-consent-filter-parity-block9.test.mjs`, `test-mazium-native-greeting-parity-block8.test.mjs`, `test-mazium-web-native-conversation-parity.test.mjs`, `test-mobile-redesign-block10.test.mjs`, `test-native-app-audit-block8.test.mjs`, `test-native-notification-settings-audit.test.mjs`, `test-native-visual-parity-block2.test.mjs`, `test-native-visual-parity-block3.test.mjs`, `test-native-visual-parity-block5.test.mjs`, `test-seller-vehicle-specs.test.mjs`, `test-unified-account-settings.test.mjs`, `test-website-mobile-app-downloads.test.mjs`
  - Assertions updated in `test-native-visual-parity-block9.test.mjs` (3): Onboarding treated as dark-by-design artwork in the two "every screen subscribes" checks (it was already an exception in the gradient check); the Sell-flow placeholder expectation now names `Colors.inputPlaceholder` instead of the 2.0:1 `Colors.borderMuted`.
- New contrast gate `npm run test:theme-contrast`: 6/6 pass on HEAD; 4/6 fail on the base commit (proves it detects the original defects, including a fixture of the Team screenshot).
- New token tests `src/theme/__tests__/appearanceContrast.test.ts` (31 cases): pass under a Jest-compatible runner here; CI should run them with `npm run test:theme-tokens`.
- Not run (environment): `npm run typescript`, Jest under jest-expo, ESLint, Android/iOS builds.

## 8. Every modified file and why

| File | Change | Reason |
|---|---|---|
| `App.tsx` | modified | Root expo-status-bar follows the appearance |
| `THEME_AUDIT.md` | added | This report |
| `package.json` | modified | Scripts: test:theme-contrast, test:theme-tokens, audit:theme |
| `scripts/theme-audit/audit.cjs` | added | New: pattern scan (status bars, white icons, dark-only tokens) |
| `scripts/theme-audit/contrast-audit.cjs` | added | New: static contrast audit (both modes) |
| `scripts/theme-audit/contrast-audit.test.mjs` | added | New: CI regression gate |
| `src/components/AuctionCardBadges.tsx` | modified | Trust badges overlay the listing photo; left identical in both modes and annotated |
| `src/components/BulkImportModal.tsx` | modified | Close icon was white on a white button in light mode; 7 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: outlineBtnText, liveErrorText, errorSummaryTitle |
| `src/components/BuyerVehicleFacts.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); dark-mode semantic text lightened to its readable sibling |
| `src/components/CategoryPill.tsx` | modified | Category pills: glass pill and #E2E8F0 label invisible in light; selected state uses deep red text; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/components/DealerGate.tsx` | modified | static light-content status bar → ThemedStatusBar |
| `src/components/GlobalAIChatBot.tsx` | modified | Header stays navy (website parity) but its title/status were navy in light mode → white/textMuted; message and input colours themed; error fallback themed; 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/components/GlobalDrawer.tsx` | modified | 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/components/HamburgerButton.tsx` | modified | Legacy pill menu button: white bars on a white-alpha pill were invisible in light mode; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/components/HeroCarousel.tsx` | modified | Text over the hero photo; identical in both modes, annotated as not statically verifiable |
| `src/components/HorizontalVehicleCard.tsx` | modified | light-mode colours for 2 style key(s) the light map missed: estateText, bannerBadge; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/components/ImportListingModal.tsx` | modified | 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); dark-mode semantic text lightened to its readable sibling; placeholder off 24%-white borderMuted |
| `src/components/LiveBidCard.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: binBadgeText, viewersBadge, viewersText; dark-mode semantic text lightened to its readable sibling |
| `src/components/LocationPromptSheet.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: error; dark-mode semantic text lightened to its readable sibling |
| `src/components/OfflineBanner.tsx` | modified | Offline strip: opaque pale amber with deep amber text in light (15% tint let content show through); 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/components/PrimaryCTA.tsx` | modified | Disabled filled CTA in light mode: solid neutral pill with 5.4:1 label instead of 45%-opacity red with white label (~2:1) |
| `src/components/ProfileCompletionPromptSheet.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: error; dark-mode semantic text lightened to its readable sibling |
| `src/components/SaleCancellationSheet.tsx` | modified | 6 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: reasonTextSelected, pickButtonText, totalEvidenceText, errorText, fileMeta; dark-mode semantic text lightened to its readable sibling |
| `src/components/SectionHeader.tsx` | modified | Section titles/subtitles/see-all used the dark sheet in light mode (white on the light page) |
| `src/components/StripeCheckoutModal.tsx` | modified | Loading spinner on a dim scrim annotated; status bar was already themed |
| `src/components/ThemedStatusBar.tsx` | added | New: appearance-aware status bar |
| `src/components/ThemedSwitch.tsx` | added | New: appearance-aware switch |
| `src/components/VehicleCard.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: verifiedText, estateText, bannerBadge, newBadge, saveBtn; fill behind white label deepened (solid semantic token) |
| `src/components/WebsiteTopBar.tsx` | modified | Account avatar initial white on a stronger red tint (red-on-red-tint was 2.6:1, both modes) |
| `src/components/WishlistHeart.tsx` | modified | Heart sits on a dark translucent button over the photo; annotated |
| `src/components/damage/BuyerDamageViewer.tsx` | modified | Damage empty/error panels and report list used the dark sheet in light mode; 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/components/damage/DamageViewerErrorBoundary.tsx` | modified | 3D viewer fallback panel themed (class component reads the store); 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/components/delivery/ReceivedDeliveryRequestsPanel.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: btnAccept; fill behind white label deepened (solid semantic token) |
| `src/components/filters/AuctionFilterSheet.tsx` | modified | 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: pillTextSelected |
| `src/components/listing/EnquireModal.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: errorText; dark-mode semantic text lightened to its readable sibling |
| `src/components/offers/CounterLedger.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: attemptCount, currentPillText |
| `src/components/ui/Badge.tsx` | modified | Tinted badges use deep text in light; neutral badge becomes a bordered white chip |
| `src/components/ui/Chip.tsx` | modified | Spec chips: 4%-white chip and #E2E8F0 label invisible on white cards |
| `src/components/ui/EmptyState.tsx` | modified | Empty-state orb, title, subtitle and quiet CTA readable in light (module-level light map); reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/components/ui/ErrorBanner.tsx` | modified | Error icon and "Try again" link readable on the light error banner |
| `src/components/ui/Eyebrow.tsx` | modified | Eyebrow labels readable in light; caller colours translated with themedColor |
| `src/components/ui/Price.tsx` | modified | Prices were white text on light cards |
| `src/components/ui/Skeleton.tsx` | modified | Untinted default renders the light skeleton tone in light mode (was navy blocks); dark default unchanged |
| `src/constants/colors.ts` | modified | Dark placeholder/disabled tokens raised; solid semantic fill tokens added |
| `src/screens/account/AccountRoleHomeScreen.tsx` | modified | light-mode colours for 1 style key(s) the light map missed: note |
| `src/screens/account/LegacyPartnerDashboardScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 9 style key(s) the light map missed: sectionSub, input, keyWarning, secondaryButtonText, modalSub, modalCancelText, recordSub, statusText …; static light-content status bar → ThemedStatusBar |
| `src/screens/account/PaymentHistoryScreen.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: emptySub, summarySub; static light-content status bar → ThemedStatusBar |
| `src/screens/account/SaleCancellationsScreen.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: headerSub, reason, serviceWarningText, note, secondaryBtnText, primaryBtn; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token) |
| `src/screens/account/UnifiedDashboardScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: avatarDealer; static light-content status bar → ThemedStatusBar |
| `src/screens/auth/ForgotPasswordScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: successTitle, successBody, successEmail, input; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/auth/LoginScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: input, sessionNote; static light-content status bar → ThemedStatusBar |
| `src/screens/auth/PostSignupOnboardingScreen.tsx` | modified | Interest chips themed; unfocused input icons readable; placeholders; 12 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: stepIndicator, input, ghostBtnText, preferencesIntro; dark-mode semantic text lightened to its readable sibling |
| `src/screens/auth/ResetPasswordScreen.tsx` | modified | 7 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: successTitle, successBody, input, validationError, submitError; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/auth/SignupScreen.tsx` | modified | 7 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: stepIndicator, roleCardLabelActive, roleNote, input, fieldError; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/screens/auth/VerifyEmailScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: sub, email, secondaryBtnText, backBtnText |
| `src/screens/buyer/BuyerBidsScreen.tsx` | modified | 8 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 9 style key(s) the light map missed: emptySub, emptyCtaBtnText, bidTime, cancelRowHint, cancelBtnText, pageBtnText, pageIndicator, wonCtaBtn …; fill behind white label deepened (solid semantic token) |
| `src/screens/buyer/BuyerDashboardScreen.tsx` | modified | 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: seeAllText, verifiedBadgeText; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); surface/fill made mode-aware |
| `src/screens/buyer/BuyerDeliveryRequestsScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: actionBtnPrimary, backBtn; fill behind white label deepened (solid semantic token) |
| `src/screens/buyer/BuyerOffersScreen.tsx` | modified | 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 15 style key(s) the light map missed: actionBtnWithdrawText, acceptedStatusText, closedStatusText, counterSentText, actionBtnCounterBackText, counterBackCurrency, counterBackError, counterBackCancel …; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/buyer/BuyerPurchaseHistoryScreen.tsx` | modified | 4 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: emptySub, receiptBtnText, loadMoreBtnText, countBadge; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token) |
| `src/screens/main/AboutScreen.tsx` | modified | light-mode colours for 2 style key(s) the light map missed: heroTagline, footerVersion; static light-content status bar → ThemedStatusBar |
| `src/screens/main/AcceptInviteScreen.tsx` | modified | 4 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: headerSubRed, successText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/AuctionCompleteScreen.tsx` | modified | Pay button labels kept white on red; review stars and amber button spinner readable; 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 8 style key(s) the light map missed: headerLabelGreen, carStatusText, reviewSub, reviewInput, heroSubGreen, summaryTotalNote, payBtnText, footerNote; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ChatScreen.tsx` | modified | Own-bubble timestamps and read ticks white on the red bubble (were 1.7–1.9:1, both modes); offer bubble labels kept white; message icons themed; 16 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 14 style key(s) the light map missed: timeTextRight, onlineStatus, refreshOverlayBtnText, reportModalHelp, reportReasonTextSelected, reportCancelText, errorContainer, loadEarlierButton …; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/screens/main/CompareScreen.tsx` | modified | Column headers: car C label #9A161D was 1.75:1 in dark (now amber); car B blue lightened in dark; 8 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 13 style key(s) the light map missed: headerTag, carModel, carSub, highBadgeText, highValueB, textRed, textBlue, rowVal …; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/ContactScreen.tsx` | modified | 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: cardLine; static light-content status bar → ThemedStatusBar |
| `src/screens/main/CustomerServiceJobDetailScreen.tsx` | modified | 12 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: headerSub, status, muted, cancelText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/CustomerServiceJobsScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: statusText, trailing, headerSub, inlineError; static light-content status bar → ThemedStatusBar |
| `src/screens/main/DealerAnalyticsScreen.tsx` | modified | 8 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: funnelStep, headerSub, convCTA, convCTALink |
| `src/screens/main/DealerAuctionBuyingSections.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: retry, go, pageLink |
| `src/screens/main/DealerBuyBidScreen.tsx` | modified | 4 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: cardAction, errorText, retryText, manageLink, permissionNotice |
| `src/screens/main/DealerEarningsScreen.tsx` | modified | 4 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 8 style key(s) the light map missed: saleBuyer, exportBtnText, bonusTotal, bonusBlurb, bonusMore, receiptsSub, sectionHeader, summaryCard; static light-content status bar → ThemedStatusBar |
| `src/screens/main/DealerFinanceScreen.tsx` | modified | 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); static light-content status bar → ThemedStatusBar |
| `src/screens/main/DealerInventoryScreen.tsx` | modified | 12 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 13 style key(s) the light map missed: listingLiveLabel, markSoldModalHint, soldPriceLabel, soldPriceCurrency, soldPriceInput, stockMake, stockRejection, rowCrossListChipText …; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerKYCScreen.tsx` | modified | Form field errors readable in light; inline colours; 9 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 7 style key(s) the light map missed: sectionEyebrow, infoCardAmber, businessTypeTitleSelected, docUploadedText, docReplaceLink, docUploadingRow, businessTypeHint; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerLeadsScreen.tsx` | modified | 15 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 26 style key(s) the light map missed: avatarText, detailName, detailVehicle, metaChipText, sectionLabel, staffChipText, tagWarmText, emptySub …; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerMoreScreen.tsx` | modified | 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: subtitle |
| `src/screens/main/DealerMyOffersScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: actionBtnWithdrawText, actionBtnAcceptCounter; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token) |
| `src/screens/main/DealerOffersScreen.tsx` | modified | 11 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 7 style key(s) the light map missed: buyerCounteredText, counterSentText, modalBtnCancelText, toastBannerText, actionBtnAccept, actionBtnMarkSold, modalBtnConfirmSale; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerOnboardingScreen.tsx` | modified | 19 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: headerSubRed, stepperLabelActive, stepperNum, businessTypeTitleSelected, businessTypeHelp, signInLink; static light-content status bar → ThemedStatusBar; switches use ThemedSwitch (visible off track in light); dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerProfileScreen.tsx` | modified | 21 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: metaText, metricChangeGreen, loadingText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/DealerPurchasesScreen.tsx` | modified | Count badge fill (white on #60A5FA was 2.5:1); seller action text; 7 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: sellerSectionLabel, sellerActionText, modalCloseBtnText, countBadge; fill behind white label deepened (solid semantic token) |
| `src/screens/main/DealerTeamScreen.tsx` | modified | Team page from the screenshot: permission labels used dark-only `Colors.textSecondary`/`textMuted` inline (1.2:1 / 2.2:1 on white) → `palette.secondary` / `palette.disabled` (10.3:1 / 5.4:1); status bar themed; back/invite icons and hamburger no longer white on white; MANAGE TEAM / MEMBERS labels readable; Save TradeXchange button had borrowed the 5%-white invite circle (white label on nothing) → own style, deep red in light; role chips, pending badge, remove icon, email field icon/placeholder readable; switches get readable off-track and accessibility labels/state; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/DealerWebParityOverview.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: error, applyText |
| `src/screens/main/FinanceScreen.tsx` | modified | CTA subtitle on red: 75% white (2.9:1) → white (both modes); 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 2 style key(s) the light map missed: introSub, secondaryCtaText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/HomeScreen.tsx` | modified | Section headings, card styles hook, empty states and watermark; heart buttons over photos annotated; 20 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: seeAll, statChipText, aiResultError, aiResultLabel; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/HowItWorksScreen.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: stepNumber, introSub, receiptKey, receiptNote, receiptTotalKey, receiptFootnote; static light-content status bar → ThemedStatusBar; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/screens/main/LiveScreen.tsx` | modified | Countdown colons white on the light card; 11 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 7 style key(s) the light map missed: clearFiltersText, imageCarMake, imageCarModel, statsAboveReserve, upcomingTime, viewerBadge, viewerCount |
| `src/screens/main/MessagesScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: textBold, offerTagText, lastMessageTextUnread; static light-content status bar → ThemedStatusBar |
| `src/screens/main/NotificationSettingsScreen.tsx` | modified | 7 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: muteSub, toggleSub, deliveryBtn; static light-content status bar → ThemedStatusBar; switches use ThemedSwitch (visible off track in light) |
| `src/screens/main/NotificationsScreen.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); static light-content status bar → ThemedStatusBar |
| `src/screens/main/PartnerDashboardScreen.tsx` | modified | 19 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: sub, input, sectionSub, serviceStatus, reviewNote; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/PricingScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: introSub, planPeriod, sectionSub, dealerPromptSub, mostPopularText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/PrivacyPolicyScreen.tsx` | modified | light-mode colours for 1 style key(s) the light map missed: loadingText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderCapabilitiesScreen.tsx` | modified | 6 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: sub, error, warning, actionButton; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderJobDetailScreen.tsx` | modified | 11 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: headerSub, statusText, currency, moneyField, input, dangerText; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/ProviderJobsScreen.tsx` | modified | 6 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: statusText, trailing, headerSub; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderLeadDetailScreen.tsx` | modified | 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: headerSub, statusText, input, currency, moneyField, expiredText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderLeadsScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: statusText, headerSub, expiredText; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderMatchingScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 3 style key(s) the light map missed: input, sub, error; static light-content status bar → ThemedStatusBar; switches use ThemedSwitch (visible off track in light) |
| `src/screens/main/ProviderMessagesScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 5 style key(s) the light map missed: time, statusLabel, sub, searchInput, muted; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ProviderVerificationScreen.tsx` | modified | 8 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: sub, error, fileButtonText, input; static light-content status bar → ThemedStatusBar |
| `src/screens/main/PurchaseFlowScreen.tsx` | modified | 8 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 6 style key(s) the light map missed: commissionNote, successNote, headerSub, successText, summaryValueGreen, bottomNote; static light-content status bar → ThemedStatusBar |
| `src/screens/main/ReviewsScreen.tsx` | modified | CTA subtitle on red: 75% white (2.9:1) → white (both modes); light-mode colours for 3 style key(s) the light map missed: introSub, badgeTitle, badgeSub; static light-content status bar → ThemedStatusBar |
| `src/screens/main/SavedScreen.tsx` | modified | 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: heartBtnIcon; static light-content status bar → ThemedStatusBar |
| `src/screens/main/SearchScreen.tsx` | modified | 36 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 8 style key(s) the light map missed: headerSub, aiSearchBtnText, aiExplanationText, clearBelowText, endText, modalReset, postcodeChangeLink, aiModalBtn; static light-content status bar → ThemedStatusBar; switches use ThemedSwitch (visible off track in light); fill behind white label deepened (solid semantic token); placeholder off 24%-white borderMuted |
| `src/screens/main/ServicesScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: cardKind |
| `src/screens/main/SettingsScreen.tsx` | modified | Semantic copy on white cards (warnings, errors, success, notes, back link) readable; bank save button label black on amber (white was 2.2:1); category and chevron icons themed; switches themed; 18 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); static light-content status bar → ThemedStatusBar; switches use ThemedSwitch (visible off track in light); dark-mode semantic text lightened to its readable sibling |
| `src/screens/main/TermsScreen.tsx` | modified | Legal-text block renderer used the dark sheet in light mode (near-white copy on the light page); light-mode colours for 6 style key(s) the light map missed: companyLine, para, bullet, defTerm, stepNumText, moneyLine; static light-content status bar → ThemedStatusBar |
| `src/screens/onboarding/OnboardingScreen.tsx` | modified | Kept light-on-dark in both modes: slides are photos fading to navy; remapping put dark text on the artwork; static light-content status bar → ThemedStatusBar |
| `src/screens/sell/MyListingDashboardScreen.tsx` | modified | Memoised ListingCard rows used the dark sheet directly; live banner edit icon kept white on the red end; 22 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 7 style key(s) the light map missed: headerSub, statChange, statChangeOffers, actionSub, liveText, toastText, listingImagePlaceholder; static light-content status bar → ThemedStatusBar; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/screens/sell/SellCarFlowScreen.tsx` | modified | Badge cards (BASIC accent was white: invisible label, tick and Selected pill in light), placeholders, inline icons, publish button fill, switches; 45 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); switches use ThemedSwitch (visible off track in light); fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling; placeholder off 24%-white borderMuted; surface/fill made mode-aware; reviewed element annotated for the audit (photo overlay / emoji / decorative) |
| `src/screens/sell/SellLandingScreen.tsx` | modified | 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 1 style key(s) the light map missed: retailPriceButton; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/seller/EarningsScreen.tsx` | modified | 5 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 13 style key(s) the light map missed: saleBuyer, exportBtnText, bonusTotal, bonusBlurb, bonusMore, sectionHeader, payoutsCardSub, summaryCard …; static light-content status bar → ThemedStatusBar |
| `src/screens/seller/SellerAuctionsScreen.tsx` | modified | 36 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 19 style key(s) the light map missed: resultsBtnText, auctionInfoValue, editLabel, editCurrency, editInput, editError, editDiscard, handoverFeeLabel …; static light-content status bar → ThemedStatusBar; dark-mode semantic text lightened to its readable sibling |
| `src/screens/seller/SellerDashboardScreen.tsx` | modified | 24 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 8 style key(s) the light map missed: sectionSeeAll, heroDaysPillText, statCardViews, statCardSaves, offersEmpty, quickTile, offersEmptySub, quickSub; static light-content status bar → ThemedStatusBar |
| `src/screens/seller/SellerListingsScreen.tsx` | modified | Dual-submit button fill (white on orange 2.8:1); header icons; overlay annotated; 10 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 12 style key(s) the light map missed: cardViews, soldCurrencySymbol, soldInput, soldCancelBtnText, tabBadgeText, dualModalSub, dualCurrency, dualInput …; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/seller/SellerOffersScreen.tsx` | modified | 12 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 10 style key(s) the light map missed: buyerCounteredText, counterSentText, toastText, modalSubtitle, inputLabel, counterInput, modalBtnCancelText, actionBtnAccept …; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling |
| `src/screens/seller/SellerPerformanceScreen.tsx` | modified | 2 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); static light-content status bar → ThemedStatusBar |
| `src/screens/seller/SellerProfileScreen.tsx` | modified | Review avatar gradient stop (token lightened) back to navy; status bars; 3 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 4 style key(s) the light map missed: emptySub, heroSub, reviewTime, reviewComment; static light-content status bar → ThemedStatusBar |
| `src/screens/vehicle/AuctionDeepLinkScreen.tsx` | modified | static light-content status bar → ThemedStatusBar |
| `src/screens/vehicle/AuctionDetailScreen.tsx` | modified | Cancelled pill and first-offer amount readable; faint icons; inline colours themed; fills behind white labels deepened; 86 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 17 style key(s) the light map missed: sellerToolsLabel, binSellerDeclineText, antiSnipeBarText, specGroup, bidAvatarText, binPendingText, binPanelLabel, bidToggleEyebrow …; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling; placeholder off 24%-white borderMuted; surface/fill made mode-aware |
| `src/screens/vehicle/VehicleDeepLinkScreen.tsx` | modified | static light-content status bar → ThemedStatusBar |
| `src/screens/vehicle/VehicleDetailScreen.tsx` | modified | Disabled offer button label, video chip, HPI and history panels, fills behind white labels, inline colours; 56 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged); light-mode colours for 40 style key(s) the light map missed: detailBannerText, importedBadgeText, ulezWarningText, linkedAuctionText, linkedAuctionCta, warnText, dealerWebsiteText, reviewsResponse …; static light-content status bar → ThemedStatusBar; fill behind white label deepened (solid semantic token); dark-mode semantic text lightened to its readable sibling; placeholder off 24%-white borderMuted; surface/fill made mode-aware |
| `src/theme/__tests__/appearanceContrast.test.ts` | added | New: token contrast tests |
| `src/theme/appearancePalette.ts` | modified | Semantic tokens and helpers (§3); 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |
| `src/theme/useAppearance.ts` | added | New hook: mode, palette, tc/tbg/tfill; 1 inline text/icon/placeholder colour(s) made mode-aware (light-mode readable, dark unchanged) |

Repository-root files changed: `.github/workflows/mobile-theme-contrast-ci.yml` (new CI gate), `scripts/test-native-visual-parity-block9.test.mjs` (3 assertions, §7).

## 9. Applying the patch

From the repository root, on top of `71373ef` / the PR #626 branch:

```bash
git checkout fix/native-qa-restore-approved-navigation-20261018
git checkout -b fix/light-mode-contrast-audit-20261018
git am --keep-cr patches/*.patch  # keeps the 14 commits; --keep-cr because SellerDashboardScreen.tsx uses CRLF
# or: git apply --index carmazium-light-dark-audit.diff && git commit
# or: git fetch carmazium-light-dark-audit.bundle fix/light-mode-contrast-audit-20261018:fix/light-mode-contrast-audit-20261018
```

No Supabase, production, store or business-rule changes. Navigation (PR #626), Inventory scrolling, compact bidding controls and vehicle cards are untouched apart from colour styles.