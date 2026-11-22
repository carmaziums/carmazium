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

### Shared mobile typography and public-page headers

Computed styles in foreground emulator Chrome confirmed loaded Inter for body text and controls, with Poppins headings. Native body/control typography used Montserrat. Switched the three existing body font weights to bundled Inter assets, retaining Poppins and numeric fonts without adding dependencies or extra loaded weights. Shared NativePage inputs/body now explicitly use the same font. About, How It Works, Reviews and Compare now expose the shared site header. Trader Pricing includes its missing native Partner Guide link.

Validation: completed native TypeScript, 112 native tests, 778 repository tests, product/knowledge checks and Android Metro export. These final font/header changes still require signed-device acceptance.

Build114 device checks confirmed dealer and personal dashboard cards, one-column Analytics, partner/services/provider navigation, large My Cars cards, and the correct Mark Sold confirmation (cancelled without a sale). Received offers group the Toyota with its withdrawn offer. Purchases shows the same two completed agreed purchases and ten recorded purchases as emulator Chrome, including collection dates. These checks use the dealer account and personal preview, not independent buyer/seller-role acceptance. Public APK remains111.

### Automotive Guides archive

Paired emulator inspection found the app was only a sequential article feed. Added the website hero, nine evergreen guide shortcuts in three categories, Google source-preferences action, three native goal destinations, featured first article, category/date/reading time, research library and matching twelve-article numbered pagination. First-party article and marketplace destinations remain native. Failed loads retain the last successful page; retry targets the failed page, malformed data shows an error and stale replies cannot overwrite newer navigation.

Validation: native TypeScript, 115 native tests (three new archive behavior tests), all 778 root tests, parity/knowledge guards and Android Metro export. This newer source requires a later candidate than116.

Build114 further verification: personal Saved Cars shows five retail vehicles; Earnings shows £701, one sale and its date; Performance shows48 listings/97.2h/0%/no reviews; My Offers shows Current0/History23/Accepted2/Rejected15/Cancelled6. My Bids shows1703 bids across171 pages (171 is the page count, not bid count); Next successfully loads the second page and returns to its top. No account records were changed.

### Marketplace explanation and dedicated auction guide

The old native How It Works had three generic steps and omitted the website’s two six-step flows. It now includes the same seller/dealer explanations, qualifying-reward receipts, photographs, retail destination and clearly-labelled anti-snipe demonstration. Added a distinct native Auction Guide with seller/buyer tracks, all eight rules, three trust explanations, five expandable FAQs and native browse/sell/contact destinations. Generated copy is checked directly against the current website sources. Guides now links to the correct auction-specific page.

After the cloud execution workspace disconnected, the latest edits were recovered into the isolated laptop review checkout. Completed native TypeScript, 118 native tests and Android Metro export pass there. Product parity and all72 knowledge fingerprints pass after restoring repository-exact text bytes. The root suite contains Windows-incompatible shell/symlink fixtures; its Linux CI result is required before merging, rather than claiming the Windows run passed. No website source or account records were changed. Device acceptance for these final guide pages is pending.

## Reconnected emulator verification — 21 November, 10:20–10:35 London

- Original package uk.carmazium.app updated in place from 114 to 117; UID 10064 and firstInstallTime 2026-11-20 11:36:34 unchanged. No uninstall/data clearing.
- Candidate 117 source 31937d6c75aa41b7c9c4a4924de8fb8197d761eb; APK SHA-256 92023f321474c509fa1971139825e423d44bc19ba4b4a670c96b026b89e643e5, 100608118 bytes, original pinned signing certificate verified. Streaming ADB install stalled; that process was stopped and the same checksum-verified APK installed successfully from emulator local storage.
- Emulator restored to portrait. Chrome mobile pricing inspected at 900 physical pixels / 600dp. Browser is now signed into the user's personal account; the native app opened signed out. Requested dealer sign-in; retained app identity alone does not establish retained authenticated session.
- Build 117 public pricing has working native screens, but direct visual comparison found omitted Standard badge and four information blocks, differing package copy, heavy shadows, incorrect coloured price text, and differing typography/spacing.
- Follow-up corrects those observed pricing differences using website page structure, exact package facts, Inter 700/900 and Poppins 900, independent FAQ disclosures, and native tier navigation. Shared light-mode primary red and muted text now match globals.css; dark colours and logo assets retained.
- Automated pricing navigation/tier/FAQ checks pass; added rendered-package and website theme-token regression checks. Full native suite: 119 passed initially plus one test fixture path error; corrected test passes. Product parity check passes. Android export and CI pending at this checkpoint.
- Full native account-screen acceptance and customer APK publication remain pending. Public download has not been changed in this session.


## Marketplace gallery and automatic cover follow-up — 21 November 2026

On the same 600dp BlueStacks device, native build 117 showed only eight of the ten BMW 7 SERIES photos shown by mobile Chrome. Native result cards also lacked the website's offers label, specification chips, delivery badge and full-width details action. The original package remains installed; these changes are not yet a public release.

- Native galleries now retain up to 100 supplied photos, decode only nearby images, show the full counter and honor stored fit/position/zoom. Result cards retain native details, wishlist, warranty and gallery actions while matching the website's facts and layout.
- The native seller uploader now calls the same authenticated /listings/photo-cover-recommendation endpoint as the website after exterior uploads. It sends at most the first 30 source URLs without crop fragments and applies the same confidence threshold of 0.6. Service failure or an unclear recommendation leaves the order intact. Manual cover selection remains available.
- The exact photo order is retained across category tabs, edits and account-scoped saved drafts. Create and update requests submit that order, so the shared listing's first photo is the cover used by both clients. Partial upload failures retain successfully uploaded photos.
- Native automated suite: 128 passed, including gallery/crop/action tests and five cover-selection tests for successful recommendations, bounds, confidence, failures, metadata and draft/edit order. TypeScript and Android bundle checks are recorded separately.
- Live uploads/publication were not performed with the dealer's real vehicles. Final candidate emulator validation and public artifact publication remain pending.


## Reviews and body-type guide follow-up — 21 November 2026

Emulator QA found that the native Reviews screen still claimed all transactions ran through Stripe and referred to deposit/delivery protection. The current website instead explains direct buyer-to-seller vehicle payment and the limits of verification. The native page now reproduces the website's current review, feedback, payment and inspection content, with native navigation to search, how-it-works, pricing and the body-type guide. Feedback opens a customer-reviewed email draft only.

The body-type guide now includes all eight website illustrations, descriptions and checks, the same introductory and closing sections, native filtered search buttons and a preview restricted to genuine active retail listings. The optional preview failing does not hide the guide. Four new regression tests cover content, routing, all body types, filtered stock and outages. The existing 128 native tests passed; the new tests passed after correcting a test-only regex typo. TypeScript, product-parity and Android Metro export passed. The full native suite is now included in release certification.

Additional device evidence: build 118 installed over the original package with UID 10064 and first-install time unchanged; PULSE CARS LIMITED remained signed in. At 411dp, pricing cards/benefits/add-ons and the native Standard-package route were verified; two FAQ answers remain expanded. Dark-mode pricing was readable and light mode restored. At 411dp and font scale 1.3, dealer dashboard labels wrapped without clipping. No vehicle edit was saved.

A live advisory cover request using the BMW 7 SERIES's ten existing photos in reverse order returned HTTP 200, front view, recommended index 9, confidence 0.98. This request did not alter the listing. Final candidate installation and public download publication are still pending.


## Signed build 121 device acceptance and rollout hold — 21 November, 12:23–12:35 London

PR963 (automatic cover selection/gallery), PR964 (Reviews, body guide, Compare and card/gutter fixes), and PR965 (hardware Back retains current upload guard) are merged. All 135 native tests, native TypeScript, Android Metro export and required PR Actions/Vercel checks passed.

- Candidate run 44901631859 succeeded from ea97d10686ee771d212189768afd135cee423b08. Exact APK SHA256: 54142d23f9547bb522f4f72cfc6070d5e46f5267d449c35fbb416f4a1955a414; 101017998 bytes; versionName 1.0.1/versionCode 121; uk.carmazium.app; original pinned signer ea9b8d6733ee68d6e36ce092e81c0e360330a56dde9ed0b4edb2c421c8600f24.
- Installed in place over 119. UID10064 and firstInstallTime 2026-11-20 11:36:34 unchanged. PULSE CARS LIMITED initially remained signed in, and the dealer dashboard rendered at 411dp. No uninstall, data clearing or real listing/profile/offer/bid/payment changes.
- Compare: selected BMW 7 SERIES 2018, searched KIA and selected SPORTAGE, added Skoda Superb in slot three, inspected the horizontal specification table, removed the middle selection without shifting the remaining slots, and opened BMW native details. Three-slot selection/search/removal/details confirmed on device.
- Reviews: updated feedback wording and direct buyer-to-seller payment/verification limits confirmed. Body-guide link opened the native illustrated guide; Browse used SUVs opened native Search with one body-type filter and 202 results. Source/behavior tests cover all eight guide types; this is not a claim every illustration was individually captured on device.
- Gallery: Category NONE no longer displayed. Swiping over History Report Included advanced 1/10 to 2/10. Reached 10/10 and opened the correct tenth photo in the native full-screen viewer. Search/mobile gutters and updated vehicle facts confirmed.
- Automatic cover selection: five automated cover regressions and prior live advisory request with existing BMW photos passed (recommended front at index9/confidence0.98). No actual new photo upload or listing save was performed on the dealer's real vehicles.

### Blocking observation after restoring emulator display

Restoring the emulator from 411dp to its original portrait 900x1600/density240 caused an activity restart. The app then showed Login and a dashboard sign-in gate. A subsequent cold restart also showed Login. The initial in-place upgrade DID preserve the authenticated session, but persistent login after this later restart is NOT verified. Sanitized Android log checks did not establish a cause; do not describe it as a proven expiry, data loss or new regression. A fresh dealer sign-in and cold-restart check are required; if reproducible, investigate/fix session restoration before rollout.

Publication workflow 44904299402 succeeded, but its GitHub release id453677626 was returned to DRAFT while this check is pending. Do not rerun the publication workflow: the exact artifact already exists. After acceptance, publish that existing release (draft:false), restore production APK URL/hash to the exact 121 values above and redeploy latest main. Website deployment dpl_HUpmR6vSQerzEtLdrGwSEKVkFzpf was CANCELLED before completion. Production environment values were restored to build111; live /api/app-version was rechecked and still advertises111 with SHA256 c328d89008018ef454654c483cde2bb56d4597698c3054dc815e799d1630b755. No claim that 121 reached customer phones.

Emulator is left on the app's Sign In page at original display settings/light mode/font_scale1.0. The app's installed version remains121. No APK cleanup yet: retain original108 backup and final121; older review APKs can be removed after successful public-release verification. Final public-byte verification helper: C:\Users\Dell\CarMazium-Current\qa-public-apk-check.cjs 121 <SHA256-above>. Evidence screenshots: qa-dashboard\parity-build121-*.png and *-small.jpg on the laptop. No iOS acceptance, independent buyer/seller-role acceptance or complete page-by-page visual parity is claimed; guided-tour replay remains outstanding.

## Continuation: restart checks and native tour — 21 November

The user signed in afresh on installed build 121. The original package retained UID 10064 and firstInstallTime 2026-11-20 11:36:34. PULSE CARS LIMITED was present before and after two force-stop/relaunch checks, including a density-change/reset sequence. No uninstall or app-data clearing occurred. The earlier loss of login was not reproduced; its cause remains unproven. Laptop screenshot: qa-dashboard/parity-build121-login-restart-passed-small.jpg.

Source review separately identified Supabase 2.107 authentication subscribers awaiting getSession/signOut under the auth notification lock. Subscribers now defer their work and cancel queued callbacks on unsubscribe; startup/explicit login retains ownership of hydration while loading. This is a defensive correction, not a proven diagnosis of the earlier sign-in screen.

Native Account Settings / Personal details now offers Replay website tour. The tour uses the website's generated, parity-checked copy, native allowlisted destinations, Next/Back/topic selection/skip, the same introduction acknowledgement endpoint, and optional approved British-English narration through expo-audio 1.1.1 (SDK 54). Recording permissions are disabled. The native tour outlines the page viewport, not individual website DOM controls. No browser fallback, bids, forms or payment submissions are triggered by tour navigation. Dealer, buyer, seller and contractor route coverage is automated; admin and specialist tours remain outside this implementation.

Validation: 146 native tests and 778 repository tests passed, followed by 12 focused authentication/tour tests after adding the website-copy assertion. Native TypeScript and Android Metro export passed. Actual narration, tour layout and new-code session acceptance require the next signed build. Independent personal-account device comparison is ongoing. Build 121 remains installed; no new public APK has been published by this continuation.

### Independent personal-account follow-up

The user signed a separate personal account into both the native app and Chrome inside BlueStacks. Account identity was matched from the native account menu and website Account Settings, distinct from the dealer. Compared dashboard cards/attention, My Cars, received offers, Saved Cars, Purchases, outgoing offers and settings categories. The account has no listings, saved cars, offers, vehicle purchases or platform receipts; both clients agree. This verifies real personal-role access and empty states, not populated personal transaction/checkout acceptance. A force-stop/relaunch retained the personal session.

Corrected three small presentation differences locally: retail My Cars and Saved empty wording now follows the website, and the empty platform-receipts section no longer incorrectly says completed vehicle purchases will appear there. Added narration lifecycle tests (off by default, authenticated approved audio, topic/background cancellation and retryable load timeout). Final local validation: 150 native tests, native TypeScript and Android Metro export passed; the earlier 778 root tests and product-parity guard passed. No real listings, offers, bids, payments or profile fields were changed.

Automatic approval review rejected the GitHub push, stating that authorization/trust for publishing repository contents was not established. The local implementation commit is cf14b6e5d4cfa6cd74b55763e9ebdc079a5537fc plus the local follow-up changes. No alternate publication route was attempted. User approval is required to push these exact changes to carmaziums/carmazium, run CI, merge, build the next signed candidate and complete device acceptance before public release. Build 121 remains installed; live /api/app-version was rechecked and still advertises build 111 with the recorded hash. Installer cleanup remains pending successful release; keep original 108 backup and current accepted candidate.


## 22 November 2026 — real BlueStacks in-place build 125 review (additional evidence)

This is an **internal emulator audit**, not customer release certification. The signed build 125 under review is from GitHub Actions Android release-candidate run `44959012292`, original app package `uk.carmazium.app`, versionCode `125`, source commit `fb21a55cad7e9dd395878708f53f6024bfd5aebf`, artifact `CarMazium-Android-REVIEW-ONLY`. Its ZIP's embedded `release-evidence.json` SHA-256 was independently matched against the extracted APK before installing. No new application ID or debug APK was created. The repository is public: this artifact is explicitly for internal review, **not** a customer installer.

On authorised laptop `DESKTOP-LPIB4R3`, Android emulator `emulator-5554`, the APK was installed with `HD-Adb.exe install -r` **over existing build 111 without uninstall, data clearing or a second app**. Android reported `Success`, versionCode changed `111 → 125`, while original package `firstInstallTime` remained `2026-11-21 23:05:08`. This demonstrates OS-accepted in-place package/signing compatibility; it does **not** prove persisted login data because the emulator was logged out at test time. The local keystore password check could not open a copy of the private signing key, so local signing was not attempted or approved.

Same-emulator mobile Chrome (`www.carmazium.com`) and installed native build 125 were compared in the **guest Buy Cars flow**. Both showed `753` retail vehicles and a featured red 2022 Nissan Juke with consistent badges, sale-price content and photo count `1/34`. Search field, prominent red Search button, featured section and sort controls in build 125 are substantially closer to the live website than build 111. This is a **limited** visual comparison, not complete page-by-page parity.

**Confirmed outstanding defect in actual build 125:** On Nissan Juke's vehicle page, horizontal inline image swipe changed photo `1/34 → 2/34`. The fullscreen image viewer opened at `2/34`; horizontal swipes across the photo **did not** advance the photo, whereas the right-arrow button moved it to `3/34`. The fullscreen counter is present but swipe navigation remains broken in the shipped review binary. The Block 2 branch adds a bounded native touch-event fallback with swipe deduplication and retains pinch-to-zoom, arrows, and accessibility counts, plus a source regression check. **Neither this fallback nor the latest Block 2 changes are in the installed build 125** and therefore cannot be declared device verified.

The signed-in dealer, buyer/seller, service-provider and admin dashboard flows, tour with optional voice and replay, all native pages, dark/light modes, account persistence and original source-matched Android/iOS release identities remain **unverified on the new candidate**. The completed Block 2 source stages are in draft PR #983, not merged to `main`. Production website, backend deployment, public direct APK download and iOS distribution are **unchanged**. Do not promote build 125 as Block 2 completion or merge PR #983 merely because the old APK installed: a new exact-source original-signer versionCode **greater than 125** must be built and certified through both emulator and physical-device acceptance and a coordinated production release plan.
