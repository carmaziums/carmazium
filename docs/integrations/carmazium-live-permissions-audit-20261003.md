# Live CarMazium database permission review — 3 October 2026

**Scope:** Actual production metadata-only review, one tightly guarded live permission containment for an empty table, independent read-back, and a disposable PostgreSQL 17 regression. It is NOT a full schema/role cutover or evidence of a real backup restore.

## Confirmed partner credential access, now contained

The live public.partner_profiles table had a plaintext-named apiKey column and table-wide SELECT explicitly granted to both anon and authenticated. Its SELECT RLS policy had USING (true), meaning all partner rows would have been readable. Immediately before containment, the table contained **zero rows and zero populated credentials**. This was a proven potential future exposure path, NOT evidence of historical partner-key loss.

The following DCL was already executed on the confirmed live project in a transaction guarded by zero-row and server-role preconditions; it is documented here, **NOT** an instruction to replay it without change control:

    REVOKE SELECT ON TABLE public.partner_profiles FROM anon, authenticated;

The transaction verified both client roles no longer had table or apiKey column SELECT while postgres/service_role retained server-side access. A separate read-only inspection confirmed that unrelated public retail-listing SELECT and anonymous email-capture INSERT stayed enabled. The live Supabase adviser changed its GraphQL exposure inventory from 9→8 anonymously and 30→29 signed in. The permissive partnerprofiles_read RLS policy remains, but revoked table/column grants now prevent those roles from accessing it. NEVER restore a full-table client SELECT grant on a table storing apiKey; a future directory needs a reviewed public projection excluding secrets and active-only ownership-aware policy.

**Regression:** backend/scripts/security/ci-only-partner-credential-acl.sql and its GitHub workflow prove the precise revocation using disposable PostgreSQL 17 and fake credentials. Do not run that role-creating fixture in Supabase.

## Other current findings — read-only only, broader changes BLOCKED

- **Schema CREATE:** Both anon and authenticated still inherit CREATE on the entire public schema. The known live backend database login uses postgres. Previous free PostgreSQL 17 selected-schema rehearsal proves the mechanics of revoking PUBLIC CREATE for a synthetic runtime/session adapter, but does NOT cover the full live schema or real production operations. Do not apply the broad revoke or switch Fly's database credential until real recovery, comprehensive staged application tests and an approved maintenance/backout window.
- **Five authenticated SECURITY DEFINER helpers:** current_uid, has_user_role, is_admin, my_dealer_profile_ids and owns_listing are owned by postgres, use search_path=public and are callable by authenticated but NOT anon. Their definitions use auth.uid/role ownership predicates and they are referenced by live RLS policies, including dealer KYC and listing ownership. Review exact privilege/search-path hardening on a production-equivalent isolated environment before modifying or removing them.
- **32 RLS-enabled tables without policies:** a separate grant survey found that none had direct authenticated table SELECT/INSERT/UPDATE/DELETE permissions. These lints are NOT proven data leaks; do not add blanket open policies.
- **Other client column scope:** authenticated users have SELECT on public.users including passwordHash/bank fields, while RLS allows own-account (or actual admin) reads. Authenticated dealer invite SELECT includes token but its policy restricts eligible dealer profiles/admin. Public vehicles currently has zero records yet grants anonymous full-column SELECT with a permissive public RLS policy, including prospective VIN/VRM. The public retail policy exposes 166 retail listing rows, 3 with nonempty VIN and 98 with precise coordinate fields at this inspection. These are *metadata counts only*; no passwords, keys, names, coordinates, VRMs, VINs, other records or media were read. Classify seller-authorised fields and migrate to tested safe public views/projections; unreviewed blanket changes could break retail search, signup or dealer flows.
- **Recovery prerequisite:** The owner confirmed seeing a managed database backup dated 2 October 2026 at 11:59 pm, dashboard time zone unknown. No independent non-production real DB restoration proves it usable, and database backups do NOT include uploaded Storage file bytes. Draft PR #382 provides a fully tested independent seven-bucket encrypted backup/recovery runner, but the existing UK-region independent private vault/credentials and real restoration evidence are not available through current connected accounts. Issue #364 stays open.

## Non-sensitive schema fingerprint for future isolated restore comparison

A fresh read-only query of the actual live production catalog on 3 October found **63 public base tables, 939 public relation columns, 41 RLS policies and 10 public functions**. The following fingerprints hash *metadata definitions*, never customer rows. They are an acceptance comparison target for a real isolated recovery, not proof that a usable provider backup exists:

- Column/type/nullability fingerprint (MD5 for catalog drift only): d7d243d9a8232c723de3aa709ce075b8
- RLS policy-definition fingerprint: fffa117521b079da8227f8b7926bfc3b
- Public function-definition fingerprint: 379163bafc28b38240e416ec83911f6f

Regenerate using the same ordered catalog query for the restored database. Account for legitimate schema changes made since this snapshot; do not reject a good backup simply because newer migrations change the live fingerprint.

## Production release gates

Complete a non-production rehearsal with all relevant direct SQL/Prisma, RLS, policies, triggers, login/session adapter, dealer KYC, bids, refund/payment and handover flows on a production-equivalent schema, with synthetic records. Prove a real isolated database restore and an independent, private KYC/handover object recovery before changes to the PUBLIC schema CREATE grant, privileged runtime login or other broad live permissions. Preserve the already-performed partner_profiles containment. Do not publish partner production keys until the privacy agreement, hosted staging verification and recovery/security gates are complete.

References: GitHub issues #356 and #364; security and synthetic stage draft PRs #346, #381, #382, #383.
