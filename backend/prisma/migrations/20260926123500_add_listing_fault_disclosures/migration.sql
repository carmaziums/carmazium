-- Seller-declared known vehicle faults.
ALTER TABLE "listings"
ADD COLUMN "mechanicalIssues" TEXT,
ADD COLUMN "electricalIssues" TEXT;
