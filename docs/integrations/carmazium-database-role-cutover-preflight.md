# CarMazium — PostgreSQL privileges and private maintenance cutover
**Status: controlled preflight only. Do not apply these instructions to production
until the checks, sign-off and rollback conditions below are satisfied.**

## Read-only findings: 2 October 2026

Reviewed the current **live CarMazium Supabase project** and the distinct
**CarMazium Development** project with metadata-only SQL. No application data,
secrets, permissions or production schema objects were modified.

| Characteristic | Live CarMazium | CarMazium Development |
|---|---|---|
| `public` schema ACL | `{postgres=UC/postgres,=UC/postgres}` | `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}` |
| Schema CREATE inherited by all roles? | **Yes — PUBLIC has CREATE and USAGE** | No — PUBLIC has only USAGE |
| `public.sessions` | Present | Absent |
| Main `users`, `auctions`, `listings` tables | RLS enabled; currently owned by `postgres` | Do not assume identical schema |
| `public.sessions` RLS | Enabled; no `sessions` policy returned by a read-only `pg_policies` query | Separate role/policy rehearsal needed |

**Impact:** in the live database, `PUBLIC` has permission to create objects in
`public`, and both `anon` and `authenticated` inherit `PUBLIC` role privileges.
A schema-level CREATE grant is not by itself evidence of exploitation or that
anonymous HTTPS visitors can run arbitrary SQL, but it widens the consequences
of any SQL-execution path and is not required for ordinary reads and writes.
The Development project already demonstrates a tighter schema ACL. Revoke
`PUBLIC` CREATE only after confirming any required application-side
creation paths have been provisioned elsewhere.

## Live cutover gates (all required)

1. **Identify the actual live backend database login** from within the
   authorised Fly backend runtime without printing `DATABASE_URL`,
   `DIRECT_URL` or other secrets. Supabase's aggregate connection listing
   shows multiple `postgres` connections but **does not establish which
   belongs to Fly**. Confirm all connection paths, poolers, direct URLs,
   scheduled backup scripts and migration/manual SQL tooling.
2. **Review RLS and every direct SQL access path**, not just Prisma's model
   definitions. Current live RLS policies returned for the key tables
   target `anon`/`authenticated`, not a new restricted server login.
   Do not add blanket `USING (true)` policies for production tables.
   Design explicit service-role access and test its trust boundary; a
   `NOLOGIN` managed Supabase role is not interchangeable with an
   application password-bearing PostgreSQL login.
3. **Pre-provision session storage.** The backend's legacy
   `connect-pg-simple` config creates the session table automatically when
   missing. After provisioning the appropriate table, policy and grants
   on a realistic isolated staging schema, set
   `SESSION_TABLE_PREPROVISIONED=true` to suppress bootstrap DDL.
   This code flag defaults to existing behaviour while not enabled.
   Test login, logout, password recovery, active-session continuity and
   the production-equivalent session table/RLS constraints.
4. **Exercise application operations under the proposed DB login** on a
   non-production clone with representative synthetic data: catalogue
   search, vehicle valuation, admin review, dealer KYC, bidding/concurrency,
   refunds/transactions, handover, broadcast and scheduled jobs. Include
   any triggers, stored procedures and `SECURITY DEFINER` dependencies.
   Review explicit per-table DML and required sequence grants. Do not
   broadly copy the `postgres` owner's permissions to the runtime role.
5. **Protect ongoing backups**: the current API image retains the
   PostgreSQL client for the existing weekly backup. A restricted
   non-bypass-RLS account may produce incomplete backups; verify
   the separate backup role/service and a full restore rehearsal before
   replacing the live connection. Avoid quietly moving backups to an
   untested owner credential.
6. **Approve private migration operation**: use the pinned, minimal,
   non-root `prisma-maintenance` image as a private, on-demand short-lived
   task, not a public service. A separate operator-approved DDL-capable
   login must have restricted access, auditing, a time-bound secret and
   a preflight backup. CLI image access is not a substitute for database
   account segregation. The upstream Prisma `deepmerge-ts` high advisory
   remains unresolved inside this private image and needs explicit
   security risk acceptance or a reviewed upstream fix.
7. **Retain the ban on automated schema reconciliation**: production
   Prisma migration history remains incomplete relative to manually
   applied Supabase SQL. Neither `prisma db push` nor
   `prisma migrate deploy` is cleared for production automatically.
   Non-mutating `migrate status` requires a confirmed private destination.
8. **Production public-schema hardening**: after dependent flows are
   reviewed and the designated rollback window agreed, a database owner
   can apply only the schema-ACL change below. Recheck `PUBLIC`, `anon`
   and `authenticated` CREATE access, Supabase Auth/PostgREST, sessions
   and app health. This step is separate from switching the backend login.

## Proposed manually reviewed hardening change (NOT EXECUTED)

Run only through an approved database-owner change process against the
confirmed production project, with a written backout plan:

```sql
-- Confirm expected baseline using a READ-ONLY inspection first.
SELECT nspacl::text FROM pg_namespace WHERE nspname = 'public';
SELECT has_schema_privilege('anon','public','CREATE') AS anon_can_create,
       has_schema_privilege('authenticated','public','CREATE') AS users_can_create;

-- Production change, subject to explicit approved maintenance window:
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- After-change READ-ONLY checks:
SELECT has_schema_privilege('anon','public','CREATE') AS anon_can_create,
       has_schema_privilege('authenticated','public','CREATE') AS users_can_create,
       has_schema_privilege('anon','public','USAGE') AS anon_can_use,
       has_schema_privilege('authenticated','public','USAGE') AS users_can_use;
```

**Rollback only if tests identify a genuine dependency:** restore the
precise prior ACL and document the affected workflow, then redesign its
required object-creation path. On the observed live ACL, restoring the old
permission would involve `GRANT CREATE ON SCHEMA public TO PUBLIC`, which
reintroduces the issue. Do not use that as routine rollback without
incident/change approval.

## Verified isolated permissions rehearsal

`.github/workflows/carmazium-db-role-rehearsal.yml` creates a disposable
PostgreSQL 17 test database with **synthetic-only** credentials. It checks
a deliberately vulnerable `PUBLIC` schema, revokes CREATE only in CI,
tests application DML and explicitly policy-authorised sessions, denies
unauthorised/unguarded RLS reads and both CREATE and ALTER attempts,
and confirms the private migration role can create its own synthetic
schema objects.

This demonstrates the privilege mechanism; **it does not** mean
CarMazium's real application journeys work with the new role.
No test workflow receives a real Supabase credential or contacts a live
project.

## Deployment and partner boundary

Once all gates are signed off, prepare a dedicated staging release using
the already verified pinned Node 24 public API image. Do not switch
`DATABASE_URL` or `DIRECT_URL` or redeploy Fly directly as part of this
preflight. Ensure the team has tested rollback and a break-glass incident
procedure before any separate production deployment.

The SimpleDMS feed and external key remain independently gated on the
partner staging tests, security review, photo rights, data-sharing and
privacy/legal approvals. This database rehearsal is **not** permission
to send external credentials or begin the 90-day production pilot.
