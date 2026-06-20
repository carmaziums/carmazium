---
phase: 12
slug: auction-enhancements-buy-it-now-instant-purchase-cancel-bid-fat-finger-window
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (jest-expo preset) |
| **Config file** | `backend/jest.config.js` (existing) |
| **Quick run command** | `npx jest bids.service.spec --no-coverage` (from backend dir) |
| **Full suite command** | `npx jest --no-coverage` (from backend dir) |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest bids.service.spec --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | BIN DB schema | manual | `npx prisma migrate dev` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | BIN trigger endpoint | unit | `npx jest auctions.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | BIN trigger rejects if reserve met | unit | `npx jest auctions.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | BIN confirm ends auction + creates Sale | unit | `npx jest auctions.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | BIN decline resumes auction | unit | `npx jest auctions.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 12-01-06 | 01 | 1 | BIN pending auto-cancel on bid >= BIN | unit | `npx jest bids.service.spec --no-coverage` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | Cancel bid DB field | manual | `npx prisma migrate dev` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | Cancel bid rejected after 2 min | unit | `npx jest bids.service.spec --no-coverage` | ✅ (new test) | ⬜ pending |
| 12-02-03 | 02 | 2 | Cancel bid rejected if not high bidder | unit | `npx jest bids.service.spec --no-coverage` | ✅ (new test) | ⬜ pending |
| 12-02-04 | 02 | 2 | Cancel bid rejected if auction ended | unit | `npx jest bids.service.spec --no-coverage` | ✅ (new test) | ⬜ pending |
| 12-02-05 | 02 | 2 | Cancelled bid excluded from top-bid query | unit | `npx jest bids.service.spec --no-coverage` | ✅ (new test) | ⬜ pending |
| 12-03-01 | 03 | 3 | BIN UI in live auction room | manual | visual inspection in browser | N/A | ⬜ pending |
| 12-03-02 | 03 | 3 | Cancel countdown button visible only to bidder | manual | visual inspection in browser | N/A | ⬜ pending |
| 12-03-03 | 03 | 3 | BIN UI in listing detail sidebar | manual | visual inspection in browser | N/A | ⬜ pending |
| 12-03-04 | 03 | 3 | BIN field in auction creation form | manual | visual inspection in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/auctions/auctions.service.spec.ts` — create file with BIN lifecycle tests (does not exist yet)
- [ ] `backend/src/bids/bids.service.spec.ts` — add 4 cancel-bid edge case tests (file exists, needs new test blocks)

*Wave 0 runs at start of Plan 01 execution before any implementation tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BIN countdown button visually drains | UX requirement | CSS/SVG animation — untestable in unit tests | Open live auction room, place bid, verify circular arc animates over 2 minutes |
| BIN pending banner shown to other viewers | UX requirement | Requires multi-user browser session | Open auction room in two browsers; trigger BIN in one; verify banner appears in other |
| BIN disappears when reserve met | UX requirement | Real-time UI state | Place bid >= reserve; verify BIN section hides with "Reserve met" message |
| Seller sees BIN confirm/decline UI in dashboard | UX requirement | User role-specific UI | Log in as seller; verify BIN request notification + action buttons appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
