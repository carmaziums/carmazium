-- A recorded provisional below-reserve offer expires after 72 hours.
-- Preserve the expired bid identity and timestamp for auditable, buyer-visible outcomes.
-- No sales, payments, original bid rows, or customer decisions are modified by this migration.
ALTER TABLE "auctions"
  ADD COLUMN IF NOT EXISTS "provisionalExpiredBidId" TEXT,
  ADD COLUMN IF NOT EXISTS "provisionalExpiredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "auctions_provisional_expiry_candidates"
  ON "auctions" ("provisionalOfferedAt")
  WHERE "provisionalOfferBidId" IS NOT NULL AND status = 'ENDED';
