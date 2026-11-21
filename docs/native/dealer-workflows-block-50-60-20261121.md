# CarMazium Android versus mobile website — Dealer block 50–60%

Date: 21 November 2026. This is the sixth ten-percent work-plan checkpoint, **not** a claim of 60% achieved visual or functional parity.

## Environment and matched role

- Laptop: DESKTOP-LPIB4R3. Emulator: BlueStacks Samsung SM_S908E (`emulator-5554`), same Android device used for BOTH app and Chrome comparisons.
- App: `uk.carmazium.app` installed versionCode **121**, versionName 1.0.1. Browser: live `carmazium.com` in Chrome *inside that same emulator*.
- Same authenticated Pulse Cars Limited dealer account previously confirmed on both surfaces; dealer screens continued to show this account.
- No test bid, offer, purchase, cancellation, seller funds confirmation, handover, job bid, payment, message send, or other production mutation was performed.
- Screenshot evidence in private laptop directory `C:\Users\Dell\CarMazium-QA-Tools\`:
  - `dealer-5060-web-bids.png` and `dealer-5060-app-bids.png`
  - `dealer-5060-web-offers.png` and `dealer-5060-app-offers2.png`
  - `dealer-5060-web-purchases.png` and `dealer-5060-app-purchases.png`
  - `dealer-5060-web-services.png` and `dealer-5060-app-services.png`
  - `dealer-5060-web-messages-settled.png` and `dealer-5060-app-messages.png`
  - The native Auctions hub was captured separately in `dealer-5060-app-bids-hub.png`.
- Screenshots containing customer identities and messages are QA evidence only, not for public upload.

## Account-to-account findings

### Bids & Offers
- Website and app both showed **0 active auction bids** for this dealer.
- Website `/dashboard/dealer/bids` shows header, Refresh, Auction bids / Retail offers switch, count, white empty-state panel, and **Browse Live Auctions** CTA.
- Installed native screen showed the switch before Refresh, full-width Refresh, plain text-only empty state, and a separate history/cancellations button. The website's empty-state CTA was missing.
- Code change: move Refresh ahead of the switch, style the empty state as a card with the same title and explanatory text, and add a **Browse Live Auctions** button that switches to the existing native live-auctions section. Existing history/cancellation access is preserved.
- Placing a bid, cancelling and history actions not exercised; cannot claim end-to-end bid parity.

### Offers received
- Both website and installed app displayed **0 pending, 0 accepted and 1 total received**; one withdrawn buyer offer appeared in the registry.
- The website uses coloured MetricCard tiles with icon, uppercase status and label, prominent count and decorative coloured lower edge. The installed native summary cards were plain.
- Code change: native metric cards now use website-aligned status headings, icons, spacing, semantics and warning/success/info colour cues. Counts use `getDealerOfferMetrics` and exactly match the website logic: PENDING and ACCEPTED status counts plus total length.
- No response, counter, sale or cancellation mutation tested.

### Purchases, auction wins and handovers
- Both website and app showed **no in-progress purchases** in the All filter, with In progress / Completed / Cancelled stages, search and All / Auction / Retail filters. Both exposed an auction wins and £125 fee / handover link.
- The website has a bordered "No purchases yet" card and visible stage sections; app renders a larger centre-aligned empty state. This remains a visual gap.
- No live purchase was in progress to test handover or £125 payment; no money-moving actions performed. Completed, Cancelled, Retail and detailed historical records were not exhaustively compared in the emulator.
- Existing native purchase tests re-run, including recovered purchase history and status preservation: **4 Node tests passed**.

### TradeXchange services
- Website Available Jobs and native Service Jobs both showed **Available (0)**, **My Work (0)**, and the same "No matching jobs right now" guidance.
- The native app adds All / Delivery / Inspection filters, Job messages, a service area/verification shortcut and a prominent Post a job button; the web has an inline Post a job here link. These remain UX/layout differences, though the common workflow is native.
- No job bid, approval, acceptance or completion tested because there were no visible matching jobs.

### Messages
- Both surfaces showed **26 conversations** with the same support thread and same visible customer-conversation order. The app's message list has taller rows and greater top spacing; website uses compact cards and a different header/search hierarchy.
- No new message was sent and no thread read/unread state was intentionally changed. Thread-level message-scroll and account notifications remain for later regression.

## Source changes on isolated development worktree

- `src/screens/main/DealerOffersScreen.tsx`: styled metric cards; retained the existing received-offer API and all action handlers.
- `src/lib/dealerOfferSummary.ts` and test: pure summary calculation, matching website Pending/Accepted/Total rules.
- `src/screens/main/DealerAuctionBuyingSections.tsx`: website-style bid empty-state card and safe Browse Live Auctions action; Refresh order adjusted and history access preserved.
- `src/screens/main/DealerBuyBidScreen.tsx`: pass tab switch separately so Refresh appears before tabs as on the website; use the website-style sentence-case bid-page heading.
- Updated font sizes to existing design tokens without altering underlying numeric values.

## Automated checks

- **34 Jest tests passed** across 6 suites (dealer offers, listing entry/cover, dashboard, admin records, native tour).
- **4 native recovered-purchase/history Node tests passed**.
- TypeScript `tsc --noEmit` passed (exit 0).
- ESLint on changed source files passed (exit 0).
- `git diff --check` to be verified before the commit.

## Release and follow-up limitations

- These changes are **source-only**. The existing installed build 121 has not been replaced, signed, or visually tested with this new code.
- Public Android download remains unchanged by this block. Existing app data and credentials preserved; the application was force-stopped/relaunched once without data deletion to restore the dashboard.
- Differences still unresolved: messages spacing/header, purchase empty states and stage detail layout, service controls and web copy, full dealer bid/offer mutations, complete handovers and transaction history, deeper auction wins and retrospective purchases.
- No blanket "0.01% difference" or "100% parity" statement is justified until signed QA build testing across all roles and supported phone variants.
- **Stop at 60% work-plan checkpoint**. Only the next explicit "proceed" authorises **60–70% buyer/seller-to-buyer/seller dashboard, navigation, search and vehicle detail**. Remaining dealer issues stay on regression backlog.
