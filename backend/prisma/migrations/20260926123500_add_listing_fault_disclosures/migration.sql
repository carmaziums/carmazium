-- Seller-declared known vehicle faults.
ALTER TABLE "listings"
ADD COLUMN IF NOT EXISTS "mechanicalIssues" TEXT,
ADD COLUMN IF NOT EXISTS "electricalIssues" TEXT;
