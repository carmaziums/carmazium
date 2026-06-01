-- AddColumn: extended vehicle details requested by client
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "variant"        TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "driveType"      TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "numberOfKeys"   INTEGER;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "serviceHistory" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "owners"         TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "torqueNm"       INTEGER;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "topSpeedMph"    INTEGER;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "zeroTo60Mph"    DOUBLE PRECISION;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "combinedMpg"    DOUBLE PRECISION;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "extraUrbanMpg"  DOUBLE PRECISION;
