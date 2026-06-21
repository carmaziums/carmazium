---
phase: 15
slug: delivery-and-distance-system-seller-delivery-toggle-price-per-km-auto-calculation-buyer-delivery-request-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (NestJS backend unit tests) |
| **Config file** | `backend/jest.config.js` |
| **Quick run command** | `cd backend && npx jest delivery --no-coverage` |
| **Full suite command** | `cd backend && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest delivery --no-coverage`
- **After every plan wave:** Run `cd backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | DEL-01 through DEL-08 | unit stubs | `cd backend && npx jest delivery.service.spec --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-01-02 | 01 | 0 | DEL-09 (expiry sweep) | unit stub | `cd backend && npx jest delivery-expiry.service.spec --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-01 | 02 | 1 | DEL-01 (no offer guard) | unit | `cd backend && npx jest delivery.service.spec -t "rejects if buyer has no offer" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-02 | 02 | 1 | DEL-02 (duplicate guard) | unit | `cd backend && npx jest delivery.service.spec -t "rejects duplicate active request" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-03 | 02 | 1 | DEL-03 (radius guard) | unit | `cd backend && npx jest delivery.service.spec -t "rejects out-of-radius request" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-04 | 02 | 1 | DEL-04 (stores cost) | unit | `cd backend && npx jest delivery.service.spec -t "stores distance and cost" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-05 | 02 | 1 | DEL-05 (accept guard) | unit | `cd backend && npx jest delivery.service.spec -t "accept forbidden for non-seller" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-06 | 02 | 1 | DEL-06 (decline notification) | unit | `cd backend && npx jest delivery.service.spec -t "decline sends buyer notification" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-07 | 02 | 1 | DEL-07 (cancel guard) | unit | `cd backend && npx jest delivery.service.spec -t "cancel rejects non-PENDING" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-08 | 02 | 1 | DEL-08 (complete guard) | unit | `cd backend && npx jest delivery.service.spec -t "complete rejects non-ACCEPTED" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-02-09 | 02 | 1 | DEL-09 (expiry sweep) | unit | `cd backend && npx jest delivery-expiry.service.spec -t "expires PENDING past expiresAt" --no-coverage` | ❌ Wave 0 | ⬜ pending |
| 15-03-01 | 03 | 2 | DEL-10 | manual | Create listing with delivery, check DB | manual | ⬜ pending |
| 15-03-02 | 03 | 2 | DEL-11 | manual | Type postcode in form, see cost update live | manual | ⬜ pending |
| 15-03-03 | 03 | 2 | DEL-12 | manual | Search for delivery-enabled listing, check CarCard badge | manual | ⬜ pending |
| 15-04-01 | 04 | 3 | DEL-13 | manual | Submit delivery request, check notifications inbox + email | manual | ⬜ pending |
| 15-04-02 | 04 | 3 | DEL-14 | manual | Accept delivery, check buyer in-app + email received | manual | ⬜ pending |
| 15-04-03 | 04 | 3 | DEL-15 | manual | Set expiresAt to past, trigger sweep, check buyer notification | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/delivery/delivery.service.spec.ts` — 8 unit stubs (DEL-01 through DEL-08): no-offer guard, duplicate guard, radius guard, stores cost, accept forbidden, decline notification, cancel non-PENDING guard, complete non-ACCEPTED guard
- [ ] `backend/src/delivery/delivery-expiry.service.spec.ts` — 1 unit stub (DEL-09): expiry sweep cancels PENDING past `expiresAt`
- [ ] `DeliveryStatus` enum + `DeliveryRequest` model in `schema.prisma` must exist before service stubs can compile

*All other test infrastructure (Jest, `@nestjs/testing`) is already present in the backend.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seller delivery fields saved on listing create/update | DEL-10 | DB write — no in-scope service unit test | Create listing with delivery section filled; check DB record for `deliveryAvailable=true`, `deliveryPricePerMile`, `deliveryMaxMiles` |
| Live cost preview updates as buyer types postcode | DEL-11 | Requires browser interaction with Next.js API route + Google Maps call | Open delivery request form in offer thread; type postcode; verify cost updates live before submitting |
| CarCard delivery badge visible in search results | DEL-12 | Visual UI state requiring live data | Enable delivery on a listing; search for it; confirm truck/delivery badge renders on CarCard |
| Seller receives in-app + email on new delivery request | DEL-13 | Notification pipeline across two channels | Submit delivery request as buyer; check seller's notification bell and email inbox |
| Buyer receives in-app + email on accept/decline | DEL-14 | Notification pipeline across two channels | Accept delivery request as seller; check buyer's notification bell and email |
| 48h expiry: buyer notified when request auto-cancels | DEL-15 | Requires time manipulation or direct DB update | Set `expiresAt` to a past datetime in DB; trigger expiry cron; confirm buyer receives "expired" notification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
