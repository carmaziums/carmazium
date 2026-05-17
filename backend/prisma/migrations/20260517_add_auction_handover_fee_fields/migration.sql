-- Migration: add_auction_handover_fee_fields
-- Adds buyer fee tracking and handover proof fields to the auctions table.
-- Run this in the Supabase SQL editor (or via `prisma migrate deploy` when DB is reachable).

ALTER TABLE "auctions"
  ADD COLUMN IF NOT EXISTS "buyerFeePaid"          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "buyerFeeTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "handoverProofUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "handoverSubmittedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "sellerBonusReleased"   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "sellerBonusReleasedAt" TIMESTAMPTZ;
