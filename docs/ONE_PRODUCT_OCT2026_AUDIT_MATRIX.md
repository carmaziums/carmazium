# CarMazium website / iPhone / Android options and feature audit

Snapshot: 4 October 2026. **Audit register**, not proof of complete app parity. Derived from `product-parity.json` on the Block 1 draft branch, then augmented with separately observed subfeature drift. New website releases must be added here before Block 10 certification.

## Rules and evidence legend

- **MAPPED**: source files exist for web and native per the repository contract; does not prove accessible screens, equivalence of controls, network results, phone layout or shipped store builds.
- **CODE+CI**: correction prepared and current-commit checks passed. Still not a physical-device or store release.
- **DEVICE-PENDING**: matching signed iOS/Android account journeys are untested or evidence has not been provided.
- **WEB-ONLY**: consciously justified and tracked, not assumed to be a bug. Neither a restricted Admin console nor the SEO publishing interface should be copied into public apps without a new security/product decision.

Use a unique row per feature, and record the **web**, **signed iOS** and **signed Android** result separately with screenshots/records and exact build/commit ID; no pass should be inferred from a source file or another platform. All rows requiring native must remain DEVICE-PENDING until independently tested.

## Feature-by-feature inventory (61 registry entries)

### Identity and accounts (8)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `auth.dealer_staff_invite` | `src/app/auth/accept-invite/page.tsx` | `carmazium app/carmazium app/src/screens/main/AcceptInviteScreen.tsx` | MAPPED; DEVICE-PENDING |
| `auth.account_onboarding` | `src/app/auth/onboarding/page.tsx` | `carmazium app/carmazium app/src/screens/auth/PostSignupOnboardingScreen.tsx` | MAPPED; DEVICE-PENDING |
| `auth.email_verification` | `src/app/auth/onboarding/page.tsx` | `carmazium app/carmazium app/src/screens/auth/VerifyEmailScreen.tsx` | MAPPED; DEVICE-PENDING |
| `auth.password_recovery` | `src/app/auth/forgot-password/page.tsx` | `carmazium app/carmazium app/src/screens/auth/ForgotPasswordScreen.tsx` | MAPPED; DEVICE-PENDING |
| `auth.signup_account_type` | `src/app/auth/signup/page.tsx` | `carmazium app/carmazium app/src/screens/auth/SignupScreen.tsx` | MAPPED; DEVICE-PENDING |
| `auth.login` | `src/app/auth/login/page.tsx` | `carmazium app/carmazium app/src/screens/auth/LoginScreen.tsx` | MAPPED; DEVICE-PENDING |
| `navigation.account_role_home` | `src/app/dashboard/page.tsx` | `carmazium app/carmazium app/src/navigation/TabNavigator.tsx` | MAPPED; DEVICE-PENDING |
| `account.deletion` | `src/app/delete-account/page.tsx` | `carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx` | MAPPED; DEVICE-PENDING |

### Discovery and auction shortlist (4)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `marketplace.search` | `src/app/search/page.tsx` | `carmazium app/carmazium app/src/screens/main/SearchScreen.tsx` | MAPPED; DEVICE-PENDING |
| `marketplace.vehicle_detail` | `src/app/buy-cars/[slug]/page.tsx` | `carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx` | MAPPED; DEVICE-PENDING |
| `marketplace.auctions` | `src/app/auctions/page.tsx` | `carmazium app/carmazium app/src/screens/main/LiveScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.auction_shortlist` | `src/app/dashboard/dealer/auctions/shortlisted/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerAuctionShortlistScreen.tsx` | MAPPED; DEVICE-PENDING |

### Seller journey (11)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `seller.auction_handover_reward` | `src/app/dashboard/seller/auctions/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.draft_reset_resume` | `src/components/listing/ListingWizard.tsx` | `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.publish_review_gate` | `src/components/listing/ListingWizard.tsx` | `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.channel_conversion` | `src/components/listing/ListingWizard.tsx` | `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.sell_flow` | `src/app/sell/page.tsx` | `carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.dashboard` | `src/app/dashboard/seller/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerDashboardScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.listings` | `src/app/dashboard/seller/listings/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerListingsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.auctions` | `src/app/dashboard/seller/auctions/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.offers` | `src/app/dashboard/seller/offers/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerOffersScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.earnings` | `src/app/dashboard/seller/earnings/page.tsx` | `carmazium app/carmazium app/src/screens/seller/EarningsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `seller.performance` | `src/app/dashboard/seller/performance/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerPerformanceScreen.tsx` | MAPPED; DEVICE-PENDING |

### Buyer journey (5)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `buyer.dashboard` | `src/app/dashboard/buyer/page.tsx` | `carmazium app/carmazium app/src/screens/buyer/BuyerDashboardScreen.tsx` | MAPPED; DEVICE-PENDING |
| `buyer.bids` | `src/app/dashboard/buyer/bids/page.tsx` | `carmazium app/carmazium app/src/screens/buyer/BuyerBidsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `buyer.offers` | `src/app/dashboard/buyer/offers/page.tsx` | `carmazium app/carmazium app/src/screens/buyer/BuyerOffersScreen.tsx` | MAPPED; DEVICE-PENDING |
| `buyer.history` | `src/app/dashboard/buyer/history/page.tsx` | `carmazium app/carmazium app/src/screens/buyer/BuyerPurchaseHistoryScreen.tsx` | MAPPED; DEVICE-PENDING |
| `buyer.auction_inspection_refusal` | `src/app/auctions/won/[id]/page.tsx` | `carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx` | MAPPED; DEVICE-PENDING |

### Dealer journey (10)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `dealer.dashboard` | `src/app/dashboard/dealer/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerProfileScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.inventory` | `src/app/dashboard/dealer/inventory/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerInventoryScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.analytics` | `src/app/dashboard/dealer/analytics/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerAnalyticsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.offers` | `src/app/dashboard/dealer/offers/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerOffersScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.purchases` | `src/app/dashboard/dealer/purchases/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerPurchasesScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.earnings` | `src/app/dashboard/dealer/earnings/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerEarningsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.finance` | `src/app/dashboard/dealer/finance/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerFinanceScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.team` | `src/app/dashboard/dealer/team/page.tsx` | `carmazium app/carmazium app/src/screens/main/DealerTeamScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.auction_staff_permissions` | `src/app/auctions/live/[id]/page.tsx` | `carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx` | MAPPED; DEVICE-PENDING |
| `dealer.kyc_business_type` | `src/components/dashboard/KycOverlayForm.tsx` | `carmazium app/carmazium app/src/screens/main/DealerOnboardingScreen.tsx` | MAPPED; DEVICE-PENDING |

### Partner and TradeXchange (7)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `partner.dashboard` | `src/app/dashboard/partner/page.tsx` | `carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx` | MAPPED; DEVICE-PENDING |
| `service_provider.capabilities` | `src/app/dashboard/service/capabilities/page.tsx` | `carmazium app/carmazium app/src/screens/main/ProviderCapabilitiesScreen.tsx` | MAPPED; DEVICE-PENDING |
| `service_provider.jobs` | `src/app/dashboard/service/jobs/page.tsx` | `carmazium app/carmazium app/src/screens/main/ProviderJobsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `service_provider.leads` | `src/app/dashboard/service/leads/page.tsx` | `carmazium app/carmazium app/src/screens/main/ProviderLeadsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `service_provider.messages` | `src/app/dashboard/service/messages/page.tsx` | `carmazium app/carmazium app/src/screens/main/ProviderMessagesScreen.tsx` | MAPPED; DEVICE-PENDING |
| `partner.legacy_finance_operations` | `src/app/dashboard/finance/page.tsx` | `carmazium app/carmazium app/src/screens/account/LegacyPartnerDashboardScreen.tsx` | MAPPED; DEVICE-PENDING |
| `partner.legacy_insurance_operations` | `src/app/dashboard/insurance/page.tsx` | `carmazium app/carmazium app/src/screens/account/LegacyPartnerDashboardScreen.tsx` | MAPPED; DEVICE-PENDING |

### Payments and entitlements (5)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `pricing.customer` | `src/app/pricing/page.tsx` | `carmazium app/carmazium app/src/screens/main/PricingScreen.tsx` | MAPPED; DEVICE-PENDING |
| `payments.checkout_reconciliation` | `src/app/checkout/success/page.tsx` | `carmazium app/carmazium app/src/lib/paymentsApi.ts` | MAPPED; DEVICE-PENDING |
| `payments.seller_bonus_payout` | `src/app/dashboard/seller/auctions/page.tsx` | `carmazium app/carmazium app/src/screens/seller/SellerAuctionsScreen.tsx` | MAPPED; DEVICE-PENDING |
| `hpi.report_entitlements` | `src/components/hpi/HpiReportModal.tsx` | `carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx` | MAPPED; DEVICE-PENDING |
| `payments.vehicle_direct_settlement` | `src/app/checkout/page.tsx` | `carmazium app/carmazium app/src/screens/main/PurchaseFlowScreen.tsx` | MAPPED; DEVICE-PENDING |

### Communications and trust (5)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `notifications.tap_routing` | `src/components/layout/NotificationBell.tsx` | `carmazium app/carmazium app/App.tsx` | MAPPED; DEVICE-PENDING |
| `chat.direct_open` | `src/components/chat/ChatWindow.tsx` | `carmazium app/carmazium app/src/screens/main/ChatScreen.tsx` | MAPPED; DEVICE-PENDING |
| `legal.privacy_policy` | `src/app/privacy-policy/page.tsx` | `carmazium app/carmazium app/src/screens/main/PrivacyPolicyScreen.tsx` | MAPPED; DEVICE-PENDING |
| `chat.ugc_safety` | `src/components/chat/ChatWindow.tsx` | `carmazium app/carmazium app/src/screens/main/ChatScreen.tsx` | MAPPED; DEVICE-PENDING |
| `ai.safety_reporting` | `src/components/features/MaziumWidget.tsx` | `carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx` | MAPPED; DEVICE-PENDING |

### Navigation and visual system (4)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `navigation.public_detail_deeplinks` | `src/app/buy-cars/[slug]/page.tsx` | `carmazium app/carmazium app/src/navigation/linking.ts` | MAPPED; DEVICE-PENDING |
| `navigation.cross_role_backstack` | `src/app/dashboard/buyer/page.tsx` | `carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx` | MAPPED; DEVICE-PENDING |
| `ui.shared_terminology` | `src/config/dealerRouteConfig.ts` | `carmazium app/carmazium app/src/components/GlobalDrawer.tsx` | MAPPED; DEVICE-PENDING |
| `ui.performance_baseline` | `src/components/features/MaziumWidgetLoader.tsx` | `carmazium app/carmazium app/src/screens/onboarding/OnboardingScreen.tsx` | MAPPED; DEVICE-PENDING |

### Approved website-only (2)

| Feature contract | Website source | Native source (shared iOS/Android) | Evidence/status |
|---|---|---|---|
| `admin.operations` | `src/app/dashboard/admin/page.tsx` | — | WEB-ONLY (reviewed) |
| `blog.seo` | `src/app/blog/page.tsx` | — | WEB-ONLY (reviewed) |

## Immediate Block 1 discrepancies and changes (draft PR #413)

| User-visible capability | Website baseline | Native draft status | Evidence to collect before sign-off |
|---|---|---|---|
| Verified dealer auction shortlist | Live to Bid and All Saved, paginated and server-filtered | Implemented with shared `GET /watchlist/auctions` and KYC-gated route | Same dealer account on web, iOS, Android; verify trade gate, data isolation and route access |
| Add/remove a shortlist item | All public live auction cards link to the account watchlist | Existing native auction hearts and new shortlist removal | Save on web -> visible on both apps; remove in one app -> refresh both others |
| Dealer My Auction Bids | Website Buy & Bid navigation exposes My Auction Bids for VIEW_TRADE accounts | Existing native BuyerBids route added to dealer menu under VIEW_TRADE | Matched authorised owner/staff account sees own/dealership's bids; excluded staff cannot access trade data |
| Auction freshness | Website refreshes when visible every 20 seconds | Draft native foreground/focused 20s server refresh, separate clock update | Place test bid or end an auction; confirm price, count, live eligibility update on all three |
| Pagination after last-item removal | Website returns to last nonempty page | Native draft automatically clamps page | Add >12 saved items and remove the only item on the last page |
| Countdown and statuses | Live, Upcoming, Cancelled, Ended/unavailable and time remaining | Native draft uses listing+auction status, live/upcoming countdown | Simulate / observe auction expiration while shortlist is open; cannot bid after cutoff |
| Previously saved hearts on opening Live | Web rehydrates on initial display | Native Live and Saved refresh on focus | Add/remove item on another device; return to app tab to see updated hearts |
| Network failure | No false 'zero saved' on transient failure | Native API now propagates load errors; store preserves previous list | Offline + restore; previously saved state not wiped; no invented success |
| Account switch / sign-out | Personal lists must be user-scoped | Native resets watchlist on deliberate/forced logout; invalidates in-flight hydration | Sign out dealer A; sign in dealer B; no dealer A saved cars appear |

**Block 1 executable native tests:** Nine cases in `carmazium app/carmazium app/scripts/test-auction-shortlist-state.test.mjs` exercise multi-page hydration, offline recovery, late saves and removals, cross-account race prevention, and malformed-response handling. The test suite passed in Mobile Listing CI at commit `1560d7da06b8d0e6cb301d9f5c8a00cace0ae016`, and remained green with the parity workflow trigger at `fedee62889cc2195b02ac6e603e86c88757ccc2c`. These are simulated in-process tests, not signed-device or live cross-device verification. The verified-dealer access cache is now cleared at sign-out and fresh sign-in.\n\n**Block 1 automated code-check evidence:** GitHub PR #413. Re-run exact-commit One Product Parity, Release Certification and Mobile Listing CI after all corrections. A green contract check validates source rules, not real signed-device experiences. Neither merge nor store publish is authorized on structural checks alone.

## Other observed gaps reserved for subsequent blocks

- **Seller DVLA (Block 4):** web has non-blocking first `/dvla/lookup` then optional consented `/dvla/enrich`; native still uses one awaited lookup passing `allowAiEnrichment`. Need preserve user consent, manual changes and MOT timeouts while aligning iOS/Android.
- **Shared visual system (Block 10):** website main style currently uses primary `#ED1C24`, native uses `#FF0037` and explicitly deeper dark background. Decide shared tokens through design review rather than blindly mirroring a phone screenshot on desktop.
- **Store/device certification (Block 10):** older parity documentation records missing signing/association and physical-device proof. The source build passing typecheck does not establish which version customers have installed.

## Matched test matrix required for every cross-platform feature

| Test account / scenario | Website | Signed iOS | Signed Android | Cross-device continuation |
|---|---|---|---|---|
| Signed-out visitor browse and authenticated CTA | Unverified | Unverified | Unverified | Login resumes action |
| Buyer/seller registration and settings | Unverified | Unverified | Unverified | Profile, drafts, wishlist sync |
| Unverified dealer and company/sole-trader KYC | Unverified | Unverified | Unverified | Access denied consistently before verification |
| Verified dealer owner and delegated staff | Unverified | Unverified | Unverified | Allowed role actions and protected ones identical |
| Auction browse/save/shortlist/bid later | Source mapped | Draft native code; device unverified | Draft native code; device unverified | Web save -> iOS bid -> Android remove; live expiry mid-flow |
| Seller DVLA / valuation / new auction and retail | Unverified | Unverified | Unverified | Start on one, resume draft on another |
| Retail buyer offer / inspection / collection | Unverified | Unverified | Unverified | Messages and statuses consistent |
| Provisional auction / funds / handover correction | Unverified | Unverified | Unverified | Transaction states and refunds never diverge |
| Contractor, finance, insurance, warranty operations | Unverified | Unverified | Unverified | Matched leads, quotes and permissions |
| Offline, invalid auth, accessibility, performance | Unverified | Unverified | Unverified | Clear errors and recoverable workflows |

Record test date, actor/role, source and destination platforms, environment, exact commit and signed build ID, actions, expected result, actual result, proof and responsible fix PR. If a test cannot run because store credentials or physical devices are unavailable, use **BLOCKED / NOT TESTED**, never PASS.

## Rollback

All Block 1 work stays on `feat/native-dealer-auction-shortlist-parity-20261004`, based on main commit `b0bca15cc91e5cc3967065cf975f0ca2ec506486` (website shortlist #412). Revert this PR independently if undesired; do not roll back unrelated work or rewrite `main`. Complete each later block with its own PR and rollback reference.
