-- Additive only: existing KYC rows retain their current evidence requirements.
ALTER TABLE "dealer_kycs" ADD COLUMN IF NOT EXISTS "vatRegistered" BOOLEAN;
