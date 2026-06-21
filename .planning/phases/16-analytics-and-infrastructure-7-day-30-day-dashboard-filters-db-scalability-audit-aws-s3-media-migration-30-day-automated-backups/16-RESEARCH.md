# Phase 16: Analytics and Infrastructure - Research

**Researched:** 2026-06-21
**Domain:** Next.js dashboard filters, NestJS cron/backup, PostgreSQL/Prisma audit patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard date filters — Scope**
- All three role dashboards get the filter: buyer (`/dashboard/buyer`), seller (`/dashboard/seller`), dealer (`/dashboard/dealer`)
- Web only — mobile dashboard parity is a later phase

**Dashboard date filters — UI**
- Segmented button group '7d / 30d' positioned at the top of each dashboard page, near the page title
- All KPI tiles are date-filtered — every metric reflects the selected period (no mixed cumulative/filtered view)
- Sub-label under each KPI value showing "Last 30 days" or "Last 7 days" — makes the filter context unambiguous

**Dashboard date filters — State**
- URL query param `?period=7d|30d` — shareable and bookmarkable; consistent with the delivery filter pattern from Phase 15
- Default: 30 days — broader view on first open

**DB scalability audit — Output**
- Report + apply safe fixes — `docs/db-audit.md` written in the repo; low-risk improvements applied in the same phase; structural/high-risk changes deferred
- Audit document location: `docs/db-audit.md`

**DB scalability audit — Priority areas**
- Slow query patterns: N+1 issues in NestJS service files, `findMany` calls without proper `include`/`select` boundaries
- Table size projections: identify which tables (bids, messages, notifications) will hit Supabase limits first
- Supabase connection pool: verify pool config against expected concurrent load
- RLS policy correctness: check all tables for missing or misconfigured Row Level Security policies
- Not in scope: Missing indexes on FKs (deferred)

**Automated backups — Schedule & retention**
- Weekly backup, 30-day retention — 4 snapshots kept; oldest auto-deleted via cleanup in the cron
- Backup format: `db-backup-YYYY-MM-DD.sql.gz`

**Automated backups — Storage**
- Private 'backups' Supabase Storage bucket — separate from 'listings' media bucket
- Path: `backups/db-backup-YYYY-MM-DD.sql.gz`

**Automated backups — Trigger & execution**
- NestJS cron task via @nestjs/schedule — consistent with existing delivery expiry cron
- Mechanism: NestJS cron shells out to `pg_dump` using the existing `DATABASE_URL` env var on Fly.io; output compressed and uploaded via Supabase Storage SDK
- Failure alert: Email notification to admin if backup cron fails; use existing EmailService (Resend)

### Claude's Discretion
- Exact cron schedule for backups (e.g. Sunday 2AM UTC vs any day)
- Email failure alert implementation detail (nodemailer vs existing notification service)
- Retention cleanup implementation (Supabase Storage list + delete for files older than 30 days)
- Specific SQL queries used to assess table sizes and connection pool in the audit

### Deferred Ideas (OUT OF SCOPE)
- AWS S3 media migration — Supabase Storage remains the media store
- Missing FK indexes — audit identifies but applying deferred
- Mobile dashboard date filters — web-only in Phase 16
- CloudFront CDN — not needed at current scale
</user_constraints>

---

## Summary

Phase 16 has three independent workstreams. The dashboard date filters are a frontend-heavy task with a small backend extension — each dashboard API endpoint needs a `?period=7d|30d` query param that feeds a `createdAt gte` filter into Prisma queries. The codebase already has this exact pattern in `dealers.service.ts` (the `buildDateFilter` helper with `subDays` from `date-fns`), so this is a copy-adapt job, not greenfield work.

The DB scalability audit is primarily an investigative/documentation task. The planner should produce an audit wave that reads the existing Prisma service files and schema, runs table-size SQL queries against the live Supabase DB, and writes `docs/db-audit.md`. Safe fixes (missing `select` boundaries on `findMany`, dropping unused `take` values, adding `cancelledAt: null` guards already established in Phase 12) are applied inline with the audit.

The automated backup cron follows the identical pattern of `DeliveryExpiryService` — a NestJS `@Injectable()` with `@Cron()`, registered in `TasksModule`. The mechanism shells out to `pg_dump` via Node's `child_process.execSync`, pipes through gzip, then uploads the resulting buffer to a private Supabase Storage bucket using the service-role `createClient`. The existing `EmailService.sendBrandedEmail()` handles failure alerts without any new dependency.

**Primary recommendation:** Implement all three workstreams in separate waves — filters first (most user-visible), backup cron second, DB audit/docs last.

---

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/schedule` | ^6.1.1 | NestJS cron decorator | Already in use for delivery expiry and auction lifecycle |
| `date-fns` | ^4.1.0 | `subDays()` utility | Already imported in `dealers.service.ts` |
| `@supabase/supabase-js` | ^2.95.3 | Storage upload for backup bucket | Already in backend auth flow |
| `next/navigation` `useSearchParams` | Next.js built-in | Read `?period=` from URL client-side | Already used in 20+ pages (auctions, seller, messages) |
| `resend` | ^6.12.3 | Email failure alert | Already wired via `EmailService.sendBrandedEmail()` |

### Node Built-ins Used
| Module | Use | Notes |
|--------|-----|-------|
| `child_process` | Shell out to `pg_dump` | `execSync` or `spawnSync` with `PGPASSWORD` env |
| `zlib` | gzip compression | `createGzip()` stream or `gzipSync()` for in-memory |
| `stream` | Pipe pg_dump → gzip | Standard pipe pattern |

### No New Dependencies
Everything required already exists in `backend/package.json`. The backup service uses `child_process` (Node built-in) + `@supabase/supabase-js` (already installed). Do NOT add `pg-dump`, `node-gzip`, or any third-party backup library.

---

## Architecture Patterns

### Pattern 1: Date Period Filter — Backend `@Query` Pattern

The existing `dashboard.controller.ts` uses `@Get('buyer')` / `@Get('seller')` / `@Get('dealer')` with no query params. The extension adds `@Query('period') period = '30d'` to each handler and passes it to the service.

The `dealers.service.ts` `buildDateFilter` helper is the blueprint:

```typescript
// Source: backend/src/dealers/dealers.service.ts (line 467-473)
import { subDays } from 'date-fns';

private buildDateFilter(range: string): { gte: Date } {
  const now = new Date();
  if (range === '7d') return { gte: subDays(now, 7) };
  return { gte: subDays(now, 30) }; // default
}
```

For the dashboard service, each role method signature becomes:
```typescript
async getBuyerDashboard(userId: string, period: '7d' | '30d' = '30d')
async getSellerDashboard(userId: string, period: '7d' | '30d' = '30d')
async getDealerDashboard(userId: string, period: '7d' | '30d' = '30d')
```

The `period` value produces a `dateFilter = { gte: subDays(new Date(), period === '7d' ? 7 : 30) }` that is applied to time-sensitive counts and lists (bids, offers, sales). Cumulative counts that don't make sense to filter (e.g. `watchlistCount`) can remain unfiltered — but the CONTEXT.md says **all KPI tiles are date-filtered**, so apply `createdAt: dateFilter` to all `count()` and `findMany()` calls.

### Pattern 2: `useSearchParams` — Frontend Period Toggle

The project already uses `useSearchParams` in pages like `src/app/dashboard/dealer/auctions/page.tsx`. The pattern is:

```typescript
// Consistent with existing usage in the codebase
"use client"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()

const period = (searchParams.get('period') as '7d' | '30d') ?? '30d'

function setPeriod(p: '7d' | '30d') {
  const params = new URLSearchParams(searchParams.toString())
  params.set('period', p)
  router.replace(`${pathname}?${params.toString()}`)
}
```

**Important:** `useSearchParams()` requires a `<Suspense>` boundary in Next.js 13+ App Router. Each dashboard page already is a Client Component (`"use client"`), so wrapping the entire page export in `<Suspense>` is the correct approach.

### Pattern 3: `MetricCard` with Sub-Label

The existing `MetricCard` component (`src/components/dashboard/MetricCard.tsx`) has a `statusLabel` prop that renders a small badge at top-right. The CONTEXT.md wants a **sub-label under the value** ("Last 30 days"). The current `MetricCard` does not have a `subLabel` prop — it needs one added:

```typescript
// Add to MetricCardProps:
subLabel?: string

// Add in the JSX after the value h3:
{subLabel && (
  <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-widest font-bold relative z-10">
    {subLabel}
  </p>
)}
```

All three dashboards pass `subLabel={period === '7d' ? 'Last 7 days' : 'Last 30 days'}` to every `MetricCard`.

### Pattern 4: Segmented '7d / 30d' Button Group Component

The CONTEXT.md specifies pill buttons matching the existing segmented control style. Create a reusable `PeriodToggle` component:

```typescript
// src/components/dashboard/PeriodToggle.tsx
interface PeriodToggleProps {
  value: '7d' | '30d'
  onChange: (p: '7d' | '30d') => void
}
```

Style: `inline-flex rounded-lg overflow-hidden border border-white/10`. Active pill: `bg-primary text-white`. Inactive pill: `bg-transparent text-gray-400 hover:text-white`. Matches the existing segmented control pattern seen in `StatusFilter` components.

### Pattern 5: NestJS Backup Cron — Mirrors DeliveryExpiryService

```typescript
// backend/src/tasks/db-backup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { gzipSync } from 'zlib';
import { EmailService } from '../email/email.service';

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly emailService: EmailService) {}

  // Every Sunday at 2 AM UTC: '0 2 * * 0'
  @Cron('0 2 * * 0')
  async handleWeeklyBackup(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `db-backup-${date}.sql.gz`;

    try {
      // 1. Run pg_dump (DATABASE_URL already set on Fly.io)
      const dumpBuffer = execSync(`pg_dump "${process.env.DATABASE_URL}"`, {
        maxBuffer: 200 * 1024 * 1024, // 200 MB safety ceiling
      });

      // 2. gzip in-memory
      const compressed = gzipSync(dumpBuffer);

      // 3. Upload to private 'backups' bucket via service role key
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const { error } = await supabase.storage
        .from('backups')
        .upload(`backups/${filename}`, compressed, {
          contentType: 'application/gzip',
          upsert: false,
        });

      if (error) throw new Error(`Storage upload failed: ${error.message}`);

      // 4. Retention cleanup: delete files older than 30 days
      await this.pruneOldBackups(supabase);

      this.logger.log(`[DbBackup] Weekly backup complete: ${filename}`);
    } catch (err: any) {
      this.logger.error(`[DbBackup] FAILED: ${err.message}`);
      await this.emailService.sendBrandedEmail({
        to: process.env.ADMIN_EMAIL || 'airafadil619@gmail.com',
        subject: 'ALERT: CarMazium weekly DB backup failed',
        bodyHtml: `<p>The weekly database backup cron failed at ${new Date().toISOString()}.</p>
                   <p><strong>Error:</strong> ${err.message}</p>`,
      });
    }
  }

  private async pruneOldBackups(supabase: any): Promise<void> {
    const { data: files } = await supabase.storage
      .from('backups')
      .list('backups', { limit: 100 });

    if (!files) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const toDelete = files
      .filter((f: any) => new Date(f.created_at) < cutoff)
      .map((f: any) => `backups/${f.name}`);

    if (toDelete.length > 0) {
      await supabase.storage.from('backups').remove(toDelete);
      this.logger.log(`[DbBackup] Pruned ${toDelete.length} old backup(s)`);
    }
  }
}
```

**Registration in `tasks.module.ts`:** Add `DbBackupService` to providers. Import `EmailModule` (or inject via existing pattern) since `DeliveryExpiryService` already uses `NotificationsModule` injection. `EmailModule` is globally available — check if it exports `EmailService` (it does: `email.module.ts` exists).

### Pattern 6: DB Audit — SQL Queries for Supabase

The audit wave runs these queries against the live Supabase database via the Supabase SQL editor or `psql`:

```sql
-- Table size projections
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Connection pool usage
SELECT count(*) AS total, state, wait_event_type
FROM pg_stat_activity
GROUP BY state, wait_event_type;

-- Slow/missing index candidates (tables > 10k rows without indexes on FK columns)
SELECT t.relname AS table_name, a.attname AS column_name
FROM pg_attribute a
JOIN pg_class t ON a.attrelid = t.oid
WHERE a.attname LIKE '%Id' AND t.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute ia ON ia.attrelid = i.indrelid AND ia.attnum = ANY(i.indkey)
    WHERE i.indrelid = t.oid AND ia.attname = a.attname
  );

-- RLS check: tables without RLS enabled
SELECT relname FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT relrowsecurity;
```

**Audit document structure** (`docs/db-audit.md`):
```
| Table | Issue | Severity | Fix Applied |
|-------|-------|----------|-------------|
| bids  | N+1 in findMany (no select boundary) | HIGH | Yes |
| ...   | ...   | ...      | ...         |
```

### Recommended Project Structure (new files)

```
backend/src/tasks/
├── image-cleanup.service.ts       (existing)
├── featured-boost-expiry.service.ts (existing)
├── auction-lifecycle.service.ts   (existing)
├── db-backup.service.ts           (NEW — Phase 16)
└── tasks.module.ts                (extend: add DbBackupService)

src/components/dashboard/
├── MetricCard.tsx                 (extend: add subLabel prop)
├── PeriodToggle.tsx               (NEW — Phase 16)
└── PageHeader.tsx                 (existing — PeriodToggle renders via children)

docs/
└── db-audit.md                    (NEW — Phase 16)
```

### Anti-Patterns to Avoid

- **Do not use `router.push()` for period toggle** — use `router.replace()` so browser Back button is not polluted with filter state changes.
- **Do not stream pg_dump to a temp file on disk** — Fly.io ephemeral filesystem is wiped on restarts. Use `execSync` with `maxBuffer` to capture in-memory, then `gzipSync`, then upload. For very large databases (>100 MB dump), use `spawn` + streaming gzip + chunked upload.
- **Do not use the anon key for the backup upload** — the 'backups' bucket is private. Use `SUPABASE_SERVICE_ROLE_KEY`. The backend already has this env var (`SUPABASE_SERVICE_ROLE_KEY=ASK_TEAM_FOR_SERVICE_ROLE_KEY` in `.env.example`).
- **Do not import `subDays` from scratch** — it is already in `backend/package.json` as `date-fns ^4.1.0`.
- **Do not filter `watchlistCount`** — watchlist is cumulative (saved items persist); however, per CONTEXT.md decision "all KPI tiles are date-filtered", apply `createdAt` filter consistently. The planner should note the semantic awkwardness but implement as decided.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date subtraction | Manual `Date.getTime()` arithmetic | `subDays(new Date(), N)` from `date-fns` | Already installed; handles DST, month boundaries |
| gzip compression | Manual binary manipulation | `gzipSync()` from Node `zlib` | Built-in, zero deps, synchronous |
| Email failure alert | nodemailer or direct SMTP | `EmailService.sendBrandedEmail()` | Already wired with Resend; brand template included |
| URL state management | Manual localStorage / state | `useSearchParams` + `router.replace` | Next.js App Router native; shareable URLs |
| Storage upload | Custom fetch to Supabase REST | `@supabase/supabase-js` client `.storage.from().upload()` | Already installed in backend; handles auth headers |

---

## Common Pitfalls

### Pitfall 1: `useSearchParams` Requires Suspense Boundary
**What goes wrong:** Next.js 13+ App Router throws a build error or runtime warning if `useSearchParams()` is called outside a `<Suspense>` boundary in a Server Component tree.
**Why it happens:** The buyer/seller/dealer dashboard pages are already `"use client"`, but if the Suspense boundary is missing the build may still warn.
**How to avoid:** Wrap the inner component that reads `useSearchParams` in `<Suspense fallback={null}>` OR ensure the page itself is fully client-side (which it already is — all three dashboards are `"use client"`). In fully client-side pages, the Suspense requirement is satisfied automatically.
**Warning signs:** Build error: "useSearchParams() should be wrapped in a suspense boundary at page..."

### Pitfall 2: `pg_dump` Not Available on Fly.io Dockerfile
**What goes wrong:** The NestJS backend runs in a container that may not have `pg_dump` installed if the base image is a slim Node image.
**Why it happens:** `pg_dump` is part of the `postgresql-client` package, not installed in `node:20-alpine` or similar.
**How to avoid:** The planner must add `RUN apk add --no-cache postgresql16-client` (or appropriate version) to the backend Dockerfile, or use the Fly.io `flyctl ssh console` to verify `pg_dump --version` is available. If the Dockerfile is not customised, use the Supabase REST API backup endpoint (`/rest/v1/rpc/...`) as a fallback — but the pg_dump approach is preferred per CONTEXT.md.
**Warning signs:** `Error: Command failed: pg_dump "..."` with `ENOENT` or `command not found`.

### Pitfall 3: Dashboard API Caching Invalidation
**What goes wrong:** The frontend fetches `/api/dashboard/buyer` and caches the result. When the user toggles the period filter, the request URL changes (`?period=7d` vs `?period=30d`) so browser fetch deduplication is bypassed — but if the page uses `React.useEffect` with no `period` in the dependency array, the data is not re-fetched.
**Why it happens:** The existing dashboards use `React.useEffect(..., [user, authLoading])` without including the period in the deps.
**How to avoid:** Add `period` to the `useEffect` dependency array. Pattern: `React.useEffect(() => { fetchData() }, [user, authLoading, period])`.

### Pitfall 4: Supabase Storage `backups` Bucket Must Be Private
**What goes wrong:** If the bucket is created as public, backup files get a public URL and are accessible to anyone with the URL.
**Why it happens:** Supabase Storage defaults buckets to private, but if created via the dashboard UI a developer might accidentally check "Make public".
**How to avoid:** Create the bucket via the Supabase SQL editor or dashboard with `public: false`. The service role key upload bypasses RLS; reading requires the service role key (no public URL is exposed).

### Pitfall 5: `execSync` Blocks Event Loop During pg_dump
**What goes wrong:** `execSync` is synchronous and blocks the Node.js event loop for the duration of the pg_dump. On a large database (several hundred MB), this could stall all other NestJS requests for seconds.
**Why it happens:** pg_dump is CPU+I/O intensive.
**How to avoid:** For the current Carmazium scale (early-stage marketplace), `execSync` is acceptable — the cron runs at 2 AM UTC weekly with no concurrent load. Document this in `db-audit.md` as a future migration to `spawn`+stream when the DB exceeds 500 MB.

### Pitfall 6: `MetricCard` Prop Addition Breaks TypeScript
**What goes wrong:** Adding `subLabel?: string` to `MetricCardProps` is fine, but the `foilValue` and `statusLabel` props currently coexist — adding a third text-under-value prop can visually clash with `statusLabel`.
**Why it happens:** `statusLabel` renders top-right; `subLabel` renders bottom — they are separate positions and do not clash. But TypeScript prop interfaces must be updated together.
**How to avoid:** Place `subLabel` immediately after the metric value h3, before the existing label text. Update `MetricCardProps` interface in the same commit.

---

## Code Examples

### Backend: Extend Dashboard Controller with `@Query('period')`

```typescript
// backend/src/dashboard/dashboard.controller.ts (updated)
@Get('buyer')
async getBuyerDashboard(
  @CurrentUser() user: User,
  @Query('period') period: '7d' | '30d' = '30d',
) {
  const data = await this.dashboardService.getBuyerDashboard(user.id, period);
  return new StandardResponse(data);
}
```

### Backend: Extend Dashboard Service with Date Filter

```typescript
// backend/src/dashboard/dashboard.service.ts (updated)
import { subDays } from 'date-fns';

private buildPeriodFilter(period: '7d' | '30d'): { gte: Date } {
  return { gte: subDays(new Date(), period === '7d' ? 7 : 30) };
}

async getBuyerDashboard(userId: string, period: '7d' | '30d' = '30d') {
  const dateFilter = this.buildPeriodFilter(period);

  const [activeBids, activeOffers, watchlistCount, wonAuctions, bids, offers, history] =
    await Promise.all([
      this.prisma.bid.count({ where: { bidderId: userId, createdAt: dateFilter } }),
      this.prisma.offer.count({
        where: { buyerId: userId, status: { in: ['PENDING', 'COUNTERED'] }, createdAt: dateFilter },
      }),
      this.prisma.watchlistItem.count({ where: { userId, createdAt: dateFilter } }),
      this.prisma.auction.count({ where: { winnerId: userId, createdAt: dateFilter } }),
      // ... bids/offers/history findMany with createdAt: dateFilter
    ]);
  // ...
}
```

### Frontend: PeriodToggle Component

```typescript
// src/components/dashboard/PeriodToggle.tsx
"use client"
interface PeriodToggleProps {
  value: '7d' | '30d'
  onChange: (p: '7d' | '30d') => void
}

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
      {(['7d', '30d'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            value === p
              ? 'bg-primary text-white'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          {p === '7d' ? '7 Days' : '30 Days'}
        </button>
      ))}
    </div>
  )
}
```

### Frontend: Dashboard Page Integration (Buyer example)

```typescript
// src/app/dashboard/buyer/page.tsx (partial)
const searchParams = useSearchParams()
const router = useRouter()
const pathname = usePathname()
const period = (searchParams.get('period') as '7d' | '30d') ?? '30d'

function setPeriod(p: '7d' | '30d') {
  const params = new URLSearchParams(searchParams.toString())
  params.set('period', p)
  router.replace(`${pathname}?${params.toString()}`)
}

// Pass period to API call:
const data = await apiClient(`/dashboard/buyer?period=${period}`)

// Re-fetch on period change:
React.useEffect(() => { fetchData() }, [user, authLoading, period])

// Render PeriodToggle near the page title:
<PeriodToggle value={period} onChange={setPeriod} />
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Full dump without compression | `pg_dump | gzip` → `.sql.gz` | 60-80% size reduction for text SQL |
| Manual date ranges in Prisma | `subDays` from `date-fns` | Handles DST correctly |
| Separate localStorage state for filters | `useSearchParams` URL params | Shareable, bookmarkable, SSR-compatible |

---

## Open Questions

1. **`pg_dump` availability on Fly.io**
   - What we know: The backend Dockerfile is not customised (standard Node image)
   - What's unclear: Whether `postgresql-client` is included in the current Fly.io build
   - Recommendation: The planner should add a Wave 0 task to check `which pg_dump` via `flyctl ssh console` and add `postgresql-client` to the Dockerfile if missing. Fallback: use Supabase Management API backup if pg_dump is unavailable.

2. **`ADMIN_EMAIL` env var for backup failure alerts**
   - What we know: `EmailService.sendBrandedEmail()` accepts a `to` string; no admin email env var exists in `.env.example`
   - What's unclear: Whether to hard-code the admin email, read from env, or look up ADMIN-role users in the DB
   - Recommendation: Add `ADMIN_BACKUP_EMAIL` to `.env.example`; default to `airafadil619@gmail.com` (the project owner email from memory). The cron reads `process.env.ADMIN_BACKUP_EMAIL`.

3. **Supabase `backups` bucket creation**
   - What we know: The bucket must be created manually via the Supabase dashboard before the cron first runs
   - What's unclear: Whether to add a startup check or document it as a manual prerequisite
   - Recommendation: Document in `docs/db-audit.md` as a one-time setup step. The planner should include a Wave 0 task: "Create private 'backups' bucket in Supabase Storage dashboard."

4. **Which specific Prisma queries to fix in DB audit**
   - What we know: `dashboard.service.ts` has `Promise.all` with 7+ concurrent queries, some lacking `select` boundaries; `getBuyerDashboard` does `this.prisma.bid.findMany` with `include.listing.include.auction` but the outer query fetches all bids with no `where cancelledAt: null`
   - What's unclear: Full scope of N+1 patterns until the audit wave investigates each service file
   - Recommendation: The audit wave should grep `findMany` across all service files and flag any missing `select` (fetching more columns than needed) or missing `take` (unbounded result sets).

---

## Validation Architecture

The `workflow.nyquist_validation` key is absent from `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest ^30.0.0 (backend) |
| Config file | `backend/package.json` `"jest"` section |
| Quick run command | `cd backend && npx jest --testPathPattern db-backup --passWithNoTests` |
| Full suite command | `cd backend && npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-FILTER-01 | `getBuyerDashboard(userId, '7d')` returns bids filtered to last 7 days | unit | `npx jest --testPathPattern dashboard.service` | ❌ Wave 0 |
| DASH-FILTER-02 | `getSellerDashboard(userId, '30d')` returns offers filtered to last 30 days | unit | `npx jest --testPathPattern dashboard.service` | ❌ Wave 0 |
| DASH-FILTER-03 | `getDealerDashboard(userId, '7d')` returns dealer KPIs filtered to last 7 days | unit | `npx jest --testPathPattern dashboard.service` | ❌ Wave 0 |
| BACKUP-01 | `DbBackupService.handleWeeklyBackup()` calls pg_dump and uploads to Supabase Storage | unit (mocked) | `npx jest --testPathPattern db-backup` | ❌ Wave 0 |
| BACKUP-02 | On pg_dump failure, `EmailService.sendBrandedEmail()` is called | unit (mocked) | `npx jest --testPathPattern db-backup` | ❌ Wave 0 |
| BACKUP-03 | `pruneOldBackups()` deletes files older than 30 days | unit (mocked) | `npx jest --testPathPattern db-backup` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest --testPathPattern "(dashboard|db-backup)" --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/dashboard/dashboard.service.spec.ts` — covers DASH-FILTER-01, DASH-FILTER-02, DASH-FILTER-03
- [ ] `backend/src/tasks/db-backup.service.spec.ts` — covers BACKUP-01, BACKUP-02, BACKUP-03
- [ ] Supabase 'backups' bucket created manually via dashboard — prerequisite for real backup run

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/src/dashboard/dashboard.service.ts` — all 3 dashboard methods read in full
- Codebase inspection: `backend/src/delivery/delivery-expiry.service.ts` — exact cron pattern to mirror
- Codebase inspection: `backend/src/dealers/dealers.service.ts` lines 467-486 — `buildDateFilter` with `subDays`
- Codebase inspection: `backend/src/email/email.service.ts` — `sendBrandedEmail()` confirmed available
- Codebase inspection: `backend/src/auth/auth.service.ts` — Supabase `createClient` backend pattern
- Codebase inspection: `backend/src/tasks/tasks.module.ts` — provider registration pattern
- Codebase inspection: `backend/.env.example` — `SUPABASE_SERVICE_ROLE_KEY` env var confirmed
- Codebase inspection: `src/components/dashboard/MetricCard.tsx` — props shape confirmed, `subLabel` missing
- Codebase inspection: `src/components/dashboard/PageHeader.tsx` — `children` slot for toggle placement
- Codebase inspection: `backend/package.json` — `date-fns ^4.1.0`, `@nestjs/schedule ^6.1.1`, `@supabase/supabase-js ^2.95.3` all confirmed installed

### Secondary (MEDIUM confidence)
- Node.js built-in `zlib.gzipSync` and `child_process.execSync` — standard Node.js APIs, stable
- `useSearchParams` Suspense requirement — confirmed pattern from Next.js 13+ App Router documentation

### Tertiary (LOW confidence)
- pg_dump availability on Fly.io default Node image — not verified, flagged as Open Question
- Supabase Storage `list()` response shape for `created_at` field — assumed standard; verify against `@supabase/supabase-js` SDK types during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies confirmed in package.json; all patterns confirmed in existing service files
- Architecture: HIGH — all three patterns have direct codebase analogues
- Pitfalls: HIGH — pg_dump/Dockerfile issue is a known Fly.io gotcha; others are codebase-specific findings

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable dependencies)
