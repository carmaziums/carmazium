# Carmazium

## What This Is

Carmazium (`carmazium.co.uk`) is a UK-focused premium automotive marketplace where sellers can list cars for £1 and buyers can browse retail listings or participate in real-time auctions. The platform serves buyers, private sellers, dealers, and partner roles (finance, insurance, service) behind a unified dark-luxury interface.

The product has two surfaces: a **production web app** (Next.js 15, Tailwind v4, Framer Motion, Supabase — live at carmazium.co.uk) and a **React Native mobile app** (Expo Router 4, NativeWind, TanStack Query, Supabase auth — scaffold in `mobile/`).

## Core Value

A verified, premium car marketplace where buying and selling is transparent, fast, and cinematic — whether on web or mobile.

## Current Milestone: v1.0 Mobile App

**Goal:** Deliver a production-ready React Native mobile app covering all buyer, seller, and dealer flows — built on the existing backend with full design system fidelity.

**Target features:**
- Role-specific dashboards (buyer, private seller, dealer)
- Sell My Car multi-step wizard (DVLA lookup → condition → publish)
- Dealer flows (inventory, CRM leads, analytics, auction management)
- KYC / identity verification flow
- Mazium AI natural language search
- Map / Near Me geo-browse
- Vehicle compare (side-by-side)
- Push notifications (Expo Notifications + backend WebSocket)
- Offer composer and negotiation thread
- Purchase & handover confirmation screens
- App store preparation (EAS Build, metadata, screenshots)

## Requirements

### Validated

<!-- Nothing shipped yet on mobile — scaffold complete as of 2026-05-30 -->

- ✓ Project scaffold — Expo 52 + Expo Router 4 + NativeWind + TanStack Query + Zustand + Socket.IO — mobile/
- ✓ Design tokens — CZM colour/type/spacing constants ported from design system — mobile/src/constants/tokens.ts
- ✓ API client layer — listings, auctions, watchlist, chat, offers, dashboard — mobile/src/lib/api/
- ✓ Socket.IO client — /auctions (public), /chat, /notifications (authenticated) — mobile/src/lib/socket/
- ✓ Zustand stores — auth, auction — mobile/src/store/
- ✓ UI atoms — CzButton, CzBadge, CzChip, CzPrice, CzEyebrow, CzScreen, CzTabBar — mobile/src/components/ui/
- ✓ Auth screens — Onboarding (3-slide), Login (Supabase Bearer), Signup — mobile/app/(auth)/
- ✓ Tab screens — Home, Search, Live Auctions, Saved/Watchlist, Profile — mobile/app/(tabs)/
- ✓ Detail screens — Vehicle Detail, Live Auction Room (WebSocket), Messages inbox + conversation — mobile/app/

### Active

- [ ] Buyer dashboard (bids, offers, order history, stats KPIs)
- [ ] Private seller dashboard (listings, offers inbox, accept/counter/decline, earnings)
- [ ] Dealer dashboard (revenue KPIs, lead funnel, inventory snapshot)
- [ ] Dealer analytics (sales charts, velocity, AI conversion insight)
- [ ] Dealer inventory management (list, edit, status change)
- [ ] Dealer CRM leads (AI-scored inbox, hot/warm/cold, quick reply)
- [ ] Dealer auction manager (live auctions, schedule new)
- [ ] Sell My Car wizard (DVLA reg lookup → details → condition → photos → review → publish)
- [ ] KYC / identity verification (licence upload, liveness check, pending state)
- [ ] Dealer onboarding (business details, verify, connect)
- [ ] Mazium AI natural-language search (input + thinking state + results)
- [ ] Map / Near Me (geo-browse with car pins, radius filter, distance list)
- [ ] Vehicle compare (side-by-side spec comparison, 2-3 cars)
- [ ] Make an offer / negotiation thread (composer, counter-offer, accept/decline)
- [ ] Purchase & handover screens (summary, slot booking)
- [ ] Auction win + completion (win celebration, handover confirmed, rate seller)
- [ ] Push notifications (Expo Notifications, permission flow, backend webhook)
- [ ] Notification preferences (category toggles, quiet hours, delivery channel)
- [ ] App store preparation (EAS Build config, icons, splash, metadata, screenshots)

### Out of Scope

- In-app payments / Stripe flow — Platform facilitates communication only; no payment processing on mobile (same decision as web)
- 3D car model viewer — Three.js / React Three Fiber not viable in React Native; use photo gallery instead
- Admin dashboard on mobile — Admin flows stay web-only; complexity not justified for mobile
- Finance/Insurance/Service partner dashboards — Partner roles are web-only for v1 mobile
- Web scraping / external data feeds — Not part of Carmazium's architecture

## Context

**Backend:** NestJS deployed at `https://carmazium-hjoh9w.fly.dev`. SessionAuthGuard supports BOTH session cookies AND Bearer tokens — mobile sends `Authorization: Bearer <supabase_access_token>`, backend auto-creates session. No backend changes needed for mobile auth.

**Design system:** `CarMazium Design System/ui_kits/carmazium-mobile/` contains 25+ screen sections (JSX mockups) covering every flow. Each screen file is the direct reference for implementation.

**Brand:** Dark-first, cinematic, premium. Red `#ff0037` on slate `#0a0d14`. Poppins headings, Montserrat body, JetBrains Mono prices/countdowns. Chamfered buttons, glass cards, neon glow.

**WebSockets:** Three namespaces — `/auctions` (public, live bidding), `/chat` (authenticated, messaging), `/notifications` (authenticated, push-equivalent).

**Key auction rules (locked):** Fixed 5h duration, anti-snipe +3min on bid in final 3min, cron lifecycle every minute, post-auction auto-creates ChatRoom between winner + seller.

## Constraints

- **Tech stack:** Expo SDK 52 + Expo Router 4 — locked to scaffold versions
- **Design fidelity:** Must match CarMazium Design System exactly — no colour or type deviations
- **Backend:** Existing NestJS API — no schema or endpoint changes unless absolutely required
- **Auth:** Supabase Bearer token auth only — no custom JWT or session bridging
- **No payments:** Platform is communication-only; never trigger financial transactions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo Router 4 (file-based) | Same mental model as Next.js app/ directory the team uses | — Pending |
| NativeWind v4 for styling | Reuses Tailwind token muscle memory; maps design kit tokens | — Pending |
| Supabase Bearer auth (no cookie session) | Mobile can't reliably send cookies; Bearer token path already in SessionAuthGuard | ✓ Good |
| TanStack Query for server state | Same library works in RN; team familiar from web | — Pending |
| Socket.IO client (existing backend) | Backend already uses Socket.IO; no alternative needed | ✓ Good |
| No 3D model viewer on mobile | React Three Fiber not viable in RN; photo gallery sufficient | ✓ Good |

---
*Last updated: 2026-05-30 — Milestone v1.0 Mobile App started*
