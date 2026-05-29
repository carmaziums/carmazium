# Features Research: Carmazium Mobile — Remaining Screens

**Domain:** Premium UK car marketplace — buyer, private seller, and dealer flows
**Researched:** 2026-05-30
**Source:** Design system screens (25 JSX screen files), PROJECT.md, existing scaffold

---

## Feature Categories

### 1. Buyer Dashboard (Bids History, Offers, Stats KPIs)

**Table stakes:**
- KPI summary cards: active offers count, watchlist count, live bids count, saved searches count
- Recent activity feed: outbid alerts, counter-offers received, price drops, new messages — in chronological order
- Per-offer status visibility: pending / counter / accepted / declined with amounts shown
- Navigate from any activity row directly into the relevant screen (auction room, conversation, vehicle detail)
- Tab segmentation: Offers | Bids | Watchlist within a unified "My Activity" view
- Per-offer action strip: Accept, Decline, or Counter without leaving the dashboard

**Differentiators:**
- "Hot deal" surface — a single card that matches a saved search alert shown prominently above the activity feed, reducing time to discovery
- Mini pipeline summary (Pending N / Counter N / Accepted N) as a scannable status bar at the top of the Offers tab
- Negotiation track strip inside each offer card showing "Your offer → Counter" side by side with amounts, so users see distance to agreement at a glance
- Delta indicators on KPIs: "+1 today", "2 dropped" — not just raw counts
- Offer expiry timer on counters so urgency is surfaced without hunting

**Anti-features:**
- Do not merge the buyer dashboard with the seller/dealer dashboard — role contexts are different enough to warrant separate screens
- Do not show earnings or inventory stats on a buyer dashboard (dealer data should never leak into the buyer role view)
- Do not show offers as a flat list without status differentiation — "Pending" and "Counter-received" require different call-to-action prominence

**Complexity:** Medium
**Depends on:** Vehicle Detail (to navigate to car), Messages Inbox + Conversation (to surface message links), Live Auction Room (bid status), Make Offer / Negotiation Thread (offer state)
**Screens/states needed:**
- Dashboard Overview (KPI 2x2 grid + hot-deal card + activity feed)
- My Activity — Offers tab (pipeline summary + offer cards with Accept/Counter/Decline)
- My Activity — Bids tab (auction cards with live countdown + bid position)
- My Activity — Watchlist tab (shortcut into existing Saved screen)
- Empty state: no activity yet (first-time user, no bids or offers placed)

---

### 2. Seller Dashboard (Listings Management, Offers Inbox, Earnings)

**Table stakes:**
- Hero card showing the active listing with status badge (LIVE / PENDING / DRAFT), days listed, asking price, and edit shortcut
- Stats triptych: Views / Saves / Offers with today's delta for each
- Offers inbox preview showing latest 2 offers with quick Accept/Decline actions accessible without drilling in
- Full offers list with offer amount, buyer initials, AI score badge (HOT / WARM), and % vs asking price
- Ability to mark listing as Sold from the dashboard without navigating away
- Boost listing CTA (even if the boost flow itself is deferred — the entry point should exist)

**Differentiators:**
- AI-scored offers (HOT / WARM based on buyer behaviour signals) so sellers can prioritise responses — the design surface is already defined in the design system
- "% of asking" and absolute difference (−£2,000) shown on each offer, not just the amount, so sellers assess without mental arithmetic
- Quick-action 2x2 grid: Boost, Share, View insights, Mark sold — reduces friction for common seller tasks
- "NEW" badge on unread offers with red border treatment to distinguish from read offers at a glance
- Share listing shortcut (copy link / social) directly from the dashboard

**Anti-features:**
- Do not model this as a dealer dashboard — private sellers have 1 listing, not 34; the layout must reflect single-listing context
- Do not show finance or insurance upsells on the private seller dashboard (partner features are web-only in v1)
- Do not require navigation into a separate screen to see the top 2 offers — the preview must be inline

**Complexity:** Medium
**Depends on:** Sell My Car Wizard (listing must exist before dashboard is useful), Make Offer / Negotiation Thread (offer state and accept/counter flows)
**Screens/states needed:**
- Seller Dashboard Overview (listing card + stats + 2 latest offers + quick actions)
- Offers Inbox (full list — all offers with Accept / Message / Decline per card)
- Mark As Sold confirmation state
- Empty state: no offers yet
- Empty state: no listing yet (prompt to list)

---

### 3. Dealer Dashboard + Analytics (Revenue Charts, Lead Funnel, AI Conversion)

**Table stakes:**
- Hero revenue card: gross revenue for the selected period (7D / 30D etc.) with week-over-week % change and a mini bar chart
- KPI 2x2 grid: live listings count, new leads, avg days listed, conversion rate — each with a positive/negative delta
- Lead funnel visualisation: Views → Enquiries → Offers → Test Drives → Sold — with counts and bar fill
- "Needs attention" action panel: unread leads count, offers awaiting response, auctions ending today
- Inventory snapshot: stacked bar showing Live / Pending / Sold split
- Top 3 listings by views with lead count and price

**Differentiators (Analytics sub-screen):**
- Revenue area chart with gradient fill, time period selector (7D / 30D / 90D / YTD), and download button
- Sales velocity metrics: cars sold, avg sell time, avg margin — compared to previous period
- Top performers table: which specific listings sold fastest and for how much
- Conversion deep-dive: donut chart showing view-to-sale rate vs UK dealer benchmark (6.2%), plus step-by-step funnel with conversion percentages between each stage
- Mazium AI Insight card on the analytics screen: identifies the weakest funnel step and gives an actionable recommendation in plain English

**Anti-features:**
- Do not show individual buyer identities in revenue charts — aggregate only
- Do not build full admin reporting here — this is dealer self-serve, not a back-office tool
- Do not make the analytics screen require a separate login or Stripe connection to view — analytics should be available regardless of payment setup
- Do not pad charts with fake trend lines — if data is sparse, show a "Not enough data yet" state rather than misleading visualisations

**Complexity:** Complex
**Depends on:** Dealer Inventory Management (listings must exist for revenue data), Dealer CRM Leads (lead funnel data), KYC / Dealer Onboarding (dealer must be onboarded to see their data)
**Screens/states needed:**
- Dealer Dashboard Overview (hero revenue card + KPI grid + lead funnel + needs-attention panel)
- Inventory snapshot variant (alternative tab or scroll section)
- Analytics screen — Revenue chart view (area chart + time selector + velocity metrics + top performers)
- Analytics screen — Conversion funnel deep-dive (donut chart + step funnel + AI insight card)
- Empty state: newly onboarded dealer with no listings yet
- No-data state per time period: "No sales in this period"

---

### 4. Dealer Inventory Management (List/Edit/Status)

**Table stakes:**
- Inventory list with status filter tabs: All / Live / Pending / Sold
- Per-listing row showing thumbnail, title, price, status badge (LIVE / PENDING / SOLD / DRAFT), days listed, view count, lead count, and offer count
- Search within inventory
- Sort control (newest, most views, most leads)
- Floating action button to add a new listing
- Listing detail/edit view: photo strip (hero-first), editable price, offers toggle (accepting/paused), visibility tier indicator, days listed stat
- Status change: Boost button and Mark Sold button on the detail view
- Photo management: add photos, change hero photo

**Differentiators:**
- 3-column stats grid per listing (Views / Leads / Offers) with accent colour on offers to signal action needed
- Status badge overlay directly on the thumbnail so status is readable at list density without needing to read text
- Inline pencil icons on editable fields in the detail view — editing is discoverable without a separate "Edit mode" toggle
- Offer count highlighted in red if > 0 — dealers should notice offers that need responding to
- "Above/below reserve" status strip on auction cards within the inventory (when the listing is being auctioned)

**Anti-features:**
- Do not require the dealer to navigate to analytics to see basic per-listing stats — views and leads must be on the list row
- Do not make status changes require a confirmation modal for every action — Mark Sold can have a light confirmation but Boost should not
- Do not use full-page image picker flows — inline camera/library buttons within the edit view

**Complexity:** Medium
**Depends on:** Dealer Onboarding (dealer must be set up), Sell My Car Wizard (reuses photo upload patterns), KYC
**Screens/states needed:**
- Inventory List (filterable + sortable)
- Listing Detail / Edit view (photos + stats grid + editable fields + action buttons)
- Status change confirmation (Mark Sold)
- Empty state: no listings yet (prompt to add first listing via the wizard)

---

### 5. Dealer CRM Leads (AI-Scored Inbox)

**Table stakes:**
- Lead inbox list: buyer name/initials, car of interest, last message preview, time ago, unread count badge, AI score badge (HOT / WARM / COLD)
- Filter tabs: All / Hot / Warm / Booked
- Unread leads visually distinguished (red-tinted background, red border)
- Offer amount badge on leads that contain an active offer
- Booked badge on leads where a test drive has been scheduled
- Hot lead detail screen: AI brief, conversation thread, quick reply chips (Accept offer / Counter / Book viewing), full-text composer

**Differentiators:**
- Mazium AI brief panel at the top of each hot lead's detail screen: "Cash buyer, viewed 14 of your cars in 3 weeks. Offered £61,500 (1.6% below ask). Reply within 30 min for highest close rate." — not generic CRM notes but contextual intelligence
- Quick reply chips above the composer: contextual to the conversation state (Accept price / Counter price / Book viewing) — reduces dealer response time dramatically
- Score colour system (HOT = red, WARM = amber, COLD = grey) carried consistently across all lead surfaces
- Pulse animation on HOT tab indicator to signal urgency without a notification

**Anti-features:**
- Do not allow bulk actions from the inbox in v1 (multi-select, mass decline) — adds complexity without user research validating the need
- Do not automate lead scoring display as a percentage — the HOT/WARM/COLD tri-state is more scannable and actionable at mobile list density
- Do not combine the leads screen with the messages inbox — dealers need the AI context and offer data that the generic chat inbox doesn't have

**Complexity:** Complex (AI brief integration, real-time unread state via WebSocket /notifications namespace)
**Depends on:** Messages Inbox + Conversation (leads flow into chat), Make Offer (offer amounts shown inline), Dealer Onboarding
**Screens/states needed:**
- Lead Inbox (scored list, filter tabs, unread badges)
- Lead Detail / Hot Reply (AI brief + conversation + quick reply chips + composer)
- Empty state: no leads yet (new dealer)
- Empty state per filter: "No hot leads right now"

---

### 6. Sell My Car Wizard (DVLA Lookup → Details → Condition → Photos → Review → Publish)

**Table stakes:**
- Step 1 — Vehicle: UK registration plate input (yellow plate styling using Charles Wright / JetBrains Mono font), DVLA lookup result card showing make/model/year/engine, mileage field (DVLA-pre-filled, editable), instant fair-market valuation with price range and comparable sales count
- Step 2 — Condition & Photos: condition picker (Excellent / Good / Fair / Project) with description for each tier, photo grid with minimum photo count requirement (min 5), hero photo designation, camera and library upload options, progress counter (4 of 12)
- Step 3 — Review & Publish: live preview card of the listing as it will appear, listing tier picker (Free £1 / Standard £19 / Premium £59) with feature comparison, final publish CTA with price
- Progress stepper showing current step and completed steps throughout the wizard
- Back navigation must not lose data from previous steps

**Differentiators:**
- UK-branded yellow plate input field — this is not a generic text box, it's styled to resemble a UK number plate (amber background, dark monospaced font). Immediate visual recognition of the context
- Instant valuation card surfaced on Step 1 before the user commits to listing — this is a differentiator that reduces drop-off by showing the seller the money before they do the work
- Live listing preview in Step 3 — sellers see exactly what buyers will see, including the PREMIUM badge at the top tier
- Tier picker with per-tier feature bullet points (days, VIN report, badge, placement) rather than just names and prices

**Anti-features:**
- Do not add Steps 4 or 5 for things like "Set your price" as a separate step — the valuation and price are confirmed on the review step, not mid-wizard
- Do not require an account before starting the wizard — authentication gate should be minimal friction; handle it when the user hits "Publish"
- Do not use a generic file input control for photo upload — the grid with camera/library buttons must match the design system

**Complexity:** Complex (DVLA API integration for reg lookup, photo upload handling, multi-step state persistence)
**Depends on:** KYC (user must be identity-verified before a listing goes live), Profile (auth state)
**Screens/states needed:**
- Step 1: Reg input idle state
- Step 1: DVLA lookup loading state (spinner/skeleton on plate)
- Step 1: DVLA match confirmed state (green confirmed card + valuation)
- Step 1: DVLA no-match state (manual entry fallback)
- Step 2: Condition picker + photo grid (4 of 12, min 5 not met warning)
- Step 2: Photo grid with min met (Continue unlocked)
- Step 3: Review + tier picker + publish CTA
- Post-publish success state (listing live confirmation)

---

### 7. KYC / Identity Verification (Document Upload, Liveness, Pending State)

**Table stakes:**
- 3-step progress stepper: Licence / Selfie / Address
- Step 1 — Licence: upload front and back of driving licence, support camera capture and library upload, file format and size guidance, front-uploaded success state (green border + check icon)
- Step 2 — Selfie/Liveness: camera-based check
- Step 3 — Address: proof of address document upload
- Pending state: checklist of completed vs in-review steps, "2–5 minute" time expectation, push notification promise when approved
- "While you wait" suggestions (browse/save/watch auctions) to retain users during the pending window
- Privacy note: documents encrypted at rest, not shared with third parties
- Clear "Required to bid or list" banner explaining why this is needed

**Differentiators:**
- The upload zone for completed documents shows the filename and file size (not just a checkbox) — gives users confidence the upload succeeded
- The pending screen includes an animated pulse indicator on the in-review step — not just static text
- The "while you wait" section is a retention mechanism: users can still use core browse/save/auction watch features, so they don't abandon the app waiting for verification

**Anti-features:**
- Do not require KYC before the user can browse and save — gate only bidding and listing
- Do not display raw document images back to the user after upload (privacy risk)
- Do not use a generic "ID check" label — use "Driving licence" and "Selfie" as concrete step labels
- Do not fail silently on upload errors — network failure must show a retry state

**Complexity:** Complex (camera access, file upload to backend, real-time status polling or push notification for approval)
**Depends on:** Push Notifications (verification complete notification), Profile (KYC status surfaced on profile)
**Screens/states needed:**
- KYC landing / intro (why verify, step overview)
- Step 1: Licence front upload (idle + uploaded states for both front and back)
- Step 2: Selfie/liveness prompt
- Step 3: Address upload
- Pending state (animated checklist, "while you wait" panel)
- Verified state (success confirmation, CTA back to home or back to what they were doing)
- Failed / resubmit state (if documents rejected)

---

### 8. Mazium AI Natural Language Search

**Table stakes:**
- Free-text input box with blinking cursor, styled with red border when active and animated thinking dots
- "Mazium AI is thinking…" state with 3 sequential pulse dots
- Results screen showing matched cars with match score percentage (e.g. "98%") and match label ("Best match" / "Close match")
- AI interpretation card: tags showing what the AI extracted from the query (e.g. "Red", "SUV", "Under £45k", "Under 20k mi") with a "+ Refine" chip
- Per-result: matched criteria chips (green "check + label" chips showing which criteria the car meets)
- Per-result: AI note (e.g. "2% cheaper than avg for this spec" or "Colour differs — Pearl White. Adjust?")
- Result count in header ("8 RESULTS")
- Voice input and Clear buttons
- Recent searches list
- "Try asking" suggestion chips for inspiration

**Differentiators:**
- Match score badge on each result card (top-right, "98%") — not just relevance ordering but a score that explains ranking
- Colour-coded match labels ("Best match" = green, "Close match" = amber) using the same tone system as bid/offer states
- AI interpretation card at the top of results — not just results, but transparency about what the AI understood. This directly addresses the common frustration of "why did it show me this?"
- AI note per result that goes beyond spec matching: price vs market average, attribute discrepancies ("Colour differs"), allowing one-tap refinement
- Filter chips on results segmented by body type ("SUVs · 5 / Hatchbacks · 3") — natural language intent + structured refinement without losing the query

**Anti-features:**
- Do not use typeahead/autocomplete in the input — this is natural language, not a structured search field. Autocomplete trains users to use structured search patterns
- Do not show raw LLM reasoning or token counts to users
- Do not paginate results into separate screens — "Show 6 more" inline expansion is preferable for the discovery context
- Do not conflate AI search with the standard structured Search screen — they are separate entry points with different interaction models

**Complexity:** Complex (LLM API integration, query parsing, match scoring logic on backend)
**Depends on:** Vehicle Detail (results navigate into existing detail screen), Standard Search (AI results share the same listing data)
**Screens/states needed:**
- Input idle state (empty input + suggestions + recent searches)
- Thinking state (query entered, animated dots, query visible with blinking cursor)
- Results state (AI interpretation card + filter chips + result cards with scores + AI notes)
- No results state ("No matches — try rephrasing")
- Error state (AI service unavailable, fallback to standard search)

---

### 9. Map / Near Me (Geo-Browse)

**Table stakes:**
- Dark map with styled car price pins (pill-shaped, showing £Xk) and cluster circles (showing count) for dense areas
- User location dot (blue pulse) with dashed radius circle
- Sliding radius control (5 mi to 25 mi range) displayed as a scrubber pill
- Filter chips scrollable above the map: Near me / Under £30k / SUV / EV / < 20k mi
- Bottom sheet (draggable) showing nearby car count and a horizontal scroll card strip of the 3 closest results with distance badge
- "List view" toggle to switch to the distance-sorted list view
- Search bar overlay on the map ("Search this area…") with result count badge
- List view: sorted by distance, body type filter chips, radius scrubber, toggle back to map

**Differentiators:**
- Price pins are directly labelled with "£Xk" — users can see price distribution on the map without tapping individual pins. This is the primary differentiator vs generic map POI behaviour
- Active pin state: the selected listing's pin turns red and elevated vs inactive grey-tinted pins
- Map style is custom dark (not standard Google maps light) — matches the app's dark-luxury brand
- Distance badge on every card in list view ("1.2 mi") with red accent for the closest listing

**Anti-features:**
- Do not use satellite imagery — the custom dark road map is both brand-appropriate and less visually noisy for car browsing
- Do not cluster aggressively — single listings within the viewport should always show individual price pins
- Do not require permission to use the feature without graceful fallback — if location is denied, default to a UK city centre (e.g. London) with an "Enable location" prompt
- Do not show map pins for auction-only listings without a clear visual distinction from retail listings

**Complexity:** Complex (native map integration — react-native-maps or Expo Maps, geo-queries to backend, clustering logic)
**Depends on:** Vehicle Detail (pins navigate to existing detail screen), Standard Search filters (shares filter vocabulary)
**Screens/states needed:**
- Map view (pins + radius circle + user location + filter chips + bottom sheet collapsed)
- Map view with active pin (bottom sheet expanded showing selected car card)
- List view (distance sorted + radius scrubber + body type chips)
- Location permission denied state (fallback to London + enable location prompt)
- No listings in area state ("No cars within 5 miles — expand radius")
- Loading state (skeleton pins while geo-query fetches)

---

### 10. Vehicle Compare (Side-by-Side)

**Table stakes:**
- 2-car side-by-side mode: two photo cards with label badges (A/B), close button per car, spec rows below
- 3-car table mode: sticky header row with mini car photos, spec rows with winner-highlighted cells
- Spec rows: Price, Year, Mileage, Fuel, Body, Transmission, Monthly finance estimate, Distance
- Winner highlighting: green value + check icon for the "better" spec in the row
- "Highlights winners" toggle on the 3-car view
- Add/remove car controls (up to 3 in v1, up to 4 max as indicated by "2 of 4 compared" header)
- Navigation to each car's detail screen from the compare view ("View A" / "View B" CTAs)
- Share the comparison

**Differentiators:**
- Mazium AI summary card at the bottom of the 2-car comparison: a sentence that synthesises the comparison in plain English (e.g. "A wins on price and miles. B wins on year and is closer.") — this is the premium-feel differentiator vs a raw spec table
- Monthly finance estimate row — UK car shoppers think in monthly payments, not just sticker price. Including this without requiring the user to configure a finance calculator is a meaningful shortcut
- 3-car table with sticky header row so spec labels remain visible while scrolling through rows

**Anti-features:**
- Do not allow comparison of more than 3 cars in v1 (4 is the target but the design only shows 3 implemented) — 4 cars at mobile density is unreadable
- Do not require users to navigate to individual car pages to add to compare — the add button should be on the vehicle detail screen as well as accessible from the compare screen
- Do not show all spec rows at once — hide the "less interesting" rows (colour, VIN, service history) below a "Show more specs" expand

**Complexity:** Medium
**Depends on:** Vehicle Detail (cars are added to compare from the detail screen), Standard Search (comparison candidates come from search results)
**Screens/states needed:**
- 2-car side-by-side (photo cards + spec rows + AI summary + View A / View B CTAs)
- 3-car table (sticky header + winner-highlighted rows + share)
- Adding a car to compare (car picker modal or navigation back to search/saved)
- Empty state: comparison screen with 0 or 1 car (prompt to add cars)

---

### 11. Make Offer / Negotiation Thread

**Table stakes:**
- Offer composer screen: car context strip (thumbnail, seller name, asking price), large offer amount display, suggestion chips (−5% / −3% / Full ask with pre-calculated values), optional message to seller text area
- Buyer protection note: escrow copy at the base of the composer
- Negotiation thread screen: chat-bubble layout showing offer history (buyer → seller counter), offer expiry countdown timer
- Action bar with Decline / Counter / Accept buttons, mini price comparison strip (Your offer / Counter / Asking) above the buttons
- Counter-offer highlighted in amber to distinguish from buyer's own messages

**Differentiators:**
- Suggestion chips with pre-calculated values (−5% = £59,375) reduce cognitive load — users do not need to calculate what a percentage discount means in pounds
- Offer expiry countdown timer (11:42:07) in the negotiation thread creates legitimate urgency without being manipulative — it reflects a real business rule
- The price comparison strip (three columns: Your offer / Counter / Asking) is always visible in the action bar — the buyer never has to scroll up to remember the numbers
- Offer amount displayed in JetBrains Mono at 38px in the composer — the large monospaced treatment makes the number feel serious and precise

**Anti-features:**
- Do not allow the buyer to submit an offer above the asking price through the composer — clamp the maximum at asking price
- Do not use a free-text field for the offer amount — the amount should be set via a slider or numeric stepper to prevent typos on large values
- Do not require the buyer to type the counter-offer amount if they choose "Counter" — pre-fill with the seller's counter-offer amount minus a small increment
- Do not create a separate chat thread for offer negotiation — the negotiation thread IS the chat thread (post-offer the existing Conversation screen handles follow-up)

**Complexity:** Medium
**Depends on:** Vehicle Detail (offer is initiated from the detail screen), Messages Inbox + Conversation (post-acceptance conversation), Buyer Dashboard (offer status shown there)
**Screens/states needed:**
- Offer composer (idle — entering amount)
- Offer composer (reviewing — amount set, message optional, CTA shows amount)
- Offer sent confirmation state (brief interstitial before navigating to negotiation thread)
- Negotiation thread — buyer waiting (single offer bubble, "Awaiting seller" indicator)
- Negotiation thread — counter received (amber-styled counter bubble + action bar with Decline/Counter/Accept)
- Offer accepted state (transition to Purchase & Handover)
- Offer declined state (with option to make a new offer)
- Offer expired state

---

### 12. Purchase & Handover

**Table stakes:**
- Purchase summary screen: accepted deal card (car thumbnail + "Seller accepted your offer" confirmation), order summary breakdown (agreed price, buyer fee £95, HPI check included, buyer protection included, total payable), payment method selector
- Escrow copy: "Funds held in secure escrow until handover confirmed"
- Handover booking screen: collect vs delivery toggle, collection address display with map link, date picker strip (7-day scrollable with Mon–Sun), time slot grid (3-column, slots marked BOOKED or available)
- Confirm handover CTA with selected date/time summary

**Differentiators:**
- The order summary explicitly lists HPI check and buyer protection as "Included" line items in green — this is not just reassurance copy but a value attribution that justifies the buyer fee
- The date picker and time slot grid are native-feeling calendar components (not a third-party modal) with the same dark styling as the rest of the app
- Collect vs Delivery as a prominent first choice in the handover screen — delivery is not hidden as an option
- The confirm button reads "Confirm · Sat 21 Dec, 10:00" (with the chosen slot) rather than generic "Confirm" — final state of the button confirms what was selected

**Anti-features:**
- Do not handle actual payment processing in-app (locked in project constraints) — the "payment method" is for display/information purposes; the platform is communication-only
- Do not show a payment gateway or Stripe embed
- Do not use a full-month calendar view — the 7-day strip is the right density for mobile
- Do not collapse the order summary behind a toggle — all line items must be visible without expanding

**Complexity:** Medium (no payment processing simplifies this significantly; main complexity is the date/time slot UX and backend slot availability)
**Depends on:** Make Offer / Negotiation Thread (offer must be accepted before purchase flow), Messages Inbox (post-handover chat auto-created), Auction Win + Completion (auction path enters here)
**Screens/states needed:**
- Purchase summary (accepted deal card + order breakdown + payment method + CTA)
- Handover booking (collect/delivery toggle + address card + date strip + time grid)
- Booking confirmed state (summary of date/time chosen, navigate to handover confirmation)
- Handover confirmed (post-collection, triggers escrow release and rate-seller flow)

---

### 13. Auction Win + Completion

**Table stakes:**
- Win celebration screen: full-bleed green glow radial gradient, trophy icon, "YOU WON THE AUCTION" eyebrow, car name and lot number
- Hammer price displayed large in JetBrains Mono
- Payment deadline countdown (23:47:12) in amber — "Complete payment within N hours or lot goes to next bidder"
- Order summary: hammer price, buyer fee (2.5%), HPI check included, buyer protection included, total payable
- "Complete Payment" CTA (communication-only — no actual Stripe flow)
- Handover confirmed screen: car card with "Collected" timestamp, purchase journey timeline (Offer accepted → Payment cleared → Handover booked → Handover confirmed), digital receipt with reference number and download button, rate-seller flow

**Differentiators:**
- The payment deadline countdown is the key differentiator — auction winners face real time pressure. Displaying the countdown prominently (as a separate amber card, not just text) makes this a functional UX element, not decoration
- Purchase journey timeline on the handover-confirmed screen shows the full path the buyer took — this closure narrative is satisfying and confirms each step was completed
- Digital receipt (Ref: CZM-2024-XXXXX) with download button — gives buyers a record for insurance, finance, or resale history
- Rate seller flow directly on the handover-confirmed screen (5-star + optional comment) — capturing reviews at the moment of peak satisfaction

**Anti-features:**
- Do not suppress the win screen for "sniped" anti-snipe-triggered auctions — the winner experience is the same regardless of how the auction ended
- Do not show the payment deadline as body text — it must be its own distinct card with amber styling and a live countdown
- Do not require the seller rating to be submitted before allowing the user to continue — make it optional with a "Rate later" or skip option
- Do not auto-navigate away from the win screen after N seconds — the user may be reading the details

**Complexity:** Medium
**Depends on:** Live Auction Room (win state is triggered by WebSocket auction end event), Purchase & Handover (payment + handover booking flow), Push Notifications (win notification when user is not in the auction room)
**Screens/states needed:**
- Auction win / celebration screen (trophy + hammer price + payment deadline countdown + order summary + CTA)
- Payment processing intermediary state (CTA tapped, confirming)
- Handover booking (reuses the Purchase & Handover handover booking screen)
- Handover confirmed + rate seller (timeline + receipt + star rating)
- Payment deadline expired state (if user does not complete within window)

---

### 14. Push Notifications (Permission Flow, Categories)

**Table stakes:**
- Permission request prompt: shown at a meaningful moment (first bid attempt or first save), not on app launch. Must include rationale before triggering the OS dialog
- Activity feed screen: grouped notifications (Today / Yesterday / Earlier), each notification item showing type icon, title, body, time ago
- Filter chips on the activity feed: All / Bids / Offers / Price drops / Matches
- "Read all" action to clear the unread count
- Unread count badge on the bell icon (Profile tab bell, Dashboard header bell)
- Navigation: tapping a notification deep-links directly to the relevant screen (auction room, negotiation thread, vehicle detail, conversation)
- Win-state notification: hero treatment when the notification IS the win event (large car image, "YOU WON" headline) — distinct from a standard list row

**Differentiators:**
- Filter chips on the activity feed allow users to view only bid alerts or only price drops — reduces noise for users who are active in multiple contexts simultaneously
- The win-state hero notification (variation B in the design) surfaces when viewing the notification, not just as a banner — it's a moment of celebration, not an administrative record
- Notification items that require action (counter-offer received, outbid alert) show an action indicator distinct from informational items (price drop, new match)
- Pulse animation on actively-winning bid notifications in the feed (animated glow dot)

**Anti-features:**
- Do not request push permission on the first app launch or onboarding — this kills opt-in rates. Request at a contextual moment of clear user benefit (first bid, first save with alerts enabled)
- Do not batch all notifications into a single "Carmazium" category — users need to silence price drops without silencing outbid alerts
- Do not show raw payload data in the notification body (auction IDs, UUIDs)
- Do not navigate to the home screen when a deep-linked notification is tapped — always navigate to the specific item

**Complexity:** Medium (Expo Notifications SDK + backend webhook + deep-link routing)
**Depends on:** All other screens (every feature generates notifications), Profile (notification bell + badge), Socket.IO /notifications namespace (already scaffolded)
**Screens/states needed:**
- Permission prompt (rationale card + OS system dialog trigger)
- Activity feed — populated (grouped list with filter chips)
- Activity feed — win-state hero item (large card treatment for auction win)
- Activity feed — empty state ("No notifications yet")
- OS permission denied state (in-app prompt to enable in Settings)

---

### 15. Notification Preferences

**Table stakes:**
- Master "Mute all notifications" toggle at the top (overrides all individual settings)
- Category sections: Bids & Auctions / Offers / Price drops / Messages — each with section header and individual toggle rows
- Per-toggle: label, subtitle explaining the event, on/off toggle
- Price drop threshold configuration (e.g. "Only when price drops by ≥ £500") accessible from the price drop section
- Delivery channels section (sub-screen): Push / Email / SMS with per-channel toggles and account identifiers shown
- Bid alert frequency options: Immediately / Every 30 min / Daily digest
- Quiet hours: enable/disable toggle, From / Until time pickers
- Test notification button (developer-friendly feature that also helps users verify their setup)
- "Reset" action to restore defaults

**Differentiators:**
- Colour-coded section icons (gavel = red, tag = amber, arrow-down = green, message = blue) — each category has a consistent colour that matches the colour used for that event type throughout the app
- The "≥ £500" chip on the price drop threshold row is a secondary spec chip that appears without requiring a sub-screen drill-in — it's visible at a glance that a threshold is active
- Section headers are grouped into their own row above the toggle card — not just a label inside the card, giving cleaner visual hierarchy
- "Recommended" chip on the "Immediately" frequency option — reduces decision fatigue for new users

**Anti-features:**
- Do not use system-native settings (linking to iOS Settings / Android Notification settings) as the primary preference surface — in-app granular control is the table stake
- Do not require a separate screen for each notification type — the section/toggle pattern handles the full preference set in one scroll
- Do not show delivery channel settings (email/SMS) on the same screen as event category toggles — they have different mental models and should be a sub-screen linked from a row at the bottom

**Complexity:** Simple
**Depends on:** Push Notifications (preference changes must affect delivery), Profile (accessed from Profile settings)
**Screens/states needed:**
- Main preferences screen (mute-all toggle + category sections with individual toggles)
- Delivery & quiet hours sub-screen (channels + frequency picker + quiet hours time range)
- Reset to defaults confirmation

---

### 16. App Store Preparation

**Table stakes:**
- EAS Build configuration: `eas.json` with production profile, correct bundle identifiers (iOS) and applicationId (Android), signing credentials configured
- App icons: 1024x1024 icon (iOS App Store), adaptive icon (Android foreground + background layers), correct mask shapes applied
- Splash screen: full-bleed dark slate with CZM red logo, loading indicator
- App Store metadata: app name "Carmazium", subtitle (UK car marketplace), keywords, description (UK English, premium tone matching brand voice), age rating (4+), category (Shopping or Auto & Vehicles)
- Privacy manifest (iOS): declared data types used (location, identifiers, usage descriptions)
- Screenshots: at minimum 6.5" iPhone screenshots and 12.9" iPad screenshots for App Store Connect, showing the key screens (Home, Auction Room, Vehicle Detail, Sell Wizard, Buyer Dashboard, AI Search)
- Play Store: feature graphic (1024x500), short description (80 chars), full description, 2–8 screenshots
- App transport security / permissions rationale text: camera (photo upload), location (Near Me), notification (push alerts)

**Differentiators:**
- Screenshots should be designed within the dark brand aesthetic — not plain device frames but framed in the cinematic CZM style (dark background, red CTA highlights, Poppins headings). This is a differentiator because most marketplace apps use plain white screenshots
- The App Store description should lead with a hook that matches the onboarding tone ("The UK's most cinematic car marketplace") rather than a generic feature list

**Anti-features:**
- Do not hard-code API base URLs in the app bundle — use `app.config.js` with `EXPO_PUBLIC_*` env vars so staging and production builds have different endpoints without a code change
- Do not submit screenshots created from the design canvas JSX mocks — screenshots must be from a real device or an Expo simulator running production build
- Do not skip privacy manifest for iOS — App Store Review will reject without it (iOS 17.2+ requirement)
- Do not use a generic category like "Utilities" — "Shopping" or "Auto & Vehicles" is correct and improves App Store discoverability

**Complexity:** Medium (EAS Build configuration is straightforward; screenshot generation and metadata writing is time-consuming but not technically complex)
**Depends on:** All screens complete and stable (screenshots require final UI), EAS account configured, Apple Developer Program membership, Google Play Console account
**Screens/states needed:** (not traditional UX states — build and submission artefacts)
- `eas.json` production + preview profiles
- `app.config.js` with correct identifiers, permissions, and icon paths
- Icon assets (1024x1024 PNG, adaptive icon layers)
- Splash screen asset
- App Store Connect listing (screenshots, metadata, privacy labels)
- Play Store listing (feature graphic, screenshots, descriptions)

---

## Feature Dependencies Map

```
KYC
  └── required before: Sell My Car Wizard (listing publish), Buyer bidding, Dealer Onboarding

Dealer Onboarding
  └── required before: Dealer Dashboard, Dealer Inventory, Dealer CRM Leads, Dealer Analytics

Sell My Car Wizard
  └── required before: Seller Dashboard (listing must exist)

Make Offer / Negotiation Thread
  └── required before: Purchase & Handover (retail path)
  └── feeds into: Buyer Dashboard (offer status), Seller Dashboard (offers inbox)

Live Auction Room (existing)
  └── triggers: Auction Win + Completion
  └── requires: Push Notifications (win alert when out of app)

Purchase & Handover
  └── feeds into: Auction Win + Completion (shared handover booking screen)
  └── triggers: Handover Confirmed → escrow release → rate seller

Vehicle Detail (existing)
  └── entry point for: Make Offer, Compare, Map/Near Me pin tap, AI Search result tap

Push Notifications
  └── required for: Auction Win + Completion (out-of-app win alert), KYC (verification complete)
  └── configured by: Notification Preferences

App Store Preparation
  └── requires: all screens complete
```

## Complexity Summary

| Feature | Complexity | Primary Reason |
|---|---|---|
| Buyer Dashboard | Medium | Offer state machine, tab navigation, real-time bid status |
| Seller Dashboard | Medium | Offer inbox, listing stats, accept/counter actions |
| Dealer Dashboard + Analytics | Complex | Revenue charts, funnel data, AI insight integration |
| Dealer Inventory Management | Medium | Photo management, status changes, per-listing stats |
| Dealer CRM Leads | Complex | AI brief panel, real-time unread via WebSocket, quick replies |
| Sell My Car Wizard | Complex | DVLA API, multi-step state, photo upload, listing tiers |
| KYC / Identity Verification | Complex | Camera access, file upload, async verification polling |
| Mazium AI Search | Complex | LLM API, match scoring, result interpretation display |
| Map / Near Me | Complex | Native maps, geo-queries, clustering, permission handling |
| Vehicle Compare | Medium | 2 and 3 car layouts, winner logic, AI summary |
| Make Offer / Negotiation | Medium | Offer state machine, expiry countdown, price comparison strip |
| Purchase & Handover | Medium | Date/time picker, slot availability, escrow copy |
| Auction Win + Completion | Medium | Win event from WebSocket, deadline countdown, review flow |
| Push Notifications | Medium | Expo Notifications SDK, deep-link routing, badge management |
| Notification Preferences | Simple | Toggle state persistence, quiet hours time pickers |
| App Store Preparation | Medium | EAS config, asset creation, metadata authoring |
