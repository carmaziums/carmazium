-- Historical ENDED auctions remain NULL and cannot be retroactively accepted.
ALTER TABLE "auctions"
    ADD COLUMN "provisionalOfferBidId" TEXT,
    ADD COLUMN "provisionalOfferedAt" TIMESTAMP(3);
