-- Tracks when an auction winner was determined, so an unpaid buyer fee can
-- auto-revert the win after a grace window instead of holding the listing
-- SOLD forever with no path back to being purchasable.
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "wonAt" TIMESTAMP(3);
