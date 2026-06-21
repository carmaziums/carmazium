-- Migration: add_kyc_stripe_fields
-- Adds stripePaymentIntentId and stripeChargedAt to DealerKyc;
-- makes paymentReference nullable for Stripe-flow submissions.

ALTER TABLE "dealer_kycs"
  ALTER COLUMN "paymentReference" DROP NOT NULL;

ALTER TABLE "dealer_kycs"
  ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeChargedAt" TIMESTAMP(3);
