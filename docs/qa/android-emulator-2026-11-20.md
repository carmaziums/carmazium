# Android emulator QA — 20 November 2026

## Scope and environment

Real CarMazium Android package `uk.carmazium.app`, version 1.0.0 / versionCode 105, running on the owner's Windows BlueStacks Pie64 emulator, signed in as a personal buyer/seller. Direct Android UI interaction through ADB, UIAutomator and screenshots. This is native-app testing, not a website viewport simulation.

## Observed in the installed build

- Home loaded signed in; dashboard opened the buyer view.
- Buyer dashboard hamburger opened the public website menu, leaving account tools inaccessible from that control. Account Settings remained reachable through the home account menu.
- Account Settings -> Contact Support opened the existing support transcript.
- Sent exactly two new QA questions: editing an existing car listing in the Android app, and auction eligibility for a non-dealer.
- Both questions received AI replies. The eligibility reply correctly required verified, approved motor-trade dealer access and directed private buyers to retail. The listing reply pointed to My Cars and explained that listing status may restrict editing.
- New sent messages and AI replies were outside the visible chat area; scrolling manually revealed them.
- Support links rendered as literal Markdown instead of tappable links. The floating shopping assistant covered part of the support conversation.
- Customer/AI/staff colours did not match the requested grey/blue/red scheme.
- Dark -> light switch and restart succeeded; signed-in session survived.
- Retail results loaded; Under £15k changed the count from 713 to 603.
- Swiping Hyundai IX20 card photos changed the counter from 1/8 to 2/8.
- Saving the Hyundai succeeded and it appeared in Saved. Saved card showed missing fuel and gearbox although retail search had Diesel / Manual.
- Opening that saved car passed a summary to the detail screen: missing fuel/gearbox/description and UNKNOWN seller information. It did not hydrate the full advert.
- Removed the QA-saved car; Saved returned to zero. No listings, offers, bids, purchases or payments were submitted.
- The empty Saved "Browse listings" action reached retail search during testing. Its source relied on navigation bubbling; changed to the explicit Tabs -> Search route. Interactive retest on the updated APK remains pending.

## Implemented fixes

- Explicitly follow new support replies, AI replies and sent messages at inverted-list offset zero; retain reading position for loaded history and duplicate acknowledgements. Reapply after content/viewport layout changes.
- Distinct customer grey, AI blue and staff red message colours, including captions, timestamps and read ticks. Foreground/secondary contrast tested above 4.5:1 in both themes.
- Render approved CarMazium support links as accessible links. My Cars, plain retail search and Sell routes open native screens; other platform links open the website. External hosts and executable URL schemes remain inert.
- Hide the separate shopping assistant on chat/inbox routes.
- Buyer dashboard hamburger opens the existing account drawer, exposing selling, buying, messages and support tools.
- Saved cards receive public fuel/transmission/location fields from the backend; opening a saved retail car fetches the complete advert with an explicit loading/error path.
- Empty Saved browse button uses the correct nested tab route.

## Validation

- Full native TypeScript check passed.
- Five native chat behaviour/contrast/link tests passed.
- Eighteen existing chat width, greeting and web/native conversation checks passed.
- Five backend watchlist tests passed, including verified-dealer access and no private seller/auction fields in the public summary projection.
- Knowledge source ledger refreshed only for the reviewed native ChatScreen; platform policy facts unchanged. All 62 source fingerprints verified.

## Continued live testing

- PR #927 merged as `b77b2698c97edfe0501db0bf61a0d6bcf7cd7127`; all five PR workflows passed. Backend deployment succeeded after all 154 model evaluations passed against synthetic fixtures.
- Four further real Android support questions passed: unsold auction to retail and fees; vehicle payment and seller reward; towable caravan without registration; misspelled photo-upload troubleshooting. Six new QA questions have now been sent in this session. No customer data was used for the automated evaluation.
- Automatic-transmission filtering returned 383 results and Clear restored 713. The filter sheet scrolls and its result action remains available.
- Empty valuation and listing forms blocked progress with required-field guidance. No listing was submitted.
- After backend deployment, Saved refresh correctly displayed Diesel, Manual and Scunthorpe for the QA Hyundai. The temporary saved car must be removed after verification to restore the original empty watchlist.
- Switching Saved from list to grid reproduced a persistent blank screen on build 105. The source reused the same FlatList while changing `numColumns`, which React Native explicitly rejects. Give list and grid separate component keys so switching remounts the correct layout. On-device verification remains required.

## Remaining device verification

Build/install updated APK and verify every fix on-device, including reply scrolling with keyboard shown, long replies, history browsing and both themes. Continue personal-account listing/editing, offers, purchases, notifications, settings, service journeys and failure cases. Then dealer and admin roles. This first pass is not comprehensive app certification. No Play Store or production OTA release is implied by a merged source change.

## Extended session checks

- Ten live support questions were sent on build 105. Nine answered correctly. The tenth-question count includes a failure on the ninth question: a coordinated question asking whether a Retail price edit automatically approves the listing and releases a reward received the financial-action handoff instead of an explanation.
- Reproduced three failing informational variants locally, fixed the intent classifier, and retained explicit payment/refund/action escalation. All 160 related routing/context/automatic-response tests and backend TypeScript passed. PR #929 merged as `ca39566c7d419178eb5113854c9aa796ec241ea1`; deployment and live retest pending. The generated-answer evaluation matrix now includes 155 scenarios.
- Additional passing live topics: private-buyer finance application without dealer conversion; one personal account for buying/selling and correct My Cars/Offers Received routes; failed registration lookup with truthful manual data entry and draft guidance.
- Buyer dashboard 30D -> 7D changed the displayed reporting period. Saved count matched the one temporary QA vehicle.
- Notification preferences and delivery/quiet-hours sections loaded current values. A local hour-selector change was not saved; no notification or privacy preferences were submitted.
- Emulator physical display is 1600x900 at 240 dpi, presented as 900x1600 portrait (600 logical pixels wide). An attempted density override to 400 was reset by BlueStacks; this does not verify a 360dp phone layout.
- Candidate run 44731847893 / versionCode 106 was cancelled when the grid-switch crash was found. Candidate run 44734501024 / versionCode 107 builds commit `36e7345718ebc6463461d494a903238c3c2be000`, including PRs #927 and #928. It has not yet been installed.


## Build 107 installed and checked (20 November, 12:43–12:53 GMT)

- Private signed candidate built successfully in run 44734501024 from 36e7345718ebc6463461d494a903238c3c2be000. VersionCode 107, package uk.carmazium.app. SHA256 c2450e1137cbfe1bec37bfeefee69d6e9ad67f3f37239fd07b74f75d28273ea9, 99,115,102 bytes. CI verified retained production signer; local and laptop checksums matched. Installed with adb install -r; login retained. Not published to customers/Play Store.
- Exact failed combined retail price/approval/reward question passed the live official support retest after PR #929 deployed. Synthetic model eval: 155/155; backend routing/service tests: 160 passed. These are distinct from real Android questions.
- Twelfth live message asked how to edit existing advert photos. Correct My Cars/Edit/status guidance. New AI reply scrolled completely into view with the software keyboard open, without manually scrolling. Customer grey/AI blue verified visually. No floating shopping assistant obstructed chat.
- My Cars inline link opened the actual native My Cars screen. First tap with keyboard open dismissed the keyboard; follow-up source uses keyboardShouldPersistTaps=handled so actionable links work on the first tap.
- Saved list-to-grid no longer blanked the app. Tapping the saved Hyundai loaded full photos, description, location, fuel and transmission. Removed temporary QA save; dashboard Watching returned to 0.
- Buyer dashboard hamburger now opens account tools. Drawer scroll reached Contact Support, Report a Problem and Sign Out while background dashboard stayed fixed.
- Auction view still displayed backend dealer restriction plus misleading Bidding is live banner. A non-dealer account with dealer-staff metadata bypassed the client gate. Follow-up requires dealer accountRole as well as staff/verification eligibility; banner requires loaded live lots and no load error. Server permissions remain authoritative.
- Raw **Edit** was visible in AI replies. Follow-up renders bounded bold spans while preserving safe platform links, ordinary/unmatched asterisks and plain customer messages.
- Source inspection found queued human handoff prevented any resume action for 15 minutes in the native client. Backend already differentiates queued requests from recent actual staff replies. Follow-up exposes Resume and delegates the decision to that authoritative endpoint.
- Follow-up source validation: full native TypeScript check; 6 behaviour/contrast/link/emphasis tests. Follow-up changes are NOT in installed build 107 and require another APK/retest.


## End-of-pass checks on installed build 107

- Thirteenth live support message requested a human. The existing conversation had earlier handoff history, so it acknowledged the handoff directly and asked for missing enquiry details. This does not establish the first-request offer on a fresh thread. New acknowledgement scrolled into view. Confirmed the queued handoff menu omitted Resume AI; PR #931 fixes that source path.
- Customer grey and AI blue were readable in dark mode too. Restored light mode and original show_ime_with_hard_keyboard=0. Physical density remained 240; BlueStacks reset the attempted 400 override, so narrower phone-width verification is still outstanding.
- Purchases loaded historical platform records and correctly excluded FAILED payments from paid totals. No receipt/payment transaction was initiated.
- My Offers empty state loaded, but tapping Browse cars did nothing. Its root-stack screen targeted the nested Search tab directly. Fix to explicit Tabs -> Search; needs next APK retest.
- PR #931 merged after all five workflows passed. Includes emphasis, keyboard link taps, resume controls and non-dealer auction messaging. Build 107 does not contain these follow-up fixes.
- Temporary QA-saved Hyundai removed and Watching=0 confirmed. No bids, offers, listings, purchases or payments submitted. The explicit support handoff QA leaves this buyer conversation paused until resumed. Dealer-account and admin testing, populated listing/offer journeys, narrower phone widths and iOS remain outstanding.

## Build 108 review installation and dealer device pass

- GitHub Actions run 44740577958 succeeded at source f22ef270810ccea3d99fb47996ee250048968a8a. The laptop verified the Actions archive digest, review-only evidence, package, version, source, expected signing-certificate fingerprint, APK digest and size. APK SHA-256 `51e3029fef9728c1f8eda076feeddfedd75e0d7f7d53d39ce7752455d02db303`, 99,115,270 bytes. Android accepted the replacement with `adb install -r` and reported versionCode 108. UID 10064 and the original install time were retained. The app reopened directly to the same verified dealer dashboard. No website, Play Store or OTA release.
- On reconnect the emulator was already signed into the verified dealer, not the previously recorded personal account. Before the update, the dealer inventory showed 48 vehicles. Searching for one known registration returned its single matching vehicle; clearing restored 48. Both list and grid controls worked. The live auction screen rendered seven lots, and Bids & Offers showed an existing position plus populated retail offer history. No bids, withdrawals, offers or stock edits.
- The dealer opened TradeXchange Service Jobs. Available, Inspection and My Work loaded the appropriate empty states. Both Delivery & Recovery and Vehicle Inspections were approved on the capabilities page. Inspection matching showed nationwide coverage. Verification explained dealer KYC reuse, one-time £1 verification and the inspection document rule. No provider preferences, documents or jobs were submitted.
- Pending personal-account device checks on build 108: bold reply formatting, first tap on a link with the software keyboard visible, immediate AI resume after a fresh queued handoff, non-dealer auction messaging and My Offers → Browse cars. The original personal support conversation has not been resumed in this pass. Prior handover total remains 14 live messages and 155/155 separately evaluated AI scenarios. The 19 build-source chat checks are supplementary.

## TradeXchange website and Android comparison

- The public services hub, finance, warranty and both new-job URLs responded HTTP 200. Website inspection changes in PR #930 were absent from build 108. The app's combined post-job shortcut selected Delivery immediately, vehicle adverts lacked the website's connected service entry points, and the customer job detail only showed the first vehicle in a batch.
- PR #933 targets the inspection feature branch. The Android patch connects eligible adverts with vehicle details, offers a delivery/inspection choice, restores delivery batch and preferred-time controls, carries the service choice to provider job filtering, and shows the inspection scope and full vehicle list to the customer. Also aligned the warranty and processing-fee wording. On-device acceptance needs a review APK containing the changes.
- On the inspection feature source with the Android patch: 291 backend service tests, 27 disposable-PostgreSQL integration tests, 27 website service tests, 10 existing interface parity tests and 3 native screen-interaction tests passed. Native TypeScript passed. An additional 84 finance, warranty and human-support tests passed with disposable PostgreSQL and synthetic payments. The transaction tests exercised posting, quotes, acceptance, payment, completion, payout, and notification handling. No live payment, service booking or external provider notification occurred.

## Build 108 personal-account retests

- The original buyer/seller account reopened the same support transcript. In the Auctions tab, the verified/KYC-approved dealer gate appeared with retail browsing and free seller listing actions. The live bidding banner was absent.
- My Offers showed its empty state. One tap on Browse cars opened native Buy Cars retail search with 714 results, filters and vehicle cards.
- The earlier photo-editing response rendered bold Edit and an underlined My Cars link on build 108, without literal Markdown markers.
- The support header initially read MaziuM AI paused. Resuming restored the active header. A new request for a person produced a handoff acknowledgement and a paused header at 13:49 GMT. Selecting Resume AI replies within the same minute restored the active header. No staff reply intervened.
- The Android software keyboard opened and the composer moved above it. Remote Desktop Commander then timed out on the send action and fresh screenshot requests. Follow-up message delivery, its AI answer and first-tap link navigation remain unconfirmed. On reconnection, inspect the transcript before sending another prompt; test the visible My Cars link once while the keyboard is shown and restore BlueStacks `show_ime_with_hard_keyboard` to its original value of 0. The last observed chat header showed AI active.

### Final personal-account result on build 108

All five requested buyer retests passed. The personal account remained signed in. The Android keyboard was visible, an earlier AI answer showed an underlined My Cars link, and one tap on that link in the middle of the visible transcript opened native My Cars with its Listings and Auctions tabs. Restored the BlueStacks setting `show_ime_with_hard_keyboard` to its original value of 0 and read it back. The support header showed MaziuM AI active.

A separate delivery-display issue was observed. The original 13:50 photo-editing question was in the transcript. The open screen showed no reply at 13:55 following the connection interruption. Reopening support loaded the AI answer, also timestamped 13:50, with the correct My Cars/Edit guidance. No duplicate question was sent. There have now been 16 live QA messages using the handover total, distinct from the earlier 155 automated AI scenarios.

PR #935 adds Android chat recovery on foreground, refocus and reconnection, with focused polling when awaiting a support response or when the socket is unavailable. Native TypeScript passed, along with all ten native chat-presentation/recovery tests. The reconnection fix requires on-device acceptance on an internal build containing it. PR #933 contains the separate TradeXchange changes. On build 108 the buyer also opened My Service Jobs and an existing cancelled inspection job detail. The status, vehicle and inspection location were displayed correctly. No job or payment was submitted.
