-- Phase 12: Buy It Now + Cancel Bid fat-finger window
-- Adds BIN tracking fields to auctions and cancelledAt to bids
-- All columns nullable — zero-downtime migration

-- Auction: Buy It Now optional price
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "buyItNowPrice" DECIMAL(12,2);

-- Auction: BIN pending state tracking (no new enum value needed)
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "buyItNowPendingBuyerId" TEXT;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "buyItNowPendingAt" TIMESTAMP;

-- Bid: soft-cancel audit trail (distinct from deletedAt for admin visibility)
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP;
