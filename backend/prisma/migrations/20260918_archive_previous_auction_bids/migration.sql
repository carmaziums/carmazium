-- Separate bids from previous auction runs when a vehicle is re-auctioned.
-- Historical bids stay in the table but archived bids are excluded from all
-- live-auction calculations.

ALTER TABLE "bids"
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Repair auctions that have already been re-listed: any bid placed before the
-- current auction's start time cannot belong to the current run.
UPDATE "bids" AS b
SET "archivedAt" = a."startTime"
FROM "auctions" AS a
WHERE b."listingId" = a."listingId"
  AND a."status" IN ('SCHEDULED', 'ACTIVE')
  AND b."deletedAt" IS NULL
  AND b."cancelledAt" IS NULL
  AND b."archivedAt" IS NULL
  AND b."createdAt" < a."startTime";

CREATE INDEX "bids_listingId_archivedAt_idx"
ON "bids"("listingId", "archivedAt");
