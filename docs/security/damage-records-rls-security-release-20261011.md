# Vehicle damage evidence — RLS privacy correction and release gate

Date: 2026-10-11. Scope: live Supabase project **mazium** (project ref recorded in the restricted operations log), web damage issue #516 and backend authorization issue #521.

## Verified finding
Before mitigation, public.damage_records had `damage_read FOR SELECT TO anon, authenticated USING (true)` and the `anon` role had SELECT privilege. Records associated with unpublished listings were therefore accessible through the database API subject to Data API exposure. Counts before correction: 178 total damage records, 35 associated with non-deleted ACTIVE/OFFER_ACCEPTED/SOLD listings and 143 associated with other listing states. These counts are aggregate, not a declaration that a user exploited the issue.

## Production security mitigation applied
Supabase migration `restrict_damage_records_to_visible_listings_and_owners_20261011` succeeded. It did **not** modify seller listing/photograph data:

```sql
ALTER POLICY "damage_read" ON public.damage_records
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = "listingId"
        AND l."deletedAt" IS NULL
        AND (
          l.status IN ('ACTIVE','OFFER_ACCEPTED','SOLD')
          OR (auth.uid() IS NOT NULL AND l."sellerId" = auth.uid()::text)
        )
    )
  );

CREATE POLICY "damage_admin_read" ON public.damage_records
  FOR SELECT TO authenticated
  USING (public.is_admin());
```

Using an EXISTS on public.listings deliberately inherits that table's already-established RLS: anonymous access to active retail, authenticated eligible dealer access to auctions, and owner access to their own draft listings. The separate authenticated-only policy calls `is_admin()`, for which anonymous users lack EXECUTE permission. Do **not** use `owns_listing()` in an anonymous policy: the anon role lacks EXECUTE on that function, and PostgreSQL may evaluate it despite other boolean predicates.

## Verification
- Pre-migration: confirmed RLS enabled, anonymous SELECT grant, unconditional damage_read policy.
- Before applying: tested proposed ALTER POLICY in a transaction with ROLLBACK. Anonymous role observed 15 readable rows; simulated seller role observed 28, including owner-private entries.
- After successful migration: inspected pg_policies and reconfirmed 15 anonymous, 28 for one simulated seller principal, and 178 for simulated admin principal. All tests used row counts, no private record contents, and no customer data writes.
- Existing `damage_write` policy remains unchanged and owner/admin scoped.

## Emergency rollback (security review required)
Only if the new policy incorrectly denies legitimate authorized access, revert via a newly reviewed Supabase migration; do **not** revert casually to `USING (true)` because that re-exposes unpublished damage evidence. A safer rollback should preserve status and owner restrictions while refining affected dealer/admin visibility.

## Website and Fly release
Code-only PR #559 adds independent seller damage records, photo handling, owner/admin/active dealer staff enforcement and tests. CI includes disposable PostgreSQL 17 transaction authorization proof. Vercel preview and static/type/backend suites are not evidence of live authenticated customer functionality. Before moving the PR to main and Fly deployment, verify with distinct real staging Supabase sessions that owner can save/refresh, outsider cannot write/read drafts, authorized dealership staff can only access assigned inventory, evidence photo storage works, buyer can inspect active records, and existing web login/session policy is intact. Recheck production health and actual site after release. Production backend/website have not been deployed through this PR at the time this document was written.
