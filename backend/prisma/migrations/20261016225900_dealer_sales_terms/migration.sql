-- Dealer-provided sales terms for buyer-facing listing descriptions.
-- Existing dealer profiles default to no claimed warranty or finance.
ALTER TABLE "dealer_profiles"
  ADD COLUMN IF NOT EXISTS "warrantyOffered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "warrantyDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "financeOffered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "financeDetails" TEXT;
