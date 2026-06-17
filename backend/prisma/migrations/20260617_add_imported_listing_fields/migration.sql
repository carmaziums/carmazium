-- Add platform import tracking fields to listings
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "importedFromUrl" TEXT;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "importedSource" TEXT;

-- Register in prisma migrations table
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'manual', NOW(), '20260617_add_imported_listing_fields', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260617_add_imported_listing_fields'
);
