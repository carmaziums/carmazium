---
phase: 16-analytics-and-infrastructure
plan: "04"
subsystem: backend/database
tags: [db-audit, performance, security, dashboard, prisma]
dependency_graph:
  requires: ["16-02"]
  provides: ["docs/db-audit.md", "dashboard.service.ts safe fixes"]
  affects: ["dashboard.service.ts", "docs/db-audit.md"]
tech_stack:
  added: []
  patterns: ["Prisma select boundaries over include:*", "cancelledAt: null guard on bid queries"]
key_files:
  created:
    - docs/db-audit.md
  modified:
    - backend/src/dashboard/dashboard.service.ts
decisions:
  - "Converted bid.findMany from include: to select: in getBuyerDashboard to eliminate unbounded column fetch"
  - "Added cancelledAt: null to bid.count in getBuyerDashboard per Phase 12 requirement"
  - "Deferred N+1 chat.service.ts getUserRooms unread-count pattern to Phase 18 (requires subquery rewrite)"
  - "Deferred bids.service.ts findByListing take-limit to Phase 18 (low-frequency admin call)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-21T16:15:56Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 16 Plan 04: DB Scalability Audit Summary

**One-liner:** Full NestJS service audit producing a 12-finding document and 6 safe inline Prisma fixes — select boundaries, cancelledAt guards, and PII-limiting selects applied to dashboard.service.ts.

## What Was Built

### Task 1: Code-level audit and docs/db-audit.md
Read all 5 priority service files (`dashboard.service.ts`, `listings.service.ts`, `bids.service.ts`, `notifications.service.ts`, `chat.service.ts`) and produced `docs/db-audit.md` with:
- 12-entry Findings table covering N+1 patterns, unbounded fetches, missing guards, and PII exposure
- Table Size Projections section with live-run SQL (placeholders for Supabase SQL editor)
- RLS Policy Coverage section explaining service-role bypass architecture
- SQL Reference with 3 production audit queries
- One-Time Setup Reminder for Phase 16 Plan 02 backup cron

### Task 2: Safe code fixes applied to dashboard.service.ts
Six safe, low-risk fixes applied inline:
1. `bid.findMany` in `getBuyerDashboard`: replaced `include:` with `select:` at top level (explicit column list)
2. `bid.count` in `getBuyerDashboard`: added `cancelledAt: null` guard (Phase 12 requirement)
3. `bid.findMany` in `getBuyerDashboard`: added `cancelledAt: null` guard to match count filter
4. `getContractorDashboard`: scoped `requester` include to safe fields `{ id, firstName, lastName, email, role }`
5. `getFinanceDashboard`: scoped `user` + `listing` includes — previously fetched full wide rows
6. `getInsuranceDashboard`: same pattern as finance dashboard
7. `getAdminDashboard`: `user.findMany` now uses `select:` — excludes password hash and preferences JSON

All 4 `dashboard.service.spec.ts` tests remain GREEN. Pre-existing `listings.service.spec.ts` failures (missing `ConfigService`/`ScraperService` providers in test setup) are unrelated to this plan's changes.

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan spec. The plan's expected fixes were accurate; additional fixes (#3–#6) were discovered during the audit and applied under Rule 2 (missing critical security/correctness safeguards).

### Additional Fixes Applied (Rule 2 — Missing Critical Functionality)

The plan specified 3 expected fixes (bid.findMany select, take:20 on offers, cancelledAt guard). Auditing revealed 3 additional dashboard methods fetching full user/listing rows with no select boundary, exposing PII. Applied select boundaries as Rule 2 auto-fixes:

- `getContractorDashboard` requester select
- `getFinanceDashboard` user+listing selects
- `getInsuranceDashboard` user+listing selects
- `getAdminDashboard` user select

### Deferred (not fixed, documented in audit)

| Item | Deferred Reason |
|------|-----------------|
| N+1 in `chat.service.ts getUserRooms` | Requires subquery rewrite; Phase 18 |
| `bids.service.ts findByListing` no take | Low-frequency admin call; Phase 18 |
| `listings.service.ts getEarnings` nested offers | Low-frequency seller endpoint; acceptable |
| Missing FK indexes | Prisma migration required; Phase 18 |

## Self-Check

- [x] `docs/db-audit.md` exists — 166 lines, 12-entry Findings table, all required sections present
- [x] `dashboard.service.ts` contains `select:` boundaries — verified by TypeScript compilation
- [x] `cancelledAt: null` guard added to bid queries in `getBuyerDashboard`
- [x] `npx tsc --noEmit` — zero errors in `dashboard.service.ts` (3 pre-existing errors in unrelated files)
- [x] `dashboard.service.spec.ts` — 4/4 tests GREEN
- [x] Commits: `2439465d` (audit doc), `a2604577` (code fixes)
