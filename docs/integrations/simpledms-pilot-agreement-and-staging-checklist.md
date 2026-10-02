# SimpleDMS × CarMazium — proposed data schedule and staging acceptance checklist

**Draft for mutual written approval, not an executed contract or permission to access production.**

## Commercial parameters already agreed in email

- Initial integration and first **90 days after production launch** are free.
- No subscription, automatic renewal, exclusivity or financial commitment after
  the pilot. Both sides must affirmatively agree on any later commercial terms.
- CarMazium operates identity verification, auction bidding, payments and
  transactions. SimpleDMS provides its own stock-research and display layer.

## Proposed data schedule — confirm with both parties before activation

1. **Permitted purpose:** ingest approved active auctions into BuySmart for dealer
   discovery, CarMazium vehicle analysis, partner reporting and linking back to
   CarMazium. No onward resale, redistribution, unrelated profiling or model
   training. CarMazium remains the canonical vehicle/status source.
2. **Authorised fields:** public listing vehicle specifications and approved
   public photographs; enable VRM, current valid bid (never reserve or bidder
   identity) and approved town/region only after explicit field-level sign-off.
   Do not expose any seller address, contact, VIN, ID records, private documents
   or internal valuation. Only allowlisted literal towns/regions are supplied;
   unstructured addresses are never parsed and shared.
3. **Refresh:** target complete authenticated pagination every 2–5 minutes.
   On each completed snapshot, remove disappeared, ended and withdrawn entries.
   If synchronisation fails or records are stale, remove or mark unavailable
   rather than continue to advertise them as live; propose a 15-minute maximum
   freshness threshold, subject to acceptance testing.
4. **Temporary processing:** caching is permitted *only* for the above purpose,
   on secured partner-controlled infrastructure with restricted access.
   Proposed maximum identifiable/raw vehicle cache retention is while live
   plus up to 24 hours for reconciliation; remove records sooner after a
   successful disappearance snapshot. Do not keep a historic per-VRM corpus
   without a separate permission. Image copies, if necessary, must follow the
   same withdrawal/delete schedule.
5. **Trial termination:** revoke keys immediately. Proposed deletion deadline
   for stored identifiable/raw partner-supplied data is 7 calendar days after
   termination; confirm archival/legal-retention exceptions in writing and
   provide deletion confirmation. Aggregate non-identifying trial totals may
   be retained for the agreed review period.
6. **Rights and security:** CarMazium retains rights in its source data; verify
   that the platform has rights to syndicate sellers' photographs before
   enabling images. Partner must supply security contact, hosting region,
   subcontractor details and incident process. Agree the actual UK GDPR
   controller/processor roles and appropriate contractual clauses with legal
   review; do not assume one company's technical role determines its legal role.
7. **Reporting:** SimpleDMS supplies aggregate inventory impressions, vehicle
   views, BuySmart reports and outbound clicks; CarMazium supplies only
   aggregate, server-verified attributed account/bid/approved-handover figures
   where legally appropriate. Never exchange personal buyer identities.
   First-party click-to-account attribution must remain disabled until the
   privacy notice and lawful-basis review is complete.
8. **Access:** partner API remains read-only, individually authenticated and
   revocable. No staff/admin, bidding, account, session or payment credentials
   may be shared. Use a separate *staging* credential, then rotate to a
   production key only after sign-off.

## Staging release gates

- [ ] Confirm independent staging backend and frontend origins; neither test
      traffic nor test keys should point to production as a fallback.
- [ ] Confirm the staging database holds non-sensitive test auctions with
      approved public photos and test VRMs; do not provide real customer
      personal data in a third-party staging environment.
- [ ] Run fresh backend typecheck, partner tests, full CI and web typecheck
      against the exact proposed release commit.
- [ ] Disabled/missing/incorrect partner key cannot retrieve listings; check
      404/401 behaviour, key rotation and immediate per-partner revocation.
- [ ] 25/50 pagination, live totals, started/unexpired gate, cancelled and
      withdrawn disappearances, and 2–5 minute refresh tested end to end.
- [ ] Allowlisted public image URLs load successfully from outside CarMazium,
      while KYC/private/signed images cannot leak, including editor fragments.
- [ ] Registration, current-bid and location flags independently tested ON/OFF;
      the region field must be null unless the exact town is allowlisted.
- [ ] Verify real auction URLs and referral URLs; signed referral tampering,
      expiration and disabled attribution must fail closed.
- [ ] Verify backend report deduplication, bids/sales from canonical records,
      and no PII in reports. Confirm staff/business attribution limitations.
- [ ] Monitor 15-minute freshness and backend rate/DB load using simulated
      periodic full-feed reconciliation.
- [ ] Agree final signed data schedule, launch date, contact points, deletion
      SLA, photo rights and account/referral privacy disclosures.
- [ ] Issue a dedicated **staging-only** credential through a secure channel,
      not email body, code, logs or documentation.
- [ ] After joint written sign-off, separately approve the production deploy,
      production key creation and activation. Begin the 90-day clock only
      when the BuySmart production integration is working.

This document records **proposed** technical and data-handling terms pending
both parties' approval; it does not modify the October 2026 email agreement.
