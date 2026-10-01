-- Preserve historical already-submitted handovers without fabricating a
-- seller attestation, but require real confirmation on all new submissions.
ALTER TABLE "auctions"
  ADD COLUMN "sellerFundsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "sellerFundsConfirmedById" TEXT,
  ADD COLUMN "sellerFundsConfirmationRequired" BOOLEAN NOT NULL DEFAULT TRUE;

-- Apply grandfathering ONLY to proof already submitted before deployment.
-- If one of these sellers ever has to upload new evidence, the submission
-- endpoint requires an explicit confirmation regardless of this exemption.
UPDATE "auctions"
SET "sellerFundsConfirmationRequired" = FALSE
WHERE "handoverSubmittedAt" IS NOT NULL
  AND ("handoverProofPath" IS NOT NULL OR "handoverProofUrl" IS NOT NULL);
