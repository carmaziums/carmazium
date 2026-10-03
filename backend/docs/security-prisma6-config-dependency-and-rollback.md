# Prisma 6.19.3: narrowly scoped dependency-advisory remediation

This is a separate backend security change **stacked on bcrypt6 PR #373**, which itself depends on compatible-lockfile PR #371. The ten-block valuation candidate PR #367 is *not* involved in this change and retains its independent whole-programme rollback.

## Grounded finding (3 October 2026)

Inspecting the **actual post-bcrypt6 CarMazium lockfile** showed:

- Installed Prisma CLI is already `6.19.3`, yet installed `@prisma/client` is `6.19.2`; they need deterministic exact-version alignment.
- Installed `@prisma/config@6.19.3` already depends on **`effect@3.21.0`**, which exceeds the independently documented security fix floor **3.20.0**. Do not downgrade to Prisma 6.12 or upgrade to Prisma 7 merely because npm audit suggests it.
- `@prisma/config@6.19.3` still has an **exact upstream dependency on `deepmerge-ts@7.1.5`**, which is affected by [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx); the fix is **8.0.0 or later**. The upstream issue [prisma/orm#30052](https://github.com/prisma/orm/issues/30052) also documents the major-version behaviour caveat and downstream scoped override workaround. An upstream patch to the Prisma **7** branch is not grounds for a risky migration from CarMazium's generated Prisma 6 client.

The prior audit counted **0 critical / 3 high** because its indirect chain counts `prisma`, `@prisma/config` and `deepmerge-ts` separately, even though the observed vulnerable package is one `deepmerge-ts` dependency. This is npm's dependency reachability reporting; the vulnerability is in a configuration merge normally processing operator-owned schema/configuration, **not a demonstrated attack via the customer listing or payment APIs**. Treat zero critical/high scanning as necessary security hygiene, not proof of invulnerability.

## Proposed isolated correction

- Pin the CLI and generated client as one **`prisma@6.19.3` / `@prisma/client@6.19.3`** pair; do not migrate schema, modify Prisma data, change generators, change any auction logic or force-deprecate the current database. Retain bcrypt **6.0.0**, including previously verified old-hash compatibility.
- Add only this nested npm override under **`backend/package.json`**:
  ```json
  "overrides": {
    "@prisma/config": { "deepmerge-ts": "8.0.2" }
  }
  ```
  Do not apply a global override that might rewrite unrelated consumers of the same library. Upstream warns that this is a major dependency jump affecting some Map merge behaviour; CarMazium's real Prisma config/schema validation is required.
- Regenerate the actual lockfile using `npm install --package-lock-only --ignore-scripts`, without an audit-force downgrade or changing source code. Verify the exact locked versions and **0 critical / 0 high** in a separate `npm audit --package-lock-only --omit=dev` output. If unresolved: **STOP**, record exact cause and do not publish any proposed lockfile.
- Run `npm ci` from the resulting lockfile, the scoped dependency/config read-only smoke test, `prisma validate`, `prisma generate`, and schema-only `prisma migrate diff --from-empty --to-schema-datamodel` with synthetic placeholder database URLs. This is *not* a migration or a live database query. Compare the actual schema-only migration output with the prior Prisma CLI 6.19.3 where possible. Do not run `migrate deploy`, `db push` or use an actual production URL.
- Run **all backend Jest tests**, TypeScript checks and backend production build. Existing backward-compatible bcrypt hash tests must still pass. Do not use external customer data.
- Temporarily allow a tightly scoped GitHub CI job to commit the **backend lockfile only** after every test passes; then delete that temporary writer workflow, and run the normal backend, chat, parity and release-certification checks on the exact final PR HEAD. Restore its stacked base to bcrypt6 PR #373 after any temporary `main` targeting for CI.

## Ongoing release controls

Any future package upgrade or removal of the override must be supported by a fresh lockfile audit and a real Prisma config/gen smoke test, with a changelog review for deepmerge 8 semantics. This is security maintenance and **must survive** a customer-requested rollback of all 10 valuation blocks. It is not included in the 51-file valuation manifest.

Until a separate security deployment has been approved, the published `main` branch continues using its existing dependency graph. Live staging on the actual Fly.io Node image, safe backout and full API regression evidence are independent requirements before production. No paid Supabase branch, migrations, production writes or valuations rollout are authorised by this PR.
