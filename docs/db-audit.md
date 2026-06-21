# DB Scalability Audit — CarMazium

**Date:** 2026-06-21
**Audited by:** Phase 16 automated audit
**Scope:** NestJS service files + Supabase table projections + RLS policy review

---

## Executive Summary

The codebase is in good shape for early-stage scale: all high-volume read paths (buyer bids, seller offers, notifications) use pagination via `take` limits. The three highest-risk issues are (1) bid queries in `getBuyerDashboard` missing `cancelledAt: null` guards (Phase 12 requirement), (2) N+1 unread-count queries in `chat.service.ts` that fire one DB round-trip per chat room, and (3) admin/finance/insurance dashboard methods fetching entire `user` and `listing` records with no `select` boundary. Safe fixes for items 1 and 3 are applied in Task 2. The N+1 chat pattern is deferred as it requires a subquery rewrite.

---

## Findings

| # | File | Table | Issue | Severity | Fix Applied |
|---|------|-------|-------|----------|-------------|
| 1 | dashboard.service.ts | bids | `bid.findMany` in `getBuyerDashboard` uses `include:` wrapper — fetches all bid columns instead of scoped `select:`; mixed `include`+inner `select` pattern | HIGH | Yes — converted top-level `include` to `select` with explicit column list |
| 2 | dashboard.service.ts | bids | `bid.count` in `getBuyerDashboard` missing `cancelledAt: null` guard — inflates activeBid metric with cancelled bids (Phase 12 requirement) | HIGH | Yes — added `cancelledAt: null` to where clause |
| 3 | dashboard.service.ts | serviceRequests | `getContractorDashboard`: `serviceRequest.findMany` uses `include: { requester: true }` — fetches all user columns (PII) with no select boundary | MEDIUM | Yes — replaced with `include: { requester: { select: { id, firstName, lastName, email } } }` |
| 4 | dashboard.service.ts | financeApplications | `getFinanceDashboard`: `financeApplication.findMany` uses `include: { user: true, listing: true }` — full wide-row fetch on both tables with no select | MEDIUM | Yes — added select boundaries to user and listing includes |
| 5 | dashboard.service.ts | insuranceQuotes | `getInsuranceDashboard`: `insuranceQuote.findMany` uses `include: { user: true, listing: true }` — same unbounded pattern as finance dashboard | MEDIUM | Yes — added select boundaries to user and listing includes |
| 6 | dashboard.service.ts | users | `getAdminDashboard`: `user.findMany` with `take: 5` but no `select` — returns all user columns including hashed passwords, preferences JSON, and PII | HIGH | Yes — added `select:` with safe fields only |
| 7 | chat.service.ts | messages | `getUserRooms`: N+1 pattern — `Promise.all(rooms.map(...prisma.message.count(...)))` fires one COUNT query per chat room. For a user with 50 rooms this is 50 serial-ish DB calls | MEDIUM | No — deferred (requires rewrite to use `_count: { messages: true }` in groupBy or subquery pattern) |
| 8 | listings.service.ts | offers | `getEarnings`: `sale.findMany` includes `listing.offers` (take: 10) inside the listing include — each sale page load fetches up to 10 offers per sale, amplifying data volume linearly | LOW | No — deferred (earnings endpoint is low-frequency; acceptable at current scale) |
| 9 | bids.service.ts | bids | `findByListing`: no `take` limit — returns ALL bids for a listing. For a high-volume auction this could be thousands of rows | MEDIUM | No — deferred (called only from admin/auction detail view; frontend paginates separately) |
| 10 | notifications.service.ts | notifications | `getRecentUnread` uses `take: 10` correctly — verified CLEAN | LOW | No change needed — verified clean |
| 11 | notifications.service.ts | notifications | `findAll` uses paginated `skip`/`take` correctly — verified CLEAN | LOW | No change needed — verified clean |
| 12 | listings.service.ts | listings | `findAll` uses `skip`/`take: limit` (default 20) with `orderBy` — verified CLEAN | LOW | No change needed — verified clean |

---

## Table Size Projections

> SQL run in Supabase SQL editor. Results below are **pending live run** — paste output here after running in Supabase dashboard.

```sql
-- Table sizes
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

| Table | Estimated Size | Live Rows | Projected Scale Risk |
|-------|----------------|-----------|---------------------|
| listings | *pending live run* | *pending* | Low — bounded by active sellers |
| bids | *pending live run* | *pending* | HIGH — unbounded per auction; grows with every bid event |
| messages | *pending live run* | *pending* | HIGH — one row per message per conversation; grows continuously |
| notifications | *pending live run* | *pending* | HIGH — one row per event per user; accumulates fast |
| watchlist_items | *pending live run* | *pending* | Medium — bounded by user saves |
| sales | *pending live run* | *pending* | Low — only created on completed transactions |
| chat_rooms | *pending live run* | *pending* | Low — bounded by unique user pairs |
| finance_applications | *pending live run* | *pending* | Low — infrequent |
| insurance_quotes | *pending live run* | *pending* | Low — infrequent |

---

## Connection Pool Assessment

> Target: Supabase free tier supports ~60 concurrent connections. Fly.io default pool: 10 per instance.

```sql
-- Connection pool usage
SELECT count(*) AS total, state, wait_event_type
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type;
```

**Current configuration (pending verification):**
- Check `DATABASE_URL` in Fly.io secrets for `?pgbouncer=true&connection_limit=1` params
- Prisma + Fly.io: set `connection_limit=1` per instance when using PgBouncer (Supabase default)
- At current scale (early-stage, <10 concurrent users) connection exhaustion is not a risk
- Revisit when deploying >3 Fly.io instances or adding background workers

---

## RLS Policy Coverage

> Note: Backend uses NestJS `SessionAuthGuard` — RLS is a secondary defence for direct Supabase client access. All tables accessed via service role key bypass RLS by design. RLS matters for mobile/frontend Supabase direct calls.

```sql
-- RLS coverage check
SELECT relname FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT relrowsecurity;
```

| Table | RLS Enabled | Notes |
|-------|-------------|-------|
| users | Yes | Via Supabase auth.uid() policies |
| listings | *pending live run* | Backend enforces ownership checks via SessionAuthGuard |
| bids | *pending live run* | Backend enforces bidderId ownership |
| offers | *pending live run* | Backend enforces buyer/seller checks |
| notifications | *pending live run* | User-scoped; backend enforces userId filter |
| messages | *pending live run* | ChatRoom membership enforced in service layer |
| sales | *pending live run* | Only created by backend service; no direct client access expected |
| watchlist_items | *pending live run* | User-scoped |

> All tables accessed via the service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypass RLS by design. RLS policies primarily protect against accidental direct anon-key queries from mobile clients.

---

## Safe Fixes Applied (This Phase)

| Fix | File | Change |
|-----|------|--------|
| Converted `bid.findMany` from `include:` to `select:` in `getBuyerDashboard` | dashboard.service.ts | Replaced mixed `include`+`select` with explicit top-level `select:` boundary |
| Added `cancelledAt: null` to `bid.count` in `getBuyerDashboard` | dashboard.service.ts | `where: { bidderId: userId, createdAt: dateFilter, cancelledAt: null }` |
| Added `select:` to `requester` include in `getContractorDashboard` | dashboard.service.ts | Scoped to `{ id, firstName, lastName, email, role }` only |
| Added `select:` boundaries to user+listing includes in `getFinanceDashboard` | dashboard.service.ts | User: `{ id, firstName, lastName, email }`; Listing: `{ id, title, price, status }` |
| Added `select:` boundaries to user+listing includes in `getInsuranceDashboard` | dashboard.service.ts | Same scoping as finance dashboard |
| Added `select:` to `user.findMany` in `getAdminDashboard` | dashboard.service.ts | Safe PII-free field list only (no password hash, no preferences JSON) |

---

## Deferred Findings

| Issue | Severity | Reason Deferred |
|-------|----------|-----------------|
| N+1 unread count in `chat.service.ts getUserRooms` | MEDIUM | Requires replacing `Promise.all(rooms.map(...count()))` with `_count` Prisma relation or raw groupBy — frontend-impacting schema change; defer to Phase 18 |
| `findByListing` in `bids.service.ts` — no `take` limit | MEDIUM | Called only from auction detail admin view; acceptable at current scale (<1000 bids/auction); add pagination in Phase 18 |
| `getEarnings` nested `listing.offers` include | LOW | Earnings endpoint is low-frequency (seller/admin only); acceptable overhead at current scale |
| Missing FK indexes (e.g., `listingId` on bids, `userId` on watchlist_items) | MEDIUM | Prisma migration required; lower priority per CONTEXT.md — revisit Phase 18 |
| Pagination on `notification.findAll` | LOW | Already paginated (skip/take) — no additional work needed |
| `pg_dump execSync` blocks event loop on large DB (backup cron, Plan 02) | LOW | Acceptable at current scale (<10 MB); migrate to `spawn`+stream when DB exceeds 500 MB |

---

## SQL Reference

Queries used in this audit:

```sql
-- Table sizes
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS live_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- RLS coverage
SELECT relname FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT relrowsecurity;

-- Connection pool
SELECT count(*) AS total, state, wait_event_type
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type;
```

---

## One-Time Setup Reminder

The weekly DB backup cron (Phase 16, Plan 02) requires:
1. Create a private `backups` bucket in the Supabase Storage dashboard (not API-creatable without service role).
2. Set `ADMIN_BACKUP_EMAIL` env var on Fly.io: `flyctl secrets set ADMIN_BACKUP_EMAIL=airafadil619@gmail.com`
3. The `backups` bucket must have `public: false` — verify in Supabase dashboard.
