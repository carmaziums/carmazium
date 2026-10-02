# Live schema parity, session store and DB-role readiness
**Read-only evidence collected 2 October 2026. This document authorises no production change.**

## Current production backend identity

An authorised, one-time Fly SSH audit used the same generated Prisma client
as the running CarMazium backend, issued one metadata-only SELECT and reported:

- database session/login role: `postgres`
- `BYPASSRLS`: true
- `CREATEROLE`: true
- `CREATEDB`: true
- `CREATE` and `USAGE` on `public`: true
- live `public.sessions`: present

Evidence: Actions 37074014355. No DB URL/password or customer data was
printed, and no configuration or schema change took place.

A subsequent, independent read-only `pg.Pool` SELECT inside the **same
existing Fly application** succeeded and confirmed that the session-store
connection pool also authenticates as `postgres` (Actions 37074396199).
An earlier standalone `pg.Client` test returned protocol code **08P01**
(Actions 37073906561), but that result did not recur with the pool and is
**not evidence of an ongoing session outage**. Before cutover, recheck both
Prisma and the session-store pool using the proposed restricted credentials
in a production-equivalent isolated staging environment.

## Metadata-only production vs Development fingerprint

| Object type | Live | Existing Development |
| --- | ---: | ---: |
| Public base tables | 63 | 42 |
| Public relation columns (includes views) | 939 | 501 |
| RLS policies | 41 | 48 |
| Public functions | 10 | 64 |
| Public indexes | 300 | 136 |
| Session store `public.sessions` | present | absent |

Eight overlapping application tables have differing ordered column/type/null
fingerprints: `auctions`, `bids`, `blog_posts`, `listings`, `messages`,
`notifications`, `service_jobs` and `service_leads`. For example,
production `auctions` has 42 columns versus 15 in Development, and
production `listings` has 84 versus 32. Production-only structures include
the application `users` and `vehicles` tables, `sessions`, sales and
payments/transactions tables. These are read-only schema observations, not
user-row extracts.

**Conclusion:** The existing CarMazium Development Supabase project is not
a production-equivalent cutover environment. Do not connect the live backend
to that database or infer end-to-end compatibility from its passing tests.

## Observed session-table structure (no user sessions inspected)

Live `public.sessions` has three nonnullable columns:
`sid varchar PRIMARY KEY`, `sess json NOT NULL` and
`expire timestamp without time zone NOT NULL`. It is currently owned by
`postgres`, RLS is enabled, and the inspected policy listing returned no
explicit session policy. Only `postgres` and managed `service_role`
had relevant listed table DML grants; `service_role` has Supabase-managed
RLS-bypass privileges and is not a substitute for a restricted login.

The isolated CI fixture now mirrors these three column types plus the primary
key and verifies session insert, JSON payload update, expiry refresh,
readback and deletion by a **separate, synthetic, non-bypass-RLS application
login**. That test grants access under a session-only RLS policy; it does not
change live policies. Keep `SESSION_TABLE_PREPROVISIONED` unset in production
until a realistic staging test confirms sessions are already provisioned.

## Path to a production-equivalent, synthetic staging test

1. Provision an isolated, independently billed or approved staging database
   with no production rows. Do not assume that replaying only Supabase's
   recorded migrations reproduces every manually applied SQL object.
2. Have an authorised operator produce a **schema-only** source snapshot using
   an approved private channel: include required Supabase extensions,
   functions, role/RLS dependencies, indexes and the session table. Scrub any
   hard-coded static personal data/secrets from function bodies before it
   leaves the production security boundary. Never export customer rows or
   session JSON.
3. Reconcile schema and migration signatures against the live metadata before
   declaring the isolated staging environment representative; explicitly
   test critical auctions, bids, dealer verification, finance, transactions,
   sessions, backups and private maintenance paths.
4. Generate synthetic non-identifying test records, add a restricted
   non-owner application login with only proven DML/sequence permissions,
   and an independently controlled DDL maintenance account. Test RLS under
   each identity, without broad production-table `USING(true)` policies.
5. Verify login/session create-refresh-expire-destroy, auction bid lifecycle,
   admin moderation, seller handover, payments in sandbox mode and a full
   backup-and-restore exercise. Verify direct `pg` and Prisma clients
   separately.
6. Only after security, operational and rollout approval, plan a live
   maintenance window to restrict the database login and revoke
   `CREATE ON SCHEMA public FROM PUBLIC`. Keep independent rollback,
   monitoring and break-glass recovery. `prisma db push` and automatic
   `migrate deploy` remain prohibited while migration history is incomplete.

**Release status:** production has not been modified. The private
Prisma-maintenance image and secure DB-role design remain distinct gates
from the SimpleDMS legal/data rights and staging API gates.
