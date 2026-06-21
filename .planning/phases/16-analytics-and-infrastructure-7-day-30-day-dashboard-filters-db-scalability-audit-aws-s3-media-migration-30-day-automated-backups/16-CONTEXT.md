# Phase 16: Analytics and Infrastructure - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Three improvements in one infrastructure phase: (1) 7-day / 30-day date filter on buyer, seller, and dealer role dashboards; (2) DB scalability audit with safe fixes applied; (3) weekly automated DB backup to a private Supabase Storage bucket. AWS S3 media migration is explicitly deferred — Supabase Storage remains the media store.

</domain>

<decisions>
## Implementation Decisions

### Dashboard date filters — Scope
- **All three role dashboards get the filter:** buyer (`/dashboard/buyer`), seller (`/dashboard/seller`), dealer (`/dashboard/dealer`)
- **Web only** — mobile dashboard parity is a later phase

### Dashboard date filters — UI
- **Segmented button group '7d / 30d'** positioned at the top of each dashboard page, near the page title
- **All KPI tiles are date-filtered** — every metric reflects the selected period (no mixed cumulative/filtered view)
- **Sub-label under each KPI value** showing "Last 30 days" or "Last 7 days" — makes the filter context unambiguous without relying on users noticing the toggle

### Dashboard date filters — State
- **URL query param `?period=7d|30d`** — shareable and bookmarkable; consistent with the delivery filter pattern from Phase 15
- **Default: 30 days** — broader view on first open

### DB scalability audit — Output
- **Report + apply safe fixes** — `docs/db-audit.md` written in the repo; low-risk improvements (missing indexes, constraint checks) applied in the same phase; structural/high-risk changes deferred
- **Audit document location:** `docs/db-audit.md` (version-controlled alongside codebase)

### DB scalability audit — Priority areas
- Slow query patterns: N+1 issues in NestJS service files, `findMany` calls without proper `include`/`select` boundaries
- Table size projections: identify which tables (bids, messages, notifications) will hit Supabase limits first
- Supabase connection pool: verify pool config against expected concurrent load
- RLS policy correctness: check all tables for missing or misconfigured Row Level Security policies (security + scale concern)
- **Not in scope:** Missing indexes on FKs (deferred — lower priority than the above)

### Automated backups — Schedule & retention
- **Weekly backup, 30-day retention** — 4 daily snapshots kept; oldest auto-deleted via Supabase Storage lifecycle or manual cleanup in the cron
- **Backup format:** `db-backup-YYYY-MM-DD.sql.gz` (pg_dump piped through gzip)

### Automated backups — Storage
- **Private 'backups' Supabase Storage bucket** — separate from the 'listings' media bucket; no public URL access
- Path: `backups/db-backup-YYYY-MM-DD.sql.gz`

### Automated backups — Trigger & execution
- **NestJS cron task via @nestjs/schedule** — consistent with the existing delivery expiry cron (`@Cron('0 3 * * *')`)
- **Mechanism:** NestJS cron shells out to `pg_dump` using the existing `DATABASE_URL` env var on Fly.io; output compressed and uploaded via Supabase Storage SDK
- **Failure alert:** Email notification to admin if the backup cron fails; use existing notification infrastructure or direct SMTP

### Claude's Discretion
- Exact cron schedule for backups (e.g. Sunday 2AM UTC vs any day)
- Email failure alert implementation detail (nodemailer vs existing notification service)
- Retention cleanup implementation (Supabase Storage list + delete for files older than 30 days within the cron itself)
- Specific SQL queries used to assess table sizes and connection pool in the audit

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/delivery/delivery-expiry.service.ts` — existing `@Cron` NestJS pattern; backup service follows exact same structure
- `backend/src/tasks/tasks.module.ts` — where all cron services are registered; backup service registers here
- `@nestjs/schedule` — already installed and in use; no new dependency needed
- `src/lib/supabase.ts` — existing Supabase client; Storage SDK available for backup upload

### Established Patterns
- Existing 7d/30d backend query pattern: dashboard API endpoints likely need a `period=7d|30d` query param; planner checks `backend/src/*/\*.service.ts` for existing dashboard methods
- URL filter param pattern established in Phase 15 (`deliveryAvailable` as URL param in search); same approach for `?period=`
- KpiTile component already accepts a `subLabel` prop — use it for "Last 30 days" label
- Supabase Storage upload: `uploadImage()` in `src/lib/supabase.ts` is the existing client-side pattern; server-side backup upload uses the admin Supabase client (service role key)

### Integration Points
- Buyer dashboard: `src/app/dashboard/buyer/index.tsx` and sub-pages (`bids.tsx`, `offers.tsx`, `history.tsx`)
- Seller dashboard: `src/app/dashboard/seller/index.tsx` and sub-pages
- Dealer dashboard: `src/app/dashboard/dealer/index.tsx` and sub-pages
- Backend dashboard API endpoints: planner to identify and extend with `period` param
- `backend/src/tasks/tasks.module.ts` — backup service registered here alongside delivery expiry

</code_context>

<specifics>
## Specific Ideas

- The '7d / 30d' button group should match the visual style of existing segmented controls on the platform (pill buttons, active state highlighted)
- Backup file naming: `db-backup-2026-06-21.sql.gz` — human-readable date makes manual recovery obvious
- The audit should produce a concrete `docs/db-audit.md` with a "Findings" table: table name, issue, severity, fix applied (yes/no)

</specifics>

<deferred>
## Deferred Ideas

- **AWS S3 media migration** — Moving listing images from Supabase Storage to a real AWS S3 bucket is explicitly deferred. Current setup (Supabase Storage) works fine. When ready: presigned URL upload pattern, `listings/{listingId}/{filename}` bucket structure, full migration script to re-upload and rewrite DB URLs. Can be its own phase.
- **Missing FK indexes** — The audit will identify these but applying FK indexes is lower priority and deferred unless the audit finds a critical hotspot.
- **Mobile dashboard date filters** — Web-only in Phase 16; mobile parity in a later phase.
- **CloudFront CDN** — Not needed at current scale; revisit when S3 migration happens.

</deferred>

---

*Phase: 16-analytics-and-infrastructure*
*Context gathered: 2026-06-21*
