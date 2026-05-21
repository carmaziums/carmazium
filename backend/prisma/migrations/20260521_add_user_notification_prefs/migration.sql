-- Add notification preference fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifyOnSale" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showPublicProfile" BOOLEAN NOT NULL DEFAULT true;

-- Add purchaseStatus enum and field to sales table (if not already applied)
DO $$ BEGIN
    CREATE TYPE "purchase_status" AS ENUM ('AWAITING_CONFIRMATION', 'REVIEWING_DOCS', 'CHECKS_COMPLETE', 'DELIVERY_REQUESTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "purchaseStatus" "purchase_status" NOT NULL DEFAULT 'AWAITING_CONFIRMATION';
