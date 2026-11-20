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


## Extended build 108 website and admin checks

The [website coverage inventory](android-108-website-coverage.md) lists all 158 website page templates at the installed source. All 36 selected public website URLs returned HTTP 200 and page titles. On the device all nine buyer links opened their expected screens. The delivery and inspection forms rejected empty submissions. Vehicle Finance opened its native guidance and Warranty opened the live quote form. A successful page load does not validate payment, email or service fulfilment.

From the signed-in admin account, tapping Dashboard opened Admin Control Panel with six populated summary cards. Listings opened the pending-review queue, Handovers opened the evidence queue, and Dealer KYC opened the field-verification queue. Each displayed its appropriate empty state. Accounts loaded the account count and name/email search. App & problem reports displayed online activity, downloads and Open/Resolved filters. No account, listing, verification decision, evidence or report was changed.

Trade Services opened an Android Chrome custom tab on the CarMazium site and requested separate login. This is a real second sign-in in the installed app. The native Listings queue also lacked the website's full listings manager (including live, draft, sold and rejected records). #936 adds a direct link to it alongside guest retail enquiries, the personal warranty/enquiry shortcuts, public discovery links and missing admin warranty/finance tools. New links and the guest flow require another build.

### Authenticated admin browser and separate internal APK

After signing into the Android browser, the admin opened TradeXchange Applications, Providers, Jobs, Finance / Warranty and Disputes. Existing providers, cancelled jobs and a finance enquiry appeared. All four service filters worked. Selecting Warranty showed the add-partner form and the empty warranty enquiry result. Selecting Vehicle Finance restored the existing enquiry. All services restored the unfiltered view. Read-only checks also opened the website's listings status filters, auctions, handovers, cancellations, transactions, HPI fulfilment, grants, dealer directory, platform analytics, AI reports, marketing popup, blog, finance providers and warranty orders. The native Messages shortcut opened the authenticated Admin Messages inbox. The native Create Listing action opened Vehicle Details with auction and retail choices. Back navigation returned to the Admin Control Panel.

The [internal QA workflow](https://github.com/carmaziums/carmazium/actions/runs/44752254655) built combined source `fd29efa37ad024798f3ac3fae5cc21350fbdba4e`. Attempt one was blocked by dependency resolution. Attempt two passed both the build and the Android 15 cold-launch check. The downloaded archive matched GitHub's digest, and the installed APK SHA256 matched the build log and sums file, `52e695dfa1317037f812e80abf0ae01434284f2bb625e6230137afc8bd64dd36`. Verified the two packages side by side in BlueStacks, `uk.carmazium.qa` versionCode 2 and `uk.carmazium.app` versionCode 108. The separate build uses the repository's read-only mode. The latest additional link from pending listing reviews to the full manager landed in #936 after this snapshot.

From a fresh QA guest session, the retail vehicle detail opened, and swiping its enlarged image advanced the counter from 1/22 to 2/22. Message seller opened the native guest form with the vehicle prefilled and consent off. Empty submission raised the name/email validation message. The three listing service buttons carried the same make, model and year to the hosted inspection, delivery and warranty forms. The live service website still offered the single-vehicle inspection form. That website is on a different revision from #930. The delivery form offered recovery, scheduling and additional vehicles. The warranty page displayed the selected vehicle. The QA public menu displayed six new website options, and Business Spotlight opened with Resolve Automotive and SimpleDMS. The guest was prompted to sign in when opening the protected native inspection job form. No enquiry, job, bid or payment was sent during this pass.


### Dealer, provider and website-led Android follow-up

The live website delivery form in Android Chrome showed Year and Notes on each vehicle, with examples for no keys, low clearance and flat tyres. The existing native form omitted both. Android PR #933 commit `55d29847be65db1c4cec377f48972af966bf31fe` adds editable year and notes to the lead vehicle and each additional vehicle, keeping listing year prefill. Its 29 native tests and native typecheck passed. The regression exercises two distinct vehicles, removed rows, empty fields, both year boundaries, invalid years and submitted values against a local job API fixture. This change touches the Android screen and its test only.

On the separate signed-in dealer QA APK, the inspection form offered Vehicle, Cosmetic and Both. Selections changed exclusively. Those types come from the separately proposed website inspection change #930. The delivery form added and removed a second vehicle, selected a future collection date and time, and reset to ASAP. Find Jobs & Bid preserved the delivery filter, and the inspection filter and My Work tab opened. Both service capabilities showed approved. Delivery matching opened Nationwide coverage and the save control. Inspection verification opened the business declaration and payout requirements and explained that inspection needs no document uploads.

Dealer Customers opened with two active leads. Board/list switched to individual leads, Offers received opened a pending offer, and a blank manual lead showed the required-name alert. Team showed the roster and TradeXchange permission choices. The invitation form opened with email and role controls. Completed purchases contained existing records. Selecting Retail filtered the records. An existing completed retail purchase opened its seller, direct payment, handover and delivery sections. Book delivery prefilled the same vehicle model and job title. The app menu also opened Reviews, Contact, Terms, Privacy, How It Works and Report a problem. No customer record, invitation, job, offer or payment was submitted.

### Updated QA installer and two-vehicle device retest

[Internal workflow run 44758047222](https://github.com/carmaziums/carmazium/actions/runs/44758047222) passed both APK compilation and Android 15 cold launch for `28be544f5077ba464b5b00f10e6f0b06cb8a42b7`. The downloaded ZIP matched the Actions digest, and its APK matched SHA256SUMS.txt, the build log and the installed base APK at SHA256 `cd587b9272f0db0b011af5b6b416e8b981a04e017fbfa986866a3ada809887f1`. Installed in place over the earlier `uk.carmazium.qa` package in BlueStacks. Android retained the original first install time and the verified dealer session. The separate CarMazium package remains versionCode 108.

In Delivery & Recovery → Post a Job the tester entered 2017 and “No keys” for the first vehicle and 2019 and “Low clearance” for the second. Both values appeared under the correct vehicle. Removing the second vehicle preserved both original values. On the corresponding combined Android source all 35 native tests, native TypeScript and 777 repository checks passed. The focused TradeXchange and team service suite passed 277 tests across 23 suites with the same service implementation as the combined candidate. These automated counts cover different layers.

Additional on-device checks included the partner service inbox, expired delivery job detail, multi-vehicle inspection duplicate registration validation, missing provider inspection specialty and missing coverage-area validation. A valid two-vehicle inspection draft reached the read-only guard. Reopening provider settings showed the original values. A complete payment, provider notification and payout journey still requires a staging service with test accounts and test-mode checkout. The complete listings manager shortcut is included in this APK and still needs activation in this specific APK under an admin session.


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
