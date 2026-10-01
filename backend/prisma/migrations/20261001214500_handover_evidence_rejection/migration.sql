-- Evidence rejection must never change the buyer fee or refund state.
ALTER TABLE "auctions"
  ADD COLUMN "handoverRejectedAt" TIMESTAMP(3),
  ADD COLUMN "handoverRejectionReason" TEXT;
