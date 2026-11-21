# Website/app comparison — 21 November 2026

The requested acceptance target is the same options, pages, labels, workflows and dashboard presentation as the live website, implemented in the original native app. A menu or file existing is not evidence that a workflow is equivalent. This is an incomplete comparison and an initial dashboard correction, not full-app sign-off.

## Baseline and laptop observations

- Website source baseline: main `7abd37badf761f1bdbdafca8d8eeaedcb093172c` (PR #946).
- User laptop: DESKTOP-LPIB4R3, BlueStacks emulator-5554.
- Installed production identity initially build 110, then user upgraded to build 111; package `uk.carmazium.app`, versionName 1.0.1. No uninstall, clearing data or replacement package was performed by this work.
- User signed in to PULSE CARS LIMITED in both native app and **Chrome inside BlueStacks**. Both use the same 900×1600 portrait display (240 density, 600dp content width). Desktop Chrome is not the mobile acceptance reference.
- Compared live mobile dealer home, Customise, Stock, Customers and Purchases. Dealer cards have the same 20 destinations. Reset layout is present; live reset/hide/reorder round-trip remains to verify on the updated candidate.
- Stock: both return 48 vehicles; the first Audi A1 has the same £10,495 asking price and 65 views. Website mobile action menu includes view, boost, auction conversion and delete. No listing mutation was submitted.
- Customers: both show 0 new / 2 active / 0 follow-up / 0 sold. App hides later stages in a horizontal strip; web wraps all six stages.
- Completed Purchases: website shows 12, app 111 shows 10. Two owner-confirmed recovered acquisitions are missing from the native request. Collected retail sales are also incorrectly relabelled Purchased by the native status mapper.
- Current app 111 is the prior PR #946 candidate. None of the new branch changes are installed or published yet. Screenshots are laptop-local comparison evidence, not acceptance of the new code.

## Confirmed mismatches and corrections in this branch

| Area | Website/current app difference | Correction |
| --- | --- | --- |
| Personal dashboard entry | Website has a combined buyer/seller home. Native BUYER opens a separate cards-only screen while SELLER opens a bespoke profile/dashboard. | Both entry points use the same native personal home, website header, My Dashboard title, task panel and existing configurable cards. |
| Buyer who also sells | Native seller follow-ups were either absent or restricted by original account role. | Read the same authenticated owner-auction and summary sources for all personal accounts. Backend permissions remain authoritative. |
| Delivery requests | Website includes pending delivery requests in its attention list; app home omitted them. | Fetch received requests and open the existing native delivery-request screen. |
| Task wording/order | Native task text and ordering drifted from the website. | Generated native copies of the website's pure personal/dealer attention rules; CI compares them against the website sources. |
| Provisional offers | Native showed only a count and general destination. Website names the vehicle and its UK decision deadline. | Same vehicle-specific copy and direct native auction navigation. |
| Dealer buyer fees | Native read only the first 50 won auctions and showed a count. | Use complete paginated won-auction retrieval, website vehicle/deadline copy and native purchases destination. |
| Dealer handover eligibility | Native simplified condition could request handover before the buyer fee was paid. | Use the website seller-stage rules through the shared attention builder. |
| Failure/retry | Missing data could hide checks or look like no work. | Independently settle sources, show successful tasks plus a failure notice, retry all checks and never display all-clear after a failed/malformed source. |
| Permissions/focus | Dealer checks could run before access resolved; personal tasks did not refresh after returning. | Wait for dealer permission loading, skip forbidden collections, refresh on focus and invalidate stale requests. |
| Card alignment | Dealer cards had an extra nested horizontal inset. | Remove the extra outer inset while retaining heading/task spacing. |
| Blog manifest | Existing native blog screens were incorrectly declared web-only. | Record the existing native implementation; this does not itself certify content parity. |

The native personal delivery link goes directly to BuyerDeliveryRequests; the web attention action currently points at the seller offers page. The shared rule retains the website's wording, while the native action resolves to the existing delivery workflow.

## Same-emulator comparison corrections

- Match dashboard gutters, card widths/gaps, title sizing, attention panel and green all-clear presentation. Shared buttons now use the website's rounded geometry, sentence case, readable text and neutral outlines instead of the app's red bevelled uppercase outlines. Correct purchase, auction and verification icons.
- Stock: match page heading, import ordering and result count; show the asking-price/auction-estimate distinction and engagement bar; expose Withdrawn separately. Existing native grid view and truthful transmission/lead data remain available.
- Customers: wrap every stage with no horizontal hiding and include the matching explanatory hint.
- Purchases: shared site header, page title/subtitle, stage→search/type→auction actions order, Refresh and Browse live auctions controls. Fetch recovered records, native recovered detail, authenticated PDF download/share for server-confirmed collection records, and correct status precedence.
- Failed purchase sources preserve successful records, report incomplete data and provide retry. Invalid/over-limit pagination fails explicitly. Unknown historical prices remain Not recorded; no sale or payment data is invented.
- Regression tests exercise the real purchase screen with ten regular plus two recovered records, native routing, unknown-price display and partial failure. The updated APK still needs the same-account comparison proving the live count is 12 and that PDF preview works.

## Confirmed outstanding scope

AdminDashboardScreen still opens these 12 first-party destinations in a browser:

| Menu | Website route |
| --- | --- |
| Messages | /dashboard/admin/messages |
| Auctions | /dashboard/admin/auctions |
| Sale Cancellations | /dashboard/admin/cancellations |
| Transactions | /dashboard/admin/transactions |
| Vehicle History Reports | /dashboard/admin/hpi |
| Free Listing Grants | /dashboard/admin/free-listings |
| All Dealers | /dashboard/admin/dealers |
| Trade Services | /dashboard/admin/services |
| Analytics | /dashboard/admin/analytics |
| AI Reports | /dashboard/admin/ai-reports |
| Marketing Popup | /dashboard/admin/marketing-popup |
| Blog | /dashboard/admin/blog |

Other admin differences: account detail/list pages direct management actions to the website; handover reward payment controls remain on the website; listing review references the website vehicle-history queue. These are not fixed by this branch.

Still required: authenticated dealer and buyer/seller page-by-page comparison; complete admin and partner parity; listing/editing, filters, offers/bidding, purchases, services, settings, messages and notifications acceptance; mobile light/dark and large-text visual review; correct-account native upgrade testing; iOS verification; production download/automatic-update verification for the final candidate. The public/personal forms and marketplace pages have not all been visually compared. No completion percentage is asserted.

The existing product-parity check verifies file presence plus selected business contracts. Passing it must not be presented as all-page functional or visual parity.

## Validation

- 778 repository tests passed.
- 57 native/component tests passed, including actual personal and dealer screen rendering against controlled data, role permissions, native destinations, partial failures, retries, malformed responses, delivery requests, buyer-role seller tasks and correct handover eligibility.
- Native TypeScript passed before final packaging; final validation is recorded in the PR.
- Website and native dashboard-card catalog remains unchanged and matching.
- No live listings, offers, bids, account profiles or financial transactions were created or changed.

## Continuation

Use the existing original package and the user's correct signed-in laptop sessions. Continue the authenticated same-emulator comparison and install a signed candidate before claiming the fixes verified on device. Preserve the explicit outstanding admin list. Do not confuse a successful candidate 111 with an APK containing this branch.

## Same-emulator business-page follow-up

Compared build 111 and signed-in Chrome inside the same BlueStacks display. Mobile website captures are under the laptop's `qa-dashboard/parity-pages`; native captures include `parity-native-finance-open`, `parity-native-earnings`, and `parity-native-analytics`.

- Team: restored business service approval states, payout policy/readiness, eligible approval actions, visible invitation button and role totals. Existing individual permission toggles and invitation handling remain. No live staff permissions or service applications were submitted.
- Finance Calculator: matched page title/header/card and explanatory copy; failed preference loads now stop the spinner and offer retry without showing a false Off setting.
- Earnings: restored four metric cards with accurate Average Sale Price wording, sales/auction/receipt tabs, all auction records (no five-row truncation), registration and price differences, and filtered CSV with pennies and spreadsheet-formula protection. Receipt PDFs use authenticated transaction routes; historic KYC payments are deduplicated and synthetic entries remain non-downloadable.
- Analytics: build 111 incorrectly hid the whole report when the selected period had no sales, despite 48 active stock and available lead/inventory metrics on the website. Valid zero-sale reports now render. Restored missing metrics, all top vehicles, model/mover/source/channel/area/team sections, 7/30/90-day and validated custom ranges, and CSV export. Stale requests cannot overwrite the selected period. Native charts still require on-device visual comparison; this is not a pixel-parity sign-off.
- Added persistent, permission-filtered dealer destinations to these four stack pages.

Validation: 778 root tests pass; native TypeScript passes; ten new component/contract tests cover zero-sale analytics, all auction rows, date validation, stale responses, filtered CSV, native authenticated receipts, KYC deduplication, approval visibility and failed preference retry. The existing 57 native tests also passed before the final three analytics tests were added. APK 112 is building from PR 947 and **does not include this follow-up**. These changes need a subsequent signed build and actual emulator acceptance. Buyer/seller, admin, remaining dealer/services pages and iOS remain outstanding.

## Same-emulator buying-page follow-up

Build 111's Saved page shows zero auctions while the same dealer in emulator Chrome shows three. The native Saved page filtered the general retail watchlist instead of reading `/watchlist/auctions?view=all`. The dealer page now uses the exact auction feed, includes ended records, and switches to the separate paginated retail feed. Opening an unavailable/ended saved vehicle never removes it; removal is an explicit action.

The Bids & Offers page displayed a cramped horizontal row that hid the vehicle title/status, extra summary blocks and a Create Auction button. The native bid card now follows the mobile website's image, status, title, specification, price, bid-count and action layout. It exposes the existing current-bid cancellation with deadline checks, staff bidding permission and explicit confirmation; cancellation refreshes authoritative positions rather than guessing which earlier bid becomes active. No live bid was cancelled during QA.

Four additional component tests cover real feed selection, three ended saved rows, native detail navigation without removal, explicit cancellation confirmation and permission/deadline restrictions. Native suite: 71 passed. Native TypeScript and source parity checks pass. Updated legacy source assertions follow the extracted bid-card component. On-device validation requires the next signed build; this is not a complete parity claim.

## Same-emulator inbox and received-offer follow-up

The same account shows 26 conversations in both clients. Native Messages now has the mobile website's All, Unread and CarMazium support filters, clear support identity, profile images, list styling and persistent dealer navigation. Removed the duplicated back header. Filtering does not mark conversations read or send messages.

The one received offer is WITHDRAWN on the website but was labelled PENDING in build 111 because its status map omitted terminal statuses. Added Withdrawn/Cancelled and a truthful unknown-status fallback, plus website totals and header. Failed loads now show retry rather than false empty success. Mark as Sold starts from the negotiated final amount and includes the website's validated optional buyer postcode. No live offer responses or sale records were submitted.

Four new component tests cover inbox filters without side effects, withdrawn state/actions, failed-load recovery and final-price/postcode submission against mocked endpoints. 75 native tests pass; the full 778-root-test run had one outdated exact-padding assertion, which was updated for the persistent footer and its six-test file passed. Native TypeScript and source parity checks pass. Build 112 was installed in place with original package, UID and install date preserved; updated inbox/offer pages require the next build.

## Original-package build 112 acceptance and service-page follow-up

Build 112 was installed over the original `uk.carmazium.app` package on the laptop. Signing certificate, UID and first-install date were preserved; PULSE CARS LIMITED remained signed in. The live Completed tab now shows 12 purchases. Searching CA18POF finds the recovered Nissan Juke, opens native original-seller/collection details and downloads its PDF to Android's share/save chooser. No external sharing occurred; a PDF viewer preview has not been validated. Build 113 is running from main `3892bf16c9922f8b52e7de874d77c711b7767090`, which includes PRs 948–950 but not this service follow-up.

The emulator Chrome pages previously captured at “Checking your account” now settle successfully for Guest Enquiries, Partner Dashboard and My services. They were loading-state captures, not demonstrated route failures. The native Partner page differs substantially: duplicated dealership preference switches, a different heading and no Vehicle Dealer add-on. It now follows the website's Partner heading, business-settings link, three add-on cards, business payout state and team section. Existing service preferences remain in Account Settings. Job messages remain available from Service Jobs instead of duplicate Partner-home shortcuts.

My services now includes the website's read-only dealer business fields, payout state, declaration/insurance labels, matching links and per-service jobs actions. Applying a service opens its returned native verification page; a missing or mismatched capability is rejected. Failed reads remain visible with retry and cannot enable an application from an unknown status. Guest enquiries and native information/finance/warranty pages now share the website-style top bar instead of a bespoke Back-only header. No live service applications, staff changes, business preferences, payments or messages were submitted.

Validation: native TypeScript, 79 native tests, 778 repository tests, product-parity guard and Android Metro export pass. Four new component tests cover read-only business rendering, all three native add-on destinations, pending setup without repeat application, failed status handling and wrong-service responses. On-device acceptance of this follow-up requires a later signed build; full parity remains outstanding as listed above.

Additional acceptance: build 112's dealer dashboard hide → Done → Customise → Reset layout round-trip restored the original Add Vehicle card. Dark stock and Customers screens retained readable content and the expected 48 stock / 2 contacted customers. Android's live font-size change produced transient text-layout clipping; a full app restart at 140% rendered the full messages correctly. The one-column threshold is now 130%, accounting for Android's rounded 1.399999976 font-scale value. Emulator font size was restored to 1.0 and appearance to Light.

Service Jobs now uses independent Available/My Work reads and counts, preserves accepted work when new-job verification expires, guards against stale pagination after refresh, deduplicates pages and exposes retries. Added the mobile site's descriptive heading, refresh, customer post-job and overview actions. Source status labels follow the website. The existing Delivery/Inspection filter and native job-message destination are retained. Two component regressions verify expired new-job approval with existing paid work and late pagination; a further test verifies large-text full-width cards. Native tests: 82; root tests: 778; completed native TypeScript and product guard pass. CI caught two invalid palette property names in the first service commit; both are corrected to the existing theme token before merge.

A further missing destination was confirmed: `/dashboard/service` is a distinct Provider overview (live dealer: 2 approved services, 0 available jobs, 0 active jobs, £0.00 released). Added a native overview with the four authoritative metrics, fully paginated earnings, recent assigned work, setup guidance and native navigation. Available Jobs now opens this actual overview and provider navigation exposes Partner Home / Service Overview / Available Jobs / My Work. Post a job offers a Delivery/Inspection choice. A component regression verifies complete multi-page earnings and independent partial failures; native suite now 83 passed. Native typecheck, root 778 tests, parity guard and Android export completed successfully before this final non-submitting service-choice dialog.

### Build 113 and personal-dashboard comparison (21 November, 03:30 London)

- Build 113 installed in place on the original `uk.carmazium.app`, UID 10064, preserving first install 20 November 11:36:34 and signed-in PULSE CARS LIMITED. Source `3892bf16c9922f8b52e7de874d77c711b7767090`, APK SHA256 `8c1696662db3875e4d25071dc3bc962955bab12d1847b2d63a99264d9a527ab1`. Public download has NOT changed.
- Live emulator confirms 3 saved dealer auctions including ended records; Finance Calculator reads On; Messages 26 with All/Unread/CarMazium support filters; Unread correctly says no unread conversations; received offer now WITHDRAWN rather than Pending.
- PR951 merged after all 5 Actions and 2 Vercel checks passed. The sole final CI failure before that was the dashboard accessibility knowledge-source fingerprint, reviewed and refreshed without policy changes. Merge `92be8b5dd1da0e1f26547ddfed09040d3f221b15`.
- In emulator Chrome, personal dashboard shows 48 listings, 97.2h response time, no reviews and 12 recent listing view rows; earnings £701.00 / 1 sale; 5 saved retail vehicles. This is dealer-account personal preview, NOT acceptance on an actual separate buyer/seller account.
- Personal app changes: website performance metrics and all recent bars; no invented trend charts; personal scope preserved. Earnings gets website header, three metrics including average price, exact pennies, native receipts and real vehicle photos. Released auction bonus history remains available without the previous five-row cutoff. Payout setup remains in canonical Account Settings.
- Saved dispatch now respects preview role while retaining actual dealer permissions for auction access. Personal cards default to responsive large photos, Make Offer and View listing. Explicit Make Offer opens the existing native form only after reading current offer state; it does not submit anything. Grid card opening no longer deletes unavailable saved vehicles. Hydration errors are visible, retain prior hearts, reject repeated pagination and ignore stale/account-changed responses.
- Local verification at this checkpoint: 88 native tests, 778 root tests; native typecheck; product parity and 72 knowledge fingerprints. Metro export and final CI tracked separately. These code checks are not visual acceptance. Newly changed personal pages still require installation of the next candidate.
- Outstanding browser retries: personal cars/offers, warranties and legacy buyer offers timed out; do not count these as accepted. Settings, admin-only pages, actual buyer/seller account, iOS and public APK/update publication remain outstanding.

### Mobile Analytics visual correction

The paired emulator screenshots revealed that the native analytics metric cards were still two columns at 600dp while the website KPIGrid uses one column below 768 CSS pixels. Align the breakpoint (three columns from 768, one at enlarged type), icon colors, trend chips, heading size and mobile header spacing with the actual website source. This visual correction is additional to the verified data fix. PR952 personal pages merged after all 3 Actions and 2 Vercel checks passed, merge `32560b6542edb49e9f3075d17c43399c2a0ff2d3`.

Browser retries completed in foreground emulator Chrome: My cars has 48 listings across five pages with all status filters; personal Offers Received groups one Toyota offer; warranty orders explicitly empty with Get a warranty quote; legacy My Offers has 23 historical offers. These retries establish website references only.

### Personal cars, received offers and purchase records

Same-emulator comparison exposed missing direct listing actions and recorded purchase history in build 113. My Cars now has the website's large-photo cards, actual price/views/date, Withdrawn and Rejected filters, import/new-listing actions and ten-row pagination. Mark Sold opens the existing native confirmation form; it never records a sale on navigation. Received offers now group by vehicle and expose the native delivery-request panel, retaining accept/counter/sold flows.

Purchases now reads authoritative recorded vehicle purchases, displays collection dates and completed accepted offers, and separates vehicle prices from purchase-related platform receipts. The collection action uses the existing endpoint only after an explicit physical-receipt/payment attestation. Duplicate submissions are blocked. Live account mutations were not performed. The warranty-order empty state and native quote button were confirmed in build 113; its shared-header correction is queued for the next candidate.

Validation: 91 native component tests (including three new pagination/purchase/collection regressions), all 778 root tests, completed native TypeScript, product parity, 72 knowledge fingerprints and Android Metro export passed. PR953 mobile Analytics correction merged as 5e1766e5a4d6c6a7a6210a2d6c6dfa07ca36fe1c. These personal changes and PRs951–953 still require build114 installation and visual acceptance. Public download remains unchanged; full app parity is not yet complete.

### Personal outgoing offers and bid-permission parity

Build113 in the emulator mixed all 23 historical offers into the current list. My Offers now follows website Current/History/All/Accepted/Rejected/Cancelled views, counts, native delivery/bid destinations, vehicle photos and exact currency. Added the missing pending-offer amendment form using the existing PATCH contract and 70% asking-price minimum; no amendment is submitted until Save. Completed purchases have truthful wording. Native vehicle navigation loads the full listing first. Invalid reads show retry, not a false empty list.

Personal-preview Auction Bids was dropping dealer permissions because it inspected preview role. It now reads authoritative accountRole and still requires returned PLACE_BID/PAY_AUCTION_FEE permissions; non-dealers are not granted access. The native page uses website header/title, full count, vehicle images, exact currency/date and its existing ten-row history pagination. Confirmed cancellation remains explicit and duplicate-protected. No live bids were cancelled or amended.

Validation: 95 native tests including four new behavioral regressions, 778 root tests, completed native TypeScript, product/knowledge guards and Android Metro export pass. PR954 merged after all four Actions and both Vercel statuses succeeded. This outgoing-offer/bid correction still needs signed-candidate visual verification.

### Account Settings field follow-up

All nine website settings sections were captured in foreground emulator Chrome. The app's live business form lacked opening hours; personal form lacked postcode/location. Added those authoritative fields and all seven days, optional VAT behavior matching web/backend, public-profile navigation, crop-on-selection and explicit profile/logo removal. Logo upload now persists immediately like the website. Failed account reads disable profile/business saves instead of replacing unknown saved fields with defaults.

Validation: 98 native tests (three new settings behavior regressions), 778 repository tests, completed TypeScript, parity/knowledge checks and Android Metro export pass. No real account fields, photos, bank details or preferences were saved during QA. Website's existing-image display adjustment and guided-tour replay are still gaps; these are not represented as complete. Build114 is compiling from b1502e1442ee34ff6cf1c23eb0630dbe8708f40e and excludes this later settings change.

The image-display gap above is now implemented using the website's exact non-destructive `#cm-view` contract: Fill frame / Show full image, zoom, horizontal/vertical positioning, Reset and explicit Save. Settings and the public seller profile render the saved presentation. Selecting a new photo opens adjustment instead of destructively cropping the original. Tests verify identical encoding and failed-save retry without losing the original image. Final local validation for this follow-up: 100 native tests, 778 root tests, completed TypeScript, guards and Android Metro export. Guided-tour replay remains outstanding; new display controls still require device acceptance.

### Public retail search, compared inside the same emulator

Emulator Chrome and build113 both return 716 vehicles, but build113 omitted the website's promoted section. Native search now pins the complete featured endpoint only for the unfiltered first page in default sort, deduplicates cards, uses the website's ten-row Previous/Next pagination and exposes title, banner, history-report and warranty navigation. Filtered/search/sorted/later pages cannot receive unrelated promoted cards. The native warranty action opens the quote form; vehicle prefilling is not claimed.

Behavioral tests execute the actual pagination callback: failed loads retain prior cars, retry requests the failed page and clears errors, and late responses cannot overwrite newer filters. Validation: 105 native tests, 778 repository tests before the final retry follow-up (13 affected root tests rerun successfully), completed native TypeScript, product/knowledge guards and Android Metro export. PR956 merged as 69c29250ad43d1d21a94b8449b0fb6ef7dc0ffa7. Search and Settings require a later signed candidate than build114. This is not a claim of full visual or functional parity, separate buyer/seller-role acceptance, iOS acceptance or public APK publication.

### Contact enquiry and listing-linked warranty quote

The paired emulator comparison confirmed Contact was missing the website's four-field enquiry form. Added native Full Name, Email Address, Subject and Message with matching limits and an explicit Open email draft action. It validates required/email fields, encodes the draft and preserves entered text if no mail app is available. It does not send messages automatically. The shared website header replaces the old Contact-only bar.

Retail warranty actions now appear only for ACTIVE CLASSIFIED listings and carry the listing ID into the native quote form. The form reads the same /warranties/listing/:id endpoint as the website, displays the vehicle title and details, prevents quoting before that read finishes, preserves edits made during the read, and includes the validated listing ID in the quote. Unavailable listings expose manual standalone fallback. No live quote, message or payment was submitted.

Verification: completed native TypeScript, 109 native tests (four new form/prefill behavior tests), 778 root tests and product/knowledge guards. Signed-device acceptance is still pending; these are source-level checks. The Contact page and listing-linked warranty form are additional to PR957 search corrections.

### Customer and Trader Pricing follow-up

Same-emulator Pricing comparison found missing package CTAs, all six customer FAQs and the separate Trader Pricing destination. Added native package-selection actions through valuation into the listing wizard, preserving Standard/Premium selection while keeping auctions Free and edits authoritative. Restored the website header/heading, larger mobile prices, improved card spacing, truthful add-on copy, expandable FAQs and signed-in Partner Account destination. Added a native Trader Pricing page with the £125 winning auction fee, 72-hour deadline, £0 retail fee and native browse/partner/customer-pricing routes. No checkout or listing is submitted by opening these pages.

Validation: completed TypeScript, 111 native tests plus the added valuation/tier handoff regression (three Pricing tests passed), all 778 root tests, product/knowledge guards and Android Metro export. Two old source guards were updated for the new optional selling package parameters; the new behavior is exercised directly.

Build114 was installed in place from source b1502e1442ee34ff6cf1c23eb0630dbe8708f40e, package uk.carmazium.app, unchanged UID10064/first install/login. APK SHA256 1be2515af4f01ce5e760619dd2967fb26bc8f86d66fdcdecb685ce2af857ee71. Dealer Analytics now visibly uses one-column metrics at the emulator's 600dp width, matching the mobile website. Further visual checks continue. Public version endpoint was checked and still advertises111; no claim is made that these internal candidates reached the user's phone.
