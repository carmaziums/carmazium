# Requirements: Carmazium Mobile App

**Defined:** 2026-05-30
**Core Value:** A verified, premium car marketplace where buying and selling is transparent, fast, and cinematic — whether on web or mobile.

## v1.0 Requirements

### Infrastructure & Build

- [ ] **INFRA-01**: Developer can run EAS build with development profile and install on physical device for push notification testing
- [ ] **INFRA-02**: App registers for Expo push notifications and stores device token in user preferences on backend
- [ ] **INFRA-03**: Android notification channel is created at app startup (prevents silent notification drops on Android 8+)
- [ ] **INFRA-04**: `notification-icon.png` asset (96×96 white-on-transparent) exists and is referenced correctly in `app.json`
- [ ] **INFRA-05**: `extra.eas.projectId` is configured in `app.json` (required for `getExpoPushTokenAsync`)
- [ ] **INFRA-06**: `react-native-gifted-charts` and `react-native-svg` are installed and working

### Push Notifications

- [ ] **PUSH-01**: User receives a push notification when outbid in a live auction (foreground and background)
- [ ] **PUSH-02**: User receives a push notification when a new offer is made on their listing
- [ ] **PUSH-03**: User receives a push notification when an offer they made is accepted, rejected, or countered
- [ ] **PUSH-04**: User receives a push notification when their auction wins and a chat room is created
- [ ] **PUSH-05**: User receives a push notification when a new chat message arrives while app is backgrounded
- [ ] **PUSH-06**: Tapping a push notification deep-links to the relevant screen (auction, offer, message thread)
- [ ] **PUSH-07**: User can view a notifications inbox listing all activity alerts (bids, offers, messages, system)
- [ ] **PUSH-08**: Notifications are marked as read when viewed
- [ ] **PUSH-09**: User can configure notification preferences by category (bids, offers, messages, system) with on/off toggles
- [ ] **PUSH-10**: User can set quiet hours during which push notifications are suppressed

### Buyer Dashboard

- [ ] **BUYER-01**: Buyer can view a dashboard overview with KPI tiles (active bids, active offers, watchlist count, won auctions)
- [ ] **BUYER-02**: Buyer can view a list of all their bids with current auction status and their bid amount
- [ ] **BUYER-03**: Buyer can view all offers they have made with current offer status (pending, accepted, rejected, countered)
- [ ] **BUYER-04**: Buyer can view their order/purchase history

### Seller Dashboard

- [ ] **SELL-DASH-01**: Private seller can view a dashboard showing active listings, offer count, and total enquiries
- [ ] **SELL-DASH-02**: Private seller can view an inbox of all offers received on their listings with price and buyer details
- [ ] **SELL-DASH-03**: Private seller can accept, reject, or make a counter-offer from the offers inbox
- [ ] **SELL-DASH-04**: Private seller can view earnings summary (sold price, platform fee, net)

### Sell My Car Wizard

- [ ] **SELL-01**: User can look up a vehicle by UK registration plate via DVLA integration and auto-fill make, model, year, fuel type, colour
- [ ] **SELL-02**: User can manually enter vehicle details when DVLA lookup is unavailable
- [ ] **SELL-03**: User can specify vehicle condition (mileage, service history, MOT status, accident history)
- [ ] **SELL-04**: User can upload vehicle photos (minimum 1, max 20) from camera or photo library, with HEIC-to-JPEG conversion
- [ ] **SELL-05**: User can set a listing price and choose between retail listing or auction
- [ ] **SELL-06**: User can review all entered details on a summary screen before publishing
- [ ] **SELL-07**: Listing is created on the backend and user is navigated to their seller dashboard on publish
- [ ] **SELL-08**: User can save progress as a draft and return to complete the wizard

### KYC / Identity Verification

- [ ] **KYC-01**: User can initiate identity verification from their profile
- [ ] **KYC-02**: User can upload a photo of their driving licence (front and back) using camera or photo library
- [ ] **KYC-03**: Images are compressed and converted to JPEG before upload (max 1.5 MB per image)
- [ ] **KYC-04**: User sees a verification pending state after submitting documents
- [ ] **KYC-05**: User is notified via push notification when their KYC is approved or requires resubmission

### Dealer Dashboard

- [ ] **DEALER-01**: Dealer can view dashboard KPI tiles (active listings, active auctions, total leads, sold this month)
- [ ] **DEALER-02**: Dealer can view a lead funnel summary (counts by status: NEW, CONTACTED, QUALIFIED, NEGOTIATING, WON, LOST)
- [ ] **DEALER-03**: Dealer can view offer conversion rate and average views per listing as trend KPIs

### Dealer Inventory

- [ ] **DINV-01**: Dealer can view all their listings in a filterable list (status: active, sold, draft)
- [ ] **DINV-02**: Dealer can change listing status (activate, deactivate, mark as sold)
- [ ] **DINV-03**: Dealer can navigate from inventory to the sell wizard to add a new listing
- [ ] **DINV-04**: Dealer can view a listing detail and edit price, description, and photos

### Dealer CRM Leads

- [ ] **DCRM-01**: Dealer can view a lead inbox sorted by recency with lead name, source, and CRM status badge
- [ ] **DCRM-02**: Dealer can filter leads by status (NEW, CONTACTED, QUALIFIED, NEGOTIATING, WON, LOST)
- [ ] **DCRM-03**: Dealer can update a lead's status from the inbox or detail view
- [ ] **DCRM-04**: Dealer can send a message to a lead that opens the chat conversation thread

### Dealer Auction Manager

- [ ] **DAUC-01**: Dealer can view all their active and scheduled auctions with countdown and current bid
- [ ] **DAUC-02**: Dealer can schedule a new auction for an existing listing (POST /auctions with listingId)
- [ ] **DAUC-03**: Dealer can cancel a scheduled auction

### Offers & Negotiation

- [ ] **OFFER-01**: Buyer can compose an offer from a vehicle detail screen with a custom price and optional message
- [ ] **OFFER-02**: Buyer can view a negotiation thread showing the full offer/counter-offer history
- [ ] **OFFER-03**: Buyer can accept or withdraw their latest offer
- [ ] **OFFER-04**: Seller can counter-offer from the negotiation thread
- [ ] **OFFER-05**: Both parties see the offer status update in real-time (optimistic UI + query invalidation)

### Purchase & Handover

- [ ] **PUR-01**: Buyer can view a purchase summary screen after an offer is accepted (vehicle details, agreed price, seller contact)
- [ ] **PUR-02**: Buyer and seller can view handover confirmation details (agreed pickup slot / delivery method)
- [ ] **PUR-03**: User can rate the seller/buyer after a completed transaction

### Auction Win + Completion

- [ ] **WIN-01**: Winning bidder sees a win celebration screen with vehicle details and agreed bid price
- [ ] **WIN-02**: Win screen deep-links to the auto-created chat room with the seller
- [ ] **WIN-03**: User can confirm handover completion from the win/completion screen

### Mazium AI Search

- [ ] **AI-01**: User can enter a natural-language search query (e.g. "red SUV under £30k with low mileage")
- [ ] **AI-02**: User sees a thinking/loading animation while the AI processes the query
- [ ] **AI-03**: AI returns a matched results list that links to standard vehicle detail screens
- [ ] **AI-04**: User can refine their query and re-search

### Map / Near Me

- [ ] **MAP-01**: User can view a map with car listing pins clustered by proximity
- [ ] **MAP-02**: User can filter by radius (5 / 10 / 25 / 50 miles)
- [ ] **MAP-03**: Tapping a cluster expands it; tapping a single pin shows a mini-card with price and key specs
- [ ] **MAP-04**: User can switch between map view and a distance-sorted list view
- [ ] **MAP-05**: App requests location permission before loading the map
- [ ] **MAP-06**: Listing pins are fetched on region change completion (not on every drag frame)

### Vehicle Compare

- [ ] **CMP-01**: User can add up to 3 vehicles to a compare list from vehicle detail or search results
- [ ] **CMP-02**: User can view a side-by-side spec comparison (price, year, mileage, fuel, transmission, body type, colour)
- [ ] **CMP-03**: User can remove a vehicle from the compare list and add a different one
- [ ] **CMP-04**: Compare persists across navigation (stored in Zustand)

### App Store Preparation

- [ ] **STORE-01**: `eas.json` is configured with development, preview, and production build profiles
- [ ] **STORE-02**: App icon (1024×1024), adaptive icon, and splash screen assets are production-ready
- [ ] **STORE-03**: Apple Privacy Manifest (`PrivacyInfo.xcprivacy`) is declared in `app.json` for all required APIs
- [ ] **STORE-04**: Android `google-services.json` is configured via EAS Secret (not committed to git)
- [ ] **STORE-05**: App Store Connect listing is created with screenshots, description, and metadata
- [ ] **STORE-06**: Google Play Console listing is created with screenshots, description, and metadata
- [ ] **STORE-07**: First TestFlight build is submitted and passes App Store review
- [ ] **STORE-08**: First internal Android test track is submitted and passes Play Store review

## v1.1 Requirements (Deferred)

### Dealer Analytics (Time-Series)

- **DANA-01**: Dealer can view a revenue chart with monthly/weekly time buckets
- **DANA-02**: Dealer can view a leads-over-time chart showing pipeline velocity
- **DANA-03**: Dealer can view a listing views trend chart

### Dealer CRM AI Brief

- **DCRM-AI-01**: Dealer sees an AI-generated brief per lead (purchase history, browsing patterns, suggested reply timing)
- **DCRM-AI-02**: Leads are auto-scored HOT/WARM/COLD by a backend ML/rule model

### KYC Liveness

- **KYC-LIVE-01**: User completes a liveness selfie check via third-party SDK (Onfido/Persona)
- **KYC-LIVE-02**: Identity is automatically approved without manual admin review

### 3D Car Model Viewer

- **3D-01**: Vehicle detail shows an interactive 3D model viewer (deferred — React Three Fiber not viable in RN)

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-app payments / Stripe | Platform is communication-only; no financial transactions on mobile |
| 3D car model viewer | React Three Fiber not viable in React Native; photo gallery sufficient |
| Admin dashboard | Admin flows stay web-only for v1.0; not justified for mobile |
| Finance / Insurance / Service partner dashboards | Partner roles are web-only for v1.0 |
| Social feed / reviews feed | Not in the design system; Carmazium is marketplace-first |
| Dark/light mode toggle | App ships dark-only (`userInterfaceStyle: dark`); NativeWind `dark:` prefix is no-op |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| PUSH-01 | Phase 1 | Pending |
| PUSH-02 | Phase 1 | Pending |
| PUSH-03 | Phase 1 | Pending |
| PUSH-04 | Phase 1 | Pending |
| PUSH-05 | Phase 1 | Pending |
| PUSH-06 | Phase 1 | Pending |
| PUSH-07 | Phase 1 | Pending |
| PUSH-08 | Phase 1 | Pending |
| PUSH-09 | Phase 1 | Pending |
| PUSH-10 | Phase 1 | Pending |
| BUYER-01 | Phase 2 | Pending |
| BUYER-02 | Phase 2 | Pending |
| BUYER-03 | Phase 2 | Pending |
| BUYER-04 | Phase 2 | Pending |
| SELL-DASH-01 | Phase 2 | Pending |
| SELL-DASH-02 | Phase 2 | Pending |
| SELL-DASH-03 | Phase 2 | Pending |
| SELL-DASH-04 | Phase 2 | Pending |
| DEALER-01 | Phase 2 | Pending |
| DEALER-02 | Phase 2 | Pending |
| DEALER-03 | Phase 2 | Pending |
| SELL-01 | Phase 3 | Pending |
| SELL-02 | Phase 3 | Pending |
| SELL-03 | Phase 3 | Pending |
| SELL-04 | Phase 3 | Pending |
| SELL-05 | Phase 3 | Pending |
| SELL-06 | Phase 3 | Pending |
| SELL-07 | Phase 3 | Pending |
| SELL-08 | Phase 3 | Pending |
| KYC-01 | Phase 4 | Pending |
| KYC-02 | Phase 4 | Pending |
| KYC-03 | Phase 4 | Pending |
| KYC-04 | Phase 4 | Pending |
| KYC-05 | Phase 4 | Pending |
| DINV-01 | Phase 5 | Pending |
| DINV-02 | Phase 5 | Pending |
| DINV-03 | Phase 5 | Pending |
| DINV-04 | Phase 5 | Pending |
| DCRM-01 | Phase 5 | Pending |
| DCRM-02 | Phase 5 | Pending |
| DCRM-03 | Phase 5 | Pending |
| DCRM-04 | Phase 5 | Pending |
| DAUC-01 | Phase 5 | Pending |
| DAUC-02 | Phase 5 | Pending |
| DAUC-03 | Phase 5 | Pending |
| OFFER-01 | Phase 6 | Pending |
| OFFER-02 | Phase 6 | Pending |
| OFFER-03 | Phase 6 | Pending |
| OFFER-04 | Phase 6 | Pending |
| OFFER-05 | Phase 6 | Pending |
| PUR-01 | Phase 6 | Pending |
| PUR-02 | Phase 6 | Pending |
| PUR-03 | Phase 6 | Pending |
| WIN-01 | Phase 6 | Pending |
| WIN-02 | Phase 6 | Pending |
| WIN-03 | Phase 6 | Pending |
| AI-01 | Phase 7 | Pending |
| AI-02 | Phase 7 | Pending |
| AI-03 | Phase 7 | Pending |
| AI-04 | Phase 7 | Pending |
| MAP-01 | Phase 7 | Pending |
| MAP-02 | Phase 7 | Pending |
| MAP-03 | Phase 7 | Pending |
| MAP-04 | Phase 7 | Pending |
| MAP-05 | Phase 7 | Pending |
| MAP-06 | Phase 7 | Pending |
| CMP-01 | Phase 7 | Pending |
| CMP-02 | Phase 7 | Pending |
| CMP-03 | Phase 7 | Pending |
| CMP-04 | Phase 7 | Pending |
| STORE-01 | Phase 8 | Pending |
| STORE-02 | Phase 8 | Pending |
| STORE-03 | Phase 8 | Pending |
| STORE-04 | Phase 8 | Pending |
| STORE-05 | Phase 8 | Pending |
| STORE-06 | Phase 8 | Pending |
| STORE-07 | Phase 8 | Pending |
| STORE-08 | Phase 8 | Pending |

**Coverage:**
- v1.0 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 — Traceability populated by gsd-roadmapper (8 phases, 82 requirements)*
