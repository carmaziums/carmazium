# Free, synthetic database cutover rehearsal (no paid Supabase branch)

**Scope:** Independent disposable PostgreSQL 17 on GitHub Actions, with
synthetic records and credentials. This is NOT an exact production clone,
a full acceptance test, or permission to modify production database roles.

## Production evidence, metadata only

On 2 October 2026, a read-only query inspected the live CarMazium database's
column names, PostgreSQL types and nullability for seven critical tables:
`users`, `listings`, `auctions`, `bids`, `sales`,
`transactions` and `sessions`. Another read-only query recorded the
relevant enum labels. No customer records, hashes, contact details, session
data, function bodies or connection secrets were extracted.

The snapshot in
`backend/scripts/security/live-selected-schema-metadata.tsv`
stores **55 selected fields** that are represented in the synthetic fixture.
Each CI run checks the fixture's field names, types and nullability
against that frozen, non-sensitive metadata. The real tables contain
many **additional fields** and other indexes, triggers, policies and
functions; the test makes no claim of complete schema parity.

## Tests in disposable CI

The workflow `.github/workflows/carmazium-free-core-schema-rehearsal.yml`
creates a fresh `cm_core_ci` database for every run. The fixture's
PostgreSQL procedural guard refuses any other database name. Synthetic
data consists of a seller, a dealer and one active and one ended auction.

- Real PostgreSQL roles with no superuser, DDL, createdb or bypass-RLS
  privileges; a separate schema-owning migration login
- Selected production-observed enum values and key column definitions
- Synthetic RLS for live auction/listing visibility, eligible bid
  insertion and full session-table operations; default-denied user
  records and denied access to transactions/passwords
- Actual SQL insert of an eligible bid; rejection of a bid linked to
  an ended auction under the **synthetic** auction policy
- Negative tests for reserve modification, private field access,
  `ALTER TABLE` and `CREATE` in the formerly unsafe public schema
- Real `connect-pg-simple` session adapter using the production-shaped
  `sid varchar`, `sess json` and `expire timestamp` fields. It
  exercises set, get, expiry renewal and destroy without creating a
  session table at runtime
- A separate maintenance role can perform explicit DDL only within
  its own synthetic application schema

This deliberately exercises structural and permission boundaries.
The synthetic RLS policies are **not production policy replacements**
and do not prove that live users, listings, bidding, handover or payments
will work under a newly restricted account.

## Explicit limitations and future release gates

1. The existing Development Supabase project diverges from live schema
   and must not be treated as an equivalent substitute.
2. No paid staging branch, database, new deployed service or production
   data export is created by this workflow. It uses the repository's
   existing GitHub Actions capacity; normal plan quotas may still apply.
3. An authorised, production-equivalent **schema-only** environment is
   still required to test full application/RLS behaviour. Any export
   must exclude live rows and be independently reviewed for secrets in
   stored function bodies or defaults.
4. The actual deployed Prisma and session-pool connections currently
   use privileged `postgres`, so their separate replacement connections
   need full end-to-end tests, including backups and login continuity.
5. Never switch `DATABASE_URL`, `DIRECT_URL`, session bootstrap,
   production grants or automated migrations merely because this
   focused rehearsal is green.
6. SimpleDMS API production enablement, legal agreement, seller-photo
   rights and partner credential release remain separate gated work.

**Owner review:** Inspect the workflow and its test evidence before
merging into draft security PR #346. Keep production unchanged.
