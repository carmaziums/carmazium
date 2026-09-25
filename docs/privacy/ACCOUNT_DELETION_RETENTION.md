# CarMazium Account Deletion and Retention Rules

**Effective:** 25 September 2026

This document is the engineering contract for account deletion. It exists so the website, iPhone app, Android app, backend and privacy copy describe the same behaviour.

## Immediate deletion / erasure

When a user successfully deletes an account, CarMazium removes or anonymises the following immediately after the live-auction safety checks pass:

- Supabase Auth identity, identities/sessions and refresh-token access through a hard Auth deletion.
- Storage objects owned by the Supabase user.
- Dealer / sole-trader KYC identity documents in private Storage.
- Legacy KYC documents previously referenced from public Storage.
- Profile image and dealer logo where they are CarMazium Storage objects.
- Vehicle-listing images uploaded by the deleting seller.
- Private chat attachment files sent by the deleting user.
- Dealer KYC application row.
- Name, email, phone, bank details, profile image, location, postcode, preferences and verification flags on the application user record.
- Dealer or sole-trader company/contact/profile details that could identify the deleted account.
- Contractor business/contact/service-area/certification profile details.
- Partner company/callback/API-key details; partner access is deactivated.
- Address-verification records.
- Notifications.
- Watchlist records.
- User-linked analytics events.
- Unfinished/rejected finance applications.
- Unaccepted insurance quote requests.
- Personal/contact/financial-preference data in TradeXchange Finance/Warranty leads.
- Dealer CRM buyer name/email/phone snapshots tied to the deleting buyer.
- Buyer name/email/postcode snapshots on retained sales.
- Free-text seller-review comments authored by the deleting user.
- Private attachment pointers on retained chat messages.
- Listing descriptions, videos and precise location fields on the deleting seller's retained historical listing rows.

Unfinished listings are withdrawn. Dealer-team memberships belonging to the deleting person are removed. Staff/invites under a deleted dealer business are disabled or removed.

## Records retained in pseudonymous form

CarMazium does not hard-delete its application User row because shared marketplace records use that row as a referential anchor. The retained row is marked deleted and reduced to a generated `deleted-<uuid>@deleted.carmazium.com` identity with no contact/profile/location/bank data and no ability to authenticate.

The following may remain where necessary for a transaction, accounting, refund/chargeback, fraud, platform-safety, legal-claim or dispute purpose:

- completed transactions and Stripe payment identifiers;
- Stripe customer / Connect identifiers where a refund, chargeback or unsettled payout may still need reconciliation;
- auction bids and offers;
- completed sales and auction outcomes;
- completed/accepted finance or insurance records;
- service-job/payment/settlement history;
- sale-cancellation and dispute records;
- moderation reports and their evidence snapshots;
- transactional/support/dispute chat text after private attachment files are removed;
- audit facts such as timestamps, amounts, statuses and non-identifying vehicle/transaction details.

These records must not be reused for marketing, profiling or new customer contact after deletion.

## Access after deletion

Deleting the Supabase Auth user removes refresh sessions. An already-issued JWT can remain cryptographically valid until its normal expiry, so the CarMazium backend independently rejects every application User row with `deletedAt` set. This prevents a stale token or an old backend session from restoring account access.

## Failure behaviour

Deletion is fail-closed:

1. If a live seller auction or active live bid exists, deletion is refused before anything is erased.
2. If Storage cleanup fails, Auth and application data are not reported as deleted.
3. If Supabase Auth hard deletion fails, the application anonymisation transaction is not run and the request reports failure.
4. The local anonymisation step is one Prisma transaction so partial application-data erasure cannot be committed inside that phase.

## Future retention expiry

This deletion path defines what is erased immediately and what may survive for a legitimate record-keeping purpose. Separate scheduled retention rules should eventually purge retained records when their legal/operational retention purpose expires. A retained record is not permission to keep personal data indefinitely.
