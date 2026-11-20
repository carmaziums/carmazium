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
- The empty Saved "Browse listings" action targets an unregistered root Search route in source; corrected to Tabs -> Search. Interactive retest on the updated APK remains pending.

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

## Still required

Build/install updated APK and verify every fix on-device, including reply scrolling with keyboard shown, long replies, history browsing and both themes. Continue personal-account listing/editing, offers, purchases, notifications, settings, service journeys and failure cases. Then dealer and admin roles. This first pass is not comprehensive app certification. No Play Store or production OTA release is implied by a merged source change.
