# Roadmap: Carmazium Mobile App v1.0

**Milestone:** v1.0 — Mobile App
**Total phases:** 8
**Total requirements:** 82

## Overview

Starting from a complete scaffold (auth screens, tab screens, detail screens, API client, socket client, UI atoms), the v1.0 Mobile App delivers all buyer, seller, and dealer flows in 8 sequential phases. Infrastructure and push notifications ship first because every transactional flow depends on them. Role dashboards ship second to establish the home base each role returns to after every action. Then features layer in: sell wizard, KYC, dealer operations, offer/purchase/auction-win flows, discovery enhancements, and finally app store preparation as a hard gate once all screens are complete.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: EAS Build and Full Push Notification System** - Configure EAS dev build, register device tokens, wire all notification event types, and deliver a working notifications inbox with preferences (completed 2026-05-30)
- [ ] **Phase 2: Buyer, Seller, and Dealer Role Dashboards** - Deliver the dashboard home screen for each role with KPI tiles, offer inboxes, and lead funnel summaries
- [ ] **Phase 3: Sell My Car Wizard and Photo Upload** - Multi-step listing creation wizard (DVLA lookup → condition → photos → review → publish) with Supabase Storage and HEIC conversion
- [ ] **Phase 4: KYC Identity Verification Flow** - Driver licence upload, compression, submission, and pending state using the storage.ts helper from Phase 3
- [ ] **Phase 5: Dealer Inventory, CRM Leads, and Auction Manager** - Full dealer operational screens built on the dealer dashboard from Phase 2
- [ ] **Phase 6: Offers, Purchase, and Auction Win Completion** - Offer composer, negotiation thread, purchase summary, handover confirmation, and auction win celebration wired to push notifications from Phase 1
- [ ] **Phase 7: Mazium AI Search, Map Near Me, and Vehicle Compare** - Discovery enhancement screens that are independent of Phases 3–6 and can follow Phase 2
- [ ] **Phase 8: App Store Preparation and Submission** - EAS production build profiles, store assets, privacy manifests, store listings, and first TestFlight/Play Store submissions

## Phase Details

### Phase 1: EAS Build and Full Push Notification System
**Goal:** Developer can install a dev build on a physical device, notifications are registered with the backend, and every notification event type (outbid, offer, message, auction win, KYC) is delivered and deep-links correctly.
**Depends on:** Nothing (scaffold complete — auth, API client, socket client all exist)
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06, PUSH-07, PUSH-08, PUSH-09, PUSH-10
**Key tasks:**
- [ ] Configure `eas.json` development profile and obtain physical-device build
- [ ] Add `extra.eas.projectId` to `app.json` and reference `notification-icon.png` asset
- [ ] Create Android notification channel at app startup
- [ ] Implement `registerForPushNotificationsAsync` — request permission, get Expo push token, POST to backend user preferences endpoint
- [ ] Install `react-native-gifted-charts` and `react-native-svg`, verify render
- [ ] Implement notification handler for foreground + background events for all 5 event types (outbid, offer received, offer status, auction win, chat message)
- [ ] Implement deep-link routing from notification tap to correct screen (auction room, offer thread, message conversation)
- [ ] Build notifications inbox screen (`/notifications`) with activity list and mark-as-read
- [ ] Build notification preferences screen with category toggles and quiet-hours picker
**Success criteria:**
1. Developer can run `eas build --profile development` and install the resulting `.apk` / `.ipa` on a physical device without manual Xcode/Android Studio steps
2. When a user logs in on a physical device, a push token appears in the backend user preferences record within 5 seconds
3. When a bid is placed on an auction the user is watching, a visible push notification arrives on the device both in foreground and while the app is backgrounded
4. Tapping a push notification opens the app on the correct screen (auction room, offer thread, or message conversation) rather than the home tab
5. User can open the notifications inbox, see all activity alerts, and toggle per-category delivery preferences on/off
**Pitfall watch:**
- `getExpoPushTokenAsync` silently returns null if `projectId` is missing from `app.json` — verify `extra.eas.projectId` matches the EAS dashboard project before any device testing
- Android 8+ drops notifications silently if the notification channel is not created before the first notification arrives — channel creation must happen in the root layout `useEffect`, not lazily
**Dependencies:** None — scaffold, auth, API client, and socket client are all done

---

### Phase 2: Buyer, Seller, and Dealer Role Dashboards
**Goal:** Every authenticated role (buyer, private seller, dealer) lands on a dashboard that shows their core KPIs and provides the primary navigation entry points for their workflows.
**Depends on:** Phase 1 (push token registered so dashboards can show notification badges)
**Requirements:** BUYER-01, BUYER-02, BUYER-03, BUYER-04, SELL-DASH-01, SELL-DASH-02, SELL-DASH-03, SELL-DASH-04, DEALER-01, DEALER-02, DEALER-03
**Plans:** 5 plans
Plans:
- [ ] 02-01-PLAN.md — Foundation: jest config, KpiTile, LeadFunnelBar, role router
- [ ] 02-02-PLAN.md — Buyer dashboard: overview + bids + offers + history screens
- [ ] 02-03-PLAN.md — Seller dashboard: overview + offer inbox + earnings
- [ ] 02-04-PLAN.md — Dealer dashboard: KPI tiles + lead funnel chart + trend stats
- [ ] 02-05-PLAN.md — Checkpoint: human verify all three role dashboards on device
**Key tasks:**
- [ ] Build buyer dashboard screen: KPI tiles (active bids, active offers, watchlist count, won auctions), bids list, offers list, order/purchase history list
- [ ] Build private seller dashboard screen: active listings overview, offer inbox with price + buyer details, accept/counter/decline actions, earnings summary
- [ ] Build dealer dashboard screen: KPI tiles (active listings, active auctions, total leads, sold this month), lead funnel bar (NEW → LOST counts), offer conversion rate and avg views trend KPIs
- [ ] Wire all dashboard screens to existing API endpoints via TanStack Query
- [ ] Ensure role-based routing — correct dashboard shown based on Supabase user role claim
**Success criteria:**
1. Buyer can navigate to their dashboard and see tiles showing current counts for active bids, active offers, watchlist items, and won auctions — values match backend data
2. Private seller can view every offer received on their listings and tap Accept, Decline, or Counter-Offer; the offer status updates in the list immediately
3. Private seller can see an earnings summary showing sold price, platform fee, and net amount for completed sales
4. Dealer can view KPI tiles and a lead funnel summary (counts for each CRM status) sourced from live backend data
5. Each role is shown the correct dashboard — a buyer account never sees dealer inventory tiles
**Pitfall watch:**
- Role detection must read from the Supabase session JWT claims, not a separate API call — avoids a race condition where the role endpoint loads after the dashboard attempts to render role-specific tiles
- Counter-offer from seller dashboard must go through the offers API (`PATCH /offers/:id`) — do not invent a separate endpoint
**Dependencies:** Phase 1 (push token registration ensures backend has device token for notification badge counts)

---

### Phase 3: Sell My Car Wizard and Photo Upload
**Goal:** A private seller or dealer can take a car from unknown to published listing in a single guided multi-step wizard, with automatic DVLA data fill, photo upload to Supabase Storage, and draft-save capability.
**Depends on:** Phase 2 (seller dashboard is the post-publish destination)
**Requirements:** SELL-01, SELL-02, SELL-03, SELL-04, SELL-05, SELL-06, SELL-07, SELL-08
**Key tasks:**
- [ ] Build `mobile/src/lib/storage.ts` — Supabase Storage upload helper with HEIC-to-JPEG conversion and 1.5 MB size cap
- [ ] Build wizard step 1: UK reg plate input → DVLA API lookup → auto-fill make, model, year, fuel type, colour; fallback to manual entry on lookup failure
- [ ] Build wizard step 2: condition fields (mileage, service history, MOT status, accident history)
- [ ] Build wizard step 3: photo picker (camera + library) supporting 1–20 images, calling `storage.ts` helper, showing upload progress
- [ ] Build wizard step 4: pricing screen (price input + retail vs. auction toggle)
- [ ] Build wizard step 5: review summary screen with all entered data
- [ ] Wire publish action to `POST /listings` and navigate to seller dashboard on success
- [ ] Implement draft save to AsyncStorage / Zustand persist so user can return and resume incomplete wizard
**Success criteria:**
1. User can enter a valid UK registration plate and see make, model, year, fuel type, and colour fields auto-filled within 3 seconds
2. User can upload at least 1 and up to 20 photos from camera or photo library; HEIC images are silently converted to JPEG before upload
3. User can reach the review step, see all entered details, and tap Publish — a listing appears in the backend and the user arrives on their seller dashboard
4. If the user closes the wizard mid-way and reopens it, previously entered data is restored from the draft
5. DVLA lookup failure shows a clear fallback that lets the user continue by typing vehicle details manually
**Pitfall watch:**
- HEIC conversion (`expo-image-manipulator` or `expo-media-library`) must happen before the Supabase Storage upload call — uploading raw HEIC files causes silent failures on Android
- Draft state stored only in Zustand in-memory will be lost on app restart — must use Zustand `persist` middleware backed by AsyncStorage
**Dependencies:** Phase 2 (post-publish navigation targets seller dashboard), `storage.ts` helper is also used by Phase 4

---

### Phase 4: KYC Identity Verification Flow
**Goal:** A user can initiate identity verification from their profile, upload driving licence photos using the shared storage helper, and see a clear pending state while awaiting approval.
**Depends on:** Phase 3 (storage.ts upload helper must exist)
**Requirements:** KYC-01, KYC-02, KYC-03, KYC-04, KYC-05
**Key tasks:**
- [ ] Add "Verify Identity" entry point on the Profile screen (badge showing current KYC status)
- [ ] Build KYC screen: driving licence front + back photo capture (camera or library), using `storage.ts` with 1.5 MB JPEG compression cap
- [ ] Wire submit action to the KYC submission API endpoint
- [ ] Build KYC pending state screen (document received, under review)
- [ ] Handle push notification tap for KYC approved / resubmission required — deep-link to KYC screen with appropriate status message
**Success criteria:**
1. User can navigate to profile and tap "Verify Identity" — the KYC flow opens from any verification status (unverified, pending, rejected)
2. User can photograph or select both sides of their driving licence; each image is automatically compressed to under 1.5 MB before submission
3. After submitting, the user sees a pending state screen — not a spinner or blank screen — confirming documents are under review
4. When KYC is approved or rejected by an admin, a push notification arrives on the user's device and tapping it opens the KYC screen with the updated status
**Pitfall watch:**
- Image compression using `expo-image-manipulator` must enforce the 1.5 MB cap via quality reduction loop, not a fixed quality value — licence photos vary widely in native resolution
- KYC push notification deep-link must check whether the user is already on the KYC screen before navigating — double-push can cause route stack duplication on iOS
**Dependencies:** Phase 3 (storage.ts helper), Phase 1 (push notifications for KYC status updates)

---

### Phase 5: Dealer Inventory, CRM Leads, and Auction Manager
**Goal:** A dealer can manage their full inventory (view, edit, status change), work their CRM lead inbox (filter, update status, message leads), and schedule or cancel auctions — all from mobile.
**Depends on:** Phase 2 (dealer dashboard is the entry point to all three subsystems)
**Requirements:** DINV-01, DINV-02, DINV-03, DINV-04, DCRM-01, DCRM-02, DCRM-03, DCRM-04, DAUC-01, DAUC-02, DAUC-03
**Key tasks:**
- [ ] Build dealer inventory list screen: filterable by status (active / sold / draft), showing listing card with price and status badge
- [ ] Build listing detail/edit screen: inline edit for price, description, photos with Supabase Storage update
- [ ] Wire listing status change actions (activate / deactivate / mark sold) to `PATCH /listings/:id`
- [ ] Add "Add Listing" button that routes to the sell wizard (SELL-01 through SELL-08 already built in Phase 3)
- [ ] Build dealer CRM leads inbox: sorted by recency, showing lead name, source, CRM status badge
- [ ] Implement lead status filter (NEW / CONTACTED / QUALIFIED / NEGOTIATING / WON / LOST)
- [ ] Wire lead status update to `PATCH /leads/:id`
- [ ] Wire "Message Lead" action to open the existing chat conversation thread
- [ ] Build dealer auction manager list: active and scheduled auctions with live countdown and current bid
- [ ] Wire "Schedule Auction" form to `POST /auctions` with listingId
- [ ] Wire "Cancel Auction" action to the auction cancellation endpoint
**Success criteria:**
1. Dealer can view all their listings filtered by status and navigate to any listing to edit its price, description, or photos — changes persist on the backend
2. Dealer can open the CRM leads inbox, filter by a single status, tap a lead, change its status, and see the badge update in the inbox list immediately
3. Dealer can send a message to a lead from the CRM view — the message appears in the shared chat conversation thread
4. Dealer can see all their active and scheduled auctions with countdown timers and can successfully schedule a new auction for an existing listing
5. Dealer can cancel a scheduled auction and it disappears from the auction manager list
**Pitfall watch:**
- Lead status PATCH must use the correct CRM status enum values from the backend (`NEW`, `CONTACTED`, `QUALIFIED`, `NEGOTIATING`, `WON`, `LOST` — uppercase) — mismatched strings cause silent 400 errors
- Auction countdown timers must be driven by a `setInterval` hook, not derived from socket events alone — socket connection drops must not freeze the displayed countdown
**Dependencies:** Phase 2 (dealer dashboard navigation entry points), Phase 3 (sell wizard reused for "Add Listing" in inventory)

---

### Phase 6: Offers, Purchase, and Auction Win Completion
**Goal:** Buyers can compose and manage offers on retail listings; both parties can complete the purchase and handover flow; winning auction bidders see a celebration screen and confirm handover — all wired to push notifications.
**Depends on:** Phase 1 (push notifications for real-time offer status), Phase 2 (seller dashboard offer inbox must be live)
**Requirements:** OFFER-01, OFFER-02, OFFER-03, OFFER-04, OFFER-05, PUR-01, PUR-02, PUR-03, WIN-01, WIN-02, WIN-03
**Key tasks:**
- [ ] Build offer composer sheet (triggered from vehicle detail screen): price input, optional message, submit to `POST /offers`
- [ ] Build negotiation thread screen: full offer/counter-offer history in chronological list, accept and withdraw actions for buyer, counter-offer action for seller
- [ ] Wire offer status changes to optimistic UI update + TanStack Query invalidation for `GET /offers/:id`
- [ ] Build purchase summary screen: vehicle details, agreed price, seller contact info — shown after offer accepted
- [ ] Build handover confirmation screen: agreed pickup slot / delivery method for both buyer and seller
- [ ] Implement post-transaction rating (buyer rates seller and vice versa)
- [ ] Build auction win celebration screen: vehicle hero image, bid price, winner name, confetti/glow animation
- [ ] Wire win screen "Message Seller" button to the auto-created chat room
- [ ] Build handover confirmation action on win screen
**Success criteria:**
1. Buyer can open a vehicle detail screen and compose an offer with a custom price and optional message — the offer appears immediately in the seller's offers inbox on the seller dashboard
2. Buyer and seller can exchange counter-offers; each party sees the updated offer status in real-time without manual refresh
3. After an offer is accepted, buyer is navigated to the purchase summary screen showing vehicle details, agreed price, and seller contact
4. Winning auction bidder sees a celebration screen with vehicle details and bid price, and can tap through directly to the chat room with the seller
5. Both parties can confirm handover completion and submit a rating for the transaction counterparty
**Pitfall watch:**
- Optimistic UI for offer status must be rolled back correctly on network failure — use TanStack Query's `onError` + `onSettled` callbacks, not a manual `setTimeout` rollback
- The win celebration screen is triggered by a push notification tap (PUSH-04) — ensure the deep-link route handler handles cold-start (app was closed) as well as warm-start navigation
**Dependencies:** Phase 1 (PUSH-04 win notification, PUSH-02/03 offer notifications), Phase 2 (seller dashboard offer inbox)

---

### Phase 7: Mazium AI Search, Map Near Me, and Vehicle Compare
**Goal:** Users can discover vehicles beyond keyword search: through natural-language AI queries, a proximity map with clustering, and side-by-side spec comparisons — all independent discovery enhancements.
**Depends on:** Phase 2 (base navigation and search tab must exist; role dashboards confirm routing is stable)
**Requirements:** AI-01, AI-02, AI-03, AI-04, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, CMP-01, CMP-02, CMP-03, CMP-04
**Key tasks:**
- [ ] Build Mazium AI search screen: natural-language text input, animated "thinking" state, results list linking to vehicle detail screens, refine-and-re-search flow
- [ ] Wire AI search input to the backend natural-language search endpoint
- [ ] Install and configure `react-native-maps` (or Expo Maps); request location permission before map loads
- [ ] Build map / Near Me screen: car listing pins with clustering, radius filter (5/10/25/50 mi), mini-card popover on single pin tap, region-change debounce for pin fetching
- [ ] Implement list view toggle on map screen (distance-sorted list)
- [ ] Add "Add to Compare" action on vehicle detail and search result cards; store selections in Zustand
- [ ] Build compare screen: side-by-side columns for up to 3 vehicles showing price, year, mileage, fuel, transmission, body type, colour
- [ ] Implement remove-and-replace on compare screen; persist compare list across navigation via Zustand
**Success criteria:**
1. User can type "red SUV under £30k with low mileage" into the AI search input, see a thinking animation, and receive a results list of matching vehicles — each linking to a standard vehicle detail screen
2. User can re-enter the AI search input to refine the query and get a fresh results set without restarting the screen
3. User can open the Near Me map, grant location permission, and see listing pins clustered on the map — tapping a cluster expands it; tapping a single pin shows a price and spec mini-card
4. User can filter Near Me by radius and switch between map view and distance-sorted list view
5. User can add up to 3 vehicles to compare from detail or search result screens and view a side-by-side comparison that persists after navigating away and returning
**Pitfall watch:**
- Map pin fetch must be debounced to fire only after `onRegionChangeComplete` (not `onRegionChange`) — fetching on every drag frame causes 20–50 redundant API calls per pan gesture
- Expo Go does not support `react-native-maps` for production map features — this phase requires a development build (available from Phase 1)
**Dependencies:** Phase 1 (dev build required for react-native-maps), Phase 2 (stable tab navigation and search entry points)

---

### Phase 8: App Store Preparation and Submission
**Goal:** The app passes App Store and Play Store review and is available to testers via TestFlight and the internal Android test track — with production-grade assets, privacy manifests, and store metadata.
**Depends on:** Phases 1–7 (all screens must be complete before store submission)
**Requirements:** STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, STORE-07, STORE-08
**Key tasks:**
- [ ] Configure `eas.json` with development, preview, and production build profiles; set correct bundle identifiers and signing
- [ ] Produce production-ready 1024×1024 app icon, adaptive icon (Android), and splash screen assets matching design system
- [ ] Declare Apple Privacy Manifest (`PrivacyInfo.xcprivacy`) in `app.json` for all required API usages (location, camera, photo library, push notifications)
- [ ] Configure `google-services.json` as EAS Secret (not committed to git); verify FCM is connected for Android push
- [ ] Create App Store Connect listing: screenshots (all required device sizes), app description, keywords, age rating, support URL
- [ ] Create Google Play Console listing: screenshots, short/full description, content rating, data safety form
- [ ] Submit first TestFlight build via `eas submit --platform ios` and resolve any review rejections
- [ ] Submit first internal Android test track build via `eas submit --platform android` and resolve any review rejections
**Success criteria:**
1. `eas build --profile production` completes without error for both iOS and Android, producing a signed `.ipa` and `.aab`
2. The app icon, adaptive icon, and splash screen display at the correct resolution and without white borders or compression artefacts on both platforms
3. A TestFlight build is live and an invited tester can install and launch the app on an iOS device
4. An internal Android test track build is live and an invited tester can install and launch the app on an Android device
5. Both store listings have screenshots, descriptions, and required metadata so the listings are publishable without further edits
**Pitfall watch:**
- Apple rejects apps that declare privacy manifest API usages without corresponding entitlements — audit every `NSUsageDescription` key against the actual APIs used in code before submission
- `google-services.json` committed to git (even briefly) will trigger Google's secret scanner and invalidate the Firebase project — use EAS Secrets from day one, never commit the file
**Dependencies:** All prior phases (Phases 1–7) — every screen must exist before store screenshots and review submission

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. EAS Build and Full Push Notification System | 0/TBD | Complete    | 2026-05-30 |
| 2. Buyer, Seller, and Dealer Role Dashboards | 0/5 | Not started | - |
| 3. Sell My Car Wizard and Photo Upload | 0/TBD | Not started | - |
| 4. KYC Identity Verification Flow | 0/TBD | Not started | - |
| 5. Dealer Inventory, CRM Leads, and Auction Manager | 0/TBD | Not started | - |
| 6. Offers, Purchase, and Auction Win Completion | 0/TBD | Not started | - |
| 7. Mazium AI Search, Map Near Me, and Vehicle Compare | 0/TBD | Not started | - |
| 8. App Store Preparation and Submission | 0/TBD | Not started | - |
