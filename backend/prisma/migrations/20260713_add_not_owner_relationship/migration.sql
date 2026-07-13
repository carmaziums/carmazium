-- Add notOwnerRelationship to listings: captures the seller's relationship to the
-- vehicle's legal registered keeper when the seller is not the keeper themselves.
-- Nullable column — zero-downtime migration.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "notOwnerRelationship" TEXT;
