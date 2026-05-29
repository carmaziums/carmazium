-- Add geocoding coordinates to listings table
-- Safe to re-run (IF NOT EXISTS guards)
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
