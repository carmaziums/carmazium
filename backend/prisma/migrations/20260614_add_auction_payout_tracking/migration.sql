-- Track Stripe payout transfer ID and any failure message on the auction
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "stripePayoutTransferId" TEXT;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "stripePayoutError" TEXT;
