-- Historical ENDED auctions remain NULL and cannot be retroactively accepted.
ALTER TABLE "auctions"
    ADD COLUMN IF NOT EXISTS "provisionalOfferBidId" TEXT,
    ADD COLUMN IF NOT EXISTS "provisionalOfferedAt" TIMESTAMP(3);
