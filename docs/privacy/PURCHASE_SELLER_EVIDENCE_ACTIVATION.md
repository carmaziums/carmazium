# Purchase Seller Evidence — Activation and Privacy Checklist

**Status:** Code staged, capture disabled by default. **Do not set `PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED=true` on production until this checklist has been signed off.**

## Purpose and data boundaries

The buyer needs a reliable accounting record of the seller who supplied a vehicle, the advertised asking price and the separately agreed purchase price. CarMazium acts as the marketplace, not as the seller, and does not independently verify bank-to-bank vehicle payment.

The proposed private evidence record captures only seller legal/trading name, seller account reference, on-file email and phone, on-file business address or email-code-confirmed postal address, company and VAT identifiers where held, and the listing's price at capture. It stores the exact capture timestamp and sale-recorded timestamp. It does **not** include any KYC scan, photo ID, passport, bank or payout details, password, private seller notes or chat data.

**Accuracy:** the existing address flow emails a code to the user's account. This does not independently confirm the user resides at the address. Buyer-facing labels must say `Account-confirmed postal address`, not `Verified residence`. Business addresses are marked as business addresses on file; neither type proves vehicle collection location.

## Required approval before enabling

- [ ] Establish and document lawful purpose/basis, necessity and safeguards for each field in the private transaction record.
- [ ] Publish and notify affected sellers of the exact categories of information disclosed to their eventual buyer, the trigger, rights and retention.
- [ ] Set a justified retention window for identifying details, along with retention-expiry and deletion/anonymisation jobs; do not assume that all purchase data can be retained forever.
- [ ] Resolve conflict with `docs/privacy/ACCOUNT_DELETION_RETENTION.md`: account deletion currently erases identifying profile information, but a private legal snapshot would preserve it. Implement data-protection review, correction/suppression and deletion where required, distinct from non-identifying audit facts.
- [ ] Provide versioned correction records and an authorised buyer notice when a previously stored address or contact field was inaccurate. The original capture must not be silently overwritten or represented as current.
- [ ] Apply `backend/prisma/migrations/20261104175000_purchase_seller_legal_snapshots/migration.sql` only to the intended project; check RLS on, direct anon/authenticated permissions off, and no public Data API exposure.
- [ ] Verify all GET endpoints, PDFs, staff roles and buyer fee gates with authorised accounts; do not create test cars on live.
- [ ] Confirm only buyer-accessible evidence is generated for completed, paid/unlocked purchase records. Legacy recovered purchases must retain their original sellers' listings, not later resale stock.
- [ ] Have a privacy/data-protection owner approve activation, and monitor capture failures without putting seller PII into logs.

## Technical controls already staged

The snapshot is **off** unless `PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED === 'true'`. When enabled, only a real Sale with a matching buyer is eligible. Capture uses an idempotent first-write-wins upsert; a later seller account edit cannot silently rewrite that version. A later capture is explicitly labelled as such; it is never backdated to a historic vehicle listing. PDF reads remain behind existing `VIEW_PURCHASES` checks and auction buyer-fee restrictions. The original Sales, auction fee, collection status and later resale listing state are not changed.

## Existing completed buyers

For old sales where no contemporaneous private snapshot exists, the PDF explicitly identifies the seller information as **current account information**, not a historical assertion. Missing contact/address fields show `Not recorded` and the buyer should retain the seller-issued receipt and banking evidence. Do not populate old seller identity snapshots retroactively as if they were captured at the original transaction.

References: GitHub #786. UK ICO data protection principles: https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/data-protection-principles-definitions-and-key-terms
