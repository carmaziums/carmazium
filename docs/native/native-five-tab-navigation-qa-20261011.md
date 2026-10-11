# CarMazium native app — five-button consumer bottom navigation

Date: 2026-10-11. Stacked on simplified hamburger PR #530. **Draft source; no customer release or APK generated here.**

## Approved navigation

Consumer/personal app bottom bar now displays exactly these five entries, in order:
1. Home → the existing HomeScreen
2. Buy → the existing retail vehicle SearchScreen
3. Sell → the existing SellLandingScreen showing free valuation plus independent FREE dealer-auction and £1 retail listing actions
4. Saved → the existing SavedScreen, preserving watchlists
5. Dashboard → the existing ProfileTabScreen with account/role-aware buyer, seller, contractor and provider dashboards

The prior Auctions bottom bar button is **removed only from the consumer-visible bottom bar**. The `Live` navigator route and `LiveScreen` are retained unchanged for direct links, Buy Cars > Live Auctions, retail Search's Browse Live Auctions CTA, and navigation that already points to `Tabs > Live`. When Live is selected, Buy remains highlighted. Pressing Buy returns to retail vehicle search.

## Preserve existing role support

Dealers continue using their specialist five-button workspace bar:
**Home · Stock · Customers · Buy & Bid · More**.

This avoids losing dealer CRM and stock controls or circumventing permission requirements when accessing the same app. Existing `VIEW_INVENTORY`, `MANAGE_CRM`, `VIEW_TRADE`, KYC/DealerGate and permission-filtered tab visibility remain unchanged. Dealer users previewing personal mode see the consumer five-button bar without changing their account privileges.

The approved 10-item hamburger menu (PR #530) is unchanged and remains available to all roles; it includes Get Valuation, direct Auction/Retail listing shortcuts, TradeXchange, Compare, Pricing, About, Profile Settings, User Dashboard.

## Source and verification

- `carmazium app/carmazium app/src/navigation/TabNavigator.tsx` adds stable `Sell` tab mapping to existing `SellLandingScreen` and updates the consumer-visible filter. Existing Live tab is retained but not rendered as a consumer button.
- `scripts/test-native-consumer-bottom-five-tabs.test.mjs` covers ordered tabs, seller routes, retired visual Auctions button without broken deep link, buyer/role dashboard routing, dealer staff gates, accessibility, and large-font/safe area handling.
- Source test is registered in **One Product Parity** and **Release Certification**, retaining inherited UI tests and native/web/backend typechecks.

## Manual acceptance required

Test Android and iOS on small and large phones and at 200% font scaling: Home → Buy → Sell → Saved → Dashboard navigation, focus indicators, keyboard/back presses, hidden auction link from Buy and menu, valuation entry not being reset unexpectedly, Sell to AUCTION/CLASSIFIED listing flows, dealer/consumer switching, and dealer permission filtering. Confirm bottom bar does not cover the last selling form fields; the selling page already sets bottom page padding.

**No PR merge, customer deployment, production Android download or app-store submission.** Final release remains gated on the outstanding backend security review / deployment (#521), inherited stacked draft PRs and private device QA.
