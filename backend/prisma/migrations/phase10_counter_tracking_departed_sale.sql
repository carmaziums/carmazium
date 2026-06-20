-- Phase 10: Counter tracking + departed sale fields
-- Applied via: npx prisma db push (remote Supabase, no local DB access)

-- Listing model: departed sale fields
ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "isDepartedSale"       BOOLEAN,
  ADD COLUMN IF NOT EXISTS "departedRelationship" TEXT;

-- Offer model: counter attempt tracking fields
ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "counterAttemptsBuyer"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "counterAttemptsSeller" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "counterExpiresAt"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastCounteredBy"       TEXT;
