# CarMazium Development — isolated damage-upload QA foundation

Created: 11 October 2026. Environment: **CarMazium Development**, Supabase project ref `ffkqnswgfdgpsrhnjrqu`. This is NOT the production `mazium` project.

## Existing development resources preserved
The existing `public` schema retains its 42 tables. No existing development table was overwritten, migrated, renamed or truncated. `auth` and `storage` schemas were not modified. No production Supabase, Fly or Vercel change was made by this preparation.

## Created
Supabase migration: `carmazium_damage_qa_private_foundation_20261011`.

Private schema `carmazium_damage_qa` contains 5 minimally provisioned QA tables:
- `users`: synthetic application actors and roles
- `dealer_profiles`, `dealer_staff`: permitted/inactive dealership-role scenarios
- `listings`: sample draft auction and retail listings
- `damage_records`: independent defect UUIDs, JSONB normalized 3D coordinates, optional evidence URL

Enums: `user_role`, `listing_status`, `listing_type`, `dealer_role` (the same names/values used by the damage service).

Synthetic fixture rows: 5 user records, 2 listings, 1 active dealer-staff association, 2 independent damage records on the same panel. All fixture email addresses end `@example.invalid`; no actual authentication credentials exist. There are no real customers, car registrations or photographs.

Security:
- `USAGE` on schema revoked from `PUBLIC`, `anon`, `authenticated`
- Direct table privileges revoked from these roles
- RLS enabled with **no direct-client policies** for all five tables
- Deliberately NOT added to Supabase Data API exposed schemas

Verified via Supabase SQL readback:
- exactly 5 QA tables, 42 unchanged public tables
- `has_schema_privilege('anon', ..., 'USAGE') = false`
- `has_schema_privilege('authenticated', ..., 'USAGE') = false`
- `has_table_privilege('anon', '...damage_records','SELECT') = false`
- `has_table_privilege('authenticated', '...damage_records','INSERT') = false`
- `relrowsecurity` enabled for damage records

## Critical distinction — this is foundation, not an end-to-end staging backend
The QA schema currently includes only the five damage-specific models and **does NOT yet implement the full Prisma backend data model**. Therefore:
- Do not point a production backend, customer-facing app, existing development UI, or generic `prisma db push` at this partial schema.
- Do not claim signed-in seller/outsider/dealer end-to-end tests have passed.
- Before a dedicated Fly staging backend can use it, safely complete the full Prisma schema in this private namespace from the reviewed GitHub schema and code, validate migration SQL, and configure environment-scoped database credentials with `?schema=carmazium_damage_qa` (or separate `search_path` with strict verification). Keep `public` untouched.
- Supabase Auth is project-wide, not schema-specific. Real staging sign-in needs isolated test accounts registered against the development Auth project. Do not inject rows into `auth.users` via ad-hoc SQL; use supported Auth admin flows. This migration created **no** Auth accounts.
- Storage buckets are project-scoped, not schema-scoped. A guarded QA upload namespace/bucket and policies must be planned and verified separately. Neither customer media nor public bucket configuration was copied into QA.

## Next release gates
1. Provision a full isolated Prisma schema and suitable staging backend using dedicated credentials, isolated Redis/session settings and no production integrations; verify it targets this project/schema.
2. Register test seller, outsider buyer, dealer owner, active/inactive staff, admin with explicit test identities; ensure no test notifications or payments reach real providers.
3. Test owner save/get, outsider denied save/get on draft, staff assigned vs unassigned, 2+ defects on same panel, HTTPS evidence upload retry, refresh/resume, buyer damage viewer only on active listings.
4. Retain PR #559 as draft until full CI, both previews, staging authenticated upload checks and a backend-first rollout plan are verified. Avoid accidental Fly production deployment.

## Safe inspection query (read only)
```sql
select table_name
from information_schema.tables
where table_schema = 'carmazium_damage_qa' and table_type = 'BASE TABLE'
order by table_name;
```

Do not edit or remove test records until the QA suite and cleanup script are agreed. Changes to this QA schema must remain separate from public development and production resources.
