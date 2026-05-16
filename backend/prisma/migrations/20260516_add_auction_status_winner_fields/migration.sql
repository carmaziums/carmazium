-- Migration: add_auction_status_winner_fields
-- Run this in the Supabase SQL editor (or via prisma migrate deploy when DB is reachable)

-- 1. Create the auction_status enum type
CREATE TYPE "auction_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- 2. Add new columns to the auctions table
ALTER TABLE "auctions"
  ADD COLUMN "status"           "auction_status" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "winnerId"         UUID REFERENCES "users"("id"),
  ADD COLUMN "winningBidAmount" DECIMAL(12, 2);

-- 3. Add indexes for efficient lifecycle queries
CREATE INDEX "auctions_status_idx" ON "auctions"("status");
CREATE INDEX "auctions_endTime_idx" ON "auctions"("endTime");
