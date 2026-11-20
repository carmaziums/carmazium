# Android build 108 website coverage, 20 November 2026

## What was tested

Build 108 was installed as an update in BlueStacks. The buyer/seller and dealer sessions supplied the device evidence below. The recorded build SHA is `f22ef270810ccea3d99fb47996ee250048968a8a`. The [emulator log](android-emulator-2026-11-20.md) includes the installation digest and individual chat, inventory, service and navigation observations.

| Area | Result | Further acceptance needed |
| --- | --- | --- |
| Buyer support | All five priority buyer retests passed. A reconnect left an existing AI answer invisible until the conversation reopened. | Retest the reconnect fix in #935 with the chat still open. |
| Guest retail | Build 108 asks for sign-in. Website allows an email-confirmed enquiry. #936 adds the Android form and covers consent, invalid and valid codes in a rendered screen test. | Guest viewing → confirmation email → seller inbox on a disposable listing and controlled accounts. |
| TradeXchange | Delivery and inspection forms loaded and rejected empty posts. Existing cancelled inspection details, dealer provider coverage, matching and verification screens opened. Finance information and the web warranty quote form opened. | Scheduled and multi-vehicle jobs, inspection scope, quote acceptance, payment, completion, email, notifications and payout on an isolated deployment with an opted-in provider. |
| Dealer | Stock filtering, count, grid/list, command centre, live lots and bid/offer history checked. | Permitted staff roles, CRM, team, listings, purchases, reconciliation and handover with representative records. |
| Admin and specialist accounts | Website and native navigation compared in source. Missing admin warranty/finance entries recorded below. | Admin overview, pending listings, handovers, KYC, directory and insights opened on build 108. Remaining admin operations, standalone provider, legacy finance/insurance accounts, and populated workflows. |
| Device behaviour | Keyboard interactions and links checked in BlueStacks. | Physical phone width, rotation, accessibility, camera/file upload, push in foreground/background/terminated states, and hosted checkout return/cancellation. |

## Automated checks

On exact build 108 source, all 777 repository regression checks and all 27 native checks passed. Native TypeScript passed. The backend unit run passed 2,182 tests. All 67 separately gated database integration tests passed on isolated PostgreSQL, for 2,249 backend tests across 191 suites. The four approval tests used the repository SQL migration. The code-level release checklist reported 15 outstanding external evidence warnings. Prior support evaluation passed 155/155 scenarios. Sixteen live support test messages are tracked separately.

The internal Android snapshot `fd29efa37ad024798f3ac3fae5cc21350fbdba4e` combines client changes from #933, #935 and #936 for review. Native TypeScript and all 35 native tests passed on the combined client. It includes the inspection changes from #930 via #933. No production database migration, deployment, transaction or customer distribution was performed for this pass.

## Website page inventory

A separate availability check returned HTTP 200 for 36 public URLs and captured their page titles. All 58 make and location pages linked by the live directory also returned HTTP 200 and an H1. These checks cover public site availability.

All 158 Next.js page templates at the build 108 source are listed below. A dynamic URL represents a template, so a row cannot establish that every vehicle or account state works. The middle column lists feature IDs that explicitly name the page file in the repository parity manifest. A dash means the manifest has no direct page-file entry. Android screen observations cover only the action named. Role redirects, checkout outcomes and SEO pages are included so that they can be accounted for explicitly.

### Authentication and checkout

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/auth/accept-invite` | auth.dealer_staff_invite | Pending Android acceptance. |
| `/auth/callback` | — | Pending Android acceptance. |
| `/auth/forgot-password` | auth.password_recovery | Pending Android acceptance. |
| `/auth/login` | auth.login | Pending Android acceptance. |
| `/auth/onboarding` | auth.account_onboarding, auth.email_verification | Pending Android acceptance. |
| `/auth/registration-complete` | — | Pending Android acceptance. |
| `/auth/reset-password` | auth.password_recovery | Pending Android acceptance. |
| `/auth/signup` | auth.signup_account_type | Pending Android acceptance. |
| `/checkout/cancel` | — | Pending Android acceptance. |
| `/checkout` | payments.vehicle_direct_settlement | Pending Android acceptance. |
| `/checkout/success` | payments.checkout_reconciliation | Pending Android acceptance. |

### Dashboard / admin

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/admin/ai-reports` | ai.safety_reporting | Admin website handoff in build 108. Admin sign-in and destination pending. |
| `/dashboard/admin/analytics` | — | Admin website handoff in build 108. Admin sign-in and destination pending. |
| `/dashboard/admin/app` | — | Native App & problem reports showed activity, downloads and Open/Resolved filters. |
| `/dashboard/admin/auctions/historical-reconciliation` | — | Pending Android acceptance. |
| `/dashboard/admin/auctions` | — | Signed-in Android Chrome opened Auction Management. |
| `/dashboard/admin/blog/[id]/edit` | — | Pending Android acceptance. |
| `/dashboard/admin/blog/new` | — | Pending Android acceptance. |
| `/dashboard/admin/blog` | — | Signed-in Android Chrome opened the admin Blog list with published records. |
| `/dashboard/admin/cancellations` | — | Signed-in Android Chrome opened Sale Cancellation Review. |
| `/dashboard/admin/dealer-verification` | admin.operations | Native Dealer KYC showed field verification and its caught-up state. |
| `/dashboard/admin/dealers` | — | Admin website handoff in build 108. Admin sign-in and destination pending. |
| `/dashboard/admin/finance-providers` | — | Website finance provider manager opened in signed-in Android Chrome. Dedicated app shortcut added in #936. |
| `/dashboard/admin/free-listings` | — | Signed-in Android Chrome opened Free Listing & Purchase Grants. |
| `/dashboard/admin/handovers` | admin.operations | Native Handover Verification opened, with an empty queue and website payout shortcut. |
| `/dashboard/admin/hpi` | — | Signed-in Android Chrome opened Vehicle History Reports and its fulfilment queue. |
| `/dashboard/admin/listings` | admin.operations | Native pending review opened and correctly showed an empty queue. Full inventory manager link added in #936. |
| `/dashboard/admin/marketing-popup` | — | Admin website handoff in build 108. Admin sign-in and destination pending. |
| `/dashboard/admin/messages` | — | Admin website handoff in build 108. Admin sign-in and destination pending. |
| `/dashboard/admin/services/jobs/[id]` | — | Pending Android acceptance. |
| `/dashboard/admin/services/leads/[id]` | — | Pending Android acceptance. |
| `/dashboard/admin/services` | — | Trade Services opened a Chrome custom tab at the separate website sign-in. After separate admin sign-in, Applications, Providers, Jobs, Finance / Warranty and Disputes opened. All four service types and the All services reset were exercised. Dedicated Warranty Partners filter shortcut added in #936. |
| `/dashboard/admin/services/providers/[id]` | — | Pending Android acceptance. |
| `/dashboard/admin/transactions` | — | Signed-in Android Chrome opened Transactions. |
| `/dashboard/admin/users` | admin.operations | Native Accounts directory loaded with total user count, search and website management action. |
| `/dashboard/admin/warranty-orders` | — | Website opened in signed-in Android Chrome and showed warranty orders with an empty-state filter result. Dedicated app shortcut added in #936. |

### Dashboard / buyer

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/buyer/bids` | buyer.bids | Auction Bids empty state and View Live Auctions action displayed. |
| `/dashboard/buyer/history` | buyer.history | Pending Android acceptance. |
| `/dashboard/buyer/messages` | — | Messages opened with a populated conversation list. |
| `/dashboard/buyer/offers` | buyer.offers | My Sent Offers empty state opened. Browse cars opened retail inventory. |
| `/dashboard/buyer/settings` | — | Account Settings opened with personal details and notification/privacy controls. |
| `/dashboard/buyer/watchlist` | — | Pending Android acceptance. |

### Dashboard / dealer

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/dealer/add-listing` | — | Pending Android acceptance. |
| `/dashboard/dealer/analytics` | dealer.analytics | Pending Android acceptance. |
| `/dashboard/dealer/auctions` | — | Pending Android acceptance. |
| `/dashboard/dealer/auctions/shortlisted` | — | Pending Android acceptance. |
| `/dashboard/dealer/auctions/won` | dealer.auction_staff_permissions | Pending Android acceptance. |
| `/dashboard/dealer/bids` | — | Dealer bid history opened. |
| `/dashboard/dealer/crm` | — | Pending Android acceptance. |
| `/dashboard/dealer/earnings` | dealer.earnings | Pending Android acceptance. |
| `/dashboard/dealer/finance` | dealer.finance | Pending Android acceptance. |
| `/dashboard/dealer/inventory` | dealer.inventory | Stock search, clear, grid and list checked. |
| `/dashboard/dealer/messages` | — | Pending Android acceptance. |
| `/dashboard/dealer/my-offers` | — | Dealer sent offer history opened. |
| `/dashboard/dealer/offers` | dealer.offers | Pending Android acceptance. |
| `/dashboard/dealer/purchases/[id]` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases/[id]/seller` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases/history` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases` | dealer.purchases | Pending Android acceptance. |
| `/dashboard/dealer/purchases/reconciled/[id]` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases/retail` | — | Pending Android acceptance. |
| `/dashboard/dealer/put-on-auction` | — | Pending Android acceptance. |
| `/dashboard/dealer/settings` | — | Pending Android acceptance. |
| `/dashboard/dealer/team` | dealer.team | Pending Android acceptance. |
| `/dashboard/dealer/wishlist` | — | Pending Android acceptance. |

### Dashboard / finance

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/finance/applications` | partner.finance_contact_only | Pending Android acceptance. |
| `/dashboard/finance/messages` | — | Pending Android acceptance. |
| `/dashboard/finance/settings` | partner.finance_contact_only | Pending Android acceptance. |

### Dashboard / insurance

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/insurance/messages` | — | Pending Android acceptance. |
| `/dashboard/insurance/quotes` | partner.legacy_insurance_operations | Pending Android acceptance. |
| `/dashboard/insurance/settings` | partner.legacy_insurance_operations | Pending Android acceptance. |

### Dashboard / seller

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/seller/add-listing` | seller.sell_flow | Pending Android acceptance. |
| `/dashboard/seller/auctions` | seller.auction_handover_reward, seller.auctions, payments.seller_bonus_payout | My Auctions opened with five records counted. |
| `/dashboard/seller/earnings` | seller.earnings | Earnings opened with fees and payouts sections. |
| `/dashboard/seller/listings` | seller.listings | My Listings, status filters and empty state opened. |
| `/dashboard/seller/messages` | — | Pending Android acceptance. |
| `/dashboard/seller/offers` | seller.offers | Pending Android acceptance. |
| `/dashboard/seller/performance` | seller.performance | Pending Android acceptance. |
| `/dashboard/seller/settings` | — | Pending Android acceptance. |

### Dashboard / service

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/service/capabilities/[id]/matching` | service_provider.capabilities | Inspection nationwide matching settings opened. |
| `/dashboard/service/capabilities/[id]/verification` | service_provider.capabilities | Verification requirements and dealer KYC reuse opened. |
| `/dashboard/service/capabilities` | service_provider.capabilities | Dealer-as-provider saw both approved capabilities. |
| `/dashboard/service/jobs/[id]` | buyer.auction_inspection_refusal, service_provider.jobs | Pending Android acceptance. |
| `/dashboard/service/jobs` | service_provider.jobs | Dealer-as-provider opened available jobs, inspection filter and My Work. |
| `/dashboard/service/leads/[id]` | service_provider.leads | Pending Android acceptance. |
| `/dashboard/service/leads` | service_provider.leads, ui.shared_terminology | Pending Android acceptance. |
| `/dashboard/service/messages` | service_provider.messages | Pending Android acceptance. |
| `/dashboard/service/settings` | — | Pending Android acceptance. |

### Dashboard / shared

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/admin` | admin.operations | Native Admin Control Panel opened from the Dashboard tab. Six populated overview cards rendered. |
| `/dashboard/buyer` | buyer.dashboard, navigation.cross_role_backstack | Pending Android acceptance. |
| `/dashboard/cancellations` | — | Pending Android acceptance. |
| `/dashboard/dealer` | dealer.dashboard | Dealer command centre opened. |
| `/dashboard/enquiries` | — | Personal menu missing Guest enquiries. Website handoff added in #936. |
| `/dashboard/finance` | partner.finance_contact_only | Pending Android acceptance. |
| `/dashboard/insurance` | partner.legacy_insurance_operations | Pending Android acceptance. |
| `/dashboard` | navigation.account_role_home | Pending Android acceptance. |
| `/dashboard/partner` | partner.dashboard, ui.shared_terminology | Pending Android acceptance. |
| `/dashboard/seller` | seller.dashboard | Pending Android acceptance. |
| `/dashboard/service` | — | Pending Android acceptance. |
| `/dashboard/user` | — | Buyer/seller dashboard and account drawer opened. |
| `/dashboard/warranties` | — | Personal menu missing My Warranties. Website handoff added in #936. |

### Marketplace and listings

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/auctions/browse` | — | Pending Android acceptance. |
| `/auctions/how-it-works` | — | Pending Android acceptance. |
| `/auctions/live/[id]` | marketplace.auctions, dealer.auction_staff_permissions, navigation.public_detail_deeplinks | Dealer live lots and non-dealer role gate checked. Individual bidding transaction pending. |
| `/auctions` | marketplace.auctions | Pending Android acceptance. |
| `/auctions/won/[id]` | buyer.auction_inspection_refusal | Pending Android acceptance. |
| `/buy-cars/[slug]` | marketplace.vehicle_detail, navigation.public_detail_deeplinks | Build 108 prompts guests to sign in to enquire. Native verified-email enquiry in #936. |
| `/buy-cars` | — | Pending Android acceptance. |
| `/compare` | — | Pending Android acceptance. |
| `/search` | marketplace.search | Browse cars opened retail inventory showing 714 results at time of check. |
| `/sell/auction-submitted` | — | Pending Android acceptance. |
| `/sell` | seller.sell_flow | Pending Android acceptance. |
| `/seller/[id]/listings` | — | Pending Android acceptance. |
| `/seller/[id]` | — | Pending Android acceptance. |
| `/used-car-types` | — | Site menu footer missing body type directory. Website handoff added in #936. |
| `/used-cars/in/[slug]` | — | Pending Android acceptance. |
| `/used-cars/make/[slug]` | — | Pending Android acceptance. |
| `/used-cars` | — | Site menu footer missing make/location browsing. Website handoff added in #936. |
| `/vehicle/[id]` | marketplace.vehicle_detail | Pending Android acceptance. |

### Public pages and account utilities

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/about` | — | Pending Android acceptance. |
| `/app-support` | — | Pending Android acceptance. |
| `/blog/[slug]` | — | Pending Android acceptance. |
| `/blog` | blog.seo | Public articles are web-hosted. App menu link added in #936. |
| `/blog/tag/[tag]` | — | Pending Android acceptance. |
| `/contact` | — | Pending Android acceptance. |
| `/cookie-policy` | — | Site menu footer missing Cookie Policy. Website handoff added in #936. |
| `/delete-account` | account.deletion | Pending Android acceptance. |
| `/download-app` | — | Pending Android acceptance. |
| `/how-it-works` | — | Pending Android acceptance. |
| `/notifications` | notifications.history | Notifications screen opened. |
| `/` | — | Pending Android acceptance. |
| `/pricing` | pricing.customer | Pending Android acceptance. |
| `/pricing/traders` | — | Pending Android acceptance. |
| `/privacy-policy` | legal.privacy_policy | Pending Android acceptance. |
| `/profile/[id]` | — | Pending Android acceptance. |
| `/profile` | — | Pending Android acceptance. |
| `/report-problem` | — | Pending Android acceptance. |
| `/reviews` | — | Pending Android acceptance. |
| `/terms` | — | Pending Android acceptance. |

### TradeXchange, finance and partnerships

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/become-a-partner` | — | Site menu footer missing partner onboarding link. Website handoff added in #936. |
| `/business-spotlight` | — | Site menu footer missing Business Spotlight. Website handoff added in #936. |
| `/business-spotlight/resolve-automotive` | — | Pending Android acceptance. |
| `/business-spotlight/simpledms` | — | Pending Android acceptance. |
| `/finance` | — | Pending Android acceptance. |
| `/services/delivery/new` | — | Site menu → Delivery & Recovery → Post a Job loaded. Empty submit showed missing-information alert. |
| `/services/delivery` | — | Pending Android acceptance. |
| `/services/finance` | — | Vehicle Finance opened and displayed application instructions and contact-only provider onboarding. Application submission pending. |
| `/services/inspection/new` | — | Site menu → Vehicle Inspection → Post a Job loaded. Empty submit showed missing-information alert. |
| `/services/inspection` | — | Pending Android acceptance. |
| `/services/jobs/[id]` | buyer.auction_inspection_refusal | Existing cancelled inspection job opened with vehicle, status and location. |
| `/services/jobs/new` | — | Pending Android acceptance. |
| `/services/jobs` | — | My Service Jobs screen opened. |
| `/services/leads/[id]` | — | Pending Android acceptance. |
| `/services/leads` | — | Pending Android acceptance. |
| `/services` | — | Pending Android acceptance. |
| `/services/warranty/order` | — | Pending Android acceptance. |
| `/services/warranty` | — | Warranty opened the hosted CarMazium quote form, with registration, lookup, make, model and vehicle category visible. |
| `/services/warranty/terms` | — | Pending Android acceptance. |
