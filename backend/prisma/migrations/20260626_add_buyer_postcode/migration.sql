-- Add buyerPostcode to sales table for customer area analytics
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "buyerPostcode" TEXT;
