# TradeXchange service insurance standard — 22 November 2026

## Policy implemented

- Collection, delivery and recovery: current **Motor Trade Insurance** and **Public Liability Insurance**, each uploaded and admin-approved.
- Vehicle and cosmetic inspection: current **Public Liability Insurance** only. Motor Trade Insurance is not required for inspection-only applications.
- An eligible existing account may apply to both DELIVERY and INSPECTION; separate capabilities, documents, coverage areas, approval statuses and prior jobs are preserved. Finance/warranty central providers remain admin-managed, not created by toggling a dealer's own-listing badges.
- Each required insurance certificate must have an expiry date and appropriate service coverage; stored evidence is reviewed by staff. A service toggle never overrides verification or creates approval.
- The same business may use the same underlying liability policy for both activities if it covers both, but each service application is reviewed separately. No extra £1 dealer account-verification charge for adding a service.

## Migration and production impact

The production database preflight showed **one verified DELIVERY** and **one verified INSPECTION** capability without current approved Public Liability evidence as of 22 November 2026. They will require re-verification for NEW work under this policy. Existing accepted jobs, payments, applications, audit evidence and previous verification dates remain intact.

Migration file: `backend/prisma/migrations/20261121223000_provider_liability_reverification/migration.sql` is an idempotent data update. It sets only `verificationStatus` to `REVERIFICATION_REQUIRED` (and resets reminder flags) for currently VERIFIED delivery/inspection capabilities lacking current approved liability evidence. Historical verification timestamps/expiry are deliberately preserved.

**Important:** Production Fly `backend/fly.toml` intentionally has no Prisma migration release command. Deploying code **does not apply this migration**. Apply it as a separate authorised production SQL step after the new document upload UI is available and record a before/after count. Never run `prisma db push` or destructive schema reconciliation.

## Implementation and QA

The existing canonical TradeXchange hub is retained on website and original Android source. Document selectors and upload forms are driven by server-returned service requirements, rather than separate onboarding pages. Private evidence storage, admin approval and service-specific job eligibility remain server-gated. Current provider applications remain distinct; the old provider verification/settings URLs still redirect.

Checks performed: website/native TypeScript, targeted native insurance upload component tests, TradeXchange/document parity regression tests and the one-product parity check. Full backend CI and a Vercel preview must pass before production rollout. The public Android APK build 125 is untouched; publishing an updated signed customer APK is a separate guarded release step.
