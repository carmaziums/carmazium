# Android build 108 website coverage, 20 November 2026

## What was tested

Build 108 was installed as an update in BlueStacks. The buyer/seller and dealer sessions supplied the device evidence below. The recorded build SHA is `f22ef270810ccea3d99fb47996ee250048968a8a`. The [emulator log](android-emulator-2026-11-20.md) includes the installation digest and individual chat, inventory, service and navigation observations.

| Area | Result | Further acceptance needed |
| --- | --- | --- |
| Buyer support | All five priority buyer retests passed. A reconnect left an existing AI answer invisible until the conversation reopened. | Retest the reconnect fix in #935 with the chat still open. |
| Guest retail | Build 108 asks for sign-in. Website allows an email-confirmed enquiry. #936 adds the Android form and covers consent, invalid and valid codes in a rendered screen test. | On the separate QA APK a guest opened the prefilled form and empty submission showed validation. Delivery of a confirmation email and arrival in the seller inbox still need controlled test accounts. |
| TradeXchange | Delivery and inspection forms loaded and rejected empty posts. Existing cancelled inspection details, dealer provider coverage, matching and verification screens opened. Finance information and the web warranty quote form opened. | Signed-in QA verified date/time selection and reset, adding/removing delivery vehicles, inspection scope and provider filters. End-to-end posting, quote acceptance, payment, completion, email, notifications and payout need an isolated deployment with an opted-in provider. |
| Dealer | Stock filtering, count, grid/list, command centre, live lots and bid/offer history checked. | Dealer owner tested CRM list/board, manual lead validation, Team and invite form, populated completed retail purchases and purchase-to-delivery prefill. Staff-only permissions, reconciliation, handover changes and invitations require disposable test records. |
| Admin and specialist accounts | Website and native navigation compared in source. Missing admin warranty/finance entries recorded below. | Admin overview, pending listings, handovers, KYC, directory and insights opened on build 108. Authenticated mobile browser checked across the admin website. Admin changes requiring disposable records, standalone provider, legacy finance/insurance accounts, and populated workflows. |
| Device behaviour | Keyboard interactions and links checked in BlueStacks. | Physical phone width, rotation, accessibility, camera/file upload, push in foreground/background/terminated states, and hosted checkout return/cancellation. |

## Automated checks

On exact build 108 source, all 777 repository regression checks and all 27 native checks passed. Native TypeScript passed. The backend unit run passed 2,182 tests. All 67 separately gated database integration tests passed on isolated PostgreSQL, for 2,249 backend tests across 191 suites. The four approval tests used the repository SQL migration. The code-level release checklist reported 15 outstanding external evidence warnings. Prior support evaluation passed 155/155 scenarios. Sixteen live support test messages are tracked separately.

The internal Android snapshot `fd29efa37ad024798f3ac3fae5cc21350fbdba4e` combines client changes from #933, #935 and #936 for review. Native TypeScript and all 35 native tests passed on the combined client. It includes the inspection changes from #930 via #933. No production database migration, deployment, transaction or customer distribution was performed for this pass.

## Website page inventory

A separate availability check returned HTTP 200 for 36 public URLs and captured their page titles. All 58 make and location pages linked by the live directory also returned HTTP 200 and an H1. These checks cover public site availability.

The separate QA APK was installed alongside build 108 on BlueStacks. Its guest listing buttons opened inspection, delivery and warranty with matching vehicle details. The live hosted inspection form still had the older single-vehicle specification. The Business Spotlight shortcut opened both partner profiles in the directory. The most recent full listings manager link in #936 postdates that APK.

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
| `/dashboard/admin/ai-reports` | ai.safety_reporting | AI response reports loaded in authenticated Android Chrome with queue, open status and refresh controls. |
| `/dashboard/admin/analytics` | — | Platform Analytics content verified in authenticated Android Chrome. |
| `/dashboard/admin/app` | — | Native App & problem reports showed activity, downloads and Open/Resolved filters. |
| `/dashboard/admin/auctions/historical-reconciliation` | — | Pending Android acceptance. |
| `/dashboard/admin/auctions` | — | Signed-in Android Chrome opened Auction Management. |
| `/dashboard/admin/blog/[id]/edit` | — | Pending Android acceptance. |
| `/dashboard/admin/blog/new` | — | Pending Android acceptance. |
| `/dashboard/admin/blog` | — | Signed-in Android Chrome opened the admin Blog list with published records. |
| `/dashboard/admin/cancellations` | — | Signed-in Android Chrome opened Sale Cancellation Review. |
| `/dashboard/admin/dealer-verification` | admin.operations | Native Dealer KYC showed field verification and its caught-up state. |
| `/dashboard/admin/dealers` | — | All Dealers heading verified in authenticated Android Chrome. |
| `/dashboard/admin/finance-providers` | — | Website finance provider manager opened in signed-in Android Chrome. Dedicated app shortcut added in #936. |
| `/dashboard/admin/free-listings` | — | Signed-in Android Chrome opened Free Listing & Purchase Grants. |
| `/dashboard/admin/handovers` | admin.operations | Native Handover Verification opened, with an empty queue and website payout shortcut. |
| `/dashboard/admin/hpi` | — | Signed-in Android Chrome opened Vehicle History Reports and its fulfilment queue. |
| `/dashboard/admin/listings` | admin.operations | Native pending review opened and correctly showed an empty queue. Full inventory manager link added in #936. |
| `/dashboard/admin/marketing-popup` | — | Marketing Popup settings loaded in authenticated Android Chrome with its current disabled status. No settings were changed. |
| `/dashboard/admin/messages` | — | Native shortcut opened the signed-in admin web inbox with conversation search. |
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
| `/dashboard/buyer/history` | buyer.history | Pending populated Android acceptance; platform receipts and accepted purchases require synthetic records. |
| `/dashboard/buyer/messages` | — | Messages opened with a populated conversation list. |
| `/dashboard/buyer/offers` | buyer.offers | My Sent Offers empty state opened. Browse cars opened retail inventory. |
| `/dashboard/buyer/settings` | — | Account Settings opened with personal details and notification/privacy controls. |
| `/dashboard/buyer/watchlist` | — | Pending Android acceptance. |

### Dashboard / dealer

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/dealer/add-listing` | — | Pending Android acceptance. |
| `/dashboard/dealer/analytics` | dealer.analytics | QA #144 opened 30D and All; 48 live listings, sales-specific empty chart, and website report/CSV action displayed. Populated chart and export remain separate checks. |
| `/dashboard/dealer/auctions` | — | Pending Android acceptance. |
| `/dashboard/dealer/auctions/shortlisted` | — | Pending Android acceptance. |
| `/dashboard/dealer/auctions/won` | dealer.auction_staff_permissions | Pending Android acceptance. |
| `/dashboard/dealer/bids` | — | Dealer bid history opened. |
| `/dashboard/dealer/crm` | — | Dealer CRM list/board and manual lead validation opened; no real lead or invitation created. |
| `/dashboard/dealer/earnings` | dealer.earnings | Dealership earnings opened. Financial reconciliation against real records is not certified. |
| `/dashboard/dealer/finance` | dealer.finance | Pending Android acceptance. |
| `/dashboard/dealer/inventory` | dealer.inventory | Stock search, clear, grid and list checked. |
| `/dashboard/dealer/messages` | — | Pending Android acceptance. |
| `/dashboard/dealer/my-offers` | — | Dealer sent offer history opened. |
| `/dashboard/dealer/offers` | dealer.offers | Pending Android acceptance. |
| `/dashboard/dealer/purchases/[id]` | — | Existing retail purchase showed the summary, seller, payment, handover and delivery sections. Book delivery carried the vehicle into the native form. |
| `/dashboard/dealer/purchases/[id]/seller` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases/history` | — | Completed stage opened with populated purchases. |
| `/dashboard/dealer/purchases` | dealer.purchases | Completed records and the Retail filter worked. A retail purchase opened its details and the Book delivery action prefilled that vehicle. |
| `/dashboard/dealer/purchases/reconciled/[id]` | — | Pending Android acceptance. |
| `/dashboard/dealer/purchases/retail` | — | Retail filter showed completed retail purchases and opened a matching purchase. |
| `/dashboard/dealer/put-on-auction` | — | Pending Android acceptance. |
| `/dashboard/dealer/settings` | — | Account/settings/security headings and finance-calculator setting opened without changing customer settings. |
| `/dashboard/dealer/team` | dealer.team | Roster, service permissions and invitation email/role controls opened in the QA app. |
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
| `/dashboard/seller/offers` | seller.offers | QA #146 local buyer/seller opened Incoming Offers and the correct empty state at 360dp. Populated counter/accept/reject/sold actions remain outstanding. |
| `/dashboard/seller/performance` | seller.performance | Pending Android acceptance. |
| `/dashboard/seller/settings` | — | Pending Android acceptance. |

### Dashboard / service

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/dashboard/service/capabilities/[id]/matching` | service_provider.capabilities | Delivery and inspection matching opened. Empty coverage and missing inspection specialty triggered validation. Reopening showed the original settings. |
| `/dashboard/service/capabilities/[id]/verification` | service_provider.capabilities | Verification requirements and dealer KYC reuse opened. |
| `/dashboard/service/capabilities` | service_provider.capabilities | Dealer-as-provider saw both approved capabilities. |
| `/dashboard/service/jobs/[id]` | buyer.auction_inspection_refusal, service_provider.jobs | Local native combined inspection detail: quote, Accept & Pay, paid return, customer release, dispute and refunded status passed. Provider start/complete and refund resolution used API/service layer, not provider/admin native UI. |
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
| `/buy-cars/[slug]` | marketplace.vehicle_detail, navigation.public_detail_deeplinks | Build 108 prompts guests to sign in to enquire. Separate QA APK opened the native guest enquiry form and correctly blocked an empty submission. Confirmation delivery pending. |
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
| `/contact` | — | The QA app menu opened Contact with Get in touch. |
| `/cookie-policy` | — | Site menu footer missing Cookie Policy. Website handoff added in #936. |
| `/delete-account` | account.deletion | Pending Android acceptance. |
| `/download-app` | — | Pending Android acceptance. |
| `/how-it-works` | — | How It Works opened from the QA app menu. |
| `/notifications` | notifications.history | Notifications screen opened. |
| `/` | — | Pending Android acceptance. |
| `/pricing` | pricing.customer | Native pricing opened with Basic £1, Standard £10 and Premium £25, the history report and 28-day Featured Boost. |
| `/pricing/traders` | — | Pending Android acceptance. |
| `/privacy-policy` | legal.privacy_policy | The QA app menu opened the hosted Privacy Policy. |
| `/profile/[id]` | — | Pending Android acceptance. |
| `/profile` | — | Pending Android acceptance. |
| `/report-problem` | — | The app menu opened the problem report form. No report submitted. |
| `/reviews` | — | Trust & Reviews opened from the QA app menu, including the seller profile review action. |
| `/terms` | — | The QA app menu opened Terms & Conditions. |

### TradeXchange, finance and partnerships

| Website route | Manifest features | Android evidence or outstanding check |
| --- | --- | --- |
| `/become-a-partner` | — | Site menu footer missing partner onboarding link. Website handoff added in #936. |
| `/business-spotlight` | — | Build 108 had no footer shortcut. On the separate QA APK the new shortcut opened the partner directory showing Resolve Automotive and SimpleDMS. |
| `/business-spotlight/resolve-automotive` | — | Pending Android acceptance. |
| `/business-spotlight/simpledms` | — | Pending Android acceptance. |
| `/finance` | — | Pending Android acceptance. |
| `/services/delivery/new` | — | Site menu → Delivery & Recovery → Post a Job loaded. Empty submit showed missing-information alert. |
| `/services/delivery` | — | Pending Android acceptance. |
| `/services/finance` | — | Vehicle Finance opened and displayed application instructions and contact-only provider onboarding. Application submission pending. |
| `/services/inspection/new` | — | Site menu → Vehicle Inspection → Post a Job loaded. Empty submit showed missing-information alert. |
| `/services/inspection` | — | Pending Android acceptance. |
| `/services/jobs/[id]` | buyer.auction_inspection_refusal | Existing cancelled inspection job opened with vehicle, status and location. |
| `/services/jobs/new` | — | The hub job chooser offered Delivery or Recovery and Inspection. Choosing Inspection opened the native form. A duplicate registration was rejected and a valid draft reached the QA read-only guard. |
| `/services/jobs` | — | My Service Jobs screen opened. |
| `/services/leads/[id]` | — | Pending Android acceptance. |
| `/services/leads` | — | Pending Android acceptance. |
| `/services` | — | The native hub opened jobs, the service chooser and Partner Account. The partner inbox showed the service-job empty state. |
| `/services/warranty/order` | — | Pending Android acceptance. |
| `/services/warranty` | — | Warranty opened the hosted CarMazium quote form, with registration, lookup, make, model and vehicle category visible. |
| `/services/warranty/terms` | — | Pending Android acceptance. |


## 20 November, continued dashboard and Stripe checks (15:00–16:07 GMT)

- Website remains the reference. No customer APK, Play Store, OTA, website deployment or production payment configuration was published during this pass.
- Reproduced dealer Analytics hiding all data when sales/revenue-trend arrays were empty despite 48 active listings. Native fix shows inventory/funnel sections whenever a valid response exists, scopes the empty state to the sales chart, handles the existing website response envelope, guards against stale period responses and exposes the existing full website report/CSV route.
- Android admin Overview previously used six fixed, untappable cards. Source now follows the website's 18-card catalogue, shared saved card preferences, customization, cancel/default/save failure states and destination links. These admin changes require a signed-in admin acceptance pass in the new QA package.
- Menu comparison found missing dealer Guest enquiries and provider My Work/My services options. Source fixes and a role-menu regression test are in draft PR #936; website routes/components were not changed. The later menu changes at combined SHA 13ec38cf3ae62f702e3c5ceaa672d21f1f645342 are NOT included in run #144.
- Latest source validation: 39 native tests and TypeScript passed; 777 root tests passed. These source checks do not replace account-specific device acceptance.
- Internal run 44764702088 (#144), source 0399aaf7d5bc4c9c9a5a226566195d7d8a0bb7f3, passed compilation, APK signature/package checks and Android 15 cold launch. Archive SHA256 2ee566aac7643777276a6b0f3f12c488917f75094b97221b68c36095a213b877; APK SHA256 2bd405435ac3f5e8e4d45f579b3a55f1cc09e13a091a080f296196d16789b43c. Both matched the laptop download. Installed uk.carmazium.qa with adb install -r, preserving the dealer session and firstInstallTime 14:39:37; lastUpdateTime 16:02:45.
- Device retest of Analytics on #144 passed: 30D shows 48 live listings, the sales-specific empty chart message and full website report/CSV action; All period loads and still shows 48 live listings. Admin customization remains untested on-device. Prior dealership earnings, payment-history filters, account/settings/security headings and finance-calculator setting were opened without modifying customer records.

### Stripe sandbox — separate from Android acceptance

- User explicitly authorized sandbox setup/testing. Signed into Stripe and selected the existing Carmazium sandbox (acct_1SCdIM8OCSU5yHod), belonging to the Carmazium account identified by the Android public payment configuration. The connector's separate Mazium live account was not used for payments.
- Confirmed sandbox banner and API account identity. Used only sk_test credentials, kept outside the repository; every created PaymentIntent/Checkout asserted livemode=false.
- Ten direct Stripe API checks passed: GBP 1/10/25/125/360 success and full refund (five cases), repeated-request idempotency, GBP 100 partial GBP 20 then remaining GBP 80 refund, declined card rejection, 3D Secure requires_action and cancellation, and unpaid hosted Checkout creation/expiry. The initial GBP 1 setup check was also refunded. No successful QA charge remains unrefunded.
- These are real Stripe sandbox API requests, NOT a completed Android checkout or application webhook test. No live money moved. No production API key was replaced.
- The sandbox has no configured event destination. Existing sandbox Connect accounts report inactive transfer capabilities/payouts disabled. Provider onboarding, payout transfer/reversal, and signed application webhook delivery remain outstanding.
- Current QA APK still reads the live backend/Supabase and has write guards. It has NOT been connected to this Stripe sandbox. An isolated application backend/database/auth configuration, sandbox keys/webhook destination and a specifically configured internal build are required before end-to-end Android payments. No separate CarMazium staging project was found in connected Supabase (only Pulse Cars/mazium) or Railway (only simpledms-stage); these other projects were not changed.
- This pass does not certify all admin/dealer/buyer-seller actions or complete website parity. Continue controlled transactional, uploads, email/push, service-provider onboarding/settlement and role-specific failure-path acceptance.

## Isolated application sandbox and native payment acceptance (20 November, 16:08–17:02 GMT)

This supersedes the earlier sandbox prerequisite blockers, but is not a full application sign-off.

- Ran the actual backend at combined source `13ec38cf3ae62f702e3c5ceaa672d21f1f645342` on the owner's laptop, with a UTF-8 local PostgreSQL database on loopback port 5544 and API on loopback port 8080. ADB reverse connects only the emulator to that API. Stripe's official CLI forwards signed sandbox events. No public tunnel, production payment key, live database or customer release was introduced.
- Internal APK #145 / run 44772323267, source `41f0fe0eed333ecd83a09418cd1978c49bb20862`, passed build and Android 15 cold launch. ZIP SHA256 `e3178a0c99683a6931062e131e4f00afdab2ad0df01b08e38689dce51d33a606`; APK `dfc4ec495ec671fd8010e30adbad5311bf0ece508a1593934c430c06afbe69b1`. Installed with `adb install -r` over `uk.carmazium.qa`; login retained. Original `uk.carmazium.app` remains build 108 with its data.
- Existing Supabase sign-in is used only to authenticate. Business data and role fixtures are local. QA identity changes, direct Supabase uploads and production OTA remain blocked. Outbound email and AI credentials are absent. Private document storage is intentionally unconfigured; those journeys are not claimed passed.
- Seeded synthetic buyer, provider, outsider and admin fixtures plus a Stripe test Connect recipient with active transfers. The seeded recipient uses Stripe's documented test identity/bank tokens; this is not a real provider KYC acceptance test.
- HTTP workflow checks passed for delivery, cosmetic inspection, combined inspection and recovery: create, quote, accept, repeated acceptance reusing checkout, outsider access rejection and unpaid-start rejection. Unsigned webhook was rejected.
- Initial delivery/cosmetic event handlers hit missing manually managed tables/columns in the new local schema. Applied the existing repository migrations, then replayed the genuine signed test events successfully. These were sandbox provisioning omissions, not established production defects.
- Native buyer onboarding completed against the local database. In the actual Android app: posted a combined inspection, viewed the provider quote, tapped Accept & Pay, paid GBP100 using Stripe's 4242 test card in Android Chrome, returned to the app and saw PAID plus unlocked provider details. Genuine payment_intent and checkout.session events returned 201. Provider start/complete used the HTTP API. Native customer confirmed completion, saw “Provider payment released”, submitted a synthetic problem report, then saw the final refunded state after service-layer resolution.
- Combined native inspection: GBP100 gross, GBP9 platform fee, GBP3.35 actual Stripe test processing fee, GBP87.65 provider transfer. Cosmetic inspection produced the same split. Delivery kept its existing GBP91/GBP9 split. Premature customer release and provider completion-before-start were rejected.
- All three paid application jobs were fully refunded with actual sandbox transfer reversals. Repeating refund resolution returned alreadyResolved. Unpaid customer cancellation expired checkout and cancelled the job; unpaid provider cancellation expired checkout and reopened the job, then the synthetic customer cancelled it. No successful application QA charge remains unrefunded.
- Delivery refund: `re_3UduhO8OCSU5yHod0Tlvg3A7`; native combined refund: `re_3UdutM8OCSU5yHod1zmiHEU0`; cosmetic refund: `re_3UdumG8OCSU5yHod1qhnOoW0`. All are test-mode records.
- Refund execution used the real compiled service layer, Prisma and Stripe. Synthetic cookie-only admin HTTP resolution was correctly rejected because it requires a current secure login. Do not count service-layer refund coverage as admin browser/native acceptance.
- Admin card customization was exercised on-device with an isolated local ADMIN role fixture: deselect Users, select Trade services, Save, reopen dashboard (persisted), modify then Cancel (discarded), Reset to defaults and Save (verified in database). Original local role/preferences restored; production identity/settings were untouched. The website-opening admin tools still require the website's own authenticated admin session.

### Website-led homepage update

- User explicitly requested the app homepage match the approved website. Draft PR #937 targets the combined QA branch, with production-safe native-only homepage changes at `fa7011785359c5fa286cdb44f6ecebf4c1f22f62`. The website was not modified.
- Reuses the exact approved £1 scene, ten vehicle layers, colours, typography and animation timing. Native sale/valuation buttons, AI panel, fee strip, real discovery/body photos, matching category filters, benefits, steps, partner account information, live article feed and business spotlight are included. The old hero is removed from rendering.
- Artwork is bundled; the decorative scene has no network/auth content. Motion stops offscreen/background/unfocused and respects reduced motion and pause. Text/navigation remain native.
- Native TypeScript passed. Internal sandbox APK #146 / run 44778035601 is compiling source `a76be288aec7e6603e49220b438aa7165f806803`; device visual/navigation acceptance remains pending at this checkpoint.

Remaining: private uploads, real provider onboarding, email/push delivery, other transactional role journeys, smaller phones/iOS and all untested rows in the route matrix. Draft fixes have not been published to customers. Automated tests, API integration and device interactions remain distinct evidence layers.

## Homepage and correct customer-app provenance — 20 November, 17:09–17:30 GMT

The owner explicitly identified the website download as the authoritative customer app. Retrieved /api/app-version and /download-app: both advertise version 1.0.0 / versionCode 105 at https://www.carmazium.com/downloads/CarMazium-1.0.0-v105.apk. Downloaded the actual 99,114,490-byte APK; SHA-256 755574e857c6789ae187345e2780531fa5a30eafe2ba94161decbca98301b3e0 exactly matches the website and GitHub release asset digest. Release notes identify source 4ff05829990bed2095bf4660cade3b38d9fe930f. The current homepage work descends from this source (not an unrelated application). The release tag itself points to a later main commit; the release's recorded build source is the evidence used.

Pulled the actually installed production-package APK (uk.carmazium.app): versionCode 108 / versionName 1.0.0, SHA-256 51e3029fef9728c1f8eda076feeddfedd75e0d7f7d53d39ce7752455d02db303, 99,115,270 bytes, identical to the verified build-108 candidate retained on the laptop. Its signing certificate SHA-256 and the website APK's are both ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24. Certificate extraction confirms identity; prior candidate CI supplied cryptographic APK-signature verification. No downgrade, uninstall, data clear or public-download change occurred.

The homepage is currently tested in the deliberately separate uk.carmazium.qa localhost sandbox app. Workflow numbers (#146 etc.) are NOT customer Android versionCodes. Customer build 108 remains installed separately. Compared native source against build 108: chat presentation and tests, non-dealer LiveScreen, and My Offers navigation are byte-identical; ChatScreen retains all 108 fixes with the additional reconnect/focus-refresh work. The assembly branch had forked before backend PR #929, so restored its three exact policy/evaluation files to the isolated QA baseline. These already-deployed production fixes were not new website changes. Local backend compiled 511 files; all 56 policy tests passed; restarted only the loopback API and verified health 200, informational coordinated reward question false for staff handoff and explicit payout request true. The initial npm build encountered the running Prisma DLL's Windows lock; building with nest without regenerating the unchanged schema succeeded.

### Homepage #146 device acceptance

Run 44778035601, source a76be288aec7e6603e49220b438aa7165f806803, artifact 14650639563: ZIP SHA-256 153b9a0f9b2ca73d3d69c0648e0a9f7811327ad8c75d3325893df2ec0e0d38d8; APK SHA-256 0d062aaa8c0f52d77b98671968838e1be22697e1733e947c646f4d156a9a2896 (97,144,932 bytes). Both laptop checks matched build evidence. Installed in place with adb install -r; first install 14:39:37 retained, update 17:09:14. Build and Android 15 cold-launch jobs both passed.

- Actual BlueStacks screenshot width 540 at density 240 (360dp) using wm size 960x540. Original size still must be restored after narrow-device testing.
- Website-derived artwork renders locally in the native home, including the vehicle cycle, £1/road scene, Poppins heading, matching red/navy palette and theme-aware dark scene. Light and dark both observed. Pause held the campervan still across leaving Home and returning; Play control was shown.
- Retail CTA opened SellCarFlow with Retail £1 selected, auction CTA opened Auction FREE selected, valuation opened SellLanding. No listing submitted.
- AI example '7-seat family car' populated the native input. Existing AI generation was not exercised against the deliberately keyless sandbox.
- Three discovery links correctly replaced each other's filters: hatchback = 1, seven seats = 1, Electric/Hybrid = 1 from three synthetic fixtures.
- All eight body-type cards opened Search. Expected fixture counts: coupe 0, convertible 0, hatchback 1, MPV 0, pickup 0, saloon 0, SUV 2, estate 0.
- Category links: sporty 0 with search text, Eco-friendly 1, seven-seater 1, affordable SUV 2, first car 1, dog-friendly 0, fuel-efficient 0. Automatic reproduced 0 instead of 2 due to label-case mismatch; corrected the new native category to AUTOMATIC.
- Reproduced Explore Full Marketplace retaining the previous estate filter. Corrected all homepage unfiltered browse/see-all actions to send a fresh route marker, so Search resets previous category/text filters.
- Synthetic marketplace card opened full native vehicle detail; How It Works, Pricing, and TradeXchange links opened their native screens.
- All eight new website guide/partner/terms destinations returned HTTP 200; this checks destination availability, separate from in-app external navigation.
- No full app certification or production transaction claim. The broader route matrix and transactional limitations still apply.

Corrective workflow #147 (44782763101, source 1fe2ce7e1a3e3c7e601b2208127cea348d7963b6) was cancelled after the second navigation defect was reproduced. Replacement #148 (44783680229) is compiling source 4fcce13893d3bc7764996f8fa3e27065f6753d28 with both corrections and the aligned backend. Verify the final artifact and retest before considering these two failures closed. Full native TypeScript passed after both changes.

Homepage draft PR #937 remains six native files over the aligned QA baseline; no website code was modified for the homepage request. Current homepage source 596d07f52ffeb06f7ffc371128cde5d3dd1d64da. No customer release, Play publication, production OTA, or live Stripe payment.

## Website-led homepage final filter retest and additional seller finding — 20 November, 17:31–18:00 GMT

- Homepage footer checks on #146: Partner Account opened the correct become-a-partner website page; Guides opened the live blog directory; Resolve Automotive opened its correct business profile. How It Works, Pricing and TradeXchange opened native screens. Privacy opened the native policy container with the current website policy. These external views were read-only.
- Seeded one explicitly synthetic local blog article to test the populated homepage feed. Its title, excerpt and Read More control rendered at 360dp without a cover image. Removed that single fixture afterwards (delete count 1). No public article was published.
- About page still contained obsolete 50,000+ users / £200M+ traded figures and blanket verification claims absent from the website. Native-only draft PR #938 replaces these with the current website story, platform roles, buyer/seller/business information, contacts and five FAQs. TypeScript passed; updated device acceptance is pending the combined build.
- Remote Desktop briefly stopped responding around 17:35 and recovered at 17:37; later calls also occasionally returned deferred results. Pending calls were polled instead of replaying mutations.

### Homepage fixes verified in #148

Workflow 44783680229 / #148, source 4fcce13893d3bc7764996f8fa3e27065f6753d28, completed build/signature/package verification and Android 15 cold launch. Artifact 14655321235 ZIP SHA256 4613db6534c2dd4f212870c15078478836e9a987c96a12eab574ba20243df574; APK SHA256 f1add93ef7c7ae90035b025cce1050ad71596105c6e4bfa8e53536bd1fb8a592, 97,144,960 bytes. Both laptop hashes matched CI. Installed with adb install -r: firstInstallTime 14:39:37 retained, lastUpdateTime 17:54:40. Login retained. Original customer package 108 remains separate.

- Automatic category now returns the two automatic fixtures rather than zero.
- More cars / See all clears Automatic and returns all three active fixtures.
- Estates returns zero with one filter; Explore the Full Car Marketplace clears it and returns three with no filter.
- Under £15k returns two; homepage Prefer filters? Browse all cars clears that quick filter and returns all three.
- These are actual native button interactions at 360dp, separate from the source-only checks.

### Newly reproduced seller offer history defect

In the local sandbox, created listing e295b8e7-e893-4f7c-a600-c2d0c4fda3a6 (Synthetic QA offer actions) owned by the native buyer/seller and two synthetic buyers. On #146, Incoming Offers showed both pending cards. Zero counter amount correctly displayed validation. A £7,200 counter persisted for the £6,500 offer. Accepting the other £7,000 offer correctly changed it to ACCEPTED, rejected its sibling and set the listing OFFER_ACCEPTED. However, both cards disappeared and the app falsely displayed No offers received; Mark as Sold was unreachable.

Cause: SellerOffersScreen fetched /dashboard/seller, whose summary intentionally includes only PENDING/COUNTERED. Native-only draft PR #939 uses the website's existing /offers/received endpoint, retaining accepted and rejected history, full counter details and listing status. Normalizes decimal-string amounts before arithmetic; loading failure now offers retry instead of an empty inbox. No website/backend change.

Three rendered-screen regressions passed: accept-to-sale completion and duplicate-sale prevention, decimal counter arithmetic, and failure/retry. All 42 native script tests and full native TypeScript passed on the combined local source. Device acceptance of this new offer fix remains pending; do not mark the sale-completion flow passed yet. The synthetic accepted listing remains local-only for the upcoming retest and is excluded from active public search fixtures.

About-only queued workflow #149 (44785459523, source 5332e4cf5c7e9f1f6add220ad88bd11b8f08a88e) was cancelled before compilation so the newly found offer fix could be included. Combined workflow #150 (44788018987), source 304056369956249b40d1fbd6fa1a02f5265edd25, is compiling the homepage, About and offer fixes. Verify its artifact and perform native acceptance before closing those items.

No customer APK, Play release, production OTA, website edit or live payment was published. Emulator size remains temporarily 960x540 at density 240 for narrow-width testing; restore it after final acceptance.
