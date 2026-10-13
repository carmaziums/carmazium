# SimpleDMS production release attestation — live status 3 October 2026

**Decision: NO-GO for production partner credentials or live customer data.**
**Ready now:** reviewed public API documentation; isolated synthetic staging HTTPS
(`https://partner-api-synthetic-production.up.railway.app`), after a secure stage-only credential handoff subject to the partner accepting a synthetic test-only agreement.
This report does not constitute legal approval, an actual independent backup, a full production security cutover or permission to transmit live data.

## Independently verified engineering evidence

- [x] Isolated stage code candidate [PR #381](https://github.com/carmaziums/carmazium/pull/381) at `133e3fae03e3ece03aba4b3b5f971f1c2e7be05a` with six passing CI workflows, production/runtime image scan on previously tested technical commit zero critical/high.
- [x] Real public Railway HTTPS synthetic authenticated-list/detail/pagination/image/incorrect-key/missing-key testing, one-shot in-process random key revoked after success. [Proof PR #383](https://github.com/carmaziums/carmazium/pull/383) and [independent SUCCESS receipt](https://github.com/carmaziums/carmazium/actions/runs/37120493051). No live stock or partner key released.
- [x] Same Railway service returned to release-candidate branch with temporary test mechanism disabled, deployment `36762262-245f-465e-9d33-3b1447b12fd9` SUCCESS. Fresh independent public synthetic stage checks [PASS](https://github.com/carmaziums/carmazium/actions/runs/37112652690).
- [x] Narrow live DCL fix on previously empty `public.partner_profiles`: anon/authenticated table and API-key column SELECT removed, backend access preserved; separately read back and disposable PostgreSQL17 regression passed [PR #386](https://github.com/carmaziums/carmazium/pull/386).
- [x] Additional source-informed disposable PostgreSQL17 [five-helper and inherited CREATE rehearsal](https://github.com/carmaziums/carmazium/actions/runs/37126286159) passed, without any live schema-wide DCL writes or actual customer records.
- [x] [Independent seven-bucket encrypted backup implementation](https://github.com/carmaziums/carmazium/pull/382) improved to domain-separated HMAC-SHA256 v2 vault object keys, including 18/18 fully offline synthetic copy/recovery tests and locked AWS SDK import success [Actions run 37126429311]. This proves only the program's behaviour, **NOT a real protected backup**.

## Critical conditions still NOT completed

### Recovery (issue #364)
- [ ] Obtain owner-approved EXISTING privately controlled AWS S3 bucket in **eu-west-2** with all four public-access blocks, versioning, default reviewed KMS key, retention, restricted IAM no-delete policy and independent audit.
- [ ] Connect an approved separately encrypted PRIVATE operator machine (no connected Desktop Commander machine at current inspection); privately inject time-limited production Supabase Storage S3 read credentials, AWS IAM/KMS identity and independently stored strong HMAC key. DO NOT put secrets in GitHub, SimpleDMS email, chat, public web servers or the development project.
- [ ] Refresh exact seven-bucket read-only metadata inventory immediately before copy. Latest inspected baseline 3 October: **12,228** total objects: **12,160** public listings, **59** private KYC, **9** private auction handovers; four other buckets empty. Approve exact per-bucket count floors based on current legitimate changes.
- [ ] Execute the actual protected seven-bucket snapshot and get verified all-object independent bytes/SHA256, signed manifest and COMPLETE marker. **No actual export has occurred**.
- [ ] On separately isolated encrypted operator host WITHOUT any Supabase credentials, read and verify EVERY real destination object from the existing vault and physically restore isolated private samples. Record privacy-safe aggregate evidence only.
- [ ] Obtain current provider-managed database recovery-point evidence. Owner reports dashboard entry dated **2026-10-02 23:59**, display time zone unconfirmed; connected Supabase connector cannot read managed backup inventory, authenticate a provider physical download or restore safely to another project. **Do not restore over live production.**
- [ ] Restore a real managed backup or separately verified full logical backup into an already approved isolated production-equivalent PostgreSQL destination without using the live database or a new paid Supabase branch. Verify all 63 public base tables / 939 public columns / 41 current public RLS policies / 10 public functions (same schema-version fingerprints in PR #386), critical roles, auth and transaction consistency; verify backup age and retention; record verified rollback and break-glass.
- [ ] Approve ongoing offsite backup schedule, alerting, actual recovery objectives and periodic drills.

### Production hardening (issue #356)
- [ ] After actual recovery, validate exact production-equivalent full-schema sessions/Prisma/pg pool, signup, KYC, dealer team, bidding, concurrency, finance/refunds, handover and admin workflows on a restricted runtime login under representative synthetic data.
- [ ] Current inherited `CREATE ON SCHEMA public` privilege remains on both anon/authenticated; apply tested narrow revoke only in a supervised change window with real backup available, live post-change/rollback monitoring and formal operator sign-off. This was NOT modified in the October programme.
- [ ] On same staged cutover, remediate the five authenticated-only SECURITY DEFINER function search paths without opening access or breaking role checks; test canonical dealer/seller/admin policies. Correct broader client column exposure (users passwordHash/bank fields, empty vehicles' VIN/VRM, selected retail listing VIN/precise locations) with source-verified backend/web/native usage and privacy approval. Do not blindly revoke table SELECT from public listings.
- [ ] Switch actual public backend login from postgres to dedicated least-privilege role only after tested session migrations, backup/service account separation and exact rollback plan. The synthetic tests are NOT acceptance for a full real change.

### Contract/privacy (signature-candidate PR #387)
- [ ] Confirm SimpleDMS official CURRENT registered address and Patricia Jean Abel signatory authority against a current official company profile. CarMazium Ltd number 17053307 and director Afaq Iftikhar were verified against the available UK Companies House listings, subject to signing-date recheck.
- [ ] Agree and sign main 90-day free no-renewal pilot terms and *explicit YES/NO field-level* Schedule A.
- [ ] **Separately** negotiate and sign optional historical Schedule B: Stephen's proposed up-to-36-month minimal records/reports are NOT already approved, and post-termination new report generation requires explicit selection. VRM matching tokens remain potentially personal and require approved keyed design, lawful basis and deletion controls. No source image archive.
- [ ] Confirm actual Vercel/Supabase account hosting+backup/log regions, contracts, retention, onward transfer and relevant UK GDPR controller/processor agreement. Optional OpenAI input schedule OFF absent explicit approval and account-specific configuration.
- [ ] CarMazium verifies seller photo syndication rights, privacy/attribution consent where required and any reporting claims. Stephen was sent a non-binding follow-up requesting the outstanding evidence on 3 October 2026; this is not a signed agreement.
- [ ] After ALL recovery/security/legal conditions pass, issue dedicated raw stage credential through a controlled private channel, test actual SimpleDMS external traffic (synthetic only), separately generate production credential and execute both-party signed launch and rollback/kill-switch checklist. The **90-day** clock starts only on mutually acknowledged production integration go-live.

## Changes forbidden until these conditions pass

Never create an unapproved paid Supabase branch, use CarMazium Development as a substitute production recovery destination, restore the managed backup over production, copy KYC or handover files into CI artifacts or public GitHub, supply SimpleDMS any live API key or turn on production partner feed optional data flags before contractual acceptance. Synthetic pass evidence must remain labelled SYNTHETIC. Any real emergency recovery approval must name the independent destination and operator and record the expected provider costs.

**Next required external action:** connect the separately authorised private runner with an already-approved independent UK encrypted vault and privately configured credentials, and obtain signed SimpleDMS terms. Without these, the pending tasks cannot truthfully be marked complete.
