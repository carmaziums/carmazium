# Approved auction conversion rollout

Status: staged code, disabled by default. This does not repair live bidding until the deployment and Google configuration below are completed.

The existing website Google Ads qualified-seller action counts auction submission to pending review. This feature creates a distinct `auction_listing_approved` GA4 event from the canonical admin approval transaction. Verified retail payment tracking is preserved. Meta browser/CAPI tracking is outside this change; do not add a second Meta sender as part of this rollout.

## Deployment sequence

1. Run the migration and generate Prisma before enabling the backend. Check it against a staging PostgreSQL database, including concurrent capture/approval/revocation. Unit tests mock the database and do not establish real database concurrency behavior.
2. Create a Measurement Protocol API secret for main web stream `G-MR12LCBSXY` in GA4 property `549182278`. Store it only in the backend secret manager as `GA4_MEASUREMENT_PROTOCOL_API_SECRET`. Set backend `GA4_MEASUREMENT_ID=G-MR12LCBSXY`. Never put this secret in Git, logs, a public build variable, or a client request.
3. Validate the payload against Google's Measurement Protocol debug endpoint using a separate test property. Check consent rejection/revocation, non-owner and admin rejection, no event at pending review, exactly one send attempt after approval, and no attempt after resubmission. An HTTP 2xx from collect only acknowledges receipt; it does not prove processing or attribution.
4. Deploy backend `GA4_APPROVED_AUCTIONS_ENABLED=true` and build web with `NEXT_PUBLIC_APPROVED_AUCTION_ATTRIBUTION=true` and the matching `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Keep `NEXT_PUBLIC_GADS_AUCTION_APPROVAL_ONLY` false initially. Observe genuine consented approval events and source/campaign attribution in GA4. Do not fabricate production seller listings or payments for validation.
5. Mark `auction_listing_approved` as a GA4 key event and import it into Google Ads account `699-823-8086` as a separate conversion action, initially Secondary, Count One, no fictional monetary value. Confirm Google Ads attribution on real traffic before bidding on it. Keep generic `form_submit` and submission events out of primary bidding goals.
6. For the coordinated cutover, first rebuild the frontend with `NEXT_PUBLIC_GADS_AUCTION_APPROVAL_ONLY=true` and verify auction submission no longer sends the old website qualified-seller action. That website action still receives qualified paid retail events. Then enable the new imported approval action as Primary in the seller campaign's goals. Existing cached clients can temporarily retain old submission behavior; monitor this transition and avoid interpreting it as incremental conversions.
7. Verify accepted auction counts against canonical approvals and eligible outbox records; verify paid retail conversions remain correct. No campaign budgets, brand £1 target, or seller £20 target should be changed to perform this rollout.

## Delivery and privacy limits

- Capture requires an authenticated owner of a non-admin auction listing, analytics/marketing acceptance, and actual GA browser client ID. Native app submissions, visitors without consent, unavailable Google tags, and old listings are not invented or backfilled.
- The server writes a consent decision and a unique per-listing record. Approval queues only the captured record in the approval transaction. Workers claim pending records atomically. Consent is rechecked at claim time; a withdrawal cannot recall an already claimed/sent request.
- Sends use the actual approval timestamp and EU collection endpoint. They contain client/session IDs and internal listing ID, not names, email, VRM, payment information, or invented revenue. Session linkage is included only within 24 hours of the recorded GA session start. Delivery must occur within 48 hours of capture. Late approvals remain visible in first-party analytics but are omitted from this GA export.
- This provides at-most-one automatic send attempt per listing, not guaranteed exactly-once delivery. The custom `event_id` is diagnostic and is not assumed to deduplicate GA4 custom events. Failed, timed-out or crash-interrupted sends are not automatically replayed.
- `ACKNOWLEDGED` means HTTP success only. `UNCERTAIN`/`FAILED` require manual reconciliation; `DISPATCHING` may mean a worker crashed. Reconcile against GA4 before taking action. Do not reset state to PENDING blindly.
- Client/session IDs are erased after each attempt or queued consent withdrawal. An hourly job erases remaining IDs after 48 hours; this can retain an expired ID for up to roughly one additional hour. Deleting the user/listing cascades its records. Internal listing IDs, outcome states and consent decisions remain for operational auditing.
- Revocation uses an authenticated best-effort request, retried on subsequent page loads with rejected consent. It cannot guarantee delivery while offline; check this limitation against the site's privacy requirements before activation.

## Rollback

Restore the previous browser flag and campaign goal configuration together if reverting bidding. Disable new capture and sending, but erase remaining client/session IDs from these two tables before leaving the backend feature disabled (the retention worker is also gated). Keep historical dispatch states so re-enabling cannot replay old approved listings. Do not delete the migration or drop tables during a live rollback.

## References

- https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
- https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events

No production API secret, migration execution, live GA4 event validation, or Google Ads goal cutover is included in this code change.
