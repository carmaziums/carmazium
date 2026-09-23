# CarMazium One Product Parity Programme

## Goal

CarMazium must behave as one product across the website and native app.

The website and mobile app may use different UI components, navigation systems and platform-specific interaction patterns, but they must not disagree about:

- pricing, fees, seller rewards or payout splits;
- user roles, permissions and verification gates;
- listing, auction, offer, payment and handover states;
- HPI availability and package entitlements;
- service-provider requirements and approval gates;
- validation rules and lifecycle transitions;
- chat, notification and payment semantics;
- what a user can do at each step of the same journey.

The NestJS backend is the authoritative business-rule layer. Web and mobile are clients of the same product contract.

## Current baseline

The repository currently contains a mature Next.js website and an Expo/React Native app in the same Git repository. They already share the production backend, but some frontend rules are duplicated. Examples found during the September 2026 audit include:

- duplicated auction pricing helpers in web and mobile;
- duplicated pricing configuration in web and mobile plus enforced values in backend payment services;
- separate web/mobile API clients;
- web Partner / TradeXchange provider dashboards with no native mobile equivalent yet;
- older parity audit documents that require manual re-checking as the product evolves.

`product-parity.json` is now the machine-readable feature map.
`scripts/check-product-parity.mjs` is the CI tripwire for high-risk shared rules.

## Rules for future work

1. A business-rule change is not complete until backend enforcement and every affected client are updated in the same change.
2. Do not add a price, percentage, workflow status or permission only in UI code when the backend can own it.
3. Every customer/dealer/seller/partner feature must be represented in `product-parity.json`.
4. A feature marked `required` must retain both web and mobile surfaces.
5. A feature marked `gap` is active remediation work, not an accepted permanent exception.
6. Any intentional platform-only surface must be documented with a reason.
7. Backend APIs are the contract. Swagger/OpenAPI is the long-term type contract for both clients.
8. Native mobile UX does not need to look pixel-identical to web; behaviour, entitlements and business outcomes do.

## Ten-block remediation programme

### Block 1 — Contract and drift prevention
- Maintain the parity manifest.
- Guard pricing, auction pricing, service fee split and backend API target in CI.
- Type-check web, backend and mobile together on parity-sensitive changes.
- Establish backend/OpenAPI as the shared contract.

### Block 2 — Authentication, account model and roles
- Login, signup, verification, password reset and onboarding parity.
- Buyer / Trader / Seller / Partner / service-provider role gates.
- Dealer KYC, ID/address verification and staff-account behaviour.

### Block 3 — Public marketplace
- Home, search, filters, vehicle detail, compare, saved/watchlist.
- Retail and auction presentation.
- HPI availability, valuation display and public contact rules.

### Block 4 — Seller journey
- Valuation to listing creation.
- Retail package selection and payments.
- Auction creation, reserve guidance, relisting/retail conversion and handover.
- Seller dashboard, offers, earnings, analytics and settings.

### Block 5 — Buyer journey
- Retail purchase/enquiry.
- Auction bidding, winner fee, inspection/refusal behaviour and post-win contact.
- Offers, history, delivery and messages.

### Block 6 — Trader/dealer journey
- KYC gate, bidding, inventory, CRM, offers, purchases, earnings, finance, analytics, team permissions and dealer listing tools.

### Block 7 — Partner / TradeXchange provider journey
- Partner Account.
- Delivery & Recovery, Inspection, Finance and Warranty capabilities.
- Verification-document uploads.
- Matching settings, jobs, leads, chat, Stripe payouts and team permissions.
- This is currently the largest known mobile surface gap.

### Block 8 — Payments, HPI, chat and notifications
- Stripe checkout and Connect.
- Seller reward and service-provider payout lifecycle.
- HPI purchase/entitlements.
- Realtime chat, push/in-app notifications and tap routing.

### Block 9 — Navigation, visual system, accessibility and performance
- Equivalent reachable journeys.
- Theme parity and shared terminology.
- Mobile-native navigation/back-stack correctness.
- Loading, empty, error and offline states.
- Accessibility and performance checks.

### Block 10 — End-to-end certification and release gate
- Run matched web/mobile test journeys against the same production-like backend.
- Verify all `gap` entries are closed or explicitly approved as platform-only.
- Produce a final parity report.
- Keep CI enforcement in place so parity does not regress.

## Intent

This programme is not a one-time visual port. Its purpose is to stop CarMazium from becoming two independently maintained products again.
