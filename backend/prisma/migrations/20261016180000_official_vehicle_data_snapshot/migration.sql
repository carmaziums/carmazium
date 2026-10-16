-- Additive storage for official government fields that do not have dedicated listing columns.
-- Existing listings remain unchanged; apply only through the controlled Prisma deployment gate.
ALTER TABLE "public"."listings" ADD COLUMN IF NOT EXISTS "officialVehicleData" JSONB;
