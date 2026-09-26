-- KYC verification fees are account-level payments, not vehicle/listing payments.
-- Allow transaction rows without a listing and backfill every Stripe-confirmed
-- dealer KYC charge that is currently missing from the canonical ledger.
ALTER TABLE "transactions" ALTER COLUMN "listingId" DROP NOT NULL;

INSERT INTO "transactions" (
  "id",
  "listingId",
  "userId",
  "amount",
  "type",
  "status",
  "stripePaymentId",
  "description",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  NULL,
  dp."userId",
  1.00,
  'KYC_VERIFICATION'::"transaction_type",
  'COMPLETED'::"transaction_status",
  dk."stripePaymentIntentId",
  'One-time dealer identity verification fee',
  dk."stripeChargedAt",
  COALESCE(dk."updatedAt", dk."stripeChargedAt")
FROM "dealer_kycs" dk
JOIN "dealer_profiles" dp ON dp."id" = dk."dealerProfileId"
WHERE dk."stripeChargedAt" IS NOT NULL
  AND dk."stripePaymentIntentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "transactions" t
    WHERE t."stripePaymentId" = dk."stripePaymentIntentId"
  );
