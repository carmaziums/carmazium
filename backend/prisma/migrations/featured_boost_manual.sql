-- ============================================================
-- Featured Listing Boost — Migration SQL (corrected)
-- Paste into: https://supabase.com/dashboard/project/qcqnllehtuczgammazwi/sql
-- ============================================================

-- 1. Add featured columns to the listings table
ALTER TABLE "listings"
  ADD COLUMN IF NOT EXISTS "isFeatured"    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featuredUntil" TIMESTAMP(3);

-- 2. Create the featured_boosts table
CREATE TABLE IF NOT EXISTS "featured_boosts" (
  "id"               TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "listingId"        TEXT          NOT NULL,
  "sellerId"         TEXT          NOT NULL,
  "stripeSessionId"  TEXT          UNIQUE,
  "stripePaymentId"  TEXT          UNIQUE,
  "amountPaid"       DECIMAL(10,2) NOT NULL DEFAULT 25.00,
  "currency"         TEXT          NOT NULL DEFAULT 'gbp',
  "boostedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3)  NOT NULL,
  "isActive"         BOOLEAN       NOT NULL DEFAULT false,
  "bypassed"         BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "featured_boosts_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign key constraints
ALTER TABLE "featured_boosts"
  ADD CONSTRAINT "featured_boosts_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "featured_boosts_sellerId_fkey"
    FOREIGN KEY ("sellerId")  REFERENCES "users"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS "featured_boosts_listingId_idx" ON "featured_boosts"("listingId");
CREATE INDEX IF NOT EXISTS "featured_boosts_sellerId_idx"  ON "featured_boosts"("sellerId");
CREATE INDEX IF NOT EXISTS "featured_boosts_expiresAt_idx" ON "featured_boosts"("expiresAt");
CREATE INDEX IF NOT EXISTS "featured_boosts_isActive_idx"  ON "featured_boosts"("isActive");
CREATE INDEX IF NOT EXISTS "listings_isFeatured_idx"       ON "listings"("isFeatured");
