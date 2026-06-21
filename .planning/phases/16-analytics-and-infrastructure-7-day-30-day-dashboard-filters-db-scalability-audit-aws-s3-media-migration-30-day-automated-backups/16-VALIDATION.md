---
phase: 16
slug: analytics-and-infrastructure-7-day-30-day-dashboard-filters-db-scalability-audit-aws-s3-media-migration-30-day-automated-backups
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest ^30.0.0 (backend) |
| **Config file** | `backend/package.json` `"jest"` section |
| **Quick run command** | `cd backend && npx jest --testPathPattern "(dashboard|db-backup)" --passWithNoTests` |
| **Full suite command** | `cd backend && npx jest` |
| **Estimated runtime** | ~20 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --testPathPattern "(dashboard|db-backup)" --passWithNoTests`
- **After every plan wave:** Run `cd backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | DASH-FILTER-01,02,03 | unit (RED) | `npx jest --testPathPattern dashboard.service` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | BACKUP-01,02,03 | unit (RED) | `npx jest --testPathPattern db-backup` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | DASH-FILTER-01,02,03 | unit (GREEN) | `npx jest --testPathPattern dashboard.service` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | BACKUP-01,02,03 | unit (GREEN) | `npx jest --testPathPattern db-backup` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 3 | DASH-UI-01 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-03-02 | 03 | 3 | DASH-UI-02 | manual + tsc | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-04-01 | 04 | 4 | DB-AUDIT-01 | manual | `cat docs/db-audit.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/dashboard/dashboard.service.spec.ts` — RED stubs for DASH-FILTER-01, DASH-FILTER-02, DASH-FILTER-03
- [ ] `backend/src/tasks/db-backup.service.spec.ts` — RED stubs for BACKUP-01, BACKUP-02, BACKUP-03
- [ ] Supabase 'backups' bucket created manually via Supabase Storage dashboard (prerequisite for real backup runs — one-time human action)
- [ ] Verify `pg_dump` available on Fly.io image; add `postgresql-client` to Dockerfile if missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| '7d / 30d' toggle visible at dashboard top | DASH-UI-01 | Visual UI — not unit-testable | Open each role dashboard, confirm segmented control appears near page title |
| KPI tiles show sub-label 'Last 30 days' | DASH-UI-02 | Visual rendering | Select each period, verify sub-label text updates under each tile |
| Weekly backup cron runs and uploads | BACKUP-LIVE | Real external service | Trigger cron manually, check Supabase Storage 'backups' bucket for new file |
| DB audit document produced | DB-AUDIT-01 | Document output | Run audit task, verify `docs/db-audit.md` exists with Findings table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
