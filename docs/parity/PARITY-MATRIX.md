# CarMazium — Mobile/Web Parity Matrix

The capability diff between the Next.js web app (`src/`) and the React Native
mobile app (`carmazium app/carmazium app/`), with the NestJS API (`backend/src/`)
as the contract source of truth.

## Rules
- **ID** is `<PASS>-<NNN>` (e.g. `SELL-014`). IDs are permanent. Never renumber, never reuse.
- **Mobile status** is one of:
  - `MISSING` — no mobile implementation at all
  - `PARTIAL` — exists but incomplete vs web
  - `DIVERGENT` — exists but behaves differently from web
  - `PRESENT` — implemented and traced; requires a mobile `file:line` in Notes that proves it
  - `NEEDS_VERIFICATION` — code written this session, awaiting device testing
  - `VERIFIED` — **set by the repo owner only.** Never set by Claude.
- **Gap type**: functionality / visual / data / navigation / state / permissions
- **Effort**: S / M / L
- **Priority**: P0 / P1 / P2 / P3
- Never rewrite a row that was not audited in the current session.

## Passes
| Pass | Scope | Status |
|---|---|---|
| AUTH | onboarding, sign-up/sign-in, session persistence, roles, permission gating, deep links, logout/expiry | Not started |
| BUY | browse, search, filters, sort, listing detail, saved items, enquiry/offer, checkout | Not started |
| SELL | create listing, media upload, pricing/reserve, publish, edit/manage, close/withdraw | Not started |
| AUCTION | bidding, timers, reserve logic, outbid states, auction end, post-auction states | Not started |
| DASH | buyer/seller dashboards, status transitions, empty states, notifications, messaging, profile/settings | Not started |
| CROSS | error/loading/empty states, offline, refresh, pagination, toasts, design tokens, navigation structure | Not started |

## Matrix

| ID | Pass | Flow | Capability | Web (file:line) | API endpoint | Mobile status | Gap type | Effort | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
